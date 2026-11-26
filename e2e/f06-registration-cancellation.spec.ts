import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN!;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD!;
const participantLogin = process.env.E2E_PARTICIPANT_LOGIN!;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD!;
let createdEventId: string | null = null;

function isolatedDatabaseUrl() {
  const value = process.env.E2E_DATABASE_URL;
  if (!value) throw new Error("Missing isolated E2E database URL for cleanup");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") throw new Error("Refusing E2E cleanup outside eventcheck_test/public");
  return value;
}

test.afterEach(async () => {
  if (!createdEventId) return;
  const prisma = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    await prisma.attendance.deleteMany({ where: { eventId: createdEventId } });
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

test("TEST-F06-15: Participant cancels, keeps history after reload, and re-registers as a new row", async ({ page }) => {
  const title = `Playwright Cancellation Event ${randomUUID()}`;
  const eventDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.goto("/");
  await login(page, organizerLogin, organizerPassword);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("A persisted cancellation and re-registration journey.");
  await page.getByLabel("Location", { exact: true }).fill("Main Hall");
  await page.locator("#event-start").fill(`${eventDate}T09:00`);
  await page.locator("#event-end").fill(`${eventDate}T12:00`);
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("5");
  const publishResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/events" && response.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Publish event" }).click();
  const publishResponse = await publishResponsePromise;
  const publishBody = await publishResponse.json().catch(() => null) as { data?: { event?: { id?: unknown } } } | null;
  if (typeof publishBody?.data?.event?.id === "string") createdEventId = publishBody.data.event.id;
  if (!createdEventId) {
    const cleanupClient = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
    try {
      const publishedFixture = await cleanupClient.event.findFirst({
        where: { title, organizer: { loginIdentifier: organizerLogin } },
        select: { id: true },
      });
      createdEventId = publishedFixture?.id ?? null;
    } finally {
      await cleanupClient.$disconnect();
    }
  }
  expect(publishResponse.status()).toBe(201);
  expect(createdEventId).toBeTruthy();

  await page.getByRole("tab", { name: "My Events" }).click();
  const ownedEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(ownedEvent.getByRole("heading", { name: title, level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  await login(page, participantLogin, participantPassword);
  await page.getByRole("tab", { name: "Discover Events" }).click();
  const publicEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(publicEvent).toBeVisible();
  await publicEvent.getByRole("button", { name: "View details" }).click();
  const detail = page.getByRole("region", { name: "Public event details" });
  await detail.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("region", { name: "Discover published events" }).getByRole("status")).toContainText("Registration confirmed");
  await page.getByRole("button", { name: "View My Registrations" }).click();

  let myRegistrations = page.getByRole("region", { name: "My Registrations" });
  const firstCard = myRegistrations.locator(".event-card").filter({ hasText: title });
  const cancelButton = firstCard.getByRole("button", { name: `Cancel registration for ${title}` });
  await expect(cancelButton).toBeVisible();
  await expect(firstCard).not.toContainText("Loading attendance...");
  await expect(firstCard).not.toContainText("Attendance unavailable");
  // Tab navigation is stable only after the tab-switch focus effect has run.
  await expect(myRegistrations.getByRole("heading", { name: "My Registrations", exact: true })).toBeFocused();
  const detailsButton = firstCard.getByRole("button", { name: "View registration details" });
  await expect(detailsButton).toBeVisible();
  await detailsButton.press("Tab");
  await expect(cancelButton).toBeFocused();
  const confirmation = page.waitForEvent("dialog");
  const cancellationResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/cancel"));
  const acceptConfirmation = confirmation.then(async dialog => {
    expect(dialog.message()).toContain(title);
    await dialog.accept();
  });
  await page.keyboard.press("Enter");
  await acceptConfirmation;
  expect((await cancellationResponse).status()).toBe(200);
  await expect(page.getByRole("region", { name: "My Registrations" }).getByRole("status")).toContainText("Registration cancelled.");
  await expect(firstCard).toContainText("CANCELLED");

  const prisma = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  let participantId = "";
  let original: { id: string; registeredAt: Date; cancelledAt: Date | null } | undefined;
  try {
    const participant = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: participantLogin }, select: { id: true } });
    participantId = participant.id;
    original = await prisma.registration.findFirstOrThrow({ where: { eventId: createdEventId!, participantId, status: "CANCELLED" }, select: { id: true, registeredAt: true, cancelledAt: true } });
    expect(original.cancelledAt).toBeInstanceOf(Date);
  } finally { await prisma.$disconnect(); }

  await page.reload();
  await page.getByRole("tab", { name: "My Registrations" }).click();
  myRegistrations = page.getByRole("region", { name: "My Registrations" });
  await expect(myRegistrations.locator(".event-card").filter({ hasText: title })).toContainText("CANCELLED");
  await expect(myRegistrations.getByRole("button", { name: `Cancel registration for ${title}` })).toHaveCount(0);

  await page.getByRole("tab", { name: "Discover Events" }).click();
  const reloadedEvent = page.locator(".event-card").filter({ hasText: title });
  await reloadedEvent.getByRole("button", { name: "View details" }).click();
  const reloadedDetail = page.getByRole("region", { name: "Public event details" });
  const registerAgain = reloadedDetail.getByRole("button", { name: "Register again" });
  await expect(registerAgain).toBeVisible();
  await registerAgain.click();
  await expect(page.getByRole("region", { name: "Discover published events" }).getByRole("status")).toContainText("Registration confirmed.");
  await page.getByRole("button", { name: "View My Registrations" }).click();
  myRegistrations = page.getByRole("region", { name: "My Registrations" });
  const eventHistory = myRegistrations.locator(".event-card").filter({ hasText: title });
  await expect(eventHistory).toHaveCount(2);
  await expect(eventHistory.filter({ hasText: "CANCELLED" })).toHaveCount(1);
  await expect(eventHistory.filter({ hasText: "ACTIVE" })).toHaveCount(1);

  const verify = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    const rows = await verify.registration.findMany({ where: { eventId: createdEventId!, participantId }, orderBy: { registeredAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.id === original!.id)).toMatchObject({ status: "CANCELLED", registeredAt: original!.registeredAt, cancelledAt: original!.cancelledAt });
    expect(rows.filter(row => row.status === "ACTIVE")).toHaveLength(1);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
  } finally { await verify.$disconnect(); }
});
