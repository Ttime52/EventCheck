import request from "supertest";
import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";
import { hashPassword } from "./security.js";
import { prisma } from "./auth.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const organizerALogin = "f02-organizer-a@example.test";
const organizerBLogin = "f02-organizer-b@example.test";
const organizerCLogin = "f02-organizer-c@example.test";
const participantLogin = "f02-participant@example.test";
const fixturePassword = "f02-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const isolatedDatabase = isIsolatedTestDatabase();

const validPayload = (suffix: string) => ({
  title: `University Event ${suffix}`,
  description: "A synthetic EventCheck event for integration verification.",
  location: "Engineering Building 1",
  startAt: "2026-11-20T09:00:00+07:00",
  endAt: "2026-11-20T12:00:00+07:00",
  capacity: 1,
});

async function login(loginIdentifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password: fixturePassword });
  expect(response.status).toBe(200);
  return response.headers["set-cookie"];
}

describe.skipIf(!isolatedDatabase)("F-02 event publishing API against isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!isIsolatedTestDatabase()) throw new Error("Integration tests require DATABASE_URL pointing exactly to the isolated eventcheck_test database");
    await prisma.user.deleteMany({ where: { loginIdentifier: { in: [organizerALogin, organizerBLogin, organizerCLogin, participantLogin] } } });
    const passwordHash = await hashPassword(fixturePassword);
    await prisma.user.createMany({
      data: [
        { loginIdentifier: organizerALogin, displayName: "F02 Organizer A", role: Role.ORGANIZER, passwordHash },
        { loginIdentifier: organizerBLogin, displayName: "F02 Organizer B", role: Role.ORGANIZER, passwordHash },
        { loginIdentifier: organizerCLogin, displayName: "F02 Organizer C", role: Role.ORGANIZER, passwordHash },
        { loginIdentifier: participantLogin, displayName: "F02 Participant", role: Role.PARTICIPANT, passwordHash },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { loginIdentifier: { in: [organizerALogin, organizerBLogin, organizerCLogin, participantLogin] } } });
    await prisma.$disconnect();
  });

  it("TEST-F02-02/07/13: creates one owned published event and retrieves it from a fresh database client", async () => {
    const organizerCookie = await login(organizerALogin);
    const before = await prisma.event.count();
    const created = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).send(validPayload("persistence"));

    expect(created.status).toBe(201);
    expect(created.body.data.event).toMatchObject({
      title: "University Event persistence",
      capacity: 1,
      publicationState: "PUBLISHED",
    });
    expect(created.body.data.event.startAt).toBe("2026-11-20T02:00:00.000Z");
    expect(created.body.data.event.endAt).toBe("2026-11-20T05:00:00.000Z");

    const eventId = created.body.data.event.id as string;
    expect(await prisma.event.count()).toBe(before + 1);
    const stored = await prisma.event.findUnique({ where: { id: eventId } });
    expect(stored).toMatchObject({ organizerId: expect.any(String), title: "University Event persistence", capacity: 1, publicationState: "PUBLISHED" });

    const freshClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
    try {
      const afterRestart = await freshClient.event.findUnique({ where: { id: eventId } });
      expect(afterRestart?.id).toBe(eventId);
      expect(afterRestart?.organizerId).toBe(stored?.organizerId);
      expect(afterRestart?.startAt.toISOString()).toBe("2026-11-20T02:00:00.000Z");
    } finally {
      await freshClient.$disconnect();
    }

    const detail = await request(app).get(`/api/v1/organizer/events/${eventId}`).set("Cookie", organizerCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.event.id).toBe(eventId);
  });

  it("TEST-F02-03/04/05: rejects invalid fields, instants, and capacities without creating rows", async () => {
    const organizerCookie = await login(organizerALogin);
    const cases = [
      { name: "blank title", payload: { ...validPayload("invalid"), title: "   " } },
      { name: "blank description", payload: { ...validPayload("invalid"), description: "\t" } },
      { name: "blank location", payload: { ...validPayload("invalid"), location: "  " } },
      { name: "omitted title", payload: (() => { const { title: _title, ...payload } = validPayload("invalid"); return payload; })() },
      { name: "omitted description", payload: (() => { const { description: _description, ...payload } = validPayload("invalid"); return payload; })() },
      { name: "omitted location", payload: (() => { const { location: _location, ...payload } = validPayload("invalid"); return payload; })() },
      { name: "invalid start", payload: { ...validPayload("invalid"), startAt: "not-a-date" } },
      { name: "equal dates", payload: { ...validPayload("invalid"), endAt: validPayload("invalid").startAt } },
      { name: "reversed dates", payload: { ...validPayload("invalid"), endAt: "2026-11-20T08:00:00+07:00" } },
      { name: "zero capacity", payload: { ...validPayload("invalid"), capacity: 0 } },
      { name: "fractional capacity", payload: { ...validPayload("invalid"), capacity: 1.5 } },
      { name: "string capacity", payload: { ...validPayload("invalid"), capacity: "1" } },
    ];

    for (const testCase of cases) {
      const before = await prisma.event.count();
      const response = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).send(testCase.payload);
      expect(response.status, testCase.name).toBe(422);
      expect(response.body.error.code, testCase.name).toBe("VALIDATION_ERROR");
      expect(await prisma.event.count(), testCase.name).toBe(before);
    }

    const beforeMalformed = await prisma.event.count();
    const malformed = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).set("Content-Type", "application/json").send('{"title":');
    expect(malformed.status).toBe(400);
    expect(await prisma.event.count()).toBe(beforeMalformed);
  });

  it("TEST-F02-06: rejects anonymous and Participant publication without mutation", async () => {
    const before = await prisma.event.count();
    const csrfRejected = await request(app).post("/api/v1/events").send(validPayload("csrf"));
    expect(csrfRejected.status).toBe(403);
    const anonymous = await request(app).post("/api/v1/events").set(origin).send(validPayload("anonymous"));
    expect(anonymous.status).toBe(401);

    const participantCookie = await login(participantLogin);
    const participant = await request(app).post("/api/v1/events").set(origin).set("Cookie", participantCookie).send(validPayload("participant"));
    expect(participant.status).toBe(403);
    expect(await prisma.event.count()).toBe(before);
  });

  it("TEST-F02-07: rejects a client owner override before persistence", async () => {
    const organizerCookie = await login(organizerALogin);
    const before = await prisma.event.count();
    const response = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).send({ ...validPayload("owner-override"), organizerId: "spoofed-owner" });

    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: "organizerId" })]));
    expect(await prisma.event.count()).toBe(before);
  });

  it("TEST-F02-08/09: filters lists and protects cross-owner, wrong-role, and visitor detail access", async () => {
    const organizerACookie = await login(organizerALogin);
    const organizerBCookie = await login(organizerBLogin);
    const organizerCCookie = await login(organizerCLogin);
    const createdA = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerACookie).send(validPayload("owner-a"));
    const createdB = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerBCookie).send(validPayload("owner-b"));
    const eventA = createdA.body.data.event;
    const eventB = createdB.body.data.event;

    const ownerList = await request(app).get("/api/v1/organizer/events?organizerId=spoofed").set("Cookie", organizerACookie);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data.events.map((event: { id: string }) => event.id)).toContain(eventA.id);
    expect(ownerList.body.data.events.map((event: { id: string }) => event.id)).not.toContain(eventB.id);

    const emptyList = await request(app).get("/api/v1/organizer/events").set("Cookie", organizerCCookie);
    expect(emptyList.status).toBe(200);
    expect(emptyList.body.data.events).toEqual([]);

    const crossOwner = await request(app).get(`/api/v1/organizer/events/${eventA.id}`).set("Cookie", organizerBCookie);
    expect(crossOwner.status).toBe(404);
    expect(JSON.stringify(crossOwner.body)).not.toContain(eventA.title);

    const participantCookie = await login(participantLogin);
    const participantDetail = await request(app).get(`/api/v1/organizer/events/${eventA.id}`).set("Cookie", participantCookie);
    expect(participantDetail.status).toBe(403);
    const visitorDetail = await request(app).get(`/api/v1/organizer/events/${eventA.id}`);
    expect(visitorDetail.status).toBe(401);
  });

  it("TEST-F02-10: does not support Sprint 1 event edits or mutate the stored event", async () => {
    const organizerCookie = await login(organizerALogin);
    const created = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).send(validPayload("immutable"));
    const eventId = created.body.data.event.id as string;
    const before = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });

    const update = await request(app).patch(`/api/v1/organizer/events/${eventId}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 99 });
    expect(update.status).toBe(404);
    const after = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(after).toMatchObject({ title: before.title, capacity: before.capacity, startAt: before.startAt, endAt: before.endAt });
  });

  it("TEST-F02-12: returns a safe failure and leaves the database unchanged when the transaction fails", async () => {
    const organizerCookie = await login(organizerALogin);
    const before = await prisma.event.count();
    const transactionSpy = vi.spyOn(prisma as any, "$transaction").mockRejectedValueOnce(new Error("synthetic event insert failure"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await request(app).post("/api/v1/events").set(origin).set("Cookie", organizerCookie).send(validPayload("failed-write"));
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(await prisma.event.count()).toBe(before);
    } finally {
      transactionSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
