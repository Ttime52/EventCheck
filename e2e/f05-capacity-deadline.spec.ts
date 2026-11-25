import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN!;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD!;
const ownedEventIds = new Set<string>();

function isolatedDatabase(value: string | undefined) {
  if (!value) return false;
  const url = new URL(value);
  return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test" && url.searchParams.get("schema") === "public";
}

test.afterEach(async () => {
  if (!ownedEventIds.size) return;
  if (!isolatedDatabase(process.env.E2E_DATABASE_URL)) throw new Error("Refusing E2E cleanup outside eventcheck_test/public");
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
  try {
    const ids = [...ownedEventIds];
    await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  } finally { await prisma.$disconnect(); ownedEventIds.clear(); }
});

async function login(page: import("@playwright/test").Page) {
  await page.getByLabel("Login identifier").fill(organizerLogin);
  await page.getByLabel("Password", { exact: true }).fill(organizerPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Welcome, Demo Organizer")).toBeVisible();
}

async function createEvent(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("tab", { name: "Create Event" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("F05 browser verification");
  await page.getByLabel("Location", { exact: true }).fill("Lab 5");
  await page.locator("#event-start").fill("2099-11-26T09:00");
  await page.locator("#event-end").fill("2099-11-26T12:00");
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Publish event" }).click();
  const status = page.locator('form[aria-label="Create and publish event"] [role="status"]');
  await expect(status).toHaveText(/Event published\. Event ID: .+/);
  const eventId = (await status.textContent())?.match(/Event ID: ([0-9a-f-]{36})/)?.[1];
  if (!eventId) throw new Error("Created Event ID was not returned");
  ownedEventIds.add(eventId);
}

test("TEST-F05-01/03/07/12: Organizer edits capacity and deadline, reloads, clears deadline", async ({ page }) => {
  const title = `F05 Playwright ${Date.now()}`;
  await page.goto("/");
  await login(page);
  await createEvent(page, title);
  await page.getByRole("tab", { name: "My Events" }).click();
  const card = page.locator(".event-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByLabel("Capacity", { exact: true }).fill("4");
  await card.getByLabel("Registration deadline (optional)", { exact: true }).fill("2099-11-26T08:00");
  await card.getByRole("button", { name: "Save settings" }).click();
  await expect(card.getByRole("status")).toHaveText("Event settings saved");
  await expect(card.getByLabel("Capacity", { exact: true })).toHaveValue("4");
  await page.reload();
  await page.getByRole("tab", { name: "My Events" }).click();
  const reloaded = page.locator(".event-card").filter({ hasText: title });
  await expect(reloaded.getByLabel("Capacity", { exact: true })).toHaveValue("4");
  await expect(reloaded.getByLabel("Registration deadline (optional)", { exact: true })).toHaveValue("2099-11-26T08:00");
  await reloaded.getByLabel("Registration deadline (optional)", { exact: true }).fill("");
  await reloaded.getByRole("button", { name: "Save settings" }).click();
  await expect(reloaded.getByRole("status")).toHaveText("Event settings saved");
});

test("TEST-F05-03/06/12: Organizer settings are keyboard accessible and report validation errors", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const title = `F05 keyboard ${Date.now()}`;
  await createEvent(page, title);
  await page.getByRole("tab", { name: "My Events" }).click();
  const form = page.locator(".event-card").filter({ hasText: title }).getByRole("form");
  await expect(form).toBeVisible();
  const capacity = form.getByLabel("Capacity", { exact: true });
  await capacity.focus();
  await expect(capacity).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Registration deadline (optional)", { exact: true })).toBeFocused();
  const saveButton = form.getByRole("button", {
    name: "Save settings",
  });

  let reachedSaveButton = false;

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");

    const focused = await saveButton.evaluate(
      element => element === document.activeElement
    );

    if (focused) {
      reachedSaveButton = true;
      break;
    }
  }

  expect(
    reachedSaveButton,
    "Save settings should be reachable using Tab"
  ).toBe(true);
  await form.getByLabel("Registration deadline (optional)", { exact: true }).fill("2099-11-27T09:00");
  await form.getByRole("button", { name: "Save settings" }).click();
  await expect(form.getByRole("status")).toHaveText("registrationDeadline must not be after event start");
});

test("TEST-F05-08/09: Participant sees closed registration and no Register action", async ({ page }) => {
  const title = `F05 closed ${Date.now()}`;
  await page.goto("/");
  await login(page);
  await createEvent(page, title);
  await page.getByRole("tab", { name: "My Events" }).click();
  const card = page.locator(".event-card").filter({ hasText: title });
  await card.getByLabel("Registration deadline (optional)", { exact: true }).fill("2000-01-01T00:00");
  await card.getByRole("button", { name: "Save settings" }).click();
  await expect(card.getByRole("status")).toHaveText("Event settings saved");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  await page.getByLabel("Login identifier").fill(process.env.E2E_PARTICIPANT_LOGIN!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PARTICIPANT_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();
  await page.locator(".event-card").filter({ hasText: title }).getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register" })).not.toBeVisible();
});
