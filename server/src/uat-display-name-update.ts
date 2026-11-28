import { Prisma, Role, type PrismaClient } from "@prisma/client";

const targetAccounts = [
  {
    loginIdentifier: "participant-demo@example.com",
    expectedDisplayName: "Production Demo Participant",
    targetDisplayName: "Production Demo Participant A",
    role: Role.PARTICIPANT,
  },
  {
    loginIdentifier: "participant-b@example.test",
    expectedDisplayName: "Production Demo Participant",
    targetDisplayName: "Production Demo Participant B",
    role: Role.PARTICIPANT,
  },
] as const;

const targetLogins = targetAccounts.map(({ loginIdentifier }) => loginIdentifier);
const verifiedTargetBrand: unique symbol = Symbol("verifiedUatMaintenanceTarget");

const userSelect = {
  id: true,
  loginIdentifier: true,
  displayName: true,
  role: true,
} satisfies Prisma.UserSelect;

type DisplayNameUser = {
  id: string;
  loginIdentifier: string;
  displayName: string;
  role: Role;
};

export type DisplayNameUpdatePlan = {
  userId: string;
  loginIdentifier: string;
  expectedRole: Role;
  currentDisplayName: string;
  targetDisplayName: string;
  action: "update" | "unchanged";
};

export type UatDisplayNameUpdateClient = Pick<PrismaClient, "$transaction" | "user">;

export type VerifiedUatMaintenanceTarget = {
  databaseTarget: string;
  approvedUserIds?: Readonly<Record<string, string>>;
  readonly [verifiedTargetBrand]: true;
};

export class UatDisplayNameUpdateError extends Error {}

function normalizeLogin(loginIdentifier: string): string {
  return loginIdentifier.toLowerCase();
}

function buildPlan(users: DisplayNameUser[]): DisplayNameUpdatePlan[] {
  const targetsByLogin = new Map(targetAccounts.map((account) => [normalizeLogin(account.loginIdentifier), account]));
  const usersByLogin = new Map<string, DisplayNameUser>();
  for (const user of users) {
    const normalizedLogin = normalizeLogin(user.loginIdentifier);
    const target = targetsByLogin.get(normalizedLogin);
    if (!target) {
      throw new UatDisplayNameUpdateError("A target login identifier does not match exactly; no changes were made");
    }
    if (usersByLogin.has(normalizedLogin)) {
      throw new UatDisplayNameUpdateError("Target login identifiers collide without regard to letter case; no changes were made");
    }
    if (user.loginIdentifier !== target.loginIdentifier) {
      throw new UatDisplayNameUpdateError("A target login identifier differs only by letter case; no changes were made");
    }
    if (user.role !== target.role) {
      throw new UatDisplayNameUpdateError("A target account has the wrong role; no changes were made");
    }
    if (user.displayName !== target.expectedDisplayName && user.displayName !== target.targetDisplayName) {
      throw new UatDisplayNameUpdateError("A target account has an unexpected display name; no changes were made");
    }
    usersByLogin.set(normalizedLogin, user);
  }

  const plannedUsers = targetAccounts.map((target) => {
    const user = usersByLogin.get(normalizeLogin(target.loginIdentifier));
    if (!user) {
      throw new UatDisplayNameUpdateError("A target account is missing; no changes were made");
    }
    return { target, user };
  });

  if (new Set(plannedUsers.map(({ user }) => user.id)).size !== targetAccounts.length) {
    throw new UatDisplayNameUpdateError("The target login identifiers must resolve to two distinct Participant User IDs; no changes were made");
  }

  return plannedUsers.map(({ target, user }) => ({
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    expectedRole: target.role,
    currentDisplayName: user.displayName,
    targetDisplayName: target.targetDisplayName,
    action: user.displayName === target.targetDisplayName ? "unchanged" : "update",
  }));
}

async function readPlan(client: Pick<PrismaClient, "user">): Promise<DisplayNameUpdatePlan[]> {
  const users = await client.user.findMany({
    where: {
      OR: targetAccounts.map(({ loginIdentifier }) => ({
        loginIdentifier: { equals: loginIdentifier, mode: "insensitive" },
      })),
    },
    select: userSelect,
  });
  return buildPlan(users);
}

