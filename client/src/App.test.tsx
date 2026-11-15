import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const user = { id: "u1", displayName: "Test Participant", role: "PARTICIPANT" };
function response(body: unknown, ok = true, status = ok ? 200 : 401) { return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response); }

describe("F-01 authentication UI (TEST-F01-12)", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => response(null, false, 401))); });

  it("shows labelled login controls and handles a successful login", async () => {
    const fetchMock = vi.mocked(fetch);
    let calls = 0;
    fetchMock.mockImplementation(() => { calls += 1; return calls === 1 ? response(null, false, 401) : response({ data: { user } }); });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sign in"));
    expect(screen.getByLabelText("Login identifier")).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText("Login identifier"), { target: { value: "participant@example.test" } });
    fireEvent.input(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login" }));
    await waitFor(() => expect(screen.getByText(/Welcome, Test Participant/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("handles invalid, malformed, and network-failed login responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() => response({ error: {} }, false, 401));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sign in"));
    fireEvent.input(screen.getByLabelText("Login identifier"), { target: { value: "unknown@example.test" } });
    fireEvent.input(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Invalid credentials"));
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    fireEvent.submit(screen.getByRole("form", { name: "Login" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Unable to sign in"));
  });

  it("does not report logout success when the server rejects logout", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => String(input).includes("/auth/logout") ? response({}, false, 500) : String(input).endsWith("/me") ? response({ data: { user } }) : response({ data: { events: [], registrations: [] } }));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Welcome, Test Participant/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Unable to sign out"));
    expect(screen.getByText(/Welcome, Test Participant/)).toBeInTheDocument();
  });

  it("disables repeated login submissions while a request is pending", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(r => { resolve = r; })));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Login" })).toBeInTheDocument());
    const button = screen.getByRole("button", { name: "Log in" });
    fireEvent.submit(screen.getByRole("form", { name: "Login" }));
    expect(button).toBeDisabled();
    resolve(await response(null, false, 401));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Invalid credentials"));
  });

  it("returns safely to the login state when the session has expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: string) => input.includes("/me") ? response(null, false, 401) : response(null, false, 401)));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Login" })).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Sign in");
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("toggles password visibility without submitting or changing the value", async () => {
    render(<App />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "secret-value" } });
    const toggle = screen.getByRole("button", { name: "Show password" });
    const fetchMock = vi.mocked(fetch);
    expect(password.type).toBe("password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(password.type).toBe("text");
    expect(password.value).toBe("secret-value");
    const hideToggle = screen.getByRole("button", { name: "Hide password" });
    expect(hideToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hideToggle);
    expect(password.type).toBe("password");
    expect(password.value).toBe("secret-value");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/auth/login", expect.anything());
  });
});

