import { Prisma, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  applyUatDisplayNameUpdate,
  parseMaintenanceArguments,
  planUatDisplayNameUpdate,
  UatDisplayNameUpdateError,
  type UatDisplayNameUpdateClient,
  verifyUatMaintenanceTarget,
} from "./uat-display-name-update.js";

const participantALogin = "participant-demo@example.com";
const participantBLogin = "participant-b@example.test";
const organizerALogin = "organizer-a@example.test";
const organizerBLogin = "organizer-b@example.test";

type FakeUser = {
  id: string;
  loginIdentifier: string;
  displayName: string;
  role: Role;
  passwordHash: string;
};

type FakeRegistration = { id: string; eventId: string; participantId: string };

function makeUsers(): FakeUser[] {
  return [
    { id: "user-a", loginIdentifier: participantALogin, displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-a" },
    { id: "user-b", loginIdentifier: participantBLogin, displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-b" },
    { id: "organizer-a", loginIdentifier: organizerALogin, displayName: "Production Demo Organizer", role: Role.ORGANIZER, passwordHash: "hash-organizer-a" },
    { id: "organizer-b", loginIdentifier: organizerBLogin, displayName: "Production Demo Organizer", role: Role.ORGANIZER, passwordHash: "hash-organizer-b" },
    { id: "unrelated-user", loginIdentifier: "unrelated@example.test", displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-unrelated" },
  ];
}

function makeDatabase(initialUsers = makeUsers(), initialRegistrations: FakeRegistration[] = [
  { id: "registration-a", eventId: "event-1", participantId: "user-a" },
  { id: "registration-b", eventId: "event-1", participantId: "user-b" },
], failOnUpdateNumber?: number) {
  const users = structuredClone(initialUsers);
  const registrations = structuredClone(initialRegistrations);
  let transactionUsers: FakeUser[] | undefined;
  let updateCount = 0;
  const selectAccounts = (source: FakeUser[], logins: string[]) => source
    .filter(({ loginIdentifier }) => logins.includes(loginIdentifier))
    .map(({ id, loginIdentifier, displayName, role }) => ({ id, loginIdentifier, displayName, role }));

  const findMany = vi.fn(async ({ where }: { where: { loginIdentifier: { in: string[] } } }) =>
    selectAccounts(users, where.loginIdentifier.in));
  const transactionFindMany = vi.fn(async ({ where }: { where: { loginIdentifier: { in: string[] } } }) =>
    selectAccounts(transactionUsers ?? [], where.loginIdentifier.in));
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: { displayName: string } }) => {
    updateCount += 1;
    if (updateCount === failOnUpdateNumber) throw new Error("Simulated isolated transaction failure");
    const user = transactionUsers?.find(({ id }) => id === where.id);
    if (!user) throw new Error("Missing update target");
    user.displayName = data.displayName;
    return { id: user.id, loginIdentifier: user.loginIdentifier, displayName: user.displayName, role: user.role };
  });

  const $transaction = vi.fn(async <T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) => {
    transactionUsers = structuredClone(users);
    try {
      const result = await callback({ user: { findMany: transactionFindMany, update } } as unknown as Prisma.TransactionClient);
      users.splice(0, users.length, ...transactionUsers);
      return result;
    } finally {
      transactionUsers = undefined;
    }
  });
  const client = { user: { findMany }, $transaction } as unknown as UatDisplayNameUpdateClient;

  return { client, users, registrations, findMany, transactionFindMany, update, $transaction };
}

