import { randomUUID } from "node:crypto";
import request from "supertest";
import { PrismaClient, PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app, createRegistration } from "./app.js";
import { hashPassword } from "./security.js";
import { prisma } from "./auth.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const runId = randomUUID();
const password = "f03-registration-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const isolatedDatabase = isIsolatedTestDatabase();

describe.skipIf(!isolatedDatabase)("F-03 participant registration API", () => {
  const logins = Array.from({ length: 8 }, (_, index) => `f03-registration-p${index}-${runId}@example.test`);
  const listParticipantLogin = `f03-registration-list-${runId}@example.test`;
  const listOtherLogin = `f03-registration-other-${runId}@example.test`;
  const organizerLogin = `f03-registration-organizer-${runId}@example.test`;
  const userIds: string[] = [];
  const eventIds: string[] = [];

  async function login(loginIdentifier: string) {
    const result = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password });
    expect(result.status).toBe(200);
    return result.headers["set-cookie"];
  }

  async function event(capacity: number, suffix: string = randomUUID()) {
    const created = await prisma.event.create({ data: { organizerId: userIds[0], title: `F03 Registration ${suffix}`, description: "Registration fixture", location: "Room 1", startAt: new Date("2026-12-10T02:00:00.000Z"), endAt: new Date("2026-12-10T04:00:00.000Z"), capacity, publicationState: PublicationState.PUBLISHED } });
    eventIds.push(created.id);
    return created.id;
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const organizer = await prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F03 Registration Organizer", role: Role.ORGANIZER, passwordHash } });
    userIds.push(organizer.id);
    for (const loginIdentifier of logins) {
      const participant = await prisma.user.create({ data: { loginIdentifier, displayName: loginIdentifier, role: Role.PARTICIPANT, passwordHash } });
      userIds.push(participant.id);
    }
    for (const loginIdentifier of [listParticipantLogin, listOtherLogin]) {
      const participant = await prisma.user.create({ data: { loginIdentifier, displayName: loginIdentifier, role: Role.PARTICIPANT, passwordHash } });
      userIds.push(participant.id);
    }
  });

  afterAll(async () => {
    if (eventIds.length) await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    if (eventIds.length) await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("TEST-F03-04/06: creates a self-registration and derives identity from the session", async () => {
    const eventId = await event(2);
    const cookie = await login(logins[0]);
    const response = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({ participantId: "spoofed", status: "CANCELLED", registeredAt: "2020-01-01T00:00:00Z" });
    expect(response.status).toBe(422);
    const success = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({});
    expect(success.status).toBe(201);
    expect(success.body.data.registration).toMatchObject({ eventId, participantId: userIds[1], status: "ACTIVE" });
    expect(await prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } })).toBe(1);
  });

  it("TEST-F03-04/05: rejects anonymous, Organizer, invalid CSRF, and missing Event requests", async () => {
    const eventId = await event(1);
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).send({})).status).toBe(401);
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set("Cookie", await login(organizerLogin)).set(origin).send({})).status).toBe(403);
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set("Cookie", await login(logins[1])).send({})).status).toBe(403);
    expect((await request(app).post("/api/v1/events/00000000-0000-0000-0000-000000000000/registrations").set(origin).set("Cookie", await login(logins[2])).send({})).status).toBe(404);
    expect((await request(app).post("/api/v1/events/not-an-id/registrations").set(origin).set("Cookie", await login(logins[2])).send({})).status).toBe(404);
    const revokedCookie = await login(logins[2]);
    const revokedSessionId = revokedCookie[0].split(";", 1)[0].split("=", 2)[1];
    const revokedSession = await prisma.session.findUniqueOrThrow({ where: { id: revokedSessionId } });
    await prisma.session.update({ where: { id: revokedSession.id }, data: { invalidatedAt: new Date() } });
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", revokedCookie).send({})).status).toBe(401);
  });

  it("TEST-F03-08/20: returns duplicate-first conflict, including when full", async () => {
    const eventId = await event(1);
    const cookie = await login(logins[3]);
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({})).status).toBe(201);
    const duplicate = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("REGISTRATION_DUPLICATE");
  });

  it("TEST-F03-09: rejects a distinct eligible Participant when capacity is full", async () => {
    const eventId = await event(1);
    expect((await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", await login(logins[4])).send({})).status).toBe(201);
    const full = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", await login(logins[5])).send({});
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("EVENT_FULL");
  });

  it("TEST-F03-10: serializes five last-place races with exactly one winner each", async () => {
    for (let race = 0; race < 5; race += 1) {
      const eventId = await event(1, `last-place-${race}`);
      const responses = await Promise.all([logins[0], logins[1]].map(async loginIdentifier => request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", await login(loginIdentifier)).send({})));
      expect(responses.filter(response => response.status === 201)).toHaveLength(1);
      expect(responses.filter(response => response.status === 409)).toHaveLength(1);
      expect(await prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } })).toBe(1);
    }
  });

  it("TEST-F03-11: allows at most one ACTIVE row across five duplicate races", async () => {
    for (let race = 0; race < 5; race += 1) {
      const eventId = await event(5, `duplicate-${race}`);
      const cookies = await Promise.all(Array.from({ length: 5 }, () => login(logins[6])));
      const responses = await Promise.all(cookies.map(cookie => request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({})));
      expect(responses.filter(response => response.status === 201)).toHaveLength(1);
      expect(responses.filter(response => response.status === 409)).toHaveLength(4);
      expect(await prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } })).toBe(1);
    }
  });

  it("TEST-F03-09: updates public availability after a committed registration and preserves cancelled history", async () => {
    const eventId = await event(2);
    const registration = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", await login(logins[7])).send({});
    expect(registration.status).toBe(201);
    const publicEvent = await request(app).get(`/api/v1/events/${eventId}`);
    expect(publicEvent.body.data.event).toMatchObject({ remainingPlaces: 1, registrationAvailable: true });
    await prisma.registration.update({ where: { id: registration.body.data.registration.id }, data: { status: RegistrationStatus.CANCELLED } });
    const reRegistered = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", await login(logins[7])).send({});
    expect(reRegistered.status).toBe(201);
  });

  it("TEST-F03-07: returns only owned registrations through the API and a fresh Prisma client", async () => {
    const ownEventA = await event(3, "my-list-a");
    const ownEventB = await event(3, "my-list-b");
    const otherEvent = await event(3, "my-list-other");
    const ownCookie = await login(listParticipantLogin);
    const otherCookie = await login(listOtherLogin);
    const ownA = await request(app).post(`/api/v1/events/${ownEventA}/registrations`).set(origin).set("Cookie", ownCookie).send({});
    const ownB = await request(app).post(`/api/v1/events/${ownEventB}/registrations`).set(origin).set("Cookie", ownCookie).send({});
    expect(ownA.status).toBe(201);
    expect(ownB.status).toBe(201);
    expect((await request(app).post(`/api/v1/events/${otherEvent}/registrations`).set(origin).set("Cookie", otherCookie).send({})).status).toBe(201);
    const list = await request(app).get("/api/v1/me/registrations").set("Cookie", ownCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.registrations).toHaveLength(2);
    expect(list.body.data.registrations.map((item: { eventId: string }) => item.eventId)).toEqual(expect.arrayContaining([ownEventA, ownEventB]));
    expect(JSON.stringify(list.body)).not.toContain(listOtherLogin);
    const detail = await request(app).get(`/api/v1/me/registrations/${ownA.body.data.registration.id}`).set("Cookie", ownCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.registration.event.id).toBe(ownEventA);
    expect((await request(app).get(`/api/v1/me/registrations/${ownA.body.data.registration.id}`).set("Cookie", otherCookie)).status).toBe(404);
    expect((await request(app).get("/api/v1/me/registrations/not-an-id").set("Cookie", ownCookie)).status).toBe(404);
    expect((await request(app).get(`/api/v1/me/registrations/${randomUUID()}`).set("Cookie", ownCookie)).status).toBe(404);
    const freshClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
    try {
      expect(await freshClient.registration.count({ where: { participantId: userIds[userIds.length - 2] } })).toBe(2);
    } finally { await freshClient.$disconnect(); }
  });

  it("TEST-F03-07: returns an empty list for a Participant without registrations and protects roles", async () => {
    const emptyLogin = `f03-registration-empty-${runId}@example.test`;
    const user = await prisma.user.create({ data: { loginIdentifier: emptyLogin, displayName: emptyLogin, role: Role.PARTICIPANT, passwordHash: await hashPassword(password) } });
    userIds.push(user.id);
    expect((await request(app).get("/api/v1/me/registrations").set("Cookie", await login(emptyLogin))).body.data.registrations).toEqual([]);
    expect((await request(app).get("/api/v1/me/registrations").set("Cookie", await login(organizerLogin))).status).toBe(403);
    expect((await request(app).get("/api/v1/me/registrations")).status).toBe(401);
  });

  it("TEST-F03-12: rolls back a failure after INSERT without a false success", async () => {
    const eventId = await event(2, "rollback");
    const before = await request(app).get(`/api/v1/events/${eventId}`);
    const participantId = userIds[2];
    await expect(createRegistration(eventId, participantId, () => { throw new Error("CONTROLLED_TEST_FAILURE"); })).rejects.toThrow("CONTROLLED_TEST_FAILURE");
    expect(await prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } })).toBe(0);
    const after = await request(app).get(`/api/v1/events/${eventId}`);
    expect(after.body.data.event.remainingPlaces).toBe(before.body.data.event.remainingPlaces);
  });

  it("TEST-F03-12: returns a safe API error and rolls back an AFTER INSERT database failure", async () => {
    const eventId = await event(2, "api-rollback");
    const cookie = await login(logins[1]);
    const before = await request(app).get(`/api/v1/events/${eventId}`);
    expect(before.status).toBe(200);
    const suffix = randomUUID().replaceAll("-", "");
    const functionName = `f03_fail_insert_${suffix}`;
    const triggerName = `f03_fail_insert_${suffix}`;
    let triggerCreated = false;
    const expectedError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventId" = '${eventId}' THEN RAISE EXCEPTION 'CONTROLLED_TEST_FAILURE'; END IF; RETURN NEW; END; $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" AFTER INSERT ON "Registration" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      triggerCreated = true;
      const response = await request(app).post(`/api/v1/events/${eventId}/registrations`).set(origin).set("Cookie", cookie).send({});
      expect(response.status).toBe(500);
      expect(String(expectedError.mock.calls[0]?.[0])).toContain("CONTROLLED_TEST_FAILURE");
      expect(response.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" } });
      expect(response.body.data).toBeUndefined();
      expect(await prisma.registration.count({ where: { eventId } })).toBe(0);
      const after = await request(app).get(`/api/v1/events/${eventId}`);
      expect(after.status).toBe(200);
      expect(after.body.data.event.remainingPlaces).toBe(before.body.data.event.remainingPlaces);
    } finally {
      expectedError.mockRestore();
      if (triggerCreated) await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Registration"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }
  });
});
