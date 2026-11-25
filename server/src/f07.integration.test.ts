import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { app, setNowProvider } from "./app.js";
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

  it("TEST-F07-01/02/05: owner check-in persists Attendance and rejects unauthorized callers", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    const success = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(success.status).toBe(201); expect(success.body.data.attendance).toMatchObject({ registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId });
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", participantCookie).send({ eventId: event.id })).status).toBe(403);
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", otherOrganizerCookie).send({ eventId: event.id })).status).toBe(404);
    expect((await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set("Cookie", organizerCookie).send({ eventId: event.id })).status).toBe(403);
  });
  it("TEST-F07-03: enforces exact check-in window boundaries", async () => {
    const before = await createEvent(); const atEnd = await createEvent();
    const beforeReg = await createRegistration(before.id); const endReg = await createRegistration(atEnd.id);
    setNowProvider(() => new Date(before.startAt.getTime() - 1));
    expect((await request(app).post(`/api/v1/organizer/registrations/${beforeReg.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: before.id })).status).toBe(409);
    setNowProvider(() => atEnd.endAt);
    expect((await request(app).post(`/api/v1/organizer/registrations/${endReg.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: atEnd.id })).status).toBe(409);
  });
  it("TEST-F07-04/06: rejects cancelled and duplicate check-ins", async () => {
    const event = await createEvent(); const cancelled = await createRegistration(event.id, otherParticipantId, RegistrationStatus.CANCELLED);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    expect((await request(app).post(`/api/v1/organizer/registrations/${cancelled.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id })).body.error.code).toBe("REGISTRATION_NOT_ACTIVE");
    const active = await createRegistration(event.id); const first = await request(app).post(`/api/v1/organizer/registrations/${active.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    const second = await request(app).post(`/api/v1/organizer/registrations/${active.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(first.status).toBe(201); expect(second.status).toBe(409);
  });
  it("TEST-F07-07/08: returns owner and participant attendance projections", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    const owner = await request(app).get(`/api/v1/organizer/events/${event.id}/attendance`).set("Cookie", organizerCookie);
    expect(owner.status).toBe(200); expect(owner.body.data.attendances).toEqual([]);
    const own = await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", participantCookie);
    expect(own.status).toBe(200); expect(own.body.data.attendance).toBeNull();
    expect((await request(app).get(`/api/v1/me/registrations/${registration.id}/attendance`).set("Cookie", otherParticipantCookie)).status).toBe(404);
  });
  it("TEST-F07-04: preserves associations and safe validation outcomes", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date("2099-11-26T10:00:00.000Z"));
    const mismatch = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: crypto.randomUUID() });
    expect(mismatch.status).toBe(404);
    const invalid = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ participantId });
    expect(invalid.status).toBe(422);
    expect(await prisma.attendance.count({ where: { eventId: event.id } })).toBe(0);
  });
  it("TEST-F07-03/04: cancellation remains mutually exclusive with Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    const attendance = await prisma.attendance.create({ data: { registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt: new Date() } });
    const cancelled = await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({});
    expect(cancelled.status).toBe(409); expect(cancelled.body.error.code).toBe("REGISTRATION_CHECKED_IN"); expect(attendance.id).toBeTruthy();
  });
  it("TEST-F07-03: accepts check-in exactly at Event start", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => event.startAt);
    const response = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(response.status).toBe(201);
    expect(response.body.data.attendance.checkedInAt).toBe(event.startAt.toISOString());
  });
  it("TEST-F07-06: concurrent duplicate check-in creates exactly one Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() + 1));
    const responses = await Promise.all(Array.from({ length: 2 }, () => request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id })));
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(1);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(1);
  });
  it("TEST-F07-11: rejected check-in leaves database unchanged", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.endAt.getTime()));
    const response = await request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id });
    expect(response.status).toBe(409);
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe(RegistrationStatus.ACTIVE);
  });
  it("TEST-F07-10: transaction failure does not create Attendance", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    try {
      await prisma.$transaction(async transaction => {
        await transaction.attendance.create({ data: { registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt: new Date() } });
        throw new Error("controlled F07 failure after Attendance INSERT");
      });
    } catch (error) { expect((error as Error).message).toContain("controlled F07 failure"); }
    expect(await prisma.attendance.count({ where: { registrationId: registration.id } })).toBe(0);
  });
  it("TEST-F07-09: serializes concurrent check-in and cancellation without contradiction", async () => {
    const event = await createEvent(); const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(event.startAt.getTime() + 1));
    const [checkIn, cancellation] = await Promise.all([
      request(app).post(`/api/v1/organizer/registrations/${registration.id}/attendance`).set(origin).set("Cookie", organizerCookie).send({ eventId: event.id }),
      request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({}),
    ]);
    const stored = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    const attendance = await prisma.attendance.findUnique({ where: { registrationId: registration.id } });
    expect((checkIn.status === 201 && cancellation.status !== 200) || (cancellation.status === 200 && checkIn.status !== 201)).toBe(true);
    if (checkIn.status === 201) { expect(stored.status).toBe(RegistrationStatus.ACTIVE); expect(attendance).not.toBeNull(); }
    if (cancellation.status === 200) { expect(stored.status).toBe(RegistrationStatus.CANCELLED); expect(attendance).toBeNull(); }
  });
});
