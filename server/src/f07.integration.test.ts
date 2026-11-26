import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { app, setAttendanceFailureInjector, setNowProvider } from "./app.js";
import { prisma, SESSION_COOKIE } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const run = crypto.randomUUID();
const password = "f07-isolated-password";
const organizerLogin = `f07-organizer-${run}@example.test`;
const otherOrganizerLogin = `f07-other-organizer-${run}@example.test`;
const participantLogin = `f07-participant-${run}@example.test`;
const otherParticipantLogin = `f07-other-participant-${run}@example.test`;
const origin = { Origin: "http://localhost:5173" };
const start = new Date("2099-11-26T09:00:00.000Z");
const end = new Date("2099-11-26T12:00:00.000Z");
const isolated = isIsolatedTestDatabase();

async function login(identifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: identifier, password });
  expect(response.status).toBe(200);
  const cookies = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [response.headers["set-cookie"]];
  return cookies.find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`))!.split(";")[0];
}

describe.skipIf(!isolated)("F-07 Organizer check-in and attendance retrieval", () => {
  let organizerId = ""; let otherOrganizerId = ""; let participantId = ""; let otherParticipantId = "";
  let organizerCookie = ""; let otherOrganizerCookie = ""; let participantCookie = ""; let otherParticipantCookie = "";
  const eventIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const [organizer, otherOrganizer, participant, otherParticipant] = await Promise.all([
      prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F07 Organizer", role: Role.ORGANIZER, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: otherOrganizerLogin, displayName: "F07 Other Organizer", role: Role.ORGANIZER, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "F07 Participant", role: Role.PARTICIPANT, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: otherParticipantLogin, displayName: "F07 Other Participant", role: Role.PARTICIPANT, passwordHash } }),
    ]);
    organizerId = organizer.id; otherOrganizerId = otherOrganizer.id; participantId = participant.id; otherParticipantId = otherParticipant.id;
    [organizerCookie, otherOrganizerCookie, participantCookie, otherParticipantCookie] = await Promise.all([login(organizerLogin), login(otherOrganizerLogin), login(participantLogin), login(otherParticipantLogin)]);
  });
  afterAll(async () => {
    setNowProvider(() => new Date());
    await prisma.attendance.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [organizerId, otherOrganizerId, participantId, otherParticipantId].filter(Boolean) } } });
    await prisma.$disconnect();
  });
  async function createEvent(startAt = start, endAt = end) {
    const event = await prisma.event.create({ data: { organizerId, title: `F07 ${run}`, description: "F07 test", location: "Hall", startAt, endAt, capacity: 3, publicationState: PublicationState.PUBLISHED } });
    eventIds.push(event.id); return event;
  }
  async function createRegistration(eventId: string, participant = participantId, status: RegistrationStatus = RegistrationStatus.ACTIVE) {
    return prisma.registration.create({ data: { eventId, participantId: participant, status, cancelledAt: status === RegistrationStatus.CANCELLED ? new Date() : null } });
  }

  it("TEST-F07-01: owner check-in persists one Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    const success = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(success.status).toBe(201); expect(success.body.data.attendance).toMatchObject({ registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId });
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", participantCookie).send({ eventId: event.id })).status).toBe(403);
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", otherOrganizerCookie).send({ eventId: event.id })).status).toBe(404);
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set("Cookie", organizerCookie).send({ eventId: event.id })).status).toBe(403);
  });
  it("TEST-F07-02: enforces exact check-in window boundaries", async () => {
    const before = await createEvent(); const atEnd = await createEvent();
    const beforeReg = await createRegistration(before.id); const endReg = await createRegistration(atEnd.id);
    setNowProvider(() => new Date(before.startAt.getTime() - 1));
    expect((await request(app).post(`/api/v1/organizer/registrations/${beforeReg.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: before.id })).status).toBe(409);
    setNowProvider(() => atEnd.endAt);
    expect((await request(app).post(`/api/v1/organizer/registrations/${endReg.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: atEnd.id })).status).toBe(409);
  });
  it("TEST-F07-03: rejects cancelled check-ins", async () => {
    const event = await createEvent(); const cancelled = await createRegistration(event.id, otherParticipantId, RegistrationStatus.CANCELLED);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    expect((await request(app).post(`/api/v1/organizer/registrations/${cancelled.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id })).body.error.code).toBe("REGISTRATION_NOT_ACTIVE");
    const active = await createRegistration(event.id); const first = await request(app).post(`/api/v1/organizer/registrations/${active.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    const second = await request(app).post(`/api/v1/organizer/registrations/${active.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(first.status).toBe(201); expect(second.status).toBe(409);
  });
  it("TEST-F07-06/07: returns owner and participant attendance projections", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    const owner = await request(app).get(`/api/v1/organizer/events/${event.id}/attendance`).set("Cookie", organizerCookie);
    expect(owner.status).toBe(200); expect(owner.body.data.attendances).toEqual([]);
    const own = await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", participantCookie);
    expect(own.status).toBe(200); expect(own.body.data.attendance).toBeNull();
    expect((await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", otherParticipantCookie)).status).toBe(404);
  });

  it("TEST-F07-06: scopes Organizer attendance retrieval by Event with stable ordering", async () => {
    const first = await createEvent();
    const second = await createEvent();
    const otherOwnerEvent = await prisma.event.create({ data: { organizerId: otherOrganizerId, title: `F07 other ${run}`, description: "other", location: "Other", startAt: start, endAt: end, capacity: 2, publicationState: PublicationState.PUBLISHED } });
    eventIds.push(otherOwnerEvent.id);
    const firstRegistration = await createRegistration(first.id);
    const firstTieRegistration = await createRegistration(first.id, otherParticipantId);
    const secondRegistration = await createRegistration(second.id, otherParticipantId);
    const firstAttendance = await prisma.attendance.create({ data: { registrationId: firstRegistration.id, eventId: first.id, participantId, recordedByOrganizerId: organizerId, checkedInAt: new Date("2099-11-26T09:00:00.000Z") } });
    const firstTieAttendance = await prisma.attendance.create({ data: { registrationId: firstTieRegistration.id, eventId: first.id, participantId: otherParticipantId, recordedByOrganizerId: organizerId, checkedInAt: new Date("2099-11-26T09:00:00.000Z") } });
    await prisma.attendance.create({ data: {
      registrationId: secondRegistration.id, eventId: second.id, participantId: otherParticipantId, recordedByOrganizerId: organizerId, checkedInAt: new Date("2099-11-26T10:00:00.000Z") },
    });
    const firstResponse = await request(app).get(`/api/v1/organizer/events/${first.id}/attendance`).set("Cookie", organizerCookie);
    const secondResponse = await request(app).get(`/api/v1/organizer/events/${second.id}/attendance`).set("Cookie", organizerCookie);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body.data.attendances).toHaveLength(2);
    expect(secondResponse.body.data.attendances).toHaveLength(1);
    const persistedOrder = await prisma.attendance.findMany({ where: { eventId: first.id }, orderBy: [{ checkedInAt: "asc" }, { id: "asc" }], select: { id: true } });
    expect(firstResponse.body.data.attendances.map((item: { id: string }) => item.id)).toEqual(persistedOrder.map(item => item.id));
    expect(firstResponse.body.data.attendances[0]).toMatchObject({ id: persistedOrder[0].id, eventId: first.id });
    expect(firstResponse.body.data.attendances[1]).toMatchObject({ id: persistedOrder[1].id, eventId: first.id });
    expect([firstAttendance.id, firstTieAttendance.id]).toContain(persistedOrder[0].id);
    expect(secondResponse.body.data.attendances[0]).toMatchObject({ registrationId: secondRegistration.id, eventId: second.id });
    const empty = await request(app).get(`/api/v1/organizer/events/${(await createEvent()).id}/attendance`).set("Cookie", organizerCookie);
    expect(empty.status).toBe(200);
    expect(empty.body.data.attendances).toEqual([]);
    expect((await request(app).get(`/api/v1/organizer/events/${otherOwnerEvent.id}/attendance`).set("Cookie", organizerCookie)).status).toBe(404);
  });
  it("TEST-F07-04: preserves associations and safe validation outcomes", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    const mismatch = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: crypto.randomUUID() });
    expect(mismatch.status).toBe(404);
    const otherEvent = await createEvent();
    expect(otherEvent.id).not.toBe(event.id);
    expect(await prisma.event.count({ where: { id: { in: [event.id, otherEvent.id] } } })).toBe(2);
    const before = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    const attendanceBefore = await prisma.attendance.findMany({ where: { eventId: { in: [event.id, otherEvent.id] } } });
    const existingMismatch = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: otherEvent.id });
    expect(existingMismatch.status).toBe(404);
    expect(existingMismatch.body).toEqual({ error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" } });
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toEqual(before);
    expect(await prisma.attendance.findMany({ where: { eventId: { in: [event.id, otherEvent.id] } } })).toEqual(attendanceBefore);
    const invalid = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ participantId });
    expect(invalid.status).toBe(422);
    expect(await prisma.attendance.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("TEST-F07-04: rejects unauthenticated, wrong-role, non-owner and CSRF access without disclosure", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() + 1));
    const unauthenticated = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).send({ eventId: event.id });
    const participant = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", participantCookie).send({ eventId: event.id });
    const nonOwner = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", otherOrganizerCookie).send({ eventId: event.id });
    const csrf = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set("Origin", "http://evil.example").set("Cookie", organizerCookie).send({ eventId: event.id });
    const otherParticipant = await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", otherParticipantCookie);
    const nonexistent = await request(app).post(`/api/v1/organizer/registrations/${crypto.randomUUID()}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    const crossOwnerRetrieval = await request(app).get(`/api/v1/organizer/events/${event.id}/attendance`).set("Cookie", otherOrganizerCookie);
    expect(unauthenticated.status).toBe(401);
    expect(participant.status).toBe(403);
    expect(nonOwner.status).toBe(404);
    expect(csrf.status).toBe(403);
    expect(otherParticipant.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expect(crossOwnerRetrieval.status).toBe(404);
    const privateUser = await prisma.user.findUniqueOrThrow({ where: { id: participantId } });
    for (const denied of [unauthenticated, participant, nonOwner, csrf, otherParticipant, nonexistent, crossOwnerRetrieval]) {
      expect(Object.keys(denied.body)).toEqual(["error"]);
      expect(Object.keys(denied.body.error).sort()).toEqual(["code", "message"]);
      const serialized = JSON.stringify(denied.body);
      for (const value of [participantId, privateUser.loginIdentifier, privateUser.passwordHash, participantCookie]) expect(serialized).not.toContain(value);
      for (const field of ["participantId", "loginIdentifier", "passwordHash", "sessionId", "token"]) expect(serialized).not.toContain(`"${field}"`);
    }
    expect(JSON.stringify([unauthenticated.body, participant.body, nonOwner.body, csrf.body, otherParticipant.body, nonexistent.body, crossOwnerRetrieval.body])).not.toContain(registration.id);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
  });

  it("TEST-F07-04: rejects expired and revoked sessions on Organizer and Participant routes", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    const expiredId = crypto.randomUUID();
    const expiredPostId = crypto.randomUUID();
    const revokedId = crypto.randomUUID();
    await prisma.session.createMany({ data: [
      { id: expiredId, userId: organizerId, absoluteExpiry: new Date(Date.now() - 1000) },
      { id: expiredPostId, userId: organizerId, absoluteExpiry: new Date(Date.now() - 1000) },
      { id: revokedId, userId: organizerId, absoluteExpiry: new Date(Date.now() + 3600000) },
    ] });
    try {
      setNowProvider(() => new Date(event.startAt.getTime() + 1));
      const before = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
      const attendanceBefore = await prisma.attendance.findMany({ where: { eventId: event.id } });
      const expired = await request(app).get(`/api/v1/organizer/events/${event.id}/attendance`).set("Cookie", `${SESSION_COOKIE}=${expiredId}`);
      await prisma.session.delete({ where: { id: revokedId } });
      const revoked = await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", `${SESSION_COOKIE}=${revokedId}`);
      expect((await prisma.session.findUniqueOrThrow({ where: { id: expiredPostId } })).invalidatedAt).toBeNull();
      for (const sessionId of [expiredPostId, revokedId]) {
        const rejected = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", `${SESSION_COOKIE}=${sessionId}`).send({ eventId: event.id });
        expect(rejected.status).toBe(401);
        expect(rejected.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      }
      expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toEqual(before);
      expect(await prisma.attendance.findMany({ where: { eventId: event.id } })).toEqual(attendanceBefore);
      expect(expired.status).toBe(401);
      expect(revoked.status).toBe(401);
      expect(JSON.stringify([expired.body, revoked.body])).not.toContain(registration.id);
    } finally {
      await prisma.session.deleteMany({ where: { id: { in: [expiredId, expiredPostId, revokedId] } } });
    }
  });
  it("TEST-F07-03: cancellation remains mutually exclusive with Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    const attendance = await prisma.attendance.create({ data: { registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt: new Date() } });
    const cancelled = await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({});
    expect(cancelled.status).toBe(409); expect(cancelled.body.error.code).toBe("REGISTRATION_CHECKED_IN"); expect(attendance.id).toBeTruthy();
  });
  it("TEST-F07-02: accepts check-in exactly at Event start", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => event.startAt);
    const response = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(response.status).toBe(201);
    expect(response.body.data.attendance.checkedInAt).toBe(event.startAt.toISOString());
  });
  it("TEST-F07-05: concurrent duplicate check-in creates exactly one Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() + 1));
    const responses = await Promise.all(Array.from({ length: 2 }, () => request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id })));
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(1);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(1);
  });
  it("TEST-F07-02: rejected check-in leaves database unchanged", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.endAt.getTime()));
    const response = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(response.status).toBe(409);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe(RegistrationStatus.ACTIVE);
  });
  it("TEST-F07-10: API persistence failure rolls back Attendance and recovers", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() + 1));
    setAttendanceFailureInjector(() => { throw new Error("controlled F07 API failure after Attendance INSERT"); });
    try {
      const failed = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
      expect(failed.status).toBe(500);
      expect(failed.body.data).toBeUndefined();
    } finally { setAttendanceFailureInjector(null); }
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe(RegistrationStatus.ACTIVE);
    const recovered = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(recovered.status).toBe(201);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(1);
  });
  it("TEST-F07-09: enforces before-start and exact-start cancellation/check-in boundaries", async () => {
    const beforeEvent = await createEvent(); const beforeRegistration = await createRegistration(beforeEvent.id);
    setNowProvider(() => new Date(beforeEvent.startAt.getTime() - 1));
    const beforeCheckIn = await request(app).post(`/api/v1/organizer/registrations/${beforeRegistration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: beforeEvent.id });
    const beforeCancellation = await request(app).post(`/api/v1/me/registrations/${beforeRegistration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({});
    expect(beforeCheckIn.status).toBe(409);
    expect(beforeCancellation.status).toBe(200);
    expect(await prisma.attendance.findUnique({ where: { registrationId: beforeRegistration.id } })).toBeNull();
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: beforeRegistration.id } })).status).toBe(RegistrationStatus.CANCELLED);

    const exactEvent = await createEvent(); const exactRegistration = await createRegistration(exactEvent.id);
    setNowProvider(() => exactEvent.startAt);
    const exactCancellation = await request(app).post(`/api/v1/me/registrations/${exactRegistration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({});
    const exactCheckIn = await request(app).post(`/api/v1/organizer/registrations/${exactRegistration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: exactEvent.id });
    const stored = await prisma.registration.findUniqueOrThrow({ where: { id: exactRegistration.id } });
    const attendance = await prisma.attendance.findUnique({ where: { registrationId: exactRegistration.id } });
    expect(exactCancellation.status).toBe(409);
      expect(exactCancellation.body.error.code).toBe("CANCELLATION_CLOSED");
    expect(exactCheckIn.status).toBe(201);
    expect(stored.status).toBe(RegistrationStatus.ACTIVE);
    expect(attendance).not.toBeNull();
    expect(attendance).toMatchObject({ registrationId: exactRegistration.id, eventId: exactEvent.id, participantId, recordedByOrganizerId: organizerId });
    expect(await prisma.attendance.count({ where: { registrationId: exactRegistration.id } })).toBe(1);
  });

  it("TEST-F07-09: serializes real API cancellation and check-in behind an Event-row lock", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    setNowProvider(() => event.startAt);
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    let holderPid = 0;
    const holder = prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE`;
      const rows = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      holderPid = Number(rows[0]?.pid ?? 0);
      await released;
    }, { timeout: 15000 });
    let checkInRequest: Promise<any> | undefined;
    let cancellationRequest: Promise<any> | undefined;
    try {
      const deadline = Date.now() + 2000;
      while (!holderPid && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      expect(holderPid).toBeGreaterThan(0);
      checkInRequest = request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id }).then(result => result);
      cancellationRequest = request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({}).then(result => result);
      let blocked: Array<{ pid: number }> = [];
      const blockDeadline = Date.now() + 2000;
      while (!blocked.length && Date.now() < blockDeadline) {
        blocked = await prisma.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0 AND ${holderPid} = ANY(pg_blocking_pids(pid))`;
        if (!blocked.length) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked.length).toBeGreaterThan(0);
      release();
      const [checkIn, cancellation] = await Promise.all([checkInRequest, cancellationRequest]);
      const stored = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
      const attendance = await prisma.attendance.findUnique({ where: { registrationId: registration.id } });
      expect(checkIn.status).toBe(201);
      expect(cancellation.status).toBe(409);
      expect(["CANCELLATION_CLOSED", "REGISTRATION_CHECKED_IN"]).toContain(cancellation.body.error.code);
      expect(stored.status).toBe(RegistrationStatus.ACTIVE);
      expect(attendance).toMatchObject({ registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId });
      expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(1);
    } finally {
      release();
      await Promise.allSettled([checkInRequest, cancellationRequest].filter(Boolean));
      await holder.catch(() => undefined);
    }
  });

  it("TEST-F07-09: serializes before-start cancellation and rejected check-in behind an Event-row lock", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() - 1));
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    let holderPid = 0;
    const holder = prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE`;
      const rows = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      holderPid = Number(rows[0]?.pid ?? 0);
      await released;
    }, { timeout: 15000 });
    let checkInRequest: Promise<any> | undefined;
    let cancellationRequest: Promise<any> | undefined;
    try {
      const deadline = Date.now() + 2000;
      while (!holderPid && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      expect(holderPid).toBeGreaterThan(0);
      checkInRequest = request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id }).then(result => result);
      cancellationRequest = request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({}).then(result => result);
      let blocked: Array<{ pid: number }> = [];
      const blockDeadline = Date.now() + 2000;
      while (!blocked.length && Date.now() < blockDeadline) {
        blocked = await prisma.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0 AND ${holderPid} = ANY(pg_blocking_pids(pid))`;
        if (!blocked.length) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked.length).toBeGreaterThan(0);
      release();
      const [checkIn, cancellation] = await Promise.all([checkInRequest, cancellationRequest]);
      expect(checkIn.status).toBe(409);
      expect(["CHECK_IN_WINDOW_CLOSED", "REGISTRATION_NOT_ACTIVE"]).toContain(checkIn.body.error.code);
      expect(cancellation.status).toBe(200);
      const stored = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
      expect(stored.status).toBe(RegistrationStatus.CANCELLED);
      expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
    } finally {
      release();
      await Promise.allSettled([checkInRequest, cancellationRequest].filter(Boolean));
      await holder.catch(() => undefined);
    }
  });
});
