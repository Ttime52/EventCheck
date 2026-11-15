import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
const participantLogin = process.env.E2E_PARTICIPANT_LOGIN;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD;
let createdEventId: string | null = null;

test.beforeAll(() => {
  if (!organizerLogin || !organizerPassword || !participantLogin || !participantPassword) {
    throw new Error("Missing E2E organizer or participant credentials");
  }
});

test.afterEach(async () => {
  if (!createdEventId) return;
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing isolated E2E database URL for cleanup");
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") throw new Error("Refusing E2E cleanup outside eventcheck_test/public");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.registration.deleteMany({ where: { eventId: createdEventId } });
    await prisma.event.deleteMany({ where: { id: createdEventId } });
  } finally {
    await prisma.$disconnect();
    createdEventId = null;
  }
});

async function login(page: Page, identifier: string, password: string) {
  await page.getByLabel("Login identifier").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("TEST-F04-01/02/03/10: Organizer views persisted registrations from an owned Event", async ({ page }) => {
  const title = `Playwright Organizer Registration ${randomUUID()}`;
  const eventDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("An end-to-end Organizer registration list check.");
  await page.getByLabel("Location", { exact: true }).fill("Engineering Building 1");
  await page.locator("#event-start").fill(`${eventDate}T09:00`);
  await page.locator("#event-end").fill(`${eventDate}T12:00`);
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Publish event" }).click();

  const publishStatus = page.locator('form[aria-label="Create and publish event"] [role="status"]');
  await expect(publishStatus).toHaveText(/Event published\. Event ID: .+/);
  const eventIdMatch = (await publishStatus.innerText()).match(/Event ID:\s*(\S+)/);
  expect(eventIdMatch).not.toBeNull();
  createdEventId = eventIdMatch![1];

  await page.getByRole("tab", { name: "My Events" }).click();
  const ownedEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(ownedEvent.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await ownedEvent.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("form", { name: "Event details" })).toBeVisible();
  await page.getByRole("button", { name: "View registrations" }).click();
  const emptyList = page.getByRole("region", { name: `Registrations for ${title}` });
  await expect(emptyList).toContainText("No registrations for this event yet.");
  await expect(emptyList.getByRole("heading", { level: 2 })).toBeFocused();

  await page.getByRole("button", { name: "Back to Event details" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();

  await login(page, participantLogin!, participantPassword!);
  await page.getByRole("tab", { name: "Discover Events" }).click();
  const publicEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(publicEvent).toBeVisible();
  await publicEvent.getByRole("button", { name: "View details" }).click();
  const detail = page.getByRole("region", { name: "Public event details" });
  await expect(detail).toContainText(title);
  await detail.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("region", { name: "Discover published events" }).getByRole("status")).toContainText("Registration confirmed");

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  await login(page, organizerLogin!, organizerPassword!);
  await page.getByRole("tab", { name: "My Events" }).click();
  const refreshedOwnedEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(refreshedOwnedEvent.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await refreshedOwnedEvent.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("form", { name: "Event details" })).toBeVisible();
  await page.getByRole("button", { name: "View registrations" }).click();

  const registrations = page.getByRole("region", { name: `Registrations for ${title}` });
  await expect(registrations).toContainText("1 registration");
  await expect(registrations).toContainText("Demo Participant");
  await expect(registrations).toContainText("Participant ID");
  await expect(registrations).toContainText("ACTIVE");
  await expect(registrations.getByRole("heading", { level: 2 })).toBeFocused();
});
