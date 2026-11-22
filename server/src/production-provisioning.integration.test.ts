import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ExistingAccountConflictError,
  provisionProductionAccounts,
  type ProductionAccount,
  type ProvisioningClient,
} from "./production-provisioning.js";
import { isIsolatedTestDatabase } from "./test-database.js";
import { verifyPassword } from "./security.js";

const isolatedDatabase = isIsolatedTestDatabase();
const firstClient = new PrismaClient();
const secondClient = new PrismaClient();
let cleanupIdentifiers: string[] = [];

function makeAccounts(): ProductionAccount[] {
  const suffix = randomUUID().replaceAll("-", "");
  const accounts: ProductionAccount[] = [
    {
      loginIdentifier: "provision-organizer-" + suffix + "@example.test",
      displayName: "Integration Test Organizer",
      role: Role.ORGANIZER,
      password: "test-organizer-provisioning-passphrase",
    },
    {
      loginIdentifier: "provision-participant-" + suffix + "@example.test",
      displayName: "Integration Test Participant",
      role: Role.PARTICIPANT,
      password: "test-participant-provisioning-passphrase",
    },
  ];
  cleanupIdentifiers.push(...accounts.map(({ loginIdentifier }) => loginIdentifier));
  return accounts;
}

function makeReadBarrier(): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const allArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrived += 1;
    if (arrived === 2) release();
    await allArrived;
  };
}

function withReadBarrier(database: PrismaClient, waitForBothReads: () => Promise<void>): ProvisioningClient {
  const transaction = async <T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => database.$transaction(async (tx) => {
    const gatedTransaction = {
      user: {
        findMany: async (args: Prisma.UserFindManyArgs) => {
          const rows = await tx.user.findMany(args);
          await waitForBothReads();
          return rows;
        },
        create: tx.user.create.bind(tx.user),
      },
    } as unknown as Prisma.TransactionClient;
    return callback(gatedTransaction);
  });

  return {
    user: database.user,
    $transaction: transaction,
  } as ProvisioningClient;
}

describe.skipIf(!isolatedDatabase)("production account provisioning against isolated PostgreSQL", () => {
  beforeAll(async () => {
    await Promise.all([firstClient.$connect(), secondClient.$connect()]);
  });

  afterEach(async () => {
    if (cleanupIdentifiers.length > 0) {
      await firstClient.user.deleteMany({
        where: {
          loginIdentifier: {
            in: cleanupIdentifiers,
            mode: "insensitive",
          },
        },
      });
      cleanupIdentifiers = [];
    }
  });

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it("enforces case-insensitive uniqueness in PostgreSQL", async () => {
    const identifier = "case-check-" + randomUUID() + "@example.test";
    cleanupIdentifiers.push(identifier);

    await firstClient.user.create({
      data: {
        loginIdentifier: identifier,
        displayName: "Case Check",
        role: Role.ORGANIZER,
        passwordHash: "test-only-hash",
      },
    });

    await expect(firstClient.user.create({
      data: {
        loginIdentifier: identifier.toUpperCase(),
        displayName: "Case Check Duplicate",
        role: Role.PARTICIPANT,
        passwordHash: "test-only-hash",
      },
    })).rejects.toMatchObject({ code: "P2002" });
  });

  it("reconciles two simultaneous executions after one loses the unique-index race", async () => {
    const accounts = makeAccounts();
    const waitForBothReads = makeReadBarrier();

    const [firstResult, secondResult] = await Promise.all([
      provisionProductionAccounts(withReadBarrier(firstClient, waitForBothReads), accounts),
      provisionProductionAccounts(withReadBarrier(secondClient, waitForBothReads), accounts),
    ]);

    const allResults = [...firstResult, ...secondResult];
    expect(allResults.filter(({ status }) => status === "created")).toHaveLength(2);
    expect(allResults.filter(({ status }) => status === "existing-unchanged")).toHaveLength(2);

    const users = await firstClient.user.findMany({
      where: {
        loginIdentifier: {
          in: accounts.map(({ loginIdentifier }) => loginIdentifier),
          mode: "insensitive",
        },
      },
    });
    expect(users).toHaveLength(2);
    for (const account of accounts) {
      const user = users.find(({ loginIdentifier }) => loginIdentifier === account.loginIdentifier);
      expect(user?.role).toBe(account.role);
      expect(await verifyPassword(account.password, user!.passwordHash)).toBe(true);
    }
  });

  it("is idempotent and does not replace existing password hashes", async () => {
    const accounts = makeAccounts();
    const firstResult = await provisionProductionAccounts(firstClient, accounts);
    const before = await firstClient.user.findMany({
      where: {
        loginIdentifier: {
          in: accounts.map(({ loginIdentifier }) => loginIdentifier),
          mode: "insensitive",
        },
      },
      select: { loginIdentifier: true, passwordHash: true },
    });
    const changedPasswords = accounts.map((account) => ({
      ...account,
      password: "changed-" + account.password,
    }));

    const secondResult = await provisionProductionAccounts(firstClient, changedPasswords);
    const after = await firstClient.user.findMany({
      where: {
        loginIdentifier: {
          in: accounts.map(({ loginIdentifier }) => loginIdentifier),
          mode: "insensitive",
        },
      },
      select: { loginIdentifier: true, passwordHash: true },
    });

    expect(firstResult.map(({ status }) => status)).toEqual(["created", "created"]);
    expect(secondResult.map(({ status }) => status)).toEqual(["existing-unchanged", "existing-unchanged"]);
    expect(after).toEqual(before);
  });

  it("rolls back the first insert when a later case-variant insert violates the index", async () => {
    const identifier = "rollback-" + randomUUID() + "@example.test";
    cleanupIdentifiers.push(identifier);
    const duplicateIdentifiers: ProductionAccount[] = [
      {
        loginIdentifier: identifier,
        displayName: "Rollback Organizer",
        role: Role.ORGANIZER,
        password: "test-organizer-rollback-passphrase",
      },
      {
        loginIdentifier: identifier.toUpperCase(),
        displayName: "Rollback Participant",
        role: Role.PARTICIPANT,
        password: "test-participant-rollback-passphrase",
      },
    ];

    await expect(provisionProductionAccounts(firstClient, duplicateIdentifiers))
      .rejects.toBeInstanceOf(ExistingAccountConflictError);

    const persisted = await firstClient.user.findMany({
      where: {
        loginIdentifier: {
          equals: identifier,
          mode: "insensitive",
        },
      },
    });
    expect(persisted).toHaveLength(0);
  });
});
