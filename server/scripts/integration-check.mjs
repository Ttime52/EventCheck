import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const value = process.env.DATABASE_URL;
let valid = false;
try {
  const url = new URL(value ?? "");
  valid = url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test" && url.searchParams.get("schema") === "public";
} catch {}
if (!valid) {
  console.error("Integration tests require DATABASE_URL=postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public");
  process.exit(2);
}
const serverDir = fileURLToPath(new URL("..", import.meta.url));
const compilerEntry = resolve(serverDir, "../node_modules/typescript/bin/tsc");
const build = spawnSync(process.execPath, [compilerEntry, "-p", resolve(serverDir, "tsconfig.json")], { cwd: serverDir, stdio: "inherit", env: process.env });
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);
const vitestEntry = resolve(serverDir, "../node_modules/vitest/vitest.mjs");
const suites = ["src/auth.integration.test.ts", "src/events.integration.test.ts", "src/public-events.integration.test.ts", "src/registration.integration.test.ts", "src/organizer-registrations.integration.test.ts", "src/f05.integration.test.ts", "src/f06.integration.test.ts", "src/f07.integration.test.ts", "src/production-provisioning.integration.test.ts"];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [vitestEntry, "run", suite], { cwd: serverDir, stdio: "inherit", env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
const restartCheck = spawnSync(process.execPath, [resolve(serverDir, "scripts/f06-restart-check.mjs")], { cwd: serverDir, stdio: "inherit", env: process.env });
if ((restartCheck.status ?? 1) !== 0) process.exit(restartCheck.status ?? 1);
process.exit(0);
