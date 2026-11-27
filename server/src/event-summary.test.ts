import { describe, expect, it } from "vitest";
import { buildEventSummary } from "./event-summary.js";

const eventId = "54d0eeae-cc69-4920-8fe6-f89b1cdeab3d";

describe("F-08 summary calculations", () => {
  it("TEST-F08-01: calculates the approved draft count cases and one-decimal rates", () => {
    expect(buildEventSummary(eventId, 10, 0n, 2n, 0n)).toMatchObject({ remainingSeats: 10, notCheckedInCount: 0, attendanceRate: null });
    expect(buildEventSummary(eventId, 10, 1n, 0n, 0n)).toMatchObject({ remainingSeats: 9, notCheckedInCount: 1, attendanceRate: 0 });
    expect(buildEventSummary(eventId, 10, 3n, 2n, 1n)).toMatchObject({ remainingSeats: 7, notCheckedInCount: 2, attendanceRate: 33.3 });
    expect(buildEventSummary(eventId, 10, 3n, 2n, 3n)).toMatchObject({ remainingSeats: 7, notCheckedInCount: 0, attendanceRate: 100 });
    expect(buildEventSummary(eventId, 10, 3n, 2n, 2n).attendanceRate).toBe(66.7);
  });

  it("TEST-F08-01: rejects inconsistent, negative, and unsafe database values", () => {
    expect(() => buildEventSummary(eventId, 10, 1n, 0n, 2n)).toThrow(RangeError);
    expect(() => buildEventSummary(eventId, 1, -1n, 0n, 0n)).toThrow(RangeError);
    expect(() => buildEventSummary(eventId, Number.MAX_SAFE_INTEGER + 1, 0n, 0n, 0n)).toThrow(RangeError);
    expect(() => buildEventSummary(eventId, 1, 2n, 0n, 0n)).toThrow(RangeError);
    expect(() => buildEventSummary(eventId, 1, BigInt(Number.MAX_SAFE_INTEGER) + 1n, 0n, 0n)).toThrow(RangeError);
  });
});
