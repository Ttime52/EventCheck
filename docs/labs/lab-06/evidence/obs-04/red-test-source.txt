import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const participant = { id: "uat-participant", displayName: "UAT Participant", role: "PARTICIPANT" as const };

type DiscoveryEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  remainingPlaces: number;
  registrationAvailable: boolean;
};

function response(body: unknown, ok = true, status = ok ? 200 : 401) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

function makeEvent(remainingPlaces: number, registrationAvailable = true): DiscoveryEvent {
  return {
    id: `event-${remainingPlaces}`,
    title: `Workshop (${remainingPlaces} remaining)`,
    description: "A public workshop.",
    location: "Main Hall",
    startAt: "2026-12-01T02:00:00.000Z",
    endAt: "2026-12-01T04:00:00.000Z",
    capacity: Math.max(remainingPlaces, 5),
    remainingPlaces,
    registrationAvailable,
  };
}

async function openDiscovery(events: DiscoveryEvent[]) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((input: string) => {
    const url = String(input);
    if (url.endsWith("/api/v1/me")) return response({ data: { user: participant } });
    if (url.endsWith("/api/v1/events")) return response({ data: { events } });
    if (url.endsWith("/api/v1/me/registrations")) return response({ data: { registrations: [] } });
    const detail = events.find((event) => url.endsWith(`/api/v1/events/${event.id}`));
    if (detail) return response({ data: { event: detail } });
    return response({ data: {} });
  }));

  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Discover Events" }));
  return screen.findByRole("list");
}

describe("UAT-01 OBS-04 event availability pluralization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { remainingPlaces: 1, expectedLabel: /^1 PLACE$/i },
    { remainingPlaces: 2, expectedLabel: /^2 PLACES$/i },
    { remainingPlaces: 5, expectedLabel: /^5 PLACES$/i },
  ])("renders the correct badge for $remainingPlaces remaining place(s)", async ({ remainingPlaces, expectedLabel }) => {
    const event = makeEvent(remainingPlaces);
    const list = await openDiscovery([event]);
    const card = within(list).getByRole("heading", { name: event.title }).closest("li");
    const badge = card?.querySelector(".published-badge");

    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent(expectedLabel);
  });

  it("preserves the full-event badge and zero-remaining detail display", async () => {
    const fullEvent = makeEvent(0, false);
    const list = await openDiscovery([fullEvent]);
    const card = within(list).getByRole("heading", { name: fullEvent.title }).closest("li");
    const badge = card?.querySelector(".published-badge");

    expect(badge).toHaveTextContent(/^Full$/i);
    expect(card).toHaveTextContent("0 remaining");

    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "View details" }));
    const details = await screen.findByRole("region", { name: "Public event details" });

    expect(details).toHaveTextContent("5 (0 remaining)");
    expect(within(details).getByText("Full")).toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: "Register" })).not.toBeInTheDocument();
  });
});
