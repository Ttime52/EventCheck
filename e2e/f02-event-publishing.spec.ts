import { expect, test, type Page } from "@playwright/test";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;

test.beforeAll(() => {
  if (!organizerLogin || !organizerPassword) {
    throw new Error("Missing E2E_ORGANIZER_LOGIN or E2E_ORGANIZER_PASSWORD");
  }
});

async function login(page: Page, identifier: string, password: string) {
  await page.getByLabel("Login identifier").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("TEST-F02-01/02/14: Organizer publishes an event and sees it after reload", async ({ page }) => {
  const title = `Playwright University Event ${Date.now()}`;

  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);
  await expect(page.getByText("Welcome, Demo Organizer")).toBeVisible();
  await expect(page.getByRole("form", { name: "Create and publish event" })).toBeVisible();

  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("A Playwright persistence check.");
  await page.getByLabel("Location", { exact: true }).fill("Engineering Building 1");
  await page.locator("#event-start").fill("2026-11-20T09:00");
  await page.locator("#event-end").fill("2026-11-20T12:00");
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Publish event" }).click();

  const formStatus = page.locator('form[aria-label="Create and publish event"] [role="status"]');
  await expect(formStatus).toHaveText(/Event published\. Event ID: .+/);
  await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await expect(page.getByText("Engineering Building 1", { exact: true })).toBeVisible();
});
