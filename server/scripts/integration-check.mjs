import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const value = process.env.DATABASE_URL;
let valid = false;
try {
  const url = new URL(value ?? "");
  valid = url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test";
} catch {}
if (!valid) {
  console.error("Integration tests require DATABASE_URL=postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public");
  process.exit(2);
}
const serverDir = fileURLToPath(new URL("..", import.meta.url));
const vitestEntry = resolve(serverDir, "../node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitestEntry, "run", "src/auth.integration.test.ts", "src/events.integration.test.ts"], { cwd: serverDir, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
