import request from "supertest";
import express from "express";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { app } from "./app.js";
import { prisma, requireAuth, requireRole, IDLE_MS, ABSOLUTE_MS } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const participantLogin = "test-participant@example.test";
const organizerLogin = "test-organizer@example.test";
const participantPassword = "test-participant-password";
const organizerPassword = "test-organizer-password";
const origin = { Origin: "http://localhost:5173" };
const routineLogMethods = ["debug", "info", "log", "warn", "error"] as const;

const roleApp = express();
roleApp.get("/participant", requireAuth, requireRole(Role.PARTICIPANT), (_req, res) => res.json({ ok: true }));
roleApp.get("/organizer", requireAuth, requireRole(Role.ORGANIZER), (_req, res) => res.json({ ok: true }));

const isolatedDatabase = isIsolatedTestDatabase();
describe.skipIf(!isolatedDatabase)("F-01 authentication API against isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!isIsolatedTestDatabase()) throw new Error("Integration tests require DATABASE_URL pointing exactly to the isolated eventcheck_test database");
    await prisma.user.deleteMany({ where: { loginIdentifier: { in: [participantLogin, organizerLogin] } } });
    await prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "Test Participant", role: Role.PARTICIPANT, passwordHash: await hashPassword(participantPassword) } });
    await prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "Test Organizer", role: Role.ORGANIZER, passwordHash: await hashPassword(organizerPassword) } });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { loginIdentifier: { in: [participantLogin, organizerLogin] } } }); await prisma.$disconnect(); });

  it("TEST-F01-01/02: logs in both roles and rejects credential variants", async () => {
    for (const [loginIdentifier, password, role] of [[participantLogin, participantPassword, "PARTICIPANT"], [organizerLogin, organizerPassword, "ORGANIZER"]] as const) {
      const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password });
      expect(response.status).toBe(200); expect(response.body.data.user.role).toBe(role); expect(response.body.data.user).not.toHaveProperty("passwordHash");
    }
    for (const body of [{}, { loginIdentifier: "unknown@example.test", password: "wrong" }, { loginIdentifier: participantLogin, password: "wrong" }]) {
      const response = await request(app).post("/api/v1/auth/login").set(origin).send(body);
      expect(response.status).toBe(401); expect(response.body.error.code).toBe("INVALID_CREDENTIALS"); expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("TEST-F01-03: derives current identity from the session", async () => {
    const login = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const response = await request(app).get("/api/v1/me?userId=spoofed&role=ORGANIZER").set("Cookie", login.headers["set-cookie"]);
    expect(response.status).toBe(200); expect(response.body.data.user.role).toBe("PARTICIPANT"); expect(response.body.data.user.id).not.toBe("spoofed");
  });

  it("TEST-F01-04/05: invalidates logout and rejects replay/malformed cookies", async () => {
    const login = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const cookie = login.headers["set-cookie"];
    expect((await request(app).post("/api/v1/auth/logout").set(origin).set("Cookie", cookie)).status).toBe(204);
    expect((await request(app).get("/api/v1/me").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).get("/api/v1/me").set("Cookie", "eventcheck_session=malformed")).status).toBe(401);
  });

  it("TEST-F01-06/07: enforces exact idle and absolute boundaries", async () => {
    const login = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const id = login.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const now = Date.now();
    await prisma.session.update({ where: { id }, data: { lastActivityAt: new Date(now - IDLE_MS + 1000), absoluteExpiry: new Date(now + ABSOLUTE_MS) } });
    expect((await request(app).get("/api/v1/me").set("Cookie", login.headers["set-cookie"])).status).toBe(200);
    await prisma.session.update({ where: { id }, data: { lastActivityAt: new Date(now - IDLE_MS), absoluteExpiry: new Date(now + ABSOLUTE_MS) } });
    expect((await request(app).get("/api/v1/me").set("Cookie", login.headers["set-cookie"])).status).toBe(401);
    const second = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const secondId = second.headers["set-cookie"][0].split(";")[0].split("=")[1];
    await prisma.session.update({ where: { id: secondId }, data: { absoluteExpiry: new Date(Date.now()) } });
    expect((await request(app).get("/api/v1/me").set("Cookie", second.headers["set-cookie"])).status).toBe(401);
    const third = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const thirdId = third.headers["set-cookie"][0].split(";")[0].split("=")[1];
    await prisma.session.update({ where: { id: thirdId }, data: { absoluteExpiry: new Date(Date.now() + 1000), lastActivityAt: new Date() } });
    expect((await request(app).get("/api/v1/me").set("Cookie", third.headers["set-cookie"])).status).toBe(200);
    await prisma.session.update({ where: { id: thirdId }, data: { absoluteExpiry: new Date(Date.now()), lastActivityAt: new Date() } });
    expect((await request(app).get("/api/v1/me").set("Cookie", third.headers["set-cookie"])).status).toBe(401);
  });

  it("TEST-F01-08: applies isolated role middleware", async () => {
    const participant = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const organizer = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: organizerLogin, password: organizerPassword });
    expect((await request(roleApp).get("/organizer").set("Cookie", participant.headers["set-cookie"])).status).toBe(403);
    expect((await request(roleApp).get("/organizer").set("Cookie", organizer.headers["set-cookie"])).status).toBe(200);
  });

  it("TEST-F01-09: verifies database hashes, response secrecy, and routine-log secrecy", async () => {
    const logSpies = routineLogMethods.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    try {
      const storedUsers = await prisma.user.findMany({
        where: { loginIdentifier: { in: [participantLogin, organizerLogin] } },
        select: { loginIdentifier: true, passwordHash: true },
      });
      expect(storedUsers).toHaveLength(2);

      const expectedPasswords = new Map([
        [participantLogin, participantPassword],
        [organizerLogin, organizerPassword],
      ]);
      const storedHashes = storedUsers.map(({ passwordHash }) => passwordHash);
      expect(storedHashes.every((hash) => /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(hash))).toBe(true);
      expect(new Set(storedHashes).size).toBe(storedHashes.length);
      for (const user of storedUsers) expect(user.passwordHash).not.toContain(expectedPasswords.get(user.loginIdentifier) ?? "__missing_password__");

      const login = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
      expect(login.status).toBe(200);
      const sessionId = login.headers["set-cookie"][0].split(";")[0].split("=")[1];
      const loginBody = JSON.stringify(login.body);
      expect(loginBody).not.toContain(participantPassword);
      expect(loginBody).not.toContain(storedUsers.find((user) => user.loginIdentifier === participantLogin)?.passwordHash ?? "__missing_hash__");
      expect(loginBody).not.toContain(sessionId);

      const invalid = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: "wrong-password" });
      expect(invalid.status).toBe(401);
      const currentUser = await request(app).get("/api/v1/me").set("Cookie", login.headers["set-cookie"]);
      expect(currentUser.status).toBe(200);
      expect(JSON.stringify(currentUser.body)).not.toContain(sessionId);
      expect((await request(app).post("/api/v1/auth/logout").set(origin).set("Cookie", login.headers["set-cookie"])).status).toBe(204);

      const routineLogs = logSpies.flatMap((spy) => spy.mock.calls.flat()).map(String).join("\n");
      expect(routineLogs).not.toContain(participantPassword);
      for (const hash of storedHashes) expect(routineLogs).not.toContain(hash);
      expect(routineLogs).not.toContain(sessionId);
    } finally {
      logSpies.forEach((spy) => spy.mockRestore());
    }
  });

  it("TEST-F01-10/11: rotates sessions and enforces CSRF/cookie policy", async () => {
    const first = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
    const second = await request(app).post("/api/v1/auth/login").set(origin).set("Cookie", first.headers["set-cookie"]).send({ loginIdentifier: participantLogin, password: participantPassword });
    expect(second.headers["set-cookie"][0]).not.toContain(first.headers["set-cookie"][0].split(";")[0].split("=")[1]);
    expect((await request(app).get("/api/v1/me").set("Cookie", first.headers["set-cookie"])).status).toBe(401);
    expect((await request(app).post("/api/v1/auth/login").send({ loginIdentifier: participantLogin, password: participantPassword })).status).toBe(403);
    const localCookie = second.headers["set-cookie"][0];
    expect(localCookie).toContain("HttpOnly"); expect(localCookie).toContain("SameSite=Lax"); expect(localCookie).toContain("Path=/"); expect(localCookie).not.toContain("Secure");

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const productionLogin = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: participantLogin, password: participantPassword });
      const productionCookie = productionLogin.headers["set-cookie"][0];
      expect(productionLogin.status).toBe(200);
      expect(productionCookie).toMatch(/^eventcheck_session=[^;]+;/);
      expect(productionCookie).toContain("HttpOnly");
      expect(productionCookie).toContain("SameSite=Lax");
      expect(productionCookie).toContain("Secure");
      expect(productionCookie).toContain("Path=/");

      const productionLogout = await request(app).post("/api/v1/auth/logout").set(origin).set("Cookie", productionCookie);
      const clearedCookie = productionLogout.headers["set-cookie"][0];
      expect(productionLogout.status).toBe(204);
      expect(clearedCookie).toMatch(/^eventcheck_session=;/);
      expect(clearedCookie).toContain("HttpOnly");
      expect(clearedCookie).toContain("SameSite=Lax");
      expect(clearedCookie).toContain("Secure");
      expect(clearedCookie).toContain("Path=/");
      expect(clearedCookie).toMatch(/Max-Age=0/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
