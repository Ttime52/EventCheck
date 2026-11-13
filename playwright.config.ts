import { defineConfig, devices } from "@playwright/test";

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
    { command: "CLIENT_ORIGIN=http://localhost:5173 npm run dev --workspace server", url: "http://localhost:3000/health", reuseExistingServer: false, timeout: 30_000 },
    { command: "npm run dev --workspace client -- --host localhost", url: "http://localhost:5173", reuseExistingServer: false, timeout: 30_000 },
  ],
});
