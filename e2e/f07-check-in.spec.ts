import { test, expect } from "@playwright/test";

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
    const primaryRegistration = page.locator(".event-card").filter({ hasText: eventTitle });
    const secondaryRegistration = page.locator(".event-card").filter({ hasText: secondaryTitle });
    await expect(primaryRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toBeVisible();
    await expect(secondaryRegistration.getByText(/^Attendance:\s*Not Checked In$/)).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "My Registrations" }).click();
    await expect(primaryRegistration.getByText(/^Attendance:\s*Checked In\s·/)).toBeVisible();
    await expect(secondaryRegistration.getByText(/^Attendance:\s*Not Checked In$/)).toBeVisible();
  });
});
