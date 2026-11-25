import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, Role, RegistrationStatus } from "@prisma/client";
import { app, createRegistration, setNowProvider } from "./app.js";
import { prisma, SESSION_COOKIE } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const suffix = `f05-${crypto.randomUUID()}`;
const organizerLogin = `${suffix}-organizer@example.test`;
const participantLogin = `${suffix}-participant@example.test`;
const participantBLogin = `${suffix}-participant-b@example.test`;
const organizerBLogin = `${suffix}-organizer-b@example.test`;
const password = "f05-isolated-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const futureStart = "2099-11-26T09:00:00+07:00";
const futureEnd = "2099-11-26T12:00:00+07:00";
const isolated = isIsolatedTestDatabase();

async function login(identifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: identifier, password });
  expect(response.status).toBe(200);
  const setCookies = response.headers["set-cookie"];
  const cookieHeaders = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  const sessionCookie = cookieHeaders.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  expect(sessionCookie).toBeDefined();
  return sessionCookie!.split(";")[0];
}

describe.skipIf(!isolated)("F-05 capacity and deadline API (isolated PostgreSQL)", () => {
  let organizerCookie: string;
  let participantCookie: string;
  let participantBCookie: string;
  let organizerId: string;
  let organizerBId: string;
  let organizerBCookie: string;
  let participantId: string;
  let participantBId: string;
  const eventIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const organizer = await prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F05 Organizer", role: Role.ORGANIZER, passwordHash } });
    const organizerB = await prisma.user.create({ data: { loginIdentifier: organizerBLogin, displayName: "F05 Organizer B", role: Role.ORGANIZER, passwordHash } });
    const participant = await prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "F05 Participant", role: Role.PARTICIPANT, passwordHash } });
    const participantB = await prisma.user.create({ data: { loginIdentifier: participantBLogin, displayName: "F05 Participant B", role: Role.PARTICIPANT, passwordHash } });
    organizerId = organizer.id; organizerBId = organizerB.id; participantId = participant.id; participantBId = participantB.id;
    organizerCookie = await login(organizerLogin); organizerBCookie = await login(organizerBLogin); participantCookie = await login(participantLogin); participantBCookie = await login(participantBLogin);
  });

  afterAll(async () => {
    setNowProvider(() => new Date());
    if (!organizerId) return;
    await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds }, organizerId } });
    await prisma.user.deleteMany({ where: { id: { in: [organizerId, organizerBId, participantId, participantBId] } } });
    await prisma.$disconnect();
  });

  async function createEvent(capacity = 2, deadline?: string | null) {
    const event = await prisma.event.create({ data: { organizerId, title: suffix, description: "F05 test event", location: "Test Hall", startAt: new Date(futureStart), endAt: new Date(futureEnd), capacity, registrationDeadline: deadline ? new Date(deadline) : null, publicationState: "PUBLISHED" } });
    eventIds.push(event.id); return event;
  }

  it("TEST-F05-01/04: owner can update capacity and public remaining places", async () => {
    const event = await createEvent();
    const response = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 4 });
    expect(response.status).toBe(200); expect(response.body.data.event.capacity).toBe(4);
    const publicResponse = await request(app).get(`/api/v1/events/${event.id}`);
    expect(publicResponse.body.data.event).toMatchObject({ remainingPlaces: 4, registrationAvailable: true, registrationOpen: true });
  });

  it("TEST-F05-04: preserves ACTIVE and CANCELLED history on capacity increase", async () => {
    const event = await createEvent(2);
    const cancelledParticipant = await prisma.user.create({ data: { loginIdentifier: `${suffix}-cancelled@example.test`, displayName: "F05 Cancelled", role: Role.PARTICIPANT, passwordHash: await hashPassword(password) } });
    const active = await prisma.registration.create({ data: { eventId: event.id, participantId, status: RegistrationStatus.ACTIVE } });
    const cancelled = await prisma.registration.create({ data: { eventId: event.id, participantId: cancelledParticipant.id, status: RegistrationStatus.CANCELLED } });
    try {
      const response = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 4 });
      expect(response.status).toBe(200);
      const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
      const rows = await prisma.registration.findMany({ where: { eventId: event.id }, orderBy: { id: "asc" } });
      expect(stored.capacity).toBe(4); expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([active.id, cancelled.id]));
      expect(rows.find(row => row.id === active.id)?.status).toBe(RegistrationStatus.ACTIVE);
      expect(rows.find(row => row.id === cancelled.id)?.status).toBe(RegistrationStatus.CANCELLED);
      expect((await request(app).get(`/api/v1/events/${event.id}`)).body.data.event).toMatchObject({ remainingPlaces: 3, registrationAvailable: true, registrationDeadline: null });
    } finally { await prisma.registration.deleteMany({ where: { id: { in: [active.id, cancelled.id] } } }); await prisma.user.delete({ where: { id: cancelledParticipant.id } }); }
  });

  it("TEST-F05-02: rejects wrong role, missing Origin, and non-owner access", async () => {
    const event = await createEvent();
    const wrongRole = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", participantCookie).send({ capacity: 3 });
    expect(wrongRole.status).toBe(403); expect(wrongRole.body.error.code).toBe("FORBIDDEN");
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerBCookie).send({ capacity: 3 })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set({ Origin: "https://evil.example" }).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(403);
    const visitor = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).send({ capacity: 3 });
    expect(visitor.status).toBe(401); expect(visitor.body.error.code).toBe("UNAUTHENTICATED");
    const dedicatedExpiredCookie = await login(organizerLogin);
    const sessionId = dedicatedExpiredCookie.slice(`${SESSION_COOKIE}=`.length);
    const dedicatedSession = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(dedicatedSession.userId).toBe(organizerId);
    await prisma.session.update({ where: { id: dedicatedSession.id }, data: { invalidatedAt: new Date() } });
    const beforeExpired = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    const expired = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", dedicatedExpiredCookie).send({ capacity: 3 });
    expect(expired.status).toBe(401); expect(expired.body.error.code).toBe("UNAUTHENTICATED");
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ capacity: beforeExpired.capacity });
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(200);
  });

  it("TEST-F05-03/07: validates partial fields, timezone, and deadline ordering", async () => {
    const event = await createEvent();
    for (const payload of [{}, { unknown: 1 }, { capacity: null }, { capacity: 0 }, { registrationDeadline: "2099-11-26T09:00" }, { registrationDeadline: "2099-02-30T08:00:00Z" }, { registrationDeadline: "2099-11-27T09:00:00Z" }]) {
      const response = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send(payload);
      expect(response.status).toBe(422); expect(response.body.error.details).toEqual(expect.any(Array));
    }
    const valid = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ registrationDeadline: "2099-11-26T08:00:00+07:00" });
    expect(valid.status).toBe(200);
    const clear = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ registrationDeadline: null });
    expect(clear.status).toBe(200); expect(clear.body.data.event.registrationDeadline).toBeNull();
  });

  it("TEST-F05-05/09: rejects reductions below ACTIVE count and closed registration", async () => {
    const event = await createEvent(3);
    await prisma.registration.createMany({ data: [{ eventId: event.id, participantId, status: RegistrationStatus.ACTIVE }, { eventId: event.id, participantId: participantBId, status: RegistrationStatus.ACTIVE }] });
    const before = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    const reduction = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 1 });
    expect(reduction.status).toBe(409); expect(reduction.body.error.code).toBe("CAPACITY_BELOW_ACTIVE_COUNT");
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ capacity: before.capacity });
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(2);
    const closedEvent = await createEvent(1, "2000-01-01T00:00:00Z");
    const closed = await request(app).post(`/api/v1/events/${closedEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
    expect(closed.status).toBe(409); expect(closed.body.error.code).toBe("REGISTRATION_CLOSED");
  });

  it("TEST-F05-06: rejects edits once an Event has started", async () => {
    const event = await prisma.event.create({ data: { organizerId, title: suffix, description: "started", location: "Test Hall", startAt: new Date("2020-01-01T00:00:00Z"), endAt: new Date("2020-01-01T01:00:00Z"), capacity: 2, publicationState: "PUBLISHED" } });
    eventIds.push(event.id);
    const response = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 3 });
    expect(response.status).toBe(409); expect(response.body.error.code).toBe("EVENT_MODIFICATION_CLOSED");
    const boundaryEvent = await createEvent(2);
    const start = new Date(futureStart);
    try {
      setNowProvider(() => new Date(start.getTime() - 1));
      expect((await request(app).patch(`/api/v1/organizer/events/${boundaryEvent.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(200);
      setNowProvider(() => start);
      const exact = await request(app).patch(`/api/v1/organizer/events/${boundaryEvent.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 4 });
      expect(exact.status).toBe(409); expect(exact.body.error.code).toBe("EVENT_MODIFICATION_CLOSED");
      setNowProvider(() => new Date(start.getTime() + 1));
      const after = await request(app).patch(`/api/v1/organizer/events/${boundaryEvent.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 5 });
      expect(after.status).toBe(409); expect(after.body.error.code).toBe("EVENT_MODIFICATION_CLOSED");
    } finally { setNowProvider(() => new Date()); }
  });

  it("TEST-F05-08: exposes only public deadline and availability fields", async () => {
    const event = await createEvent(2, "2099-11-26T08:00:00+07:00");
    const response = await request(app).get(`/api/v1/events/${event.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.event).toMatchObject({ registrationDeadline: "2099-11-26T01:00:00.000Z", registrationOpen: true, registrationAvailable: true });
    expect(response.body.data.event.organizerId).toBeUndefined();
  });

  it("TEST-F05-09: accepts before a deadline and rejects at/after a closed deadline without mutation", async () => {
    const deadline = new Date("2099-11-26T01:00:00.000Z");
    try {
      const openEvent = await createEvent(1, deadline.toISOString());
      setNowProvider(() => new Date(deadline.getTime() - 1));
      const accepted = await request(app).post(`/api/v1/events/${openEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
      expect(accepted.status).toBe(201);
      const closedEvent = await createEvent(1, deadline.toISOString());
      setNowProvider(() => deadline);
      const exact = await request(app).post(`/api/v1/events/${closedEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
      expect(exact.status).toBe(409); expect(exact.body.error.code).toBe("REGISTRATION_CLOSED");
      setNowProvider(() => new Date(deadline.getTime() + 1));
      const after = await request(app).post(`/api/v1/events/${closedEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
      expect(after.status).toBe(409); expect(after.body.error.code).toBe("REGISTRATION_CLOSED");
      expect(await prisma.registration.count({ where: { eventId: closedEvent.id } })).toBe(0);
    } finally { setNowProvider(() => new Date()); }
  });

  it("TEST-F05-10: serializes concurrent capacity and registration requests", async () => {
    const event = await createEvent(1);
    const responses = await Promise.all([
      request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 2 }),
      request(app).post(`/api/v1/events/${event.id}/registrations`).set(origin).set("Cookie", participantCookie).send({}),
    ]);
    expect(responses.map(item => item.status).sort()).toEqual([200, 201]);
    const active = await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } });
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(active).toBeLessThanOrEqual(stored.capacity);
    const raceEvent = await createEvent(1);
    const race = await Promise.all([
      request(app).post(`/api/v1/events/${raceEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({}),
      request(app).post(`/api/v1/events/${raceEvent.id}/registrations`).set(origin).set("Cookie", participantBCookie).send({}),
    ]);
    expect(race.map(item => item.status).sort()).toEqual([201, 409]);
    expect(race.some(item => item.body?.error?.code === "EVENT_FULL" || item.body?.error?.code === "REGISTRATION_DUPLICATE")).toBe(true);
    expect(await prisma.registration.count({ where: { eventId: raceEvent.id, status: RegistrationStatus.ACTIVE } })).toBe(1);

    const reductionEvent = await createEvent(2);
    await prisma.registration.create({ data: { eventId: reductionEvent.id, participantId, status: RegistrationStatus.ACTIVE } });
    const reductionRace = await Promise.all([
      request(app).patch(`/api/v1/organizer/events/${reductionEvent.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 1 }),
      request(app).post(`/api/v1/events/${reductionEvent.id}/registrations`).set(origin).set("Cookie", participantBCookie).send({}),
    ]);
    const patchResult = reductionRace[0];
    const registrationResult = reductionRace[1];
    expect([[200, 409], [409, 201]]).toContainEqual([patchResult.status, registrationResult.status]);
    const committed = await prisma.event.findUniqueOrThrow({
      where: { id: reductionEvent.id },
    });

    const committedActive = await prisma.registration.count({
      where: {
        eventId: reductionEvent.id,
        status: RegistrationStatus.ACTIVE,
      },
    });

    if (patchResult.status === 200) {
      expect(registrationResult.body.error.code).toBe("EVENT_FULL");
      expect(committed.capacity).toBe(1);
      expect(committedActive).toBe(1);
    } else {
      expect(patchResult.body.error.code).toBe("CAPACITY_BELOW_ACTIVE_COUNT");
      expect(committed.capacity).toBe(2);
      expect(committedActive).toBe(2);
    }
    if (registrationResult.status === 201) expect(patchResult.body.error.code).toBe("CAPACITY_BELOW_ACTIVE_COUNT");
    expect(committedActive).toBeLessThanOrEqual(committed.capacity);
    expect(await prisma.registration.count({ where: { eventId: reductionEvent.id, participantId, status: RegistrationStatus.ACTIVE } })).toBe(1);
    const publicState = await request(app).get(`/api/v1/events/${reductionEvent.id}`);
    expect(publicState.body.data.event.remainingPlaces).toBe(committed.capacity - committedActive);
    expect(publicState.body.data.event.registrationAvailable).toBe(committedActive < committed.capacity);
  });

  it("TEST-F05-10: proves PostgreSQL Event-row lock contention for reduction versus registration", async () => {
    const event = await createEvent(2);
    await prisma.registration.create({ data: { eventId: event.id, participantId, status: RegistrationStatus.ACTIVE } });
    const lockClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    let holderPid = 0;
    let release!: () => void;
    let releasedAlready = false;
    const released = new Promise<void>(resolve => { release = resolve; });
    let signalReady!: () => void;
    const ready = new Promise<void>(resolve => { signalReady = resolve; });
    const holderTransaction = lockClient.$transaction(async tx => {
      const pidRows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      holderPid = Number(pidRows[0].pid);
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE`;
      signalReady();
      await released;
    }, { timeout: 4000 });
    let pendingPatch: Promise<any> | undefined;
    let pendingRegistration: Promise<any> | undefined;
    try {
      let readyTimer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([ready, new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error("lock holder did not become ready")), 1000); })]);
      if (readyTimer) clearTimeout(readyTimer);
      pendingPatch = Promise.resolve(request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).send({ capacity: 1 }));
      pendingRegistration = Promise.resolve(request(app).post(`/api/v1/events/${event.id}/registrations`).set(origin).set("Cookie", participantBCookie).send({}));
      let blockers: Array<{ pid: number; blockedBy: number[]; query: string }> = [];
      for (let attempt = 0; attempt < 40 && blockers.length === 0; attempt += 1) {
        blockers = await prisma.$queryRaw<Array<{ pid: number; blockedBy: number[]; query: string }>>`SELECT pid, pg_blocking_pids(pid) AS "blockedBy", query FROM pg_stat_activity WHERE ${holderPid} = ANY(pg_blocking_pids(pid)) AND (query ILIKE '%FOR UPDATE%' OR query ILIKE '%"Event"%')`;
        if (blockers.length === 0) await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(blockers.some(row => row.blockedBy.includes(holderPid))).toBe(true);
      release();
      releasedAlready = true;
      const [patchResult, registrationResult] = await Promise.all([pendingPatch, pendingRegistration]);
      expect([[200, 409], [409, 201]]).toContainEqual([patchResult.status, registrationResult.status]);
      const finalEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
      const finalActive = await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } });
      if (patchResult.status === 200) {
        expect(registrationResult.body.error.code).toBe("EVENT_FULL");
        expect(finalEvent.capacity).toBe(1);
        expect(finalActive).toBe(1);
      } else {
        expect(registrationResult.status).toBe(201);
        expect(patchResult.body.error.code).toBe("CAPACITY_BELOW_ACTIVE_COUNT");
        expect(finalEvent.capacity).toBe(2);
        expect(finalActive).toBe(2);
      }
      expect(finalActive).toBeLessThanOrEqual(finalEvent.capacity);
      expect(await prisma.registration.count({ where: { eventId: event.id, participantId, status: RegistrationStatus.ACTIVE } })).toBe(1);
      expect((await request(app).get(`/api/v1/events/${event.id}`)).body.data.event).toMatchObject({ remainingPlaces: finalEvent.capacity - finalActive, registrationAvailable: finalActive < finalEvent.capacity });
    } finally {
      if (!releasedAlready) release();
      await Promise.allSettled([pendingPatch, pendingRegistration].filter(Boolean) as Promise<unknown>[]);
      await Promise.race([holderTransaction, new Promise(resolve => setTimeout(resolve, 4500))]);
      await lockClient.$disconnect();
    }
  });

  it("TEST-F05-11/12: preserves atomic rejection and persistence through a fresh client", async () => {
    const event = await createEvent();
    const malformed = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerCookie).set("Content-Type", "application/json").send('{"capacity":');
    expect(malformed.status).toBe(400);
    const fresh = await prisma.event.findUnique({ where: { id: event.id } });
    expect(fresh?.capacity).toBe(2);
  });

  it("TEST-F05-11: rolls back a controlled failure after Registration INSERT", async () => {
    const event = await createEvent(2);
    await expect(createRegistration(event.id, participantId, () => { throw new Error("F05_CONTROLLED_FAILURE"); })).rejects.toThrow("F05_CONTROLLED_FAILURE");
    expect(await prisma.registration.count({ where: { eventId: event.id } })).toBe(0);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).capacity).toBe(2);
  });
});
