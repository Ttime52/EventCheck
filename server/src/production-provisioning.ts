import { Prisma, Role, type PrismaClient } from "@prisma/client";
import { hashPassword } from "./security.js";

export class ProvisioningConfigurationError extends Error {}
export class ExistingAccountConflictError extends Error {}

export type ProductionAccount = {
  loginIdentifier: string;
  displayName: string;
  role: Role;
  password: string;
};

export type ProvisioningResult = {
  role: Role;
  status: "created" | "existing-unchanged";
};

export type ProvisioningClient = Pick<PrismaClient, "$transaction" | "user">;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function requiredValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProvisioningConfigurationError(`Required environment variable ${name} is missing or empty`);
  }
  return value;
}

function validateEmail(env: NodeJS.ProcessEnv, name: string): string {
  const email = requiredValue(env, name).trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) {
    throw new ProvisioningConfigurationError(`${name} must be a valid email address`);
  }
  return email;
}

function validatePassword(env: NodeJS.ProcessEnv, name: string): string {
  const password = requiredValue(env, name);
  if ([...password].length < 16 || password.trim().length === 0) {
    throw new ProvisioningConfigurationError(`${name} must contain at least 16 non-whitespace characters`);
  }
  return password;
}

/** Validate the complete production configuration before the caller connects to the database. */
export function readProductionAccounts(env: NodeJS.ProcessEnv = process.env): ProductionAccount[] {
  if (env.NODE_ENV !== "production") {
    throw new ProvisioningConfigurationError("Production account provisioning requires NODE_ENV=production");
  }

  const databaseUrl = requiredValue(env, "DATABASE_URL");
  try {
    const parsed = new URL(databaseUrl);
    if (!["postgresql:", "postgres:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
  } catch {
    throw new ProvisioningConfigurationError("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  const organizerEmail = validateEmail(env, "PROVISION_ORGANIZER_EMAIL");
  const organizerPassword = validatePassword(env, "PROVISION_ORGANIZER_PASSWORD");
  const participantEmail = validateEmail(env, "PROVISION_PARTICIPANT_EMAIL");
  const participantPassword = validatePassword(env, "PROVISION_PARTICIPANT_PASSWORD");

  if (organizerEmail === participantEmail) {
    throw new ProvisioningConfigurationError("Organizer and Participant email addresses must be different");
  }
  if (organizerPassword === participantPassword) {
    throw new ProvisioningConfigurationError("Organizer and Participant passwords must be different");
  }

  return [
    {
      loginIdentifier: organizerEmail,
      displayName: "Production Demo Organizer",
      role: Role.ORGANIZER,
      password: organizerPassword,
    },
    {
      loginIdentifier: participantEmail,
      displayName: "Production Demo Participant",
      role: Role.PARTICIPANT,
      password: participantPassword,
    },
  ];
}

/** Create missing accounts atomically; matching existing accounts are never updated. */
export async function provisionProductionAccounts(
  client: ProvisioningClient,
  accounts: ProductionAccount[],
): Promise<ProvisioningResult[]> {
  try {
    return await client.$transaction(async (transaction) => {
      const existingUsers = await transaction.user.findMany({
        where: {
          loginIdentifier: {
            in: accounts.map((account) => account.loginIdentifier),
            mode: "insensitive",
          },
        },
        select: { loginIdentifier: true, role: true },
      });

      const existingByEmail = new Map<string, (typeof existingUsers)[number]>();
      for (const user of existingUsers) {
        const normalizedEmail = user.loginIdentifier.toLowerCase();
        if (existingByEmail.has(normalizedEmail)) {
          throw new ExistingAccountConflictError(
            "Multiple accounts match a requested email without regard to casing; no accounts were changed",
          );
        }
        existingByEmail.set(normalizedEmail, user);
      }

      // Check every role before the first write so a conflict cannot create only half the pair.
      for (const account of accounts) {
        const existing = existingByEmail.get(account.loginIdentifier.toLowerCase());
        if (existing && (existing.role !== account.role || existing.loginIdentifier !== account.loginIdentifier)) {
          throw new ExistingAccountConflictError(
            "An account with a requested email already exists with a different role or casing; no accounts were changed",
          );
        }
      }

      const results: ProvisioningResult[] = [];
      for (const account of accounts) {
        if (existingByEmail.has(account.loginIdentifier.toLowerCase())) {
          results.push({ role: account.role, status: "existing-unchanged" });
          continue;
        }

        const passwordHash = await hashPassword(account.password);
        await transaction.user.create({
          data: {
            loginIdentifier: account.loginIdentifier,
            displayName: account.displayName,
            role: account.role,
            passwordHash,
          },
        });
        results.push({ role: account.role, status: "created" });
      }

      return results;
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    // PostgreSQL's case-insensitive unique index is the final arbiter when two
    // provisioning jobs race. The losing transaction has already rolled back.
    // Re-read outside that failed transaction and report success only if the
    // complete requested pair now exists with exactly the expected roles/casing.
    const existingUsers = await client.user.findMany({
      where: {
        loginIdentifier: {
          in: accounts.map((account) => account.loginIdentifier),
          mode: "insensitive",
        },
      },
      select: { loginIdentifier: true, role: true },
    });
    const existingByEmail = new Map<string, (typeof existingUsers)[number]>();
    for (const user of existingUsers) {
      const normalizedEmail = user.loginIdentifier.toLowerCase();
      if (existingByEmail.has(normalizedEmail)) {
        throw new ExistingAccountConflictError(
          "A case-insensitive account conflict was found; no accounts from this run were committed",
        );
      }
      existingByEmail.set(normalizedEmail, user);
    }

    for (const account of accounts) {
      const existing = existingByEmail.get(account.loginIdentifier.toLowerCase());
      if (!existing || existing.role !== account.role || existing.loginIdentifier !== account.loginIdentifier) {
        throw new ExistingAccountConflictError(
          "A concurrent account uniqueness conflict occurred; no accounts from this run were committed",
        );
      }
    }

    return accounts.map((account) => ({
      role: account.role,
      status: "existing-unchanged",
    }));
  }
}

/** Validate all configuration before entering the database transaction. */
export async function provisionProductionAccountsFromEnvironment(
  client: ProvisioningClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProvisioningResult[]> {
  const accounts = readProductionAccounts(env);
  return provisionProductionAccounts(client, accounts);
}
