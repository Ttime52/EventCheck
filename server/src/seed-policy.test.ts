import { describe, expect, it } from "vitest";
import { assertSeedEnvironment } from "./seed-policy.js";

describe("synthetic seed safety", () => {
  it.each(["development", "test"])("allows exact %s mode", mode => expect(() => assertSeedEnvironment(mode)).not.toThrow());
  it.each([undefined, "", "production", "prod", "staging", "development "])("rejects unsafe mode %s", mode => expect(() => assertSeedEnvironment(mode)).toThrow());
});
