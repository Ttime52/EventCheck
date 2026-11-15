import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
const participantLogin = process.env.E2E_PARTICIPANT_LOGIN;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD;
let createdEventId: string | null = null;
let createdOtherOrganizerId: string | null = null;
const evidenceDirectory = resolve("docs/evidence/sprint-1/program");

async function capture(page: Page, name: string) {
  if (process.env.E2E_CAPTURE_EVIDENCE !== "1") return;
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDirectory, `${name}.png`), fullPage: true });
}

function isolatedDatabaseUrl() {
  const value = process.env.E2E_DATABASE_URL;
  if (!value) throw new Error("Missing isolated E2E database URL");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") throw new Error("Refusing database access outside eventcheck_test/public");
  return value;
}

test.beforeAll(() => {
  if (!organizerLogin || !organizerPassword || !participantLogin || !participantPassword) {
    throw new Error("Missing E2E organizer or participant credentials");
  }
});

test.afterEach(async () => {
  if (!createdEventId && !createdOtherOrganizerId) return;
  const prisma = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    if (createdEventId) {
      await prisma.registration.deleteMany({ where: { eventId: createdEventId } });
      await prisma.event.deleteMany({ where: { id: createdEventId } });
    }
    if (createdOtherOrganizerId) await prisma.user.deleteMany({ where: { id: createdOtherOrganizerId } });
  } finally {
    await prisma.$disconnect();
    createdEventId = null;
    createdOtherOrganizerId = null;
  }
});

