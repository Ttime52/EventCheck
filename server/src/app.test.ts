import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";
import { prisma } from "./auth.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("health endpoint", () => {
  it("reports the baseline service status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("readiness endpoint", () => {
  it("returns ready when PostgreSQL responds", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }] as never);
    const response = await request(app).get("/api/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });

  it("returns safe 503 when PostgreSQL is unavailable", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("database details"));
    const response = await request(app).get("/api/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(response.body)).not.toContain("database details");
  });
});
