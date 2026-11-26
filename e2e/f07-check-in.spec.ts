import { test, expect, type Locator, type Page } from "@playwright/test";

async function tabUntilFocused(page: Page, target: Locator, direction: "forward" | "backward", maxTabs = 24) {
  const key = direction === "forward" ? "Tab" : "Shift+Tab";
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press(key);
    if (await target.evaluate((element: Element) => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard traversal did not reach target after ${maxTabs} ${direction} tabs`);
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
    await activeList.getByRole("button", { name: "Check in participant" }).click();
    await expect(page.getByText("Attendance recorded.")).toBeVisible();
    await expect(activeList.getByText(/Checked In —/)).toBeVisible();
    await expect(activeList.getByRole("button", { name: "Check in participant" })).toHaveCount(0);
    const history = page.getByRole("list", { name: "Registration History" });
    await expect(history.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(history.getByRole("button", { name: /Check in participant/ })).toHaveCount(0);
    const summary = page.getByLabel("Attendance summary");
    await expect(summary.getByText("Active registrations").locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Cancelled registrations").locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("1");
    await expect(summary.getByText("Not checked in", { exact: true }).locator(".." ).locator("strong")).toHaveText("0");
    await expect(summary.getByText("Remaining seats").locator(".." ).locator("strong")).toHaveText("4");
    await expect(summary.getByText("Total registration records").locator(".." ).locator("strong")).toHaveText("2");
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
    await expect(cancelledRegistration).toHaveCount(1);
    await expect(secondaryRegistration).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Check in participant/i })).toHaveCount(0);
    await expect(primaryRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toBeVisible();
    await expect(cancelledRegistration.getByText(/^Status:\s*CANCELLED\b/)).toBeVisible();
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
    await expect(cancelledRegistration.getByText(/^Status:\s*CANCELLED\b/)).toBeVisible();
    await expect(cancelledRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toHaveCount(0);
    await expect(secondaryRegistration.getByText(/^Attendance:\s*Not Checked In$/)).toBeVisible();
  });
});