describe("F-02 organizer event publishing UI", () => {
  const organizer = { id: "organizer-1", displayName: "Test Organizer", role: "ORGANIZER" as const };
  const event = {
    id: "event-1",
    title: "University Workshop",
    description: "A persisted workshop.",
    location: "Engineering Building 1",
    startAt: "2026-11-20T02:00:00.000Z",
    endAt: "2026-11-20T05:00:00.000Z",
    capacity: 25,
    publicationState: "PUBLISHED" as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("TEST-F02-01/02/14: shows the organizer form, publishes, and renders persisted event details", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => response({ data: { user: organizer } }))
      .mockImplementationOnce(() => response({ data: { events: [] } }))
      .mockImplementationOnce(() => response({ data: { event } }, true, 201));

    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "My Events" }));
    expect(screen.getByText(/No published events yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Create Event" }));

    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "University Workshop" } });
    fireEvent.input(screen.getByLabelText("Description"), { target: { value: "A persisted workshop." } });
    fireEvent.input(screen.getByLabelText("Location"), { target: { value: "Engineering Building 1" } });
    fireEvent.change(screen.getByLabelText("Start date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T09:00" } });
    fireEvent.change(screen.getByLabelText("End date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T12:00" } });
    fireEvent.input(screen.getByLabelText("Capacity (positive integer)"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish event" }));

    await waitFor(() => expect(screen.getByText("Event published. Event ID: event-1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "My Events" }));
    await waitFor(() => expect(screen.getByText("University Workshop")).toBeInTheDocument());
    const eventCall = fetchMock.mock.calls.find(([input]) => input === "/api/v1/events");
    expect(eventCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(eventCall?.[1]?.body))).toMatchObject({ startAt: "2026-11-20T02:00:00.000Z", endAt: "2026-11-20T05:00:00.000Z", capacity: 25 });
  });

  it("TEST-F02-03/04/05: maps API validation details to the event form", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => response({ data: { user: organizer } }))
      .mockImplementationOnce(() => response({ data: { events: [] } }))
      .mockImplementationOnce(() => response({ error: { code: "VALIDATION_ERROR", message: "Event details are invalid", details: [{ field: "capacity", message: "capacity must be a positive integer" }] } }, false, 422));

    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "University Workshop" } });
    fireEvent.input(screen.getByLabelText("Description"), { target: { value: "A persisted workshop." } });
    fireEvent.input(screen.getByLabelText("Location"), { target: { value: "Engineering Building 1" } });
    fireEvent.change(screen.getByLabelText("Start date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T09:00" } });
    fireEvent.change(screen.getByLabelText("End date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T12:00" } });
    fireEvent.input(screen.getByLabelText("Capacity (positive integer)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish event" }));

    await waitFor(() => expect(screen.getByText("capacity must be a positive integer")).toBeInTheDocument());
    expect(screen.queryByText("University Workshop", { selector: "h3" })).not.toBeInTheDocument();
  });

  it("TEST-F02-09/14: loads the selected owned event detail from the API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => response({ data: { user: organizer } }))
      .mockImplementationOnce(() => response({ data: { events: [event] } }))
      .mockImplementationOnce(() => response({ data: { event } }));

    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "My Events" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    const detail = await screen.findByRole("region", { name: "Event details" });
    const detailForm = await within(detail).findByRole("form", { name: "Event details" });
    expect(within(detailForm).getByLabelText("Title")).toHaveValue("University Workshop");
    expect(within(detailForm).getByLabelText("Description")).toHaveValue("A persisted workshop.");
    expect(within(detailForm).getByLabelText("Location")).toHaveValue("Engineering Building 1");
    expect(within(detailForm).getByLabelText(/Start date and time/)).toHaveValue("20 Nov 2026, 09:00");
    expect(within(detailForm).getByLabelText(/End date and time/)).toHaveValue("20 Nov 2026, 12:00");
    expect(within(detailForm).getByLabelText("Capacity")).toHaveValue("25");
    expect(within(detailForm).getByLabelText("Publication state")).toHaveValue("PUBLISHED");
    expect(within(detailForm).getByLabelText("Event ID")).toHaveValue("event-1");
    for (const field of within(detailForm).getAllByRole("textbox")) {
      expect(field).toHaveAttribute("readonly");
    }
    expect(screen.queryByRole("button", { name: /Save|Edit/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/organizer/events/event-1", { credentials: "include" });

    fireEvent.click(screen.getByRole("button", { name: "Back to Your events" }));
    fireEvent.click(screen.getByRole("tab", { name: "Create Event" }));
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
  });

  it("TEST-F02-09/14: shows a safe message when the selected event is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => response({ data: { user: organizer } }))
      .mockImplementationOnce(() => response({ data: { events: [event] } }))
      .mockImplementationOnce(() => response({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } }, false, 404));

    render(<App />);
    await waitFor(() => expect(screen.getByRole("form", { name: "Create and publish event" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "My Events" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Event not found"));
    expect(screen.getByRole("region", { name: "Event details" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Event details" })).not.toBeInTheDocument();
  });
});

describe("F-03 participant discovery UI", () => {
  const publicEvent = { id: "event-1", title: "University Workshop", description: "Public workshop", location: "Main Hall", startAt: "2026-12-01T02:00:00.000Z", endAt: "2026-12-01T04:00:00.000Z", capacity: 2, remainingPlaces: 2, registrationAvailable: true };

  it("TEST-F03-01/02/03: loads public events with empty and accessible states", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(() => response(null, false, 401)).mockImplementationOnce(() => response({ data: { events: [] } }));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Browse published events" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Browse published events" }));
    await waitFor(() => expect(screen.getByText("No published events are available.")).toBeInTheDocument());
  });

  it("TEST-F03-04/06/07: registers as Participant and shows My Registrations", async () => {
    const participant = { id: "participant-1", displayName: "Participant", role: "PARTICIPANT" as const };
    const fetchMock = vi.mocked(fetch);
    let registered = false;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/me")) return response({ data: { user: participant } });
      if (url.endsWith("/api/v1/events")) return response({ data: { events: [{ ...publicEvent, remainingPlaces: registered ? 1 : 2 }] } });
      if (url.includes("/api/v1/events/") && !url.includes("/registrations")) return response({ data: { event: publicEvent } });
      if (url.includes("/registrations") && init?.method === "POST") { registered = true; return response({ data: { registration: { id: "registration-1" } } }, true, 201); }
      if (url.includes("/me/registrations/")) return response({ data: { registration: { id: "registration-1", eventId: "event-1", status: "ACTIVE", registeredAt: "2026-12-01T00:00:00.000Z", event: publicEvent } } });
      return response({ data: { registrations: registered ? [{ id: "registration-1", eventId: "event-1", status: "ACTIVE", registeredAt: "2026-12-01T00:00:00.000Z", event: publicEvent }] : [] } });
    });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Discover Events" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Discover Events" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(screen.getByText(/Registration confirmed/)).toBeInTheDocument());
    expect(screen.getByText("My Registrations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View My Registrations" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "My Registrations" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("button", { name: "View registration details" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Registration details" })).toBeInTheDocument());
    expect(screen.getByText("registration-1")).toBeInTheDocument();
  });

  it("does not show Register controls to an Organizer", async () => {
    const organizer = { id: "organizer-1", displayName: "Organizer", role: "ORGANIZER" as const };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => String(input).endsWith("/me") ? response({ data: { user: organizer } }) : response({ data: { events: [publicEvent] } }));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Discover Events" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Discover Events" }));
    await waitFor(() => expect(screen.getByText("University Workshop")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Register" })).not.toBeInTheDocument();
  });

  it("refreshes availability after EVENT_FULL and preserves the exact conflict message", async () => {
    const participant = { id: "participant-1", displayName: "Participant", role: "PARTICIPANT" as const };
    const fetchMock = vi.mocked(fetch);
    let postCount = 0;
    let eventGets = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/me")) return response({ data: { user: participant } });
      if (url.endsWith("/api/v1/events")) { eventGets += 1; return response({ data: { events: [{ ...publicEvent, remainingPlaces: postCount ? 0 : 1, registrationAvailable: !postCount }] } }); }
      if (url.includes("/api/v1/events/") && !url.includes("/registrations")) return response({ data: { event: publicEvent } });
      if (url.includes("/registrations") && init?.method === "POST") { postCount += 1; return response({ error: { code: postCount === 1 ? "EVENT_FULL" : "REGISTRATION_DUPLICATE" } }, false, 409); }
      return response({ data: { registrations: [] } });
    });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Discover Events" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Discover Events" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    const publicPanel = screen.getByRole("region", { name: "Discover published events" });
    await waitFor(() => expect(within(publicPanel).getByRole("status")).toHaveTextContent("This event is full"));
    expect(eventGets).toBeGreaterThanOrEqual(2);
  });

  it("refreshes availability after REGISTRATION_DUPLICATE and preserves the exact conflict message", async () => {
    const participant = { id: "participant-1", displayName: "Participant", role: "PARTICIPANT" as const };
    const fetchMock = vi.mocked(fetch);
    let eventGets = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/me")) return response({ data: { user: participant } });
      if (url.endsWith("/api/v1/events")) { eventGets += 1; return response({ data: { events: [{ ...publicEvent, remainingPlaces: 1, registrationAvailable: true }] } }); }
      if (url.includes("/api/v1/events/") && !url.includes("/registrations")) return response({ data: { event: publicEvent } });
      if (url.includes("/registrations") && init?.method === "POST") return response({ error: { code: "REGISTRATION_DUPLICATE" } }, false, 409);
      return response({ data: { registrations: [] } });
    });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Discover Events" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Discover Events" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    const publicPanel = screen.getByRole("region", { name: "Discover published events" });
    await waitFor(() => expect(within(publicPanel).getByRole("status")).toHaveTextContent("already registered"));
    expect(eventGets).toBeGreaterThanOrEqual(2);
  });
});

