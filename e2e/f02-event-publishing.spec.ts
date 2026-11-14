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

  const eventCard = page.locator(".event-card").filter({ hasText: title });
  await eventCard.getByRole("button", { name: "View details" }).click();
  const detail = page.getByRole("region", { name: "Event details" });
  await expect(detail).toBeVisible();
  const detailForm = detail.getByRole("form", { name: "Event details" });
  await expect(detailForm.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(detailForm.getByLabel("Description", { exact: true })).toHaveValue("A Playwright persistence check.");
  await expect(detailForm.getByLabel("Location", { exact: true })).toHaveValue("Engineering Building 1");
  await expect(detailForm.getByLabel(/Start date and time/)).toHaveValue("20 Nov 2026, 09:00");
  await expect(detailForm.getByLabel(/End date and time/)).toHaveValue("20 Nov 2026, 12:00");
  await expect(detailForm.getByLabel("Capacity", { exact: true })).toHaveValue("25");
  await expect(detailForm.getByLabel("Publication state", { exact: true })).toHaveValue("PUBLISHED");
  await expect(detailForm.getByLabel("Event ID", { exact: true })).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Back to Your events" }).click();
  await expect(page.getByRole("form", { name: "Create and publish event" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await expect(page.getByText("Engineering Building 1", { exact: true })).toBeVisible();
});
