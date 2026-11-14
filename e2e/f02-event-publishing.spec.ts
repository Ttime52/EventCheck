import { expect, test, type Page } from "@playwright/test";

const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
const participantLogin = process.env.E2E_PARTICIPANT_LOGIN;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD;

test.beforeAll(() => {
  if (!organizerLogin || !organizerPassword || !participantLogin || !participantPassword) {
    throw new Error("Missing E2E organizer or participant credentials");
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

  const eventCard = page.locator(".event-card").filter({ hasText: title });
  await expect(eventCard).toHaveCount(1);
  await expect(eventCard.getByText("Published", { exact: true })).toBeVisible();
  await eventCard.getByRole("button", { name: "View details" }).click();
  const detail = page.getByRole("region", { name: "Event details" });
  await expect(detail).toBeVisible();
  const detailForm = detail.getByRole("form", { name: "Event details" });
  await expect(detailForm.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(detailForm.locator("#detail-description")).toHaveValue("A Playwright persistence check.");
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
  await expect(eventCard.getByText("Engineering Building 1", { exact: true })).toBeVisible();
});

test("TEST-F02-03/05/14: required fields and invalid capacity show safe feedback", async ({ page }) => {
  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);
  const form = page.getByRole("form", { name: "Create and publish event" });
  await expect(form).toBeVisible();

  const requiredFields = [
    page.getByLabel("Title", { exact: true }),
    page.getByLabel("Description", { exact: true }),
    page.getByLabel("Location", { exact: true }),
    page.locator("#event-start"),
    page.locator("#event-end"),
    page.getByLabel("Capacity (positive integer)", { exact: true }),
  ];
  for (const field of requiredFields) await expect(field).toHaveAttribute("required", "");

  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
  expect(await page.getByLabel("Title", { exact: true }).evaluate((element) => !(element as HTMLInputElement).validity.valid)).toBe(true);

  const title = `Playwright invalid event ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Invalid capacity should not persist.");
  await page.getByLabel("Location", { exact: true }).fill("Engineering Building 1");
  await page.locator("#event-start").fill("2026-11-20T09:00");
  await page.locator("#event-end").fill("2026-11-20T12:00");
  await page.getByLabel("Capacity (positive integer)", { exact: true }).fill("0");
  await form.evaluate((element) => { (element as HTMLFormElement).noValidate = true; });
  await page.getByRole("button", { name: "Publish event" }).click();

  await expect(page.locator("#event-capacity-error")).toHaveText("capacity must be a positive integer");
  await expect(page.getByRole("heading", { name: title, level: 3 })).not.toBeVisible();
});

test("TEST-F02-01/14: Organizer event form follows keyboard focus order", async ({ page }) => {
  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);

  const title = page.getByLabel("Title", { exact: true });
  const description = page.getByLabel("Description", { exact: true });
  const location = page.getByLabel("Location", { exact: true });
  const start = page.locator("#event-start");
  const end = page.locator("#event-end");
  const capacity = page.getByLabel("Capacity (positive integer)", { exact: true });
  const publish = page.getByRole("button", { name: "Publish event" });

  await title.focus();
  const controls = [
    ["title", title],
    ["description", description],
    ["location", location],
    ["start", start],
    ["end", end],
    ["capacity", capacity],
    ["publish", publish],
  ] as const;
  const reached = new Set<string>();

  for (let tab = 0; tab < 20 && reached.size < controls.length; tab += 1) {
    for (const [name, control] of controls) {
      if (await control.evaluate((element) => element === document.activeElement)) reached.add(name);
    }
    if (reached.size === controls.length) break;
    await page.keyboard.press("Tab");
  }

  expect([...reached].sort()).toEqual(controls.map(([name]) => name).sort());
  await expect(publish).toBeFocused();
  await expect(publish.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

test("TEST-F02-06/14: Participant does not receive Organizer event controls", async ({ page }) => {
  await page.goto("/");
  await login(page, participantLogin!, participantPassword!);

  await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();
  await expect(page.getByText("PARTICIPANT", { exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Create and publish event" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Publish event" })).not.toBeVisible();
  await expect(page.getByText("Your events are coming soon")).toBeVisible();
});

test("TEST-F02-06/14: expired Organizer event session returns safely to login", async ({ page }) => {
  await page.goto("/");
  await login(page, organizerLogin!, organizerPassword!);
  await expect(page.getByText("Welcome, Demo Organizer")).toBeVisible();

  await page.route("**/api/v1/organizer/events", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SESSION_EXPIRED", message: "Session expired" } }),
    });
  });
  await page.reload();

  await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  await expect(page.getByText("Welcome, Demo Organizer")).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Session expired; sign in again");
});
