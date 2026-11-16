import { describe, expect, it } from "vitest";
import { resolvePort } from "./config.js";

describe("Cloud Run port configuration", () => {
  it("prefers PORT", () => expect(resolvePort({ PORT: "8080", SERVER_PORT: "3000" })).toBe(8080));
  it("falls back to SERVER_PORT", () => expect(resolvePort({ SERVER_PORT: "3100" })).toBe(3100));
  it("defaults to 3000", () => expect(resolvePort({})).toBe(3000));
  it.each(["", "abc", "0", "65536", "3.14"])('rejects invalid value "%s"', value => expect(() => resolvePort({ PORT: value })).toThrow());
});
