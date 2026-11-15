import { describe, expect, it } from "vitest";
import { publicEventView, validateCreateEventInput } from "./events.js";

const validInput = {
  title: "Software Engineering Workshop",
  description: "A practical workshop for university students.",
  location: "Engineering Building 1",
  startAt: "2026-11-20T09:00:00+07:00",
  endAt: "2026-11-20T12:00:00+07:00",
  capacity: 1,
};

describe("F-02 event validation", () => {
  it("TEST-F02-03: rejects blank required text and unsupported owner fields", () => {
    for (const field of ["title", "description", "location"] as const) {
      const result = validateCreateEventInput({ ...validInput, [field]: "  " });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.map(({ field: issueField }) => issueField)).toContain(field);
    }

    const override = validateCreateEventInput({ ...validInput, organizerId: "another-organizer" });
    expect(override.ok).toBe(false);
    if (!override.ok) expect(override.issues.map(({ field }) => field)).toContain("organizerId");
  });

  it("TEST-F02-04: rejects malformed, timezone-free, equal, and reversed instants", () => {
    for (const input of [
      { ...validInput, startAt: "not-a-date" },
      { ...validInput, startAt: "2026-11-20T09:00" },
      { ...validInput, endAt: validInput.startAt },
      { ...validInput, endAt: "2026-11-20T08:00:00+07:00" },
    ]) {
      const result = validateCreateEventInput(input);
      expect(result.ok).toBe(false);
    }
  });

  it("TEST-F02-05: accepts capacity one and rejects non-positive/non-integer values", () => {
    expect(validateCreateEventInput(validInput).ok).toBe(true);
    for (const capacity of [undefined, 0, -1, 1.5, "1", "not-a-number"]) {
      expect(validateCreateEventInput({ ...validInput, capacity }).ok).toBe(false);
    }
  });
});

describe("F-03 public event projection", () => {
  const event = { id: "event-1", title: "Workshop", description: "Details", location: "Hall", startAt: new Date("2026-12-01T00:00:00Z"), endAt: new Date("2026-12-01T01:00:00Z"), capacity: 3 };

  it("handles empty, partial, and full availability", () => {
    expect(publicEventView(event, 0)).toMatchObject({ remainingPlaces: 3, registrationAvailable: true });
    expect(publicEventView(event, 1)).toMatchObject({ remainingPlaces: 2, registrationAvailable: true });
    expect(publicEventView(event, 3)).toMatchObject({ remainingPlaces: 0, registrationAvailable: false });
    expect(() => publicEventView({ ...event, capacity: 0 }, 0)).toThrow("Invalid registration capacity state");
  });

  it("rejects invalid capacity-count states instead of masking them", () => {
    expect(() => publicEventView(event, 4)).toThrow("Invalid registration capacity state");
    expect(() => publicEventView({ ...event, capacity: -1 }, 0)).toThrow("Invalid registration capacity state");
    expect(() => publicEventView(event, -1)).toThrow("Invalid registration capacity state");
  });
});
