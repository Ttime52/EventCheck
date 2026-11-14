import { randomUUID } from "node:crypto";
import request from "supertest";
import { PublicationState, Role, RegistrationStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { hashPassword } from "./security.js";
import { prisma } from "./auth.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const runId = randomUUID();
const organizerLogin = `f03-public-organizer-${runId}@example.test`;
const participantLogin = `f03-public-participant-${runId}@example.test`;
const secondParticipantLogin = `f03-public-participant-2-${runId}@example.test`;
const fixturePassword = "f03-public-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const isolatedDatabase = isIsolatedTestDatabase();

describe.skipIf(!isolatedDatabase)("F-03 public event discovery", () => {
  let eventId = "";
  let participantId = "";
  let secondParticipantId = "";
  let organizerId = "";
  let emptyEventId = "";

  beforeAll(async () => {
    const passwordHash = await hashPassword(fixturePassword);
    const organizer = await prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F03 Public Organizer", role: Role.ORGANIZER, passwordHash } });
    const participant = await prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "F03 Public Participant", role: Role.PARTICIPANT, passwordHash } });
    const secondParticipant = await prisma.user.create({ data: { loginIdentifier: secondParticipantLogin, displayName: "F03 Public Participant 2", role: Role.PARTICIPANT, passwordHash } });
    organizerId = organizer.id;
    participantId = participant.id;
    secondParticipantId = secondParticipant.id;
    const event = await prisma.event.create({ data: { organizerId, title: `F03 Public Event ${runId}`, description: "Public synthetic event", location: "Main Hall", startAt: new Date("2026-12-01T02:00:00.000Z"), endAt: new Date("2026-12-01T04:00:00.000Z"), capacity: 2, publicationState: PublicationState.PUBLISHED } });
    eventId = event.id;
    await prisma.registration.create({ data: { eventId, participantId, status: RegistrationStatus.ACTIVE } });
    await prisma.registration.create({ data: { eventId, participantId: secondParticipantId, status: RegistrationStatus.ACTIVE } });
    const emptyEvent = await prisma.event.create({ data: { organizerId, title: `F03 Empty Event ${runId}`, description: "Empty synthetic event", location: "Room 2", startAt: new Date("2026-12-02T02:00:00.000Z"), endAt: new Date("2026-12-02T04:00:00.000Z"), capacity: 2, publicationState: PublicationState.PUBLISHED } });
    emptyEventId = emptyEvent.id;
  });

  afterAll(async () => {
    if (eventId) await prisma.registration.deleteMany({ where: { eventId } });
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
    if (emptyEventId) await prisma.event.deleteMany({ where: { id: emptyEventId } });
    if (organizerId || participantId || secondParticipantId) await prisma.user.deleteMany({ where: { id: { in: [organizerId, participantId, secondParticipantId].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("TEST-F03-01/02: allows anonymous access to published events with availability", async () => {
    const response = await request(app).get("/api/v1/events");
    expect(response.status).toBe(200);
    expect(response.body.data.events).toEqual(expect.any(Array));
    const event = response.body.data.events.find((item: { id: string }) => item.id === eventId);
    expect(event).toMatchObject({ id: eventId, capacity: 2, remainingPlaces: 0, registrationAvailable: false });
    expect(event).not.toHaveProperty("organizerId");
    expect(event).not.toHaveProperty("organizer");
    expect(event).not.toHaveProperty("publicationState");
  });

  it("TEST-F03-01: allows Participant and Organizer sessions to read the same public APIs", async () => {
    const login = async (loginIdentifier: string) => (await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password: fixturePassword })).headers["set-cookie"];
    const participantResponse = await request(app).get("/api/v1/events").set("Cookie", await login(participantLogin));
    const organizerResponse = await request(app).get(`/api/v1/events/${eventId}`).set("Cookie", await login(organizerLogin));
    expect(participantResponse.status).toBe(200);
    expect(organizerResponse.status).toBe(200);
    expect(organizerResponse.body.data.event.id).toBe(eventId);
  });

  it("TEST-F03-01/02: returns public detail and empty availability; missing detail is privacy-preserving", async () => {
    const detail = await request(app).get(`/api/v1/events/${eventId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.event).toMatchObject({ id: eventId, remainingPlaces: 0, registrationAvailable: false });
    const emptyDetail = await request(app).get(`/api/v1/events/${emptyEventId}`);
    expect(emptyDetail.status).toBe(200);
    expect(emptyDetail.body.data.event).toMatchObject({ id: emptyEventId, remainingPlaces: 2, registrationAvailable: true });
    const missing = await request(app).get("/api/v1/events/00000000-0000-0000-0000-000000000000");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
  });

  it("TEST-F03-08/19: enforces one ACTIVE registration while allowing CANCELLED history", async () => {
    await expect(prisma.registration.create({ data: { eventId, participantId, status: RegistrationStatus.ACTIVE } })).rejects.toThrow();
    const cancelled = await prisma.registration.create({ data: { eventId, participantId, status: RegistrationStatus.CANCELLED } });
    expect(cancelled.status).toBe(RegistrationStatus.CANCELLED);
  });
});
