import { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./security.js";
import {
  ExistingAccountConflictError,
  ProvisioningConfigurationError,
  provisionProductionAccounts,
  provisionProductionAccountsFromEnvironment,
  readProductionAccounts,
} from "./production-provisioning.js";

type FakeUser = {
  loginIdentifier: string;
  displayName: string;
  role: Role;
  passwordHash: string;
};

function makeEnvironment(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://localhost/eventcheck?schema=public",
    PROVISION_ORGANIZER_EMAIL: "organizer@example.test",
    PROVISION_ORGANIZER_PASSWORD: "organizer-production-passphrase",
    PROVISION_PARTICIPANT_EMAIL: "participant@example.test",
    PROVISION_PARTICIPANT_PASSWORD: "participant-production-passphrase",
    ...overrides,
  };
}

function makeDatabase(initialUsers: FakeUser[] = []) {
  const users = [...initialUsers];
  const findMany = vi.fn(async ({ where }: { where: { loginIdentifier: { in: string[] } } }) => {
    const requested = new Set(where.loginIdentifier.in.map((email) => email.toLowerCase()));
    return users
      .filter((user) => requested.has(user.loginIdentifier.toLowerCase()))
      .map(({ loginIdentifier, role }) => ({ loginIdentifier, role }));
  });
  const create = vi.fn(async ({ data }: { data: FakeUser }) => {
    users.push({ ...data });
    return data;
  });
  const transaction = { user: { findMany, create } };
  const transactionCall = vi.fn(async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction));
  const client = { $transaction: transactionCall } as unknown as Pick<PrismaClient, "$transaction">;

  return { client, users, findMany, create, transactionCall };
}

describe("production account configuration", () => {
  it("requires production mode and all account/database values", () => {
    expect(() => readProductionAccounts(makeEnvironment({ NODE_ENV: "test" }))).toThrow(ProvisioningConfigurationError);
    for (const name of [
      "DATABASE_URL",
      "PROVISION_ORGANIZER_EMAIL",
      "PROVISION_ORGANIZER_PASSWORD",
      "PROVISION_PARTICIPANT_EMAIL",
      "PROVISION_PARTICIPANT_PASSWORD",
    ]) {
      expect(() => readProductionAccounts(makeEnvironment({ [name]: undefined }))).toThrow(name);
    }
  });

  it.each([
    ["DATABASE_URL", "not-a-database-url"],
    ["PROVISION_ORGANIZER_EMAIL", "not-an-email"],
    ["PROVISION_PARTICIPANT_EMAIL", "participant@"],
    ["PROVISION_ORGANIZER_PASSWORD", "short"],
    ["PROVISION_PARTICIPANT_PASSWORD", "                 "],
  ])("rejects invalid %s", (name, value) => {
    expect(() => readProductionAccounts(makeEnvironment({ [name]: value }))).toThrow(ProvisioningConfigurationError);
  });

  it("normalizes email identifiers and rejects duplicate emails or reused passwords", () => {
    const normalized = readProductionAccounts(makeEnvironment({
      PROVISION_ORGANIZER_EMAIL: " Organizer@Example.Test ",
    }));
    expect(normalized[0].loginIdentifier).toBe("organizer@example.test");
    expect(() => readProductionAccounts(makeEnvironment({
      PROVISION_PARTICIPANT_EMAIL: "ORGANIZER@example.test",
    }))).toThrow("must be different");
    expect(() => readProductionAccounts(makeEnvironment({
      PROVISION_PARTICIPANT_PASSWORD: "organizer-production-passphrase",
    }))).toThrow("passwords must be different");
  });

  it("does not expose configured credentials in validation errors", () => {
    const secret = "very-secret-production-password";
    try {
      readProductionAccounts(makeEnvironment({
        PROVISION_ORGANIZER_PASSWORD: secret,
        PROVISION_PARTICIPANT_EMAIL: "invalid",
      }));
      throw new Error("Expected invalid configuration");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain("postgresql://localhost/eventcheck");
    }
  });
});

