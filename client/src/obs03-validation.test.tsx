import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const timeError = "endAt must be later than startAt";
const summaryError = "Event details are invalid";

async function openForm(extraIssues: { field: string; message: string }[] = []) {
  const posts = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (input, init) => {
    const path = String(input);
    let body: unknown;
    let status = 200;
    if (path === "/api/v1/me") {
      body = { data: { user: { id: "obs03-organizer", displayName: "OBS-03 Organizer", role: "ORGANIZER" } } };
    } else if (path === "/api/v1/organizer/events") {
      body = { data: { events: [] } };
    } else if (path === "/api/v1/events" && init?.method === "POST") {
      posts(JSON.parse(String(init.body)));
      status = 422;
      body = { error: { code: "VALIDATION_ERROR", message: summaryError,
        details: [{ field: "endAt", message: timeError }, ...extraIssues] } };
    } else {
      throw new Error(`Unexpected request: ${path}`);
    }
    return { ok: status === 200, status, json: async () => body } as Response;
  }));
  render(<App />);
  const form = await screen.findByRole("form", { name: "Create and publish event" }) as HTMLFormElement;
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/organizer/events", expect.anything()));
  const title = within(form).getByLabelText("Title") as HTMLInputElement;
  const start = within(form).getByLabelText(/Start date and time/) as HTMLInputElement;
  const end = within(form).getByLabelText(/End date and time/) as HTMLInputElement;
  const capacity = within(form).getByLabelText("Capacity (positive integer)") as HTMLInputElement;
  fireEvent.input(title, { target: { value: "OBS-03 synthetic event" } });
  fireEvent.input(within(form).getByLabelText("Description"), { target: { value: "Synthetic validation fixture" } });
  fireEvent.input(within(form).getByLabelText("Location"), { target: { value: "Test Hall" } });
  fireEvent.change(start, { target: { value: "2099-11-28T09:00" } });
  fireEvent.change(end, { target: { value: "2099-11-28T09:00" } });
  fireEvent.input(capacity, { target: { value: "1" } });
  return { form, title, start, end, capacity, posts,
    publish: within(form).getByRole("button", { name: "Publish event" }) };
}

async function rejectEqualTimes(fixture: Awaited<ReturnType<typeof openForm>>) {
  expect(fixture.form.checkValidity()).toBe(true); // Date ordering is an API business rule.
  fireEvent.click(fixture.publish); // Use native submit activation, not fireEvent.submit.
  await within(fixture.form).findByText(timeError);
  expect(within(fixture.form).getByRole("status")).toHaveTextContent(summaryError);
  expect(fixture.posts).toHaveBeenCalledTimes(1);
  expect(fixture.posts.mock.calls[0][0]).toMatchObject({
    startAt: "2099-11-28T02:00:00.000Z", endAt: "2099-11-28T02:00:00.000Z", capacity: 1,
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Issue #65 / UAT-06 / OBS-03", () => {
  it("clears corrected time errors even when capacity 0 blocks the next native submission", async () => {
    const fixture = await openForm();
    await rejectEqualTimes(fixture);
    fireEvent.change(fixture.end, { target: { value: "2099-11-28T10:00" } });
    fireEvent.input(fixture.capacity, { target: { value: "0" } });
    expect(fixture.capacity.validity.rangeUnderflow).toBe(true);
    expect(fixture.form.checkValidity()).toBe(false);
    const submitted = vi.fn();
    fixture.form.addEventListener("submit", submitted);
    const invalid = vi.fn();
    fixture.capacity.addEventListener("invalid", invalid);
    fireEvent.click(fixture.publish);
    expect(invalid).toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.posts).toHaveBeenCalledTimes(1); // Only the rejected equal-time POST exists.
    expect(screen.queryByText(/Event published\./)).not.toBeInTheDocument();
    expect.soft(within(fixture.form).queryByText(timeError)).not.toBeInTheDocument();
    expect.soft(within(fixture.form).getByRole("status")).not.toHaveTextContent(summaryError);
    expect.soft(fixture.end).toHaveAttribute("aria-invalid", "false");
  });

  it("rechecks the dependent End Time error when Start Time is corrected", async () => {
    const fixture = await openForm();
    await rejectEqualTimes(fixture);
    fireEvent.change(fixture.start, { target: { value: "2099-11-28T08:00" } });
    expect(within(fixture.form).queryByText(timeError)).not.toBeInTheDocument();
    expect(fixture.end).toHaveAttribute("aria-invalid", "false");
    expect(within(fixture.form).getByRole("status")).toBeEmptyDOMElement();
    expect(fixture.posts).toHaveBeenCalledTimes(1);
  });

  it("preserves unresolved date errors and unrelated field errors until their inputs are valid", async () => {
    const fixture = await openForm([{ field: "title", message: "title is required" }]);
    fireEvent.input(fixture.title, { target: { value: " " } }); // Native required allows whitespace; API rejects it.
    await rejectEqualTimes(fixture);
    fireEvent.input(fixture.capacity, { target: { value: "2" } });
    expect(within(fixture.form).getByText(timeError)).toBeInTheDocument();
    fireEvent.change(fixture.end, { target: { value: "2099-11-28T08:00" } });
    expect(within(fixture.form).getByText(timeError)).toBeInTheDocument();
    fireEvent.change(fixture.end, { target: { value: "2099-11-28T10:00" } });
    expect(within(fixture.form).queryByText(timeError)).not.toBeInTheDocument();
    expect(within(fixture.form).getByText("title is required")).toBeInTheDocument();
    expect(within(fixture.form).getByRole("status")).toHaveTextContent(summaryError);
    fireEvent.input(fixture.title, { target: { value: "Still synthetic" } });
    expect(within(fixture.form).queryByText("title is required")).not.toBeInTheDocument();
    expect(within(fixture.form).getByRole("status")).toBeEmptyDOMElement();
    expect(fixture.posts).toHaveBeenCalledTimes(1);
  });

  it("retains native positive-integer capacity validation without sending invalid requests", async () => {
    const fixture = await openForm();
    fireEvent.change(fixture.end, { target: { value: "2099-11-28T10:00" } });
    for (const value of ["0", "-1", "1.5", ""]) {
      fireEvent.input(fixture.capacity, { target: { value } });
      expect(fixture.form.checkValidity()).toBe(false);
      fireEvent.click(fixture.publish);
      expect(fixture.posts).not.toHaveBeenCalled();
    }
    fireEvent.input(fixture.capacity, { target: { value: "1" } });
    expect(fixture.form.checkValidity()).toBe(true);
    expect(screen.queryByText(/Event published\./)).not.toBeInTheDocument();
  });
});
