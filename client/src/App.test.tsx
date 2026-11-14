import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fetchMock.mockImplementationOnce(() => response({ data: { user } })).mockImplementationOnce(() => response({}, false, 500));
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
    expect(screen.getByText(/No published events yet/)).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "University Workshop" } });
    fireEvent.input(screen.getByLabelText("Description"), { target: { value: "A persisted workshop." } });
    fireEvent.input(screen.getByLabelText("Location"), { target: { value: "Engineering Building 1" } });
    fireEvent.change(screen.getByLabelText("Start date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T09:00" } });
    fireEvent.change(screen.getByLabelText("End date and time — Asia/Bangkok (UTC+7)"), { target: { value: "2026-11-20T12:00" } });
    fireEvent.input(screen.getByLabelText("Capacity (positive integer)"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish event" }));

    await waitFor(() => expect(screen.getByText("Event published. Event ID: event-1")).toBeInTheDocument());
    expect(screen.getByText("University Workshop")).toBeInTheDocument();
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
});
