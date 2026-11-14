import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN!;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD!;
const participantLogin = process.env.E2E_PARTICIPANT_LOGIN!;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD!;
let createdEventId: string | null = null;

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

test("TEST-F03-01/04/06/07: participant discovers, registers, and views My Registrations", async ({ page }) => {
  const title = `Playwright Registration Event ${randomUUID()}`;
  const eventDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.goto("/");
  await login(page, organizerLogin, organizerPassword);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("A public registration journey event.");
  await page.getByLabel("Location", { exact: true }).fill("Main Hall");
  await page.locator("#event-start").fill(`${eventDate}T09:00`);
  await page.locator("#event-end").fill(`${eventDate}T12:00`);
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Publish event" }).click();
  await page.getByRole("tab", { name: "My Events" }).click();
  const publishedCard = page.locator(".event-card").filter({ hasText: title });
  await expect(publishedCard.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  const eventIdText = await publishedCard.locator(".event-id").innerText();
  createdEventId = eventIdText.replace(/^Event ID:\s*/, "").trim();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();

  await login(page, participantLogin, participantPassword);
  await page.getByRole("tab", { name: "Discover Events" }).click();
  const eventCard = page.locator(".event-card").filter({ hasText: title });
  await expect(eventCard).toBeVisible();
  await eventCard.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("region", { name: "Public event details" })).toContainText(title);
  await page.getByRole("region", { name: "Public event details" }).getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("region", { name: "Discover published events" }).getByRole("status")).toContainText("Registration confirmed");
  await page.getByRole("button", { name: "View My Registrations" }).click();
  await expect(page.getByRole("heading", { name: "My Registrations" })).toBeVisible();
  const myRegistrations = page.getByRole("region", { name: "My Registrations" });
  await expect(myRegistrations.getByText(title, { exact: true })).toBeVisible();
  await myRegistrations.locator(".event-card").filter({ hasText: title }).getByRole("button", { name: "View registration details" }).click();
  const registrationDetail = page.getByRole("region", { name: "Registration details" });
  await expect(registrationDetail).toContainText("ACTIVE");
  await expect(registrationDetail).toContainText(title);
  await expect(registrationDetail).toContainText(/Registration ID/);
  await page.reload();
  await page.getByRole("tab", { name: "Discover Events" }).click();
  await page.getByRole("tab", { name: "My Registrations" }).click();
  await expect(page.getByRole("heading", { name: "My Registrations" })).toBeVisible();
  await expect(page.getByRole("region", { name: "My Registrations" }).getByText(title, { exact: true })).toBeVisible();
});