describe("F-04 Organizer registration management UI", () => {
  const organizer = { id: "organizer-1", displayName: "Demo Organizer", role: "ORGANIZER" as const };
  const event = { id: "event-1", title: "University Workshop", description: "A persisted workshop.", location: "Engineering Building 1", startAt: "2026-11-20T02:00:00.000Z", endAt: "2026-11-20T05:00:00.000Z", capacity: 25, publicationState: "PUBLISHED" as const };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => response(null, false, 401)));
  });

  async function openRegistrationList() {
    await screen.findByRole("tab", { name: "My Events" });
    fireEvent.click(screen.getByRole("tab", { name: "My Events" }));
    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    await screen.findByRole("form", { name: "Event details" });
    fireEvent.click(screen.getByRole("button", { name: "View registrations" }));
  }

  it("TEST-F04-02/10: follows owned event navigation and renders approved registration fields in Bangkok time", async () => {
    const registration = {
      id: "registration-1",
      participantId: "participant-1",
      participantDisplayName: "Demo Participant",
      status: "ACTIVE",
      registeredAt: "2026-11-15T10:00:00.000Z",
      passwordHash: "must-never-be-rendered",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/organizer/events/${event.id}/registrations`)) return response({ data: { registrations: [registration] } });
      if (url.endsWith("/api/v1/me")) return response({ data: { user: organizer } });
      if (url.endsWith("/api/v1/organizer/events")) return response({ data: { events: [event] } });
      if (url.endsWith(`/api/v1/organizer/events/${event.id}`)) return response({ data: { event } });
      return response(null, false, 404);
    });

    render(<App />);
    await openRegistrationList();
    const region = await screen.findByRole("region", { name: "Registrations for University Workshop" });
    expect(within(region).getByText("1 registration")).toBeInTheDocument();
    expect(within(region).getByText("Demo Participant")).toBeInTheDocument();
    expect(within(region).getByText("participant-1")).toBeInTheDocument();
    expect(within(region).getByText("ACTIVE")).toBeInTheDocument();
    expect(within(region).getByText("15 Nov 2026, 17:00")).toBeInTheDocument();
    expect(within(region).queryByText("must-never-be-rendered")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/organizer/events/${event.id}/registrations`, { credentials: "include" });
    fireEvent.click(within(region).getByRole("button", { name: "Back to Event details" }));
    expect(await screen.findByRole("form", { name: "Event details" })).toBeInTheDocument();
  });

  it("TEST-F04-03/10: announces loading and displays the empty registration state", async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveList!: (value: Response) => void;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/organizer/events/${event.id}/registrations`)) return new Promise<Response>(resolve => { resolveList = resolve; });
      if (url.endsWith("/api/v1/me")) return response({ data: { user: organizer } });
      if (url.endsWith("/api/v1/organizer/events")) return response({ data: { events: [event] } });
      if (url.endsWith(`/api/v1/organizer/events/${event.id}`)) return response({ data: { event } });
      return response(null, false, 404);
    });

    render(<App />);
    await openRegistrationList();
    const loadingRegion = screen.getByRole("region", { name: "Registrations for University Workshop" });
    expect(within(loadingRegion).getByRole("status")).toHaveTextContent("Loading registrations...");
    resolveList(await response({ data: { registrations: [] } }));
    const region = await screen.findByRole("region", { name: "Registrations for University Workshop" });
    expect(within(region).getByText("0 registrations")).toBeInTheDocument();
    expect(within(region).getByText("No registrations for this event yet.")).toBeInTheDocument();
  });

  it("TEST-F04-10: shows a safe permission error without displaying registration data", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/organizer/events/${event.id}/registrations`)) return response({ error: { code: "FORBIDDEN", message: "Access denied" } }, false, 403);
      if (url.endsWith("/api/v1/me")) return response({ data: { user: organizer } });
      if (url.endsWith("/api/v1/organizer/events")) return response({ data: { events: [event] } });
      if (url.endsWith(`/api/v1/organizer/events/${event.id}`)) return response({ data: { event } });
      return response(null, false, 404);
    });

    render(<App />);
    await openRegistrationList();
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Demo Participant")).not.toBeInTheDocument();
    expect(screen.queryByText("participant-1")).not.toBeInTheDocument();
  });

  it("TEST-F04-10: exposes a retry for a temporary registration-list failure", async () => {
    const fetchMock = vi.mocked(fetch);
    let listAttempts = 0;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/organizer/events/${event.id}/registrations`)) {
        listAttempts += 1;
        return listAttempts === 1 ? Promise.reject(new Error("offline")) : response({ data: { registrations: [] } });
      }
      if (url.endsWith("/api/v1/me")) return response({ data: { user: organizer } });
      if (url.endsWith("/api/v1/organizer/events")) return response({ data: { events: [event] } });
      if (url.endsWith(`/api/v1/organizer/events/${event.id}`)) return response({ data: { event } });
      return response(null, false, 404);
    });

    render(<App />);
    await openRegistrationList();
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Unable to load registrations for this event. Try again.");
    const retryButton = within(error).getByRole("button", { name: "Retry" });
    expect(retryButton.tabIndex).toBe(0);
    fireEvent.click(retryButton);
    expect(await screen.findByText("0 registrations")).toBeInTheDocument();
    expect(listAttempts).toBe(2);
  });

  it("TEST-F04-06/10: returns to login after the registration request reports an expired session", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/organizer/events/${event.id}/registrations`)) return response({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, false, 401);
      if (url.endsWith("/api/v1/me")) return response({ data: { user: organizer } });
      if (url.endsWith("/api/v1/organizer/events")) return response({ data: { events: [event] } });
      if (url.endsWith(`/api/v1/organizer/events/${event.id}`)) return response({ data: { event } });
      return response(null, false, 404);
    });

    render(<App />);
    await openRegistrationList();
    expect(await screen.findByRole("form", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByText("Demo Participant")).not.toBeInTheDocument();
  });
});
