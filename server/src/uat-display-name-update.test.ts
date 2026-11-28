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
const databaseTarget = "uat-db.example.test:5432/eventcheck_uat?schema=public";

type FakeUser = {
  id: string;
  loginIdentifier: string;
  displayName: string;
  role: Role;
  passwordHash: string;
};

type FakeRegistration = { id: string; eventId: string; participantId: string };
type AccountWhere = {
  OR: Array<{ loginIdentifier: { equals: string; mode: "insensitive" } }>;
};

function makeUsers(): FakeUser[] {
  return [
    { id: "user-a", loginIdentifier: participantALogin, displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-a" },
    { id: "user-b", loginIdentifier: participantBLogin, displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-b" },
    { id: "organizer-a", loginIdentifier: "organizer-a@example.test", displayName: "Production Demo Organizer", role: Role.ORGANIZER, passwordHash: "hash-organizer-a" },
    { id: "organizer-b", loginIdentifier: "organizer-b@example.test", displayName: "Production Demo Organizer", role: Role.ORGANIZER, passwordHash: "hash-organizer-b" },
    { id: "unrelated-user", loginIdentifier: "unrelated@example.test", displayName: "Production Demo Participant", role: Role.PARTICIPANT, passwordHash: "hash-unrelated" },
  ];
}

function makeVerifiedTarget(userIds: Record<string, string> = {
  [participantALogin]: "user-a",
  [participantBLogin]: "user-b",
}): ReturnType<typeof verifyUatMaintenanceTarget> {
  const env = validEnvironment();
  env.EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL = approvalManifest(userIds);
  return verifyUatMaintenanceTarget(env, "apply");
}

function makeDatabase(initialUsers = makeUsers(), initialRegistrations: FakeRegistration[] = [
  { id: "registration-a", eventId: "event-1", participantId: "user-a" },
  { id: "registration-b", eventId: "event-1", participantId: "user-b" },
], failOnUpdateNumber?: number) {
  const users = structuredClone(initialUsers);
  const registrations = structuredClone(initialRegistrations);
  let transactionUsers: FakeUser[] | undefined;
  let updateCount = 0;
  const selectAccounts = (source: FakeUser[], where: AccountWhere) => source
    .filter(({ loginIdentifier }) => where.OR.some(({ loginIdentifier: filter }) =>
      loginIdentifier.toLowerCase() === filter.equals.toLowerCase()))
    .map(({ id, loginIdentifier, displayName, role }) => ({ id, loginIdentifier, displayName, role }));

  const findMany = vi.fn(async ({ where }: { where: AccountWhere }) => selectAccounts(users, where));
  const transactionFindMany = vi.fn(async ({ where }: { where: AccountWhere }) =>
    selectAccounts(transactionUsers ?? [], where));
  const update = vi.fn(async ({
    where,
    data,
  }: {
    where: { id: string; loginIdentifier: string; role: Role };
    data: { displayName: string };
  }) => {
    updateCount += 1;
    if (updateCount === failOnUpdateNumber) throw new Error("Simulated isolated transaction failure");
    const user = transactionUsers?.find(({ id, loginIdentifier, role }) =>
      id === where.id && loginIdentifier === where.loginIdentifier && role === where.role);
    if (!user) throw new Error("Missing or changed update target");
    user.displayName = data.displayName;
    return { id: user.id, loginIdentifier: user.loginIdentifier, displayName: user.displayName, role: user.role };
  });

  const $transaction = vi.fn(async <T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) => {
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

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    EVENTCHECK_DEPLOYMENT_ENV: "uat",
    DATABASE_URL: "postgresql://uat-db.example.test:5432/eventcheck_uat?schema=public",
    EVENTCHECK_EXPECTED_DATABASE_TARGET: databaseTarget,
  };
}

function approvalManifest(userIds: Record<string, string> = {
  [participantALogin]: "user-a",
  [participantBLogin]: "user-b",
}): string {
  return JSON.stringify({ databaseTarget, userIds });
}

describe("OBS-07 UAT display-name maintenance", () => {
  it("dry-runs only the two Participant accounts without writing or opening a transaction", async () => {
    const database = makeDatabase();
    const beforeUsers = structuredClone(database.users);
    const beforeRegistrations = structuredClone(database.registrations);

    const plan = await planUatDisplayNameUpdate(database.client);

    expect(plan).toEqual([
      { userId: "user-a", loginIdentifier: participantALogin, expectedRole: Role.PARTICIPANT, currentDisplayName: "Production Demo Participant", targetDisplayName: "Production Demo Participant A", action: "update" },
      { userId: "user-b", loginIdentifier: participantBLogin, expectedRole: Role.PARTICIPANT, currentDisplayName: "Production Demo Participant", targetDisplayName: "Production Demo Participant B", action: "update" },
    ]);
    expect(database.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { loginIdentifier: { equals: participantALogin, mode: "insensitive" } },
          { loginIdentifier: { equals: participantBLogin, mode: "insensitive" } },
        ],
      },
      select: { id: true, loginIdentifier: true, displayName: true, role: true },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
    expect(database.registrations).toEqual(beforeRegistrations);
  });

  it.each([
    ["Organizer A", (users: FakeUser[]) => users.filter(({ id }) => id !== "organizer-a")],
    ["Organizer B", (users: FakeUser[]) => users.filter(({ id }) => id !== "organizer-b")],
    ["both Organizers", (users: FakeUser[]) => users.filter(({ role }) => role !== Role.ORGANIZER)],
  ])("updates Participant names when %s is missing", async (_caseName, removeOrganizers) => {
    const database = makeDatabase(removeOrganizers(makeUsers()));
    const beforeRegistrations = structuredClone(database.registrations);

    const plan = await applyUatDisplayNameUpdate(database.client, makeVerifiedTarget());

    expect(plan.map(({ loginIdentifier, action }) => [loginIdentifier, action])).toEqual([
      [participantALogin, "update"],
      [participantBLogin, "update"],
    ]);
    expect(database.users.find(({ id }) => id === "user-a")?.displayName).toBe("Production Demo Participant A");
    expect(database.users.find(({ id }) => id === "user-b")?.displayName).toBe("Production Demo Participant B");
    expect(database.users.filter(({ role }) => role === Role.ORGANIZER).every(({ displayName }) =>
      displayName === "Production Demo Organizer")).toBe(true);
    expect(database.registrations).toEqual(beforeRegistrations);
  });

  it("updates only Participant displayName and preserves IDs, login, role, password hashes, registrations, and unrelated users", async () => {
    const database = makeDatabase();
    const beforeUsers = structuredClone(database.users);
    const beforeRegistrations = structuredClone(database.registrations);

    const plan = await applyUatDisplayNameUpdate(database.client, makeVerifiedTarget());

    expect(plan.map(({ targetDisplayName, action }) => [targetDisplayName, action])).toEqual([
      ["Production Demo Participant A", "update"],
      ["Production Demo Participant B", "update"],
    ]);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(database.update.mock.calls.map(([args]) => args.where)).toEqual([
      { id: "user-a", loginIdentifier: participantALogin, role: Role.PARTICIPANT },
      { id: "user-b", loginIdentifier: participantBLogin, role: Role.PARTICIPANT },
    ]);
    expect(database.update.mock.calls.map(([args]) => args.data)).toEqual([
      { displayName: "Production Demo Participant A" },
      { displayName: "Production Demo Participant B" },
    ]);
    expect(database.users).toEqual([
      { ...beforeUsers[0], displayName: "Production Demo Participant A" },
      { ...beforeUsers[1], displayName: "Production Demo Participant B" },
      beforeUsers[2],
      beforeUsers[3],
      beforeUsers[4],
    ]);
    expect(database.registrations).toEqual(beforeRegistrations);
  });

  it("is idempotent when applied twice with the same exact-ID approval", async () => {
    const database = makeDatabase();
    const approvedTarget = makeVerifiedTarget();
    await applyUatDisplayNameUpdate(database.client, approvedTarget);
    const usersAfterFirstApply = structuredClone(database.users);

    const secondPlan = await applyUatDisplayNameUpdate(database.client, approvedTarget);

    expect(secondPlan.map(({ action }) => action)).toEqual(["unchanged", "unchanged"]);
    expect(database.update).toHaveBeenCalledTimes(2);
    expect(database.users).toEqual(usersAfterFirstApply);
    expect(database.registrations).toHaveLength(2);
  });

  it("does not commit partial changes when an update fails inside the transaction", async () => {
    const database = makeDatabase(makeUsers(), undefined, 2);
    const beforeUsers = structuredClone(database.users);

    await expect(applyUatDisplayNameUpdate(database.client, makeVerifiedTarget()))
      .rejects.toThrow("Simulated isolated transaction failure");

    expect(database.update).toHaveBeenCalledTimes(2);
    expect(database.users).toEqual(beforeUsers);
  });

  it("rejects a missing Participant before any user update", async () => {
    const database = makeDatabase(makeUsers().filter(({ id }) => id !== "user-b"));
    const beforeUsers = structuredClone(database.users);

    await expect(applyUatDisplayNameUpdate(database.client, makeVerifiedTarget()))
      .rejects.toBeInstanceOf(UatDisplayNameUpdateError);

    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
  });

  it.each([
    ["a role mismatch", makeUsers().map((user) => user.id === "user-a" ? { ...user, role: Role.ORGANIZER } : user), "wrong role"],
    ["a shared User ID", makeUsers().map((user) => user.id === "user-b" ? { ...user, id: "user-a" } : user), "two distinct Participant User IDs"],
    ["an unexpected current display name", makeUsers().map((user) => user.id === "user-b" ? { ...user, displayName: "Unrelated Name" } : user), "unexpected display name"],
  ])("fails safely for %s before any user update", async (_caseName, invalidUsers, expectedError) => {
    const database = makeDatabase(invalidUsers as FakeUser[]);
    const beforeUsers = structuredClone(database.users);

    await expect(applyUatDisplayNameUpdate(database.client, makeVerifiedTarget()))
      .rejects.toThrow(expectedError as string);

    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
  });

  it("rejects case-insensitive login collisions before any write", async () => {
    const users = [
      ...makeUsers(),
      { ...makeUsers()[0], id: "case-collision", loginIdentifier: participantALogin.toUpperCase() },
    ];
    const database = makeDatabase(users);

    await expect(planUatDisplayNameUpdate(database.client))
      .rejects.toThrow("Target login identifiers collide without regard to letter case");
    expect(database.update).not.toHaveBeenCalled();
  });

  it("rejects a case-variant account even when no canonical-case account exists", async () => {
    const users = makeUsers().map((user) => user.id === "user-a"
      ? { ...user, loginIdentifier: participantALogin.toUpperCase() }
      : user);
    const database = makeDatabase(users);

    await expect(planUatDisplayNameUpdate(database.client))
      .rejects.toThrow("A target login identifier differs only by letter case");
    expect(database.update).not.toHaveBeenCalled();
  });

  it("requires a verified UAT marker and exact credential-free database target", () => {
    const env = validEnvironment();

    expect(verifyUatMaintenanceTarget(env)).toMatchObject({ databaseTarget });
    expect(() => verifyUatMaintenanceTarget({ ...env, EVENTCHECK_DEPLOYMENT_ENV: "production" }))
      .toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({ ...env, EVENTCHECK_EXPECTED_DATABASE_TARGET: "other-db/eventcheck_uat?schema=public" }))
      .toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({ ...env, DATABASE_URL: "postgresql://127.0.0.1:5432/eventcheck_uat?schema=public" }))
      .toThrow(UatDisplayNameUpdateError);
    expect(() => verifyUatMaintenanceTarget({
      ...env,
      DATABASE_URL: "postgresql:///eventcheck_uat?host=localhost&schema=public",
      EVENTCHECK_EXPECTED_DATABASE_TARGET: "localhost/eventcheck_uat?schema=public",
    })).toThrow(UatDisplayNameUpdateError);
  });

  it("binds the apply approval to the verified database and exact Participant User IDs", () => {
    const env = { ...validEnvironment(), EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL: approvalManifest() };

    expect(verifyUatMaintenanceTarget(env, "apply")).toMatchObject({
      databaseTarget,
      approvedUserIds: { [participantALogin]: "user-a", [participantBLogin]: "user-b" },
    });
    expect(() => verifyUatMaintenanceTarget({
      ...env,
      EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL: JSON.stringify({
        databaseTarget: "other-db/eventcheck_uat?schema=public",
        userIds: { [participantALogin]: "user-a", [participantBLogin]: "user-b" },
      }),
    }, "apply")).toThrow("approval database target does not match");
    expect(() => verifyUatMaintenanceTarget({ ...validEnvironment() }, "apply"))
      .toThrow("requires EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL");
    expect(() => verifyUatMaintenanceTarget({
      ...validEnvironment(),
      EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL: approvalManifest({ [participantALogin]: "user-a" }),
    }, "apply")).toThrow("must list only the two exact Participant login identifiers");
    expect(() => verifyUatMaintenanceTarget({
      ...validEnvironment(),
      EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL: approvalManifest({ [participantALogin]: "same-id", [participantBLogin]: "same-id" }),
    }, "apply")).toThrow("distinct User IDs");
  });

  it("rejects database User IDs that differ from the approved IDs before any update", async () => {
    const database = makeDatabase();
    const beforeUsers = structuredClone(database.users);
    const wrongApproval = makeVerifiedTarget({ [participantALogin]: "wrong-user-a", [participantBLogin]: "user-b" });

    await expect(applyUatDisplayNameUpdate(database.client, wrongApproval))
      .rejects.toThrow("do not match the approved Participant account IDs");

    expect(database.update).not.toHaveBeenCalled();
    expect(database.users).toEqual(beforeUsers);
  });

  it("rejects an apply target that was not produced by UAT environment verification", async () => {
    const database = makeDatabase();
    const unverifiedTarget = {
      databaseTarget,
      approvedUserIds: { [participantALogin]: "user-a", [participantBLogin]: "user-b" },
    } as unknown as ReturnType<typeof verifyUatMaintenanceTarget>;

    expect(() => applyUatDisplayNameUpdate(database.client, unverifiedTarget))
      .toThrow("database target verified from the approved UAT environment");

    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
  });

  it("defaults to dry-run and requires both explicit apply flags", () => {
    expect(parseMaintenanceArguments([])).toBe("dry-run");
    expect(parseMaintenanceArguments(["--dry-run"])).toBe("dry-run");
    expect(parseMaintenanceArguments(["--apply", "--confirm-uat-database"])).toBe("apply");
    expect(() => parseMaintenanceArguments(["--apply"]))
      .toThrow("requires both --apply and --confirm-uat-database");
    expect(() => parseMaintenanceArguments(["--confirm-uat-database"]))
      .toThrow("requires both --apply and --confirm-uat-database");
    expect(() => parseMaintenanceArguments(["--dry-run", "--apply", "--confirm-uat-database"]))
      .toThrow(UatDisplayNameUpdateError);
    expect(() => parseMaintenanceArguments(["--force"])).toThrow(UatDisplayNameUpdateError);
  });
});
