import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";

async function captureEvidence(page: Page, fileName: string) {
  if (process.env.E2E_CAPTURE_EVIDENCE !== "1") return;
  const evidenceDirectory = resolve("docs/evidence/sprint-2");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDirectory, fileName), fullPage: true });
}

async function tabUntilFocused(page: Page, target: Locator, direction: "forward" | "backward", maxTabs = 24) {
  const key = direction === "forward" ? "Tab" : "Shift+Tab";
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press(key);
    if (await target.evaluate((element: Element) => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard traversal did not reach target after ${maxTabs} ${direction} tabs`);
}

async function openBoundaryRegistrations(page: Page, boundary: "before" | "start" | "during" | "before-end" | "end" | "after") {
  const title = process.env.E2E_F07_BOUNDARY_EVENT_TITLE;
  const startAt = process.env.E2E_F07_BOUNDARY_START_AT;
  const endAt = process.env.E2E_F07_BOUNDARY_END_AT;
  if (!title || !startAt || !endAt) throw new Error("F07 boundary fixture is missing");
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const timestamp = new Date(boundary === "before" ? start - 1 : boundary === "start" ? start : boundary === "during" ? start + 1 : boundary === "before-end" ? end - 1 : boundary === "end" ? end : end + 1);
  await page.clock.install();
  await page.clock.setFixedTime(timestamp);
  await page.goto("/");
  await page.getByLabel("Login identifier", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_LOGIN ?? "");
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_PASSWORD ?? "");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("tab", { name: "My Events" }).click();
  const card = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "View details" }).click();
  await page.getByRole("button", { name: "View registrations" }).click();
  return { title, startAt: new Date(startAt), endAt: new Date(endAt) };
}

function isolatedE2eTarget(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test" && url.searchParams.get("schema") === "public";
  } catch { return false; }
}

test.describe.serial("F-07 check-in and attendance", () => {
  test.skip(!isolatedE2eTarget(process.env.E2E_DATABASE_URL), "requires eventcheck_test/public");
  const eventTitle = process.env.E2E_F07_EVENT_TITLE ?? "";

  test("TEST-F07-11: Organizer checks in an eligible registration", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Login identifier", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_LOGIN ?? "");
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_PASSWORD ?? "");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("tab", { name: "My Events" })).toBeVisible();
    await page.getByRole("tab", { name: "My Events" }).click();
    const eventCard = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: eventTitle, exact: true }) });
    await expect(eventCard).toHaveCount(1);
    await eventCard.getByRole("button", { name: "View details" }).click();
    await page.getByRole("button", { name: "View registrations" }).click();
    await expect(page.getByRole("heading", { name: "Registrations for" })).toBeFocused();
    const activeList = page.getByRole("list", { name: "Active Registrations" });
    await expect(activeList.getByText("Not Checked In", { exact: true })).toBeVisible();
    await expect(activeList.getByRole("button", { name: "Check in participant" })).toBeEnabled();
    const summary = page.getByLabel("Attendance summary");
    await expect(summary.getByText("Active registrations").locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Cancelled registrations").locator(".." ).locator("strong")).toHaveText("2");
    await expect(summary.getByText("Checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("0");
    await expect(summary.getByText("Not checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Remaining seats").locator(".." ).locator("strong")).toHaveText("4");
    await expect(summary.getByText("Total registration records").locator(".." ).locator("strong")).toHaveText("3");
    await captureEvidence(page, "f07-before-checkin-active-1-cancelled-2-not-checked-1.png");
    await activeList.getByRole("button", { name: "Check in participant" }).click();
    await expect(page.getByText("Attendance recorded.")).toBeVisible();
    await expect(activeList.getByText(/Checked In —/)).toBeVisible();
    await expect(activeList.getByRole("button", { name: "Check in participant" })).toHaveCount(0);
    const history = page.getByRole("list", { name: "Registration History" });
    await expect(history.getByText("CANCELLED", { exact: true })).toHaveCount(2);
    await expect(history.getByRole("button", { name: /Check in participant/ })).toHaveCount(0);
    await expect(summary.getByText("Active registrations").locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Cancelled registrations").locator(".." ).locator("strong")).toHaveText("2");
    await expect(summary.getByText("Checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Not checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("0");
    await expect(summary.getByText("Remaining seats").locator(".." ).locator("strong")).toHaveText("4");
    await expect(summary.getByText("Total registration records").locator(".." ).locator("strong")).toHaveText("3");
    await captureEvidence(page, "f07-after-checkin-active-1-cancelled-2-checked-in-1.png");
  });

  test("TEST-F07-12: Participant sees attendance after reload", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Login identifier", { exact: true }).fill(process.env.E2E_F07_PARTICIPANT_LOGIN ?? "");
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_F07_PARTICIPANT_PASSWORD ?? "");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("tab", { name: "My Registrations" }).click();
    const secondaryTitle = process.env.E2E_F07_SECONDARY_EVENT_TITLE;
    if (!secondaryTitle) throw new Error("E2E_F07_SECONDARY_EVENT_TITLE fixture is missing");
    const primaryRegistration = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: eventTitle, exact: true }) }).filter({ hasText: /Status:\s*ACTIVE\b/ });
    const cancelledRegistration = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: eventTitle, exact: true }) }).filter({ hasText: /Status:\s*CANCELLED\b/ });
    const secondaryRegistration = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: secondaryTitle, exact: true }) });
    await expect(primaryRegistration).toHaveCount(1);
    await expect(cancelledRegistration).toHaveCount(2);
    await expect(secondaryRegistration).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Check in participant/i })).toHaveCount(0);
    await expect(primaryRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toBeVisible();
    await expect(cancelledRegistration.getByText(/^Status:\s*CANCELLED\b/)).toHaveCount(2);
    await expect(cancelledRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toHaveCount(0);
    await expect(secondaryRegistration.getByText(/^Attendance:\s*Not Checked In$/)).toBeVisible();
    const detailsButton = primaryRegistration.getByRole("button", { name: /View event details|View registration details/i });
    await tabUntilFocused(page, detailsButton, "forward");
    await expect(detailsButton).toBeFocused();
    await page.keyboard.press("Enter");
    const registrationDetail = page.locator("section.registration-detail-view");
    await expect(registrationDetail).toBeVisible();
    await expect(registrationDetail.getByRole("heading", { name: eventTitle, exact: true })).toBeVisible();
    await expect(registrationDetail.getByText(/^Registration status$/)).toBeVisible();
    const backButton = page.getByRole("button", { name: "Back to My Registrations" });
    await tabUntilFocused(page, backButton, "backward");
    await expect(backButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "My Registrations", exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "My Registrations" }).click();
    await expect(primaryRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toBeVisible();
    await expect(cancelledRegistration.getByText(/^Status:\s*CANCELLED\b/)).toHaveCount(2);
    await expect(cancelledRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toHaveCount(0);
    await expect(secondaryRegistration.getByText(/^Attendance:\s*Not Checked In$/)).toBeVisible();
  });

  test("TEST-F07-11: Organizer recovers from an attendance loading failure", async ({ page }) => {
    let attendanceAttempts = 0;
    await page.route("**/api/v1/organizer/events/*/attendance", async route => {
      attendanceAttempts += 1;
      if (attendanceAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "attendance service unavailable" } }) });
      } else {
        await route.continue();
      }
    });
    await page.goto("/");
    await page.getByLabel("Login identifier", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_LOGIN ?? "");
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_PASSWORD ?? "");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("tab", { name: "My Events" }).click();
    const eventCard = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: eventTitle, exact: true }) });
    await eventCard.getByRole("button", { name: "View details" }).click();
    await page.getByRole("button", { name: "View registrations" }).click();
    await expect(page.getByRole("alert")).toContainText(/attendance/i);
    const retryAttendance = page.getByRole("button", { name: "Retry attendance" });
    await expect(retryAttendance).toBeVisible();
    await tabUntilFocused(page, retryAttendance, "forward");
    await expect(retryAttendance).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Attendance summary")).toBeVisible();
    expect(attendanceAttempts).toBe(2);
  });

  test("TEST-F07-11: Organizer exposes attendance loading state before recovery", async ({ page }) => {
    let releaseAttendance!: () => void;
    let requestSeen!: () => void;
    const attendanceRequestSeen = new Promise<void>(resolve => { requestSeen = resolve; });
    const attendanceBlocked = new Promise<void>(resolve => { releaseAttendance = resolve; });
    await page.route("**/api/v1/organizer/events/*/attendance", async route => {
      requestSeen();
      await attendanceBlocked;
      await route.continue();
    });
    try {
      await page.goto("/");
      await page.getByLabel("Login identifier", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_LOGIN ?? "");
      await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_F07_ORGANIZER_PASSWORD ?? "");
      await page.getByRole("button", { name: "Log in" }).click();
      await page.getByRole("tab", { name: "My Events" }).click();
      const eventCard = page.locator(".event-card").filter({ has: page.getByRole("heading", { name: eventTitle, exact: true }) });
      await eventCard.getByRole("button", { name: "View details" }).click();
      await page.getByRole("button", { name: "View registrations" }).click();
      await attendanceRequestSeen;
      await expect(page.getByRole("status").filter({ hasText: "Loading attendance" })).toBeVisible();
      releaseAttendance();
      await expect(page.getByRole("status").filter({ hasText: "Loading attendance" })).toHaveCount(0);
      await expect(page.getByLabel("Attendance summary")).toBeVisible();
    } finally {
      releaseAttendance();
      await page.unroute("**/api/v1/organizer/events/*/attendance");
    }
  });

  test("TEST-F07-11: Organizer disables check-in before start", async ({ page }) => {
    await openBoundaryRegistrations(page, "before");
    const status = page.locator(".attendance-event-summary .event-status");
    await expect(status).toHaveText("Upcoming");
    const active = page.getByRole("list", { name: "Active Registrations" });
    await expect(active.getByRole("button", { name: "Check in participant" })).toBeDisabled();
    await expect(active).toContainText("Check-in opens at event start.");
  });

  test("TEST-F07-11: Organizer enables check-in at start", async ({ page }) => {
    await openBoundaryRegistrations(page, "start");
    await expect(page.locator(".attendance-event-summary .event-status")).toHaveText("Ongoing");
    await expect(page.getByRole("list", { name: "Active Registrations" }).getByRole("button", { name: "Check in participant" })).toBeEnabled();
  });

  test("TEST-F07-11: Organizer keeps check-in enabled during window", async ({ page }) => {
    await openBoundaryRegistrations(page, "during");
    await expect(page.locator(".attendance-event-summary .event-status")).toHaveText("Ongoing");
    await expect(page.getByRole("list", { name: "Active Registrations" }).getByRole("button", { name: "Check in participant" })).toBeEnabled();
  });

  test("TEST-F07-11: Organizer keeps check-in enabled immediately before end", async ({ page }) => {
    await openBoundaryRegistrations(page, "before-end");
    await expect(page.locator(".attendance-event-summary .event-status")).toHaveText("Ongoing");
    await expect(page.getByRole("list", { name: "Active Registrations" }).getByRole("button", { name: "Check in participant" })).toBeEnabled();
  });

  test("TEST-F07-11: Organizer disables check-in at end", async ({ page }) => {
    await openBoundaryRegistrations(page, "end");
    await expect(page.locator(".attendance-event-summary .event-status")).toHaveText("Ended");
    const active = page.getByRole("list", { name: "Active Registrations" });
    await expect(active.getByRole("button", { name: "Check in participant" })).toBeDisabled();
    await expect(active).toContainText("Check-in closed after the event ended.");
  });

  test("TEST-F07-11: Organizer keeps check-in disabled after end", async ({ page }) => {
    await openBoundaryRegistrations(page, "after");
    await expect(page.locator(".attendance-event-summary .event-status")).toHaveText("Ended");
    await expect(page.getByRole("list", { name: "Active Registrations" }).getByRole("button", { name: "Check in participant" })).toBeDisabled();
  });
});
