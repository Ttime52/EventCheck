import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { app } from "./app.js";
import { prisma, SESSION_COOKIE } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const run = crypto.randomUUID();
const password = "f08-isolated-password";
const origin = { Origin: "http://localhost:5173" };
const ownerLogin = `f08-owner-${run}@example.test`;
const otherOwnerLogin = `f08-other-owner-${run}@example.test`;
const participantOneLogin = `f08-participant-one-${run}@example.test`;
const participantTwoLogin = `f08-participant-two-${run}@example.test`;
const participantThreeLogin = `f08-participant-three-${run}@example.test`;
const loginIdentifiers = [ownerLogin, otherOwnerLogin, participantOneLogin, participantTwoLogin, participantThreeLogin];
const eventTitles = [`F08 summary ${run}`, `F08 empty ${run}`];
const isolated = isIsolatedTestDatabase();

let ownerId = "";
let participantOneId = "";
let participantTwoId = "";
let participantThreeId = "";
let ownerCookie = "";
let otherOwnerCookie = "";
let participantCookie = "";
let eventId = "";
let emptyEventId = "";
let expiredSessionId = "";
let revokedSessionId = "";
const eventIds: string[] = [];
const registrationIds: string[] = [];
const attendanceIds: string[] = [];
const userIds: string[] = [];
const sessionIds: string[] = [];

function trackCreated<T extends { id: string }>(creation: Promise<T>, ids: string[]) {
  return creation.then(record => {
    ids.push(record.id);
    return record;
  });
}

async function login(loginIdentifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password });
  expect(response.status).toBe(200);
  const headers = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [response.headers["set-cookie"]];
  const cookie = headers.find(value => value?.startsWith(`${SESSION_COOKIE}=`));
  expect(cookie).toBeDefined();
  return cookie!.split(";")[0];
}

