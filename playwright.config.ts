import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
if (!e2eDatabaseUrl) throw new Error("E2E_DATABASE_URL must point to the isolated eventcheck_test database");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    { command: "npm run dev --workspace server", env: { DATABASE_URL: e2eDatabaseUrl, CLIENT_ORIGIN: "http://localhost:5173" }, url: "http://localhost:3000/health", reuseExistingServer: false, timeout: 30_000 },
    { command: "npm run dev --workspace client -- --host localhost", url: "http://localhost:5173", reuseExistingServer: false, timeout: 30_000 },
  ],
});
