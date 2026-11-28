import { PrismaClient } from "@prisma/client";
import {
  applyUatDisplayNameUpdate,
  parseMaintenanceArguments,
  planUatDisplayNameUpdate,
  UatDisplayNameUpdateError,
  verifyUatMaintenanceTarget,
} from "../src/uat-display-name-update.js";

async function main() {
  const mode = parseMaintenanceArguments(process.argv.slice(2));
  // Refuse to create a Prisma client until the deployment and database identity are verified.
  verifyUatMaintenanceTarget(process.env);
  const prisma = new PrismaClient();

  try {
    const plan = mode === "apply"
      ? await applyUatDisplayNameUpdate(prisma)
      : await planUatDisplayNameUpdate(prisma);

    console.info(mode === "apply"
      ? "Applied the verified OBS-07 display-name plan."
      : "DRY RUN: no database writes were performed.");
    for (const item of plan) {
      const action = item.action === "unchanged" ? "already correct" : mode === "apply" ? "updated" : "would update";
      console.info(`${item.loginIdentifier}: ${JSON.stringify(item.currentDisplayName)} -> ${JSON.stringify(item.targetDisplayName)} (${action})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof UatDisplayNameUpdateError) {
    console.error(error.message);
  } else {
    // Prisma errors can contain database connection details; do not print raw errors.
    console.error("UAT display-name maintenance failed; sensitive error details were suppressed.");
  }
  process.exitCode = 1;
});
