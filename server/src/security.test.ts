import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./security.js";

describe("credential protection", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("secret-value");
    expect(hash).not.toContain("secret-value");
    expect(await verifyPassword("secret-value", hash)).toBe(true);
    expect(await verifyPassword("wrong-value", hash)).toBe(false);
  });
});
