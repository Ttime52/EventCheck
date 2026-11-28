import { Prisma, Role, type PrismaClient } from "@prisma/client";

const targetAccounts = [
  {
    loginIdentifier: "participant-demo@example.com",
    expectedDisplayName: "Production Demo Participant",
    targetDisplayName: "Production Demo Participant A",
  },
  {
    loginIdentifier: "participant-b@example.test",
    expectedDisplayName: "Production Demo Participant",
    targetDisplayName: "Production Demo Participant B",
  },
] as const;

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
  currentDisplayName: string;
  targetDisplayName: string;
  action: "update" | "unchanged";
};

export type UatDisplayNameUpdateClient = Pick<PrismaClient, "$transaction" | "user">;

export class UatDisplayNameUpdateError extends Error {}

function buildPlan(users: DisplayNameUser[]): DisplayNameUpdatePlan[] {
  if (users.length !== targetAccounts.length) {
    throw new UatDisplayNameUpdateError("Both OBS-07 Participant accounts must exist exactly once; no changes were made");
  }

  const usersByLogin = new Map<string, DisplayNameUser>();
  for (const user of users) {
    const target = targetAccounts.find((account) => account.loginIdentifier === user.loginIdentifier);
    if (!target) {
      throw new UatDisplayNameUpdateError("A target login identifier does not match exactly; no changes were made");
    }
    if (usersByLogin.has(user.loginIdentifier)) {
      throw new UatDisplayNameUpdateError("A target account matched more than once; no changes were made");
    }
    if (user.role !== Role.PARTICIPANT) {
      throw new UatDisplayNameUpdateError("Both target accounts must have the PARTICIPANT role; no changes were made");
    }
    if (user.displayName !== target.expectedDisplayName && user.displayName !== target.targetDisplayName) {
      throw new UatDisplayNameUpdateError("A target account has an unexpected display name; no changes were made");
    }
    usersByLogin.set(user.loginIdentifier, user);
  }

  const plannedUsers = targetAccounts.map((target) => {
    const user = usersByLogin.get(target.loginIdentifier);
    if (!user) {
      throw new UatDisplayNameUpdateError("A target account is missing; no changes were made");
    }
    return { target, user };
  });

  if (new Set(plannedUsers.map(({ user }) => user.id)).size !== targetAccounts.length) {
    throw new UatDisplayNameUpdateError("The target login identifiers must resolve to two distinct User IDs; no changes were made");
  }

  return plannedUsers.map(({ target, user }) => ({
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    currentDisplayName: user.displayName,
    targetDisplayName: target.targetDisplayName,
    action: user.displayName === target.targetDisplayName ? "unchanged" : "update",
  }));
}

async function readPlan(client: Pick<PrismaClient, "user">): Promise<DisplayNameUpdatePlan[]> {
  const users = await client.user.findMany({
    where: { loginIdentifier: { in: targetAccounts.map(({ loginIdentifier }) => loginIdentifier) } },
    select: userSelect,
  });
  return buildPlan(users);
}

/** Read and validate the exact account pair. This function performs no writes. */
export function planUatDisplayNameUpdate(
  client: Pick<PrismaClient, "user">,
): Promise<DisplayNameUpdatePlan[]> {
  return readPlan(client);
}

/** Update only displayName for the two verified accounts in one serializable transaction. */
export function applyUatDisplayNameUpdate(
  client: UatDisplayNameUpdateClient,
): Promise<DisplayNameUpdatePlan[]> {
  return client.$transaction(async (transaction) => {
    const plan = await readPlan(transaction);
    for (const item of plan) {
      if (item.action === "unchanged") continue;
      const updated = await transaction.user.update({
        where: { id: item.userId },
        data: { displayName: item.targetDisplayName },
        select: userSelect,
      });
      if (
        updated.id !== item.userId ||
        updated.loginIdentifier !== item.loginIdentifier ||
        updated.role !== Role.PARTICIPANT ||
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

  return `${host}/${database}?schema=${schema}`;
}

/** Require a verified UAT marker and a separately confirmed, credential-free database identity. */
export function verifyUatMaintenanceTarget(env: NodeJS.ProcessEnv): string {
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
  return actualTarget;
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
