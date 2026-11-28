import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const state = process.argv[2];
if (state !== "before" && state !== "after") {
  throw new Error("Usage: node capture-ui.mjs before|after");
}

const events = [1, 2, 5].map((remainingPlaces) => ({
  id: `obs04-${remainingPlaces}`,
  title: `OBS-04 Workshop (${remainingPlaces} remaining)`,
  description: "Synthetic public event used for local UI evidence.",
  location: "Main Hall",
  startAt: "2026-12-01T02:00:00.000Z",
  endAt: "2026-12-01T04:00:00.000Z",
  capacity: 5,
  remainingPlaces,
  registrationAvailable: true,
}));

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let body = { data: {} };
    if (url.pathname === "/api/v1/me") {
      body = { data: { user: { id: "uat-participant", displayName: "UAT Participant", role: "PARTICIPANT" } } };
    } else if (url.pathname === "/api/v1/events") {
      body = { data: { events } };
    } else if (url.pathname === "/api/v1/me/registrations") {
      body = { data: { registrations: [] } };
    } else if (url.pathname.startsWith("/api/v1/events/")) {
      const event = events.find((candidate) => url.pathname.endsWith(candidate.id));
      if (event) body = { data: { event } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Discover Events" }).click();
  const badges = page.locator(".published-badge");
  await badges.nth(2).waitFor();
  const observed = await badges.allTextContents();
  const expected = state === "before" ? ["1 places", "2 places", "5 places"] : ["1 place", "2 places", "5 places"];
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(observed)}`);
  }
  const textTransform = await badges.first().evaluate((element) => getComputedStyle(element).textTransform);
  if (textTransform !== "uppercase") throw new Error(`Expected badge text-transform uppercase, received ${textTransform}`);

  const screenshotPath = fileURLToPath(new URL(`./ui-${state}.png`, import.meta.url));
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot: ${screenshotPath}`);
  console.log(`Badge text: ${observed.join(" | ")}`);
  console.log(`Browser text-transform: ${textTransform}`);
} finally {
  await browser.close();
}
