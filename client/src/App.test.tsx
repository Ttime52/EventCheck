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