describe.skipIf(!isolated)("F-08 Organizer Event Summary against isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!isIsolatedTestDatabase()) throw new Error("F-08 integration tests require exactly eventcheck_test/public on 127.0.0.1:5433");
    const passwordHash = await hashPassword(password);
    const [owner, , participantOne, participantTwo, participantThree] = await Promise.all([
      trackCreated(prisma.user.create({ data: { loginIdentifier: ownerLogin, displayName: "F08 Owner", role: Role.ORGANIZER, passwordHash } }), userIds),
      trackCreated(prisma.user.create({ data: { loginIdentifier: otherOwnerLogin, displayName: "F08 Other Owner", role: Role.ORGANIZER, passwordHash } }), userIds),
      trackCreated(prisma.user.create({ data: { loginIdentifier: participantOneLogin, displayName: "F08 Participant One", role: Role.PARTICIPANT, passwordHash } }), userIds),
      trackCreated(prisma.user.create({ data: { loginIdentifier: participantTwoLogin, displayName: "F08 Participant Two", role: Role.PARTICIPANT, passwordHash } }), userIds),
      trackCreated(prisma.user.create({ data: { loginIdentifier: participantThreeLogin, displayName: "F08 Participant Three", role: Role.PARTICIPANT, passwordHash } }), userIds),
    ]);
    ownerId = owner.id;
    participantOneId = participantOne.id;
    participantTwoId = participantTwo.id;
    participantThreeId = participantThree.id;
    [ownerCookie, otherOwnerCookie, participantCookie] = await Promise.all([login(ownerLogin), login(otherOwnerLogin), login(participantOneLogin)]);

    const [event, emptyEvent] = await Promise.all([
      trackCreated(prisma.event.create({ data: { organizerId: ownerId, title: eventTitles[0], description: "F08 aggregate fixture", location: "Test Hall", startAt: new Date("2099-11-26T09:00:00.000Z"), endAt: new Date("2099-11-26T12:00:00.000Z"), capacity: 10, publicationState: PublicationState.PUBLISHED } }), eventIds),
      trackCreated(prisma.event.create({ data: { organizerId: ownerId, title: eventTitles[1], description: "F08 empty fixture", location: "Test Hall", startAt: new Date("2099-11-26T09:00:00.000Z"), endAt: new Date("2099-11-26T12:00:00.000Z"), capacity: 4, publicationState: PublicationState.PUBLISHED } }), eventIds),
    ]);
    eventId = event.id;
    emptyEventId = emptyEvent.id;

    const createRegistration = (participantId: string, status: RegistrationStatus) => prisma.registration.create({
      data: { eventId, participantId, status, cancelledAt: status === RegistrationStatus.CANCELLED ? new Date("2026-11-01T00:00:00.000Z") : null },
    });
    const [, , activeOne] = await Promise.all([
      trackCreated(createRegistration(participantOneId, RegistrationStatus.CANCELLED), registrationIds),
      trackCreated(createRegistration(participantOneId, RegistrationStatus.CANCELLED), registrationIds),
      trackCreated(createRegistration(participantOneId, RegistrationStatus.ACTIVE), registrationIds),
      trackCreated(createRegistration(participantTwoId, RegistrationStatus.ACTIVE), registrationIds),
      trackCreated(createRegistration(participantThreeId, RegistrationStatus.ACTIVE), registrationIds),
    ]);
    await trackCreated(prisma.attendance.create({ data: { registrationId: activeOne.id, eventId, participantId: participantOneId, recordedByOrganizerId: ownerId, checkedInAt: new Date("2099-11-26T09:30:00.000Z") } }), attendanceIds);

    expiredSessionId = crypto.randomUUID();
    revokedSessionId = crypto.randomUUID();
    sessionIds.push(expiredSessionId, revokedSessionId);
    await prisma.session.createMany({ data: [
      { id: expiredSessionId, userId: ownerId, absoluteExpiry: new Date(Date.now() - 1_000) },
      { id: revokedSessionId, userId: ownerId, absoluteExpiry: new Date(Date.now() + 3_600_000), invalidatedAt: new Date() },
    ] });
  });

  afterAll(async () => {
    const cleanupErrors: string[] = [];
    const attemptCleanup = async (label: string, operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    try {
      await attemptCleanup("Attendance", () => prisma.attendance.deleteMany({ where: { OR: [
        ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
        ...(attendanceIds.length ? [{ id: { in: attendanceIds } }] : []),
      ] } }));
      await attemptCleanup("Registrations", () => prisma.registration.deleteMany({ where: { OR: [
        ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
        ...(registrationIds.length ? [{ id: { in: registrationIds } }] : []),
      ] } }));
      await attemptCleanup("Events", () => prisma.event.deleteMany({ where: { OR: [
        ...(eventIds.length ? [{ id: { in: eventIds } }] : []),
        { title: { in: eventTitles } },
      ] } }));
      await attemptCleanup("Sessions", () => prisma.session.deleteMany({ where: { OR: [
        { id: { in: sessionIds } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ] } }));
      await attemptCleanup("Users", () => prisma.user.deleteMany({ where: { OR: [
        ...(userIds.length ? [{ id: { in: userIds } }] : []),
        { loginIdentifier: { in: loginIdentifiers } },
      ] } }));
    } finally {
      await attemptCleanup("Prisma disconnect", () => prisma.$disconnect());
    }

    if (cleanupErrors.length) {
      throw new Error(`F-08 fixture cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  });

  it("TEST-F08-02: returns database-backed lifecycle and attendance counts without row-level data", async () => {
    const [eventBefore, registrationsBefore, attendanceBefore, activeCount, cancelledCount, checkedInCount] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
      prisma.registration.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
      prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } }),
      prisma.registration.count({ where: { eventId, status: RegistrationStatus.CANCELLED } }),
      prisma.attendance.count({ where: { eventId, registration: { status: RegistrationStatus.ACTIVE } } }),
    ]);

    const response = await request(app).get(`/api/v1/organizer/events/${eventId}/summary`).set("Cookie", ownerCookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { summary: {
      eventId,
      capacity: eventBefore.capacity,
      activeCount,
      cancelledCount,
      remainingSeats: eventBefore.capacity - activeCount,
      checkedInCount,
      notCheckedInCount: activeCount - checkedInCount,
      attendanceRate: 33.3,
    } } });
    expect(Object.keys(response.body.data.summary).sort()).toEqual([
      "activeCount", "attendanceRate", "cancelledCount", "capacity", "checkedInCount", "eventId", "notCheckedInCount", "remainingSeats",
    ]);
    const serialized = JSON.stringify(response.body);
    for (const privateValue of [participantOneId, participantTwoId, participantThreeId, participantOneLogin, participantTwoLogin, participantThreeLogin, ...registrationIds]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(serialized).not.toContain("passwordHash");

    const [eventAfter, registrationsAfter, attendanceAfter] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
      prisma.registration.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
    ]);
    expect(eventAfter).toEqual(eventBefore);
    expect(registrationsAfter).toEqual(registrationsBefore);
    expect(attendanceAfter).toEqual(attendanceBefore);
  });

  it("TEST-F08-01/04: returns zero counts and a null rate for an owned Event with no registrations", async () => {
    const response = await request(app).get(`/api/v1/organizer/events/${emptyEventId}/summary`).set("Cookie", ownerCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      eventId: emptyEventId,
      capacity: 4,
      activeCount: 0,
      cancelledCount: 0,
      remainingSeats: 4,
      checkedInCount: 0,
      notCheckedInCount: 0,
      attendanceRate: null,
    });
  });

  it("TEST-F08-05: enforces session, role, Event ownership, concealed 404s, and read-only denials", async () => {
    const [eventBefore, registrationsBefore, attendanceBefore] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
      prisma.registration.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
    ]);
    const denied = await Promise.all([
      request(app).get(`/api/v1/organizer/events/${eventId}/summary`),
      request(app).get(`/api/v1/organizer/events/${eventId}/summary`).set("Cookie", participantCookie),
      request(app).get(`/api/v1/organizer/events/${eventId}/summary`).set("Cookie", otherOwnerCookie),
      request(app).get(`/api/v1/organizer/events/not-a-uuid/summary`).set("Cookie", ownerCookie),
      request(app).get(`/api/v1/organizer/events/${crypto.randomUUID()}/summary`).set("Cookie", ownerCookie),
      request(app).get(`/api/v1/organizer/events/${eventId}/summary`).set("Cookie", `${SESSION_COOKIE}=${expiredSessionId}`),
      request(app).get(`/api/v1/organizer/events/${eventId}/summary`).set("Cookie", `${SESSION_COOKIE}=${revokedSessionId}`),
    ]);
    expect(denied.map(item => item.status)).toEqual([401, 403, 404, 404, 404, 401, 401]);
    expect(denied[2].body).toEqual(denied[3].body);
    expect(denied[3].body).toEqual(denied[4].body);
    for (const response of denied) {
      expect(Object.keys(response.body)).toEqual(["error"]);
      expect(response.body).not.toHaveProperty("data");
      expect(JSON.stringify(response.body)).not.toContain("capacity");
      expect(JSON.stringify(response.body)).not.toContain("summary");
      expect(JSON.stringify(response.body)).not.toContain(participantOneId);
    }
    expect(denied.map(item => item.body.error.code)).toEqual([
      "UNAUTHENTICATED", "FORBIDDEN", "EVENT_NOT_FOUND", "EVENT_NOT_FOUND", "EVENT_NOT_FOUND", "UNAUTHENTICATED", "UNAUTHENTICATED",
    ]);
    const [eventAfter, registrationsAfter, attendanceAfter] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
      prisma.registration.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
    ]);
    expect(eventAfter).toEqual(eventBefore);
    expect(registrationsAfter).toEqual(registrationsBefore);
    expect(attendanceAfter).toEqual(attendanceBefore);
  });
});