describe("OBS-07 UAT display-name maintenance", () => {
  it("dry-runs the exact four accounts without writing or opening a transaction", async () => {
    const database = makeDatabase();
    const beforeUsers = structuredClone(database.users);
    const beforeRegistrations = structuredClone(database.registrations);

    const plan = await planUatDisplayNameUpdate(database.client);

    expect(plan).toEqual([
      { userId: "user-a", loginIdentifier: participantALogin, expectedRole: Role.PARTICIPANT, currentDisplayName: "Production Demo Participant", targetDisplayName: "Production Demo Participant A", action: "update" },
      { userId: "user-b", loginIdentifier: participantBLogin, expectedRole: Role.PARTICIPANT, currentDisplayName: "Production Demo Participant", targetDisplayName: "Production Demo Participant B", action: "update" },
      { userId: "organizer-a", loginIdentifier: organizerALogin, expectedRole: Role.ORGANIZER, currentDisplayName: "Production Demo Organizer", targetDisplayName: "Production Demo Organizer A", action: "update" },
      { userId: "organizer-b", loginIdentifier: organizerBLogin, expectedRole: Role.ORGANIZER, currentDisplayName: "Production Demo Organizer", targetDisplayName: "Production Demo Organizer B", action: "update" },
    ]);
    expect(database.findMany).toHaveBeenCalledWith({
      where: { loginIdentifier: { in: [participantALogin, participantBLogin, organizerALogin, organizerBLogin] } },
      select: { id: true, loginIdentifier: true, displayName: true, role: true },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
    expect(database.registrations).toEqual(beforeRegistrations);
  });

  it("updates only displayName and preserves IDs, logins, roles, password hashes, registrations, and unrelated users", async () => {
    const database = makeDatabase();
    const beforeUsers = structuredClone(database.users);
    const beforeRegistrations = structuredClone(database.registrations);

    const plan = await applyUatDisplayNameUpdate(database.client);

    expect(plan.map(({ targetDisplayName, action }) => [targetDisplayName, action])).toEqual([
      ["Production Demo Participant A", "update"],
      ["Production Demo Participant B", "update"],
      ["Production Demo Organizer A", "update"],
      ["Production Demo Organizer B", "update"],
    ]);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(database.update.mock.calls.map(([args]) => args.data)).toEqual([
      { displayName: "Production Demo Participant A" },
      { displayName: "Production Demo Participant B" },
      { displayName: "Production Demo Organizer A" },
      { displayName: "Production Demo Organizer B" },
    ]);
    expect(database.users).toEqual([
      { ...beforeUsers[0], displayName: "Production Demo Participant A" },
      { ...beforeUsers[1], displayName: "Production Demo Participant B" },
      { ...beforeUsers[2], displayName: "Production Demo Organizer A" },
      { ...beforeUsers[3], displayName: "Production Demo Organizer B" },
      beforeUsers[4],
    ]);
    expect(database.registrations).toEqual(beforeRegistrations);
  });

  it("is idempotent when applied twice", async () => {
    const database = makeDatabase();
    await applyUatDisplayNameUpdate(database.client);
    const usersAfterFirstApply = structuredClone(database.users);

    const secondPlan = await applyUatDisplayNameUpdate(database.client);

    expect(secondPlan.map(({ action }) => action)).toEqual(["unchanged", "unchanged", "unchanged", "unchanged"]);
    expect(database.update).toHaveBeenCalledTimes(4);
    expect(database.users).toEqual(usersAfterFirstApply);
    expect(database.registrations).toHaveLength(2);
  });

  it("does not commit partial changes when an update fails inside the transaction", async () => {
    const database = makeDatabase(makeUsers(), undefined, 2);
    const beforeUsers = structuredClone(database.users);

    await expect(applyUatDisplayNameUpdate(database.client)).rejects.toThrow("Simulated isolated transaction failure");

    expect(database.update).toHaveBeenCalledTimes(2);
    expect(database.users).toEqual(beforeUsers);
  });

  it.each([
    ["a missing account", makeUsers().filter(({ loginIdentifier }) => loginIdentifier !== organizerBLogin)],
    ["a role mismatch", makeUsers().map((user) => user.loginIdentifier === organizerALogin ? { ...user, role: Role.PARTICIPANT } : user)],
    ["a shared User ID", makeUsers().map((user) => user.loginIdentifier === organizerBLogin ? { ...user, id: "organizer-a" } : user)],
    ["an unexpected current display name", makeUsers().map((user) => user.loginIdentifier === organizerBLogin ? { ...user, displayName: "Unrelated Name" } : user)],
  ])("fails safely for %s before any user update", async (_caseName, invalidUsers) => {
    const database = makeDatabase(invalidUsers as FakeUser[]);
    const beforeUsers = structuredClone(database.users);

    await expect(applyUatDisplayNameUpdate(database.client)).rejects.toBeInstanceOf(UatDisplayNameUpdateError);

    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
  });

  it("requires the deployed UAT marker and an exact credential-free database target match", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      EVENTCHECK_DEPLOYMENT_ENV: "uat",
      DATABASE_URL: "postgresql://uat-db.example.test:5432/eventcheck_uat?schema=public",
      EVENTCHECK_EXPECTED_DATABASE_TARGET: "uat-db.example.test:5432/eventcheck_uat?schema=public",
    };

    expect(verifyUatMaintenanceTarget(env)).toBe("uat-db.example.test:5432/eventcheck_uat?schema=public");
    expect(() => verifyUatMaintenanceTarget({ ...env, EVENTCHECK_DEPLOYMENT_ENV: "production" })).toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({ ...env, EVENTCHECK_EXPECTED_DATABASE_TARGET: "other-db/eventcheck_uat?schema=public" })).toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({ ...env, DATABASE_URL: "postgresql://127.0.0.1:5432/eventcheck_uat?schema=public" })).toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({
      ...env,
      DATABASE_URL: "postgresql:///eventcheck_uat?host=localhost&schema=public",
      EVENTCHECK_EXPECTED_DATABASE_TARGET: "localhost/eventcheck_uat?schema=public",
    })).toThrow(UatDisplayNameUpdateError);
  });

  it("defaults to dry-run and requires both explicit apply flags", () => {
    expect(parseMaintenanceArguments([])).toBe("dry-run");
    expect(parseMaintenanceArguments(["--dry-run"])).toBe("dry-run");
    expect(parseMaintenanceArguments(["--apply", "--confirm-uat-database"])).toBe("apply");
    expect(() => parseMaintenanceArguments(["--apply"])).toThrow("requires both --apply and --confirm-uat-database");
    expect(() => parseMaintenanceArguments(["--confirm-uat-database"])).toThrow("requires both --apply and --confirm-uat-database");
    expect(() => parseMaintenanceArguments(["--dry-run", "--apply", "--confirm-uat-database"])).toThrow(UatDisplayNameUpdateError);
    expect(() => parseMaintenanceArguments(["--force"])).toThrow(UatDisplayNameUpdateError);
  });
});
