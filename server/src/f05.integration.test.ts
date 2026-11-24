import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role, RegistrationStatus } from "@prisma/client";
import { app, createRegistration, setNowProvider } from "./app.js";
import { prisma } from "./auth.js";
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
  return response.headers["set-cookie"];
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

  it("TEST-F05-02: rejects wrong role, missing Origin, and non-owner access", async () => {
    const event = await createEvent();
    const wrongRole = await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", participantCookie).send({ capacity: 3 });
    expect(wrongRole.status).toBe(403); expect(wrongRole.body.error.code).toBe("FORBIDDEN");
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set(origin).set("Cookie", organizerBCookie).send({ capacity: 3 })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/organizer/events/${event.id}`).set({ Origin: "https://evil.example" }).set("Cookie", organizerCookie).send({ capacity: 3 })).status).toBe(403);
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
    if (patchResult.status === 200) expect(registrationResult.body.error.code).toBe("EVENT_FULL");
    if (registrationResult.status === 201) expect(patchResult.body.error.code).toBe("CAPACITY_BELOW_ACTIVE_COUNT");
    const committed = await prisma.event.findUniqueOrThrow({ where: { id: reductionEvent.id } });
    const committedActive = await prisma.registration.count({ where: { eventId: reductionEvent.id, status: RegistrationStatus.ACTIVE } });
    expect(committedActive).toBeLessThanOrEqual(committed.capacity);
    expect(await prisma.registration.count({ where: { eventId: reductionEvent.id, participantId, status: RegistrationStatus.ACTIVE } })).toBe(1);
    const publicState = await request(app).get(`/api/v1/events/${reductionEvent.id}`);
    expect(publicState.body.data.event.remainingPlaces).toBe(committed.capacity - committedActive);
    expect(publicState.body.data.event.registrationAvailable).toBe(committedActive < committed.capacity);
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