/** Read and validate the exact account set. This function performs no writes. */
export function planUatDisplayNameUpdate(
  client: Pick<PrismaClient, "user">,
): Promise<DisplayNameUpdatePlan[]> {
  return readPlan(client);
}

function assertApprovedUserIds(
  plan: DisplayNameUpdatePlan[],
  approvedUserIds: Readonly<Record<string, string>> | undefined,
): asserts approvedUserIds is Readonly<Record<string, string>> {
  const approvedLogins = approvedUserIds ? Object.keys(approvedUserIds).sort() : [];
  const expectedLogins = [...targetLogins].sort();
  if (
    !approvedUserIds ||
    approvedLogins.length !== expectedLogins.length ||
    approvedLogins.some((login, index) => login !== expectedLogins[index])
  ) {
    throw new UatDisplayNameUpdateError("Apply requires approved User IDs for both exact Participant accounts; no changes were made");
  }

  const approvedIds = expectedLogins.map((login) => approvedUserIds[login]);
  if (approvedIds.some((id) => !id || id.trim() !== id) || new Set(approvedIds).size !== expectedLogins.length) {
    throw new UatDisplayNameUpdateError("Approved Participant User IDs must be nonempty and distinct; no changes were made");
  }
  if (plan.some((item) => approvedUserIds[item.loginIdentifier] !== item.userId)) {
    throw new UatDisplayNameUpdateError("The database User IDs do not match the approved Participant account IDs; no changes were made");
  }
}

/** Update only the two verified Participant display names in one serializable transaction. */
export function applyUatDisplayNameUpdate(
  client: UatDisplayNameUpdateClient,
  target: VerifiedUatMaintenanceTarget,
): Promise<DisplayNameUpdatePlan[]> {
  if (target[verifiedTargetBrand] !== true || !target.databaseTarget) {
    throw new UatDisplayNameUpdateError("Apply requires a database target verified from the approved UAT environment");
  }
  return client.$transaction(async (transaction) => {
    const plan = await readPlan(transaction);
    assertApprovedUserIds(plan, target.approvedUserIds);
    for (const item of plan) {
      if (item.action === "unchanged") continue;
      const updated = await transaction.user.update({
        where: { id: item.userId, loginIdentifier: item.loginIdentifier, role: item.expectedRole },
        data: { displayName: item.targetDisplayName },
        select: userSelect,
      });
      if (
        updated.id !== item.userId ||
        updated.loginIdentifier !== item.loginIdentifier ||
        updated.role !== item.expectedRole ||
        updated.displayName !== item.targetDisplayName
      ) {
        throw new UatDisplayNameUpdateError("A target account did not match the requested update; the transaction was rolled back");
      }
    }
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function parseDatabaseTarget(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new UatDisplayNameUpdateError("DATABASE_URL is invalid; target environment cannot be verified");
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new UatDisplayNameUpdateError("DATABASE_URL must target PostgreSQL; target environment cannot be verified");
  }

  const host = parsed.host || parsed.searchParams.get("host")?.trim() || "";
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const schema = parsed.searchParams.get("schema")?.trim() || "public";
  const normalizedHost = host.toLowerCase().replace(/^\[([^\]]+)\](?::\d+)?$/u, "$1").replace(/:\d+$/u, "");
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase()) ||
    ["localhost", "127.0.0.1", "::1"].includes(normalizedHost);
  if (!host || !database || localHost || !/^[A-Za-z0-9_-]+$/u.test(schema)) {
    throw new UatDisplayNameUpdateError("DATABASE_URL does not identify a deployed UAT database; target environment cannot be verified");
  }

  return `${host.toLowerCase()}/${database}?schema=${schema}`;
}