describe("production account provisioning", () => {
  it("creates one account per role with hashes compatible with login", async () => {
    const accounts = readProductionAccounts(makeEnvironment());
    const database = makeDatabase();

    const results = await provisionProductionAccounts(database.client, accounts);

    expect(results).toEqual([
      { role: Role.ORGANIZER, status: "created" },
      { role: Role.PARTICIPANT, status: "created" },
    ]);
    expect(database.users.map(({ role }) => role)).toEqual([Role.ORGANIZER, Role.PARTICIPANT]);
    expect(database.users[0].passwordHash).toMatch(/^scrypt\$/);
    expect(database.users[1].passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword(accounts[0].password, database.users[0].passwordHash)).toBe(true);
    expect(await verifyPassword(accounts[1].password, database.users[1].passwordHash)).toBe(true);
    expect(database.users.some(({ passwordHash }) => accounts.some(({ password }) => passwordHash === password))).toBe(false);
  });

  it("is idempotent and never resets existing passwords", async () => {
    const initialHash = await hashPassword("original-organizer-password");
    const initialUser: FakeUser = {
      loginIdentifier: "organizer@example.test",
      displayName: "Existing Organizer",
      role: Role.ORGANIZER,
      passwordHash: initialHash,
    };
    const database = makeDatabase([initialUser]);

    const first = await provisionProductionAccounts(database.client, readProductionAccounts(makeEnvironment()));
    const organizerAfterFirst = database.users[0];
    const second = await provisionProductionAccounts(database.client, readProductionAccounts(makeEnvironment({
      PROVISION_ORGANIZER_PASSWORD: "replacement-organizer-passphrase",
      PROVISION_PARTICIPANT_PASSWORD: "replacement-participant-passphrase",
    })));

    expect(first).toEqual([
      { role: Role.ORGANIZER, status: "existing-unchanged" },
      { role: Role.PARTICIPANT, status: "created" },
    ]);
    expect(second).toEqual([
      { role: Role.ORGANIZER, status: "existing-unchanged" },
      { role: Role.PARTICIPANT, status: "existing-unchanged" },
    ]);
    expect(database.create).toHaveBeenCalledTimes(1);
    expect(organizerAfterFirst).toMatchObject({
      displayName: "Existing Organizer",
      passwordHash: initialHash,
    });
    expect(database.users[0].passwordHash).toBe(initialHash);
    expect(await verifyPassword("original-organizer-password", database.users[0].passwordHash)).toBe(true);
    expect(await verifyPassword("replacement-organizer-passphrase", database.users[0].passwordHash)).toBe(false);
  });

  it("fails before writes when an existing account has the wrong role", async () => {
    const database = makeDatabase([{
      loginIdentifier: "participant@example.test",
      displayName: "Existing Organizer",
      role: Role.ORGANIZER,
      passwordHash: await hashPassword("existing-account-password"),
    }]);
    const accounts = readProductionAccounts(makeEnvironment());

    await expect(provisionProductionAccounts(database.client, accounts)).rejects.toThrow(ExistingAccountConflictError);
    expect(database.create).not.toHaveBeenCalled();
    expect(database.users).toHaveLength(1);
  });

  it("fails closed when only the casing of an existing login identifier differs", async () => {
    const database = makeDatabase([{
      loginIdentifier: "ORGANIZER@example.test",
      displayName: "Existing Organizer",
      role: Role.ORGANIZER,
      passwordHash: await hashPassword("existing-account-password"),
    }]);

    await expect(provisionProductionAccounts(
      database.client,
      readProductionAccounts(makeEnvironment()),
    )).rejects.toThrow(ExistingAccountConflictError);
    expect(database.create).not.toHaveBeenCalled();
    expect(database.users).toHaveLength(1);
  });

  it("does not start a transaction for invalid required environment values", async () => {
    const database = makeDatabase();
    await expect(provisionProductionAccountsFromEnvironment(
      database.client,
      makeEnvironment({ PROVISION_PARTICIPANT_PASSWORD: undefined }),
    )).rejects.toThrow(ProvisioningConfigurationError);
    expect(database.transactionCall).not.toHaveBeenCalled();
  });
});
