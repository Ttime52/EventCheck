import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) loadEnvFile(".env");

function normalizeE2EDatabaseUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    return url.toString();
  } catch {
    return undefined;
  }
}

const e2eDatabaseUrl = normalizeE2EDatabaseUrl(process.env.E2E_DATABASE_URL);
const e2eApiPort = process.env.E2E_API_PORT ?? "3101";
const e2eWebPort = process.env.E2E_WEB_PORT ?? "5178";
const e2eBaseURL = `http://127.0.0.1:${e2eWebPort}`;
process.env.E2E_DATABASE_URL = e2eDatabaseUrl;
process.env.E2E_ORGANIZER_LOGIN ??= "organizer@example.test";
process.env.E2E_PARTICIPANT_LOGIN ??= "participant@example.test";
process.env.E2E_ORGANIZER_PASSWORD ??= process.env.SEED_ORGANIZER_PASSWORD;
process.env.E2E_PARTICIPANT_PASSWORD ??= process.env.SEED_PARTICIPANT_PASSWORD;

function isIsolatedE2EDatabase(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test" && url.searchParams.get("schema") === "public";
  } catch {
    return false;
  }
}
if (!isIsolatedE2EDatabase(e2eDatabaseUrl)) throw new Error("E2E_DATABASE_URL must point to an isolated PostgreSQL database at 127.0.0.1:5433/eventcheck_test with schema=public");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: e2eBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    { command: "node server/dist/index.js", env: { DATABASE_URL: e2eDatabaseUrl, CLIENT_ORIGIN: e2eBaseURL, SERVER_PORT: e2eApiPort }, url: `http://127.0.0.1:${e2eApiPort}/health`, reuseExistingServer: false, timeout: 30_000, gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 } },
    { command: `node node_modules/vite/bin/vite.js client --host 127.0.0.1 --port ${e2eWebPort}`, env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${e2eApiPort}` }, url: e2eBaseURL, reuseExistingServer: false, timeout: 30_000, gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 } },
  ],
});