function parseApprovalManifest(raw: string | undefined, actualTarget: string): Readonly<Record<string, string>> {
  if (!raw) {
    throw new UatDisplayNameUpdateError("Apply requires EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL with the approved database target and exact Participant User IDs");
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new UatDisplayNameUpdateError("EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL must contain valid JSON");
  }
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new UatDisplayNameUpdateError("The UAT display-name approval must be a JSON object");
  }

  const approval = manifest as Record<string, unknown>;
  if (Object.keys(approval).sort().join(",") !== "databaseTarget,userIds" || approval.databaseTarget !== actualTarget) {
    throw new UatDisplayNameUpdateError("The approval database target does not match the verified UAT database");
  }
  if (typeof approval.userIds !== "object" || approval.userIds === null || Array.isArray(approval.userIds)) {
    throw new UatDisplayNameUpdateError("The UAT display-name approval must list exact Participant User IDs");
  }

  const userIds = approval.userIds as Record<string, unknown>;
  const approvedLogins = Object.keys(userIds).sort();
  const expectedLogins = [...targetLogins].sort();
  if (
    approvedLogins.length !== expectedLogins.length ||
    approvedLogins.some((login, index) => login !== expectedLogins[index])
  ) {
    throw new UatDisplayNameUpdateError("The approval must list only the two exact Participant login identifiers");
  }

  const ids: string[] = [];
  for (const login of expectedLogins) {
    const userId = userIds[login];
    if (typeof userId !== "string" || !userId || userId.trim() !== userId) {
      throw new UatDisplayNameUpdateError("The approval must contain a nonempty exact User ID for each Participant");
    }
    ids.push(userId);
  }
  if (new Set(ids).size !== ids.length) {
    throw new UatDisplayNameUpdateError("The approval must contain distinct User IDs for the two Participants");
  }

  return Object.fromEntries(expectedLogins.map((login) => [login, userIds[login] as string]));
}

/** Verify the deployed UAT target and, for apply mode, its approved account-ID manifest. */
export function verifyUatMaintenanceTarget(
  env: NodeJS.ProcessEnv,
  mode: MaintenanceMode = "dry-run",
): VerifiedUatMaintenanceTarget {
  if (env.NODE_ENV !== "production" || env.EVENTCHECK_DEPLOYMENT_ENV !== "uat") {
    throw new UatDisplayNameUpdateError("Maintenance requires NODE_ENV=production and EVENTCHECK_DEPLOYMENT_ENV=uat");
  }
  if (!env.DATABASE_URL) {
    throw new UatDisplayNameUpdateError("DATABASE_URL is required to verify the UAT target");
  }

  const actualTarget = parseDatabaseTarget(env.DATABASE_URL);
  const expectedTarget = env.EVENTCHECK_EXPECTED_DATABASE_TARGET?.trim();
  if (!expectedTarget || expectedTarget.includes("://") || expectedTarget.includes("@")) {
    throw new UatDisplayNameUpdateError("Set EVENTCHECK_EXPECTED_DATABASE_TARGET to the verified host/database/schema identity");
  }
  if (actualTarget !== expectedTarget) {
    throw new UatDisplayNameUpdateError("DATABASE_URL does not match the separately verified UAT database target");
  }
  return {
    databaseTarget: actualTarget,
    approvedUserIds: mode === "apply"
      ? parseApprovalManifest(env.EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL, actualTarget)
      : undefined,
    [verifiedTargetBrand]: true,
  };
}

export type MaintenanceMode = "dry-run" | "apply";

export function parseMaintenanceArguments(args: string[]): MaintenanceMode {
  const allowed = new Set(["--dry-run", "--apply", "--confirm-uat-database"]);
  if (args.some((arg) => !allowed.has(arg)) || new Set(args).size !== args.length) {
    throw new UatDisplayNameUpdateError("Use no arguments or --dry-run for preview; apply requires --apply --confirm-uat-database");
  }

  const apply = args.includes("--apply");
  const confirm = args.includes("--confirm-uat-database");
  const dryRun = args.includes("--dry-run");
  if (dryRun && args.length !== 1) {
    throw new UatDisplayNameUpdateError("--dry-run cannot be combined with apply flags");
  }
  if (apply !== confirm) {
    throw new UatDisplayNameUpdateError("Changing the deployed UAT database requires both --apply and --confirm-uat-database");
  }
  return apply ? "apply" : "dry-run";
}
