import { describe, expect, it } from "vitest";
import { decideCancellation } from "./registration-lifecycle.js";

const eventStart = new Date("2099-11-26T09:00:00.000Z");

describe("F-06 cancellation eligibility", () => {
  it("allows an active registration before event start, even after registration deadline", () => {
    expect(decideCancellation("ACTIVE", false, eventStart, new Date("2099-11-26T08:45:00.000Z"))).toBe("CANCEL");
  });

  it("closes cancellation at the exact event-start boundary", () => {
    expect(decideCancellation("ACTIVE", false, eventStart, eventStart)).toBe("CANCELLATION_CLOSED");
  });

  it("closes cancellation after event start", () => {
    expect(decideCancellation("ACTIVE", false, eventStart, new Date(eventStart.getTime() + 1))).toBe("CANCELLATION_CLOSED");
  });

  it("rejects an active registration that already has attendance", () => {
    expect(decideCancellation("ACTIVE", true, eventStart, new Date("2099-11-26T08:00:00.000Z"))).toBe("REGISTRATION_CHECKED_IN");
  });

  it("returns an already-cancelled registration unchanged on a retry", () => {
    expect(decideCancellation("CANCELLED", true, eventStart, new Date("2099-11-26T10:00:00.000Z"))).toBe("ALREADY_CANCELLED");
  });
});
