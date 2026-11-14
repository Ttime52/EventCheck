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
const child = await import("node:child_process");
const result = child.spawnSync("npx", ["vitest", "run", "src/auth.integration.test.ts"], { cwd: new URL("..", import.meta.url), stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