async function login(page: Page, identifier: string, password: string) {
  await page.getByLabel("Login identifier").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("TEST-F03-16/TEST-F04-01/02/03/10: Organizer and Participant share one persisted registration with owner-only access", async ({ page }) => {
  const title = `Playwright Organizer Registration ${randomUUID()}`;
  const eventDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let persistedRegistration: { id: string; eventId: string; participantId: string; status: string; registeredAt: string } | undefined;

  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);
  await expect(page.getByRole("heading", { name: /Welcome, Demo Organizer/ })).toBeVisible();
  await capture(page, "01-organizer-login");
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
  const prisma = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    const persistedEvent = await prisma.event.findUniqueOrThrow({ where: { id: createdEventId } });
    expect(persistedEvent.title).toBe(title);
    expect(persistedEvent.publicationState).toBe("PUBLISHED");
  } finally { await prisma.$disconnect(); }

  await page.getByRole("tab", { name: "My Events" }).click();
  const ownedEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(ownedEvent.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  await capture(page, "02-published-event");
  await ownedEvent.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("form", { name: "Event details" })).toBeVisible();
  await page.getByRole("button", { name: "View registrations" }).click();
  const emptyList = page.getByRole("region", { name: `Registrations for ${title}` });
  await expect(emptyList).toContainText("No registrations for this event yet.");
  await expect(emptyList.getByRole("heading", { level: 2 })).toBeFocused();
  await capture(page, "03-empty-organizer-list");

  await page.getByRole("button", { name: "Back to Event details" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  await capture(page, "07-logged-out");

  await login(page, participantLogin!, participantPassword!);
  await page.getByRole("tab", { name: "Discover Events" }).click();
  const publicEvent = page.locator(".event-card").filter({ hasText: title });
  await expect(publicEvent).toBeVisible();
  await publicEvent.getByRole("button", { name: "View details" }).click();
  const detail = page.getByRole("region", { name: "Public event details" });
  await expect(detail).toContainText(title);
  await detail.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("region", { name: "Discover published events" }).getByRole("status")).toContainText("Registration confirmed");
  await capture(page, "04-registration-confirmed");
  await page.getByRole("button", { name: "View My Registrations" }).click();
  const myRegistrations = page.getByRole("region", { name: "My Registrations" });
  await expect(myRegistrations.getByText(title, { exact: true })).toBeVisible();
  await myRegistrations.locator(".event-card").filter({ hasText: title }).getByRole("button", { name: "View registration details" }).click();
  const participantDetail = page.getByRole("region", { name: "Registration details" });
  await expect(participantDetail).toContainText("ACTIVE");
  const registrationId = await participantDetail.locator(".event-id").innerText();
  await capture(page, "05-participant-saved-registration");

  const participantForbidden = await page.request.get(`/api/v1/organizer/events/${createdEventId}/registrations`);
  expect(participantForbidden.status()).toBe(403);
  expect((await participantForbidden.json()).data).toBeUndefined();
  const duplicate = await page.request.post(`/api/v1/events/${createdEventId}/registrations`, {
    headers: { Origin: new URL(page.url()).origin }, data: {},
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe("REGISTRATION_DUPLICATE");
  const saved = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    const stored = await saved.registration.findUniqueOrThrow({ where: { id: registrationId } });
    expect(stored.eventId).toBe(createdEventId);
    expect(stored.status).toBe("ACTIVE");
    persistedRegistration = { id: stored.id, eventId: stored.eventId, participantId: stored.participantId, status: stored.status, registeredAt: stored.registeredAt.toISOString() };
    expect(await saved.registration.count({ where: { eventId: createdEventId, participantId: stored.participantId, status: "ACTIVE" } })).toBe(1);
    if (process.env.E2E_CAPTURE_EVIDENCE === "1") {
      await writeFile(resolve(evidenceDirectory, "registration-database.json"), JSON.stringify({ eventId: stored.eventId, registrationId: stored.id, participantId: stored.participantId, status: stored.status, registeredAt: stored.registeredAt.toISOString(), observedBeforeFixtureCleanup: true }, null, 2));
      await writeFile(resolve(evidenceDirectory, "participant-forbidden-api.json"), JSON.stringify({ httpStatus: participantForbidden.status(), response: await participantForbidden.json() }, null, 2));
      await writeFile(resolve(evidenceDirectory, "duplicate-registration-api.json"), JSON.stringify({ httpStatus: duplicate.status(), response: await duplicate.json(), activeRowsAfterRejection: 1 }, null, 2));
    }
  } finally { await saved.$disconnect(); }

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
  await expect(registrations).toContainText(registrationId);
  await expect(registrations.getByRole("heading", { level: 2 })).toBeFocused();
  const ownerApi = await page.request.get(`/api/v1/organizer/events/${createdEventId}/registrations`);
  expect(ownerApi.status()).toBe(200);
  const ownerRows = (await ownerApi.json()).data.registrations as Array<{ id: string; participantId: string; status: string; registeredAt: string }>;
  expect(ownerRows).toContainEqual(expect.objectContaining({
    id: persistedRegistration!.id,
    participantId: persistedRegistration!.participantId,
    status: persistedRegistration!.status,
    registeredAt: persistedRegistration!.registeredAt,
  }));
  await capture(page, "06-organizer-persisted-list");
  if (process.env.E2E_CAPTURE_EVIDENCE === "1") await writeFile(resolve(evidenceDirectory, "organizer-list-api.json"), JSON.stringify({ httpStatus: ownerApi.status(), response: await ownerApi.json() }, null, 2));

  const otherOrganizerLogin = `f03-other-organizer-${randomUUID()}@example.test`;
  const fixture = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl() } } });
  try {
    const seededOrganizer = await fixture.user.findUniqueOrThrow({ where: { loginIdentifier: organizerLogin! } });
    const otherOrganizer = await fixture.user.create({ data: {
      loginIdentifier: otherOrganizerLogin,
      displayName: "Other Test Organizer",
      role: "ORGANIZER",
      passwordHash: seededOrganizer.passwordHash,
    } });
    createdOtherOrganizerId = otherOrganizer.id;
  } finally { await fixture.$disconnect(); }
  await page.getByRole("button", { name: "Log out" }).click();
  await login(page, otherOrganizerLogin, organizerPassword!);
  await expect(page.getByRole("heading", { name: "Welcome, Other Test Organizer" })).toBeVisible();
  const crossOwner = await page.request.get(`/api/v1/organizer/events/${createdEventId}/registrations`);
  expect(crossOwner.status()).toBe(404);
  const crossOwnerBody = await crossOwner.json();
  expect(crossOwnerBody.data).toBeUndefined();
  expect(JSON.stringify(crossOwnerBody)).not.toContain(registrationId);
  expect(JSON.stringify(crossOwnerBody)).not.toContain("Demo Participant");
  if (process.env.E2E_CAPTURE_EVIDENCE === "1") await writeFile(resolve(evidenceDirectory, "cross-owner-forbidden-api.json"), JSON.stringify({ httpStatus: crossOwner.status(), response: crossOwnerBody }, null, 2));
});
