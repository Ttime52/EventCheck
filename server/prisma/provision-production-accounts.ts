import { PrismaClient } from "@prisma/client";
import {
  ExistingAccountConflictError,
  ProvisioningConfigurationError,
  provisionProductionAccounts,
  readProductionAccounts,
} from "../src/production-provisioning.js";

async function main() {
  // Validate every required setting before creating a client or attempting database work.
  const accounts = readProductionAccounts(process.env);
  const prisma = new PrismaClient();

  try {
    const results = await provisionProductionAccounts(prisma, accounts);
    for (const result of results) {
      const action = result.status === "created" ? "created" : "already exists; left unchanged";
      console.info(`${result.role} account ${action}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ProvisioningConfigurationError || error instanceof ExistingAccountConflictError) {
    console.error(error.message);
  } else {
    // Database/Prisma errors can contain connection details; suppress their raw text.
    console.error("Production account provisioning failed; sensitive error details were suppressed.");
  }
  process.exitCode = 1;
});
