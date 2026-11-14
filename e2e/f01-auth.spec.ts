import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const participantLogin = process.env.E2E_PARTICIPANT_LOGIN;
const participantPassword = process.env.E2E_PARTICIPANT_PASSWORD;
const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;

function isIsolatedE2EDatabase(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test";
  } catch {
    return false;
  }
}

test.beforeAll(() => {
  for (const [name, value] of Object.entries({ participantLogin, participantPassword, organizerLogin, organizerPassword })) {
    if (!value) throw new Error(`Missing ${name}; configure ignored E2E_* environment variables before running Playwright`);
  }
});

async function login(page: Page, identifier: string, password: string) {
  await page.getByLabel("Login identifier").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("F-01 authentication", () => {
  test("Participant login, identity, refresh, and logout", async ({ page }) => {
    await page.goto("/");
    await login(page, participantLogin!, participantPassword!);
    await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();
    await expect(page.getByText("PARTICIPANT", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
  });

  test("Organizer login shows the server-derived role", async ({ page }) => {
    await page.goto("/");
    await login(page, organizerLogin!, organizerPassword!);
    await expect(page.getByText("Welcome, Demo Organizer")).toBeVisible();
    await expect(page.getByText("ORGANIZER", { exact: true })).toBeVisible();
  });

  test("invalid and missing credentials are handled generically", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("status")).toHaveText(/Invalid credentials|Unable to sign in/);
    await page.getByLabel("Login identifier").fill("unknown@example.test");
    await page.getByLabel("Password", { exact: true }).fill("incorrect");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page.getByRole("status")).toHaveText("Invalid credentials");
  });

  test("password visibility is keyboard accessible and does not submit", async ({ page }) => {
    await page.goto("/");
    const identifier = page.getByLabel("Login identifier", { exact: true });
    const password = page.getByLabel("Password", { exact: true });
    const toggle = page.getByRole("button", { name: "Show password", exact: true });
    await identifier.focus();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(password).toBeFocused();
    await password.fill("example-password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(toggle.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("example-password");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("example-password");
    await expect(page.getByRole("status")).toHaveText("Sign in");
  });

  for (const width of [375, 390, 768, 1440]) {
    test(`responsive login layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
      expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Show password", exact: true })).toBeVisible();
      await login(page, participantLogin!, participantPassword!);
      await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();
      await expect(page.getByText("PARTICIPANT", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
      expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("expired or revoked sessions return safely to login", async ({ page }) => {
    test.skip(!isIsolatedE2EDatabase(e2eDatabaseUrl), "Requires E2E_DATABASE_URL pointing exactly to isolated eventcheck_test");
    await page.goto("/");
    await login(page, participantLogin!, participantPassword!);
    await expect(page.getByText("Welcome, Demo Participant")).toBeVisible();

    const [sessionCookie] = await page.context().cookies("http://localhost:5173");
    expect(sessionCookie?.name).toBe("eventcheck_session");
    const prisma = new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl! } } });
    try {
      await prisma.session.update({ where: { id: sessionCookie.value }, data: { absoluteExpiry: new Date(Date.now() - 1) } });
    } finally {
      await prisma.$disconnect();
    }

    await page.reload();
    await expect(page.getByRole("form", { name: "Login" })).toBeVisible();
    await expect(page.getByText("Welcome, Demo Participant")).not.toBeVisible();

    const currentUser = await page.request.get("/api/v1/me");
    expect(currentUser.status()).toBe(401);

    const replay = await page.request.get("/api/v1/me", { headers: { Cookie: `eventcheck_session=${sessionCookie.value}` } });
    expect(replay.status()).toBe(401);
  });
});
