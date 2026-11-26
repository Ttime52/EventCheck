import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { app, setNowProvider } from "./app.js";
import { prisma, SESSION_COOKIE } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const suffix = `f06-${crypto.randomUUID()}`;
const organizerLogin = `${suffix}-organizer@example.test`;
const participantLogin = `${suffix}-participant@example.test`;
const otherParticipantLogin = `${suffix}-other-participant@example.test`;
const password = "f06-isolated-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const defaultStart = new Date("2099-11-26T09:00:00.000Z");
const isolated = isIsolatedTestDatabase();
const failureFunction = "f06_test_fail_registration_update";
const failureTrigger = "f06_test_fail_registration_update_trigger";

async function login(identifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier: identifier, password });
  expect(response.status).toBe(200);
  const values = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [response.headers["set-cookie"]];
  return values.find((cookie: string) => cookie.startsWith(`${SESSION_COOKIE}=`))!.split(";")[0];
}

describe.skipIf(!isolated)("F-06 cancellation and re-registration (isolated PostgreSQL)", () => {
  let organizerId = "";
  let participantId = "";
  let otherParticipantId = "";
  let organizerCookie = "";
  let participantCookie = "";
  let otherParticipantCookie = "";
  const eventIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const [organizer, participant, otherParticipant] = await Promise.all([
      prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F06 Organizer", role: Role.ORGANIZER, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "F06 Participant", role: Role.PARTICIPANT, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: otherParticipantLogin, displayName: "F06 Other Participant", role: Role.PARTICIPANT, passwordHash } }),
    ]);
    organizerId = organizer.id;
    participantId = participant.id;
    otherParticipantId = otherParticipant.id;
    [organizerCookie, participantCookie, otherParticipantCookie] = await Promise.all([login(organizerLogin), login(participantLogin), login(otherParticipantLogin)]);
  });

  afterAll(async () => {
    setNowProvider(() => new Date());
    try { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failureTrigger} ON "Registration"`); } catch {}
    try { await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failureFunction}()`); } catch {}
    if (eventIds.length) {
      await prisma.attendance.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }
    if (organizerId || participantId || otherParticipantId) {
      await prisma.user.deleteMany({ where: { id: { in: [organizerId, participantId, otherParticipantId].filter(Boolean) } } });
    }
    await prisma.$disconnect();
  });

  async function createEvent(options: { capacity?: number; startAt?: Date; deadline?: Date | null } = {}) {
    const startAt = options.startAt ?? defaultStart;
    const event = await prisma.event.create({ data: {
      organizerId,
      title: `${suffix} event ${eventIds.length + 1}`,
      description: "F06 integration event",
      location: "Test Hall",
      startAt,
      endAt: new Date(startAt.getTime() + 3_600_000),
      registrationDeadline: options.deadline === undefined ? new Date(startAt.getTime() - 30 * 60_000) : options.deadline,
      capacity: options.capacity ?? 3,
      publicationState: PublicationState.PUBLISHED,
    } });
    eventIds.push(event.id);
    return event;
  }

  async function createRegistration(eventId: string, options: { participantId?: string; status?: RegistrationStatus; cancelledAt?: Date | null; registeredAt?: Date } = {}) {
    return prisma.registration.create({ data: {
      eventId,
      participantId: options.participantId ?? participantId,
      status: options.status ?? RegistrationStatus.ACTIVE,
      cancelledAt: options.status === RegistrationStatus.CANCELLED ? options.cancelledAt ?? new Date("2099-11-25T03:00:00.000Z") : null,
      ...(options.registeredAt ? { registeredAt: options.registeredAt } : {}),
    } });
  }

  async function cancel(registrationId: string, cookie = participantCookie) {
    return request(app).post(`/api/v1/me/registrations/${registrationId}/cancel`).set(origin).set("Cookie", cookie).send({});
  }

  async function publicAvailability(eventId: string) {
    const response = await request(app).get(`/api/v1/events/${eventId}`);
    expect(response.status).toBe(200);
    return response.body.data.event as { remainingPlaces: number; registrationAvailable: boolean };
  }

  it("TEST-F06-01: enforces participant ownership, role, session, Origin, and request validation", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    const before = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });

    const anonymous = await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).send({});
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    const wrongRole = await cancel(registration.id, organizerCookie);
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.body.error.code).toBe("FORBIDDEN");
    const crossParticipant = await cancel(registration.id, otherParticipantCookie);
    expect(crossParticipant.status).toBe(404);
    expect(crossParticipant.body.error.code).toBe("REGISTRATION_NOT_FOUND");
    expect(crossParticipant.body.data).toBeUndefined();
    expect((await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set("Cookie", participantCookie).send({})).status).toBe(403);
    expect((await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set({ Origin: "https://invalid.example" }).set("Cookie", participantCookie).send({})).status).toBe(403);
    const invalidBody = await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).send({ participantId: otherParticipantId });
    expect(invalidBody.status).toBe(422);
    expect(invalidBody.body.error.code).toBe("INVALID_CANCELLATION_REQUEST");
    const invalidatedCookie = await login(participantLogin);
    const sessionId = invalidatedCookie.slice(`${SESSION_COOKIE}=`.length);
    await prisma.session.update({ where: { id: sessionId }, data: { invalidatedAt: new Date() } });
    const invalidSession = await cancel(registration.id, invalidatedCookie);
    expect(invalidSession.status).toBe(401);
    const malformed = await request(app).post(`/api/v1/me/registrations/${registration.id}/cancel`).set(origin).set("Cookie", participantCookie).set("Content-Type", "application/json").send("{");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("MALFORMED_JSON");
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: before.status, cancelledAt: before.cancelledAt });
  });

  it("TEST-F06-02: cancels after the registration deadline but before Event start using server time", async () => {
    const event = await createEvent({ capacity: 2 });
    const registration = await createRegistration(event.id, { registeredAt: new Date("2099-11-25T02:00:00.000Z") });
    const decisionTime = new Date(event.startAt.getTime() - 15 * 60_000);
    setNowProvider(() => decisionTime);
    const response = await cancel(registration.id);
    expect(response.status).toBe(200);
    expect(response.body.data.registration).toMatchObject({ id: registration.id, eventId: event.id, participantId, status: "CANCELLED", registeredAt: registration.registeredAt.toISOString(), cancelledAt: decisionTime.toISOString() });
    const stored = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(stored).toMatchObject({ status: RegistrationStatus.CANCELLED, registeredAt: registration.registeredAt, cancelledAt: decisionTime });
  });

  it("TEST-F06-03: allows one millisecond before start and rejects exact/after-start requests without mutation", async () => {
    const beforeEvent = await createEvent();
    const exactEvent = await createEvent();
    const afterEvent = await createEvent();
    const [beforeRegistration, exactRegistration, afterRegistration] = await Promise.all([
      createRegistration(beforeEvent.id), createRegistration(exactEvent.id), createRegistration(afterEvent.id),
    ]);
    setNowProvider(() => new Date(defaultStart.getTime() - 1));
    expect((await cancel(beforeRegistration.id)).status).toBe(200);
    for (const [event, registration, decisionTime] of [
      [exactEvent, exactRegistration, defaultStart],
      [afterEvent, afterRegistration, new Date(defaultStart.getTime() + 1)],
    ] as const) {
      setNowProvider(() => decisionTime);
      const response = await cancel(registration.id);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CANCELLATION_CLOSED");
      expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.ACTIVE, cancelledAt: null });
      expect((await publicAvailability(event.id)).remainingPlaces).toBe(event.capacity - 1);
    }
  });

  it("TEST-F06-04: returns the original cancelledAt on repeated cancellation even after start", async () => {
    const event = await createEvent();
    const originalCancelledAt = new Date("2099-11-26T08:00:00.000Z");
    const registration = await createRegistration(event.id, { status: RegistrationStatus.CANCELLED, cancelledAt: originalCancelledAt });
    setNowProvider(() => new Date(defaultStart.getTime() + 5 * 60_000));
    const first = await cancel(registration.id);
    const second = await cancel(registration.id);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.registration.cancelledAt).toBe(originalCancelledAt.toISOString());
    expect(second.body.data.registration.cancelledAt).toBe(originalCancelledAt.toISOString());
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED, cancelledAt: originalCancelledAt });
  });

  it("TEST-F06-05: refuses to cancel a registration with persisted Attendance", async () => {
    const event = await createEvent();
    const registration = await createRegistration(event.id);
    const checkedInAt = new Date(defaultStart.getTime() + 15 * 60_000);
    const attendance = await prisma.attendance.create({ data: { registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt } });
    setNowProvider(() => new Date(checkedInAt.getTime() + 1));
    const response = await cancel(registration.id);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("REGISTRATION_CHECKED_IN");
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.ACTIVE, cancelledAt: null });
    expect(await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })).toMatchObject({ registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt });
  });

  it("TEST-F06-06: releases exactly one place once and keeps public availability stable on retry", async () => {
    const event = await createEvent({ capacity: 2 });
    const first = await createRegistration(event.id);
    await createRegistration(event.id, { participantId: otherParticipantId });
    expect((await publicAvailability(event.id)).remainingPlaces).toBe(0);
    setNowProvider(() => new Date(defaultStart.getTime() - 10 * 60_000));
    expect((await cancel(first.id)).status).toBe(200);
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(1);
    expect((await publicAvailability(event.id)).remainingPlaces).toBe(1);
    expect((await cancel(first.id)).status).toBe(200);
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(1);
    expect((await publicAvailability(event.id)).remainingPlaces).toBe(1);
  });

  it("enforces the ACTIVE/CANCELLED and cancelledAt database invariant", async () => {
    const event = await createEvent();
    await expect(prisma.registration.create({ data: { eventId: event.id, participantId, status: RegistrationStatus.CANCELLED } })).rejects.toThrow();
    await expect(prisma.registration.create({ data: { eventId: event.id, participantId, status: RegistrationStatus.ACTIVE, cancelledAt: new Date() } })).rejects.toThrow();
    expect(await prisma.registration.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("TEST-F06-07: keeps cancelled history in Participant reads and the Organizer list across new database clients", async () => {
    const event = await createEvent();
    const registeredAt = new Date("2099-11-24T04:00:00.000Z");
    const cancelledAt = new Date("2099-11-25T03:00:00.000Z");
    const registration = await createRegistration(event.id, { status: RegistrationStatus.CANCELLED, registeredAt, cancelledAt });
    const list = await request(app).get("/api/v1/me/registrations").set("Cookie", participantCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.registrations).toContainEqual(expect.objectContaining({ id: registration.id, status: "CANCELLED", registeredAt: registeredAt.toISOString(), cancelledAt: cancelledAt.toISOString() }));
    const detail = await request(app).get(`/api/v1/me/registrations/${registration.id}`).set("Cookie", participantCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.registration).toMatchObject({ id: registration.id, status: "CANCELLED", registeredAt: registeredAt.toISOString(), cancelledAt: cancelledAt.toISOString() });
    const ownerList = await request(app).get(`/api/v1/organizer/events/${event.id}/registrations`).set("Cookie", organizerCookie);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data.registrations).toContainEqual(expect.objectContaining({ id: registration.id, status: "CANCELLED" }));
    const freshClient = new PrismaClient();
    try { expect(await freshClient.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED, registeredAt, cancelledAt }); }
    finally { await freshClient.$disconnect(); }
  });

  it("TEST-F06-08: re-registers with a new ACTIVE row and leaves cancelled history untouched", async () => {
    const event = await createEvent({ capacity: 2 });
    const cancelledAt = new Date("2099-11-25T03:00:00.000Z");
    const old = await createRegistration(event.id, { status: RegistrationStatus.CANCELLED, cancelledAt });
    await createRegistration(event.id, { participantId: otherParticipantId });
    setNowProvider(() => new Date(event.registrationDeadline!.getTime() - 1));
    const response = await request(app).post(`/api/v1/events/${event.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
    expect(response.status).toBe(201);
    const created = response.body.data.registration;
    expect(created).toMatchObject({ eventId: event.id, participantId, status: "ACTIVE" });
    expect(created.id).not.toBe(old.id);
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED, cancelledAt });
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(2);
  });

  it("TEST-F06-09: applies explicit deadline and default start boundaries to re-registration", async () => {
    const deadline = new Date(defaultStart.getTime() - 30 * 60_000);
    const beforeEvent = await createEvent({ capacity: 2, deadline });
    const exactEvent = await createEvent({ capacity: 2, deadline });
    const afterEvent = await createEvent({ capacity: 2, deadline });
    const defaultEvent = await createEvent({ capacity: 2, deadline: null });
    const fixtures = await Promise.all([beforeEvent, exactEvent, afterEvent, defaultEvent].map(async event => ({ event, old: await createRegistration(event.id, { status: RegistrationStatus.CANCELLED }) })));
    for (const [fixture, decisionTime, expected] of [
      [fixtures[0], new Date(deadline.getTime() - 1), 201],
      [fixtures[1], deadline, 409],
      [fixtures[2], new Date(deadline.getTime() + 1), 409],
      [fixtures[3], defaultStart, 409],
    ] as const) {
      setNowProvider(() => decisionTime);
      const response = await request(app).post(`/api/v1/events/${fixture.event.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
      expect(response.status).toBe(expected);
      if (expected === 409) expect(response.body.error.code).toBe("REGISTRATION_CLOSED");
      expect(await prisma.registration.findUniqueOrThrow({ where: { id: fixture.old.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED });
    }
  });

  it("TEST-F06-10: rejects re-registration for a full Event or an existing ACTIVE duplicate", async () => {
    const fullEvent = await createEvent({ capacity: 1 });
    const fullHistory = await createRegistration(fullEvent.id, { status: RegistrationStatus.CANCELLED });
    await createRegistration(fullEvent.id, { participantId: otherParticipantId });
    const duplicateEvent = await createEvent({ capacity: 3 });
    const duplicateHistory = await createRegistration(duplicateEvent.id, { status: RegistrationStatus.CANCELLED });
    const active = await createRegistration(duplicateEvent.id);
    setNowProvider(() => new Date(defaultStart.getTime() - 60 * 60_000));
    const full = await request(app).post(`/api/v1/events/${fullEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("EVENT_FULL");
    const duplicate = await request(app).post(`/api/v1/events/${duplicateEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("REGISTRATION_DUPLICATE");
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: fullHistory.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED });
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: duplicateHistory.id } })).toMatchObject({ status: RegistrationStatus.CANCELLED });
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ status: RegistrationStatus.ACTIVE, cancelledAt: null });
    expect(await prisma.registration.count({ where: { eventId: duplicateEvent.id, status: RegistrationStatus.ACTIVE } })).toBe(1);
  });

  it("TEST-F06-11: serializes simultaneous cancellation retries and releases one place", async () => {
    const event = await createEvent({ capacity: 1 });
    const registration = await createRegistration(event.id);
    setNowProvider(() => new Date(defaultStart.getTime() - 60 * 60_000));
    const responses = await Promise.all([cancel(registration.id), cancel(registration.id)]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(responses[0].body.data.registration.cancelledAt).toBe(responses[1].body.data.registration.cancelledAt);
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(0);
    const reRegistered = await request(app).post(`/api/v1/events/${event.id}/registrations`).set(origin).set("Cookie", participantCookie).send({});
    expect(reRegistered.status).toBe(201);
    expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(1);
  });

  it("TEST-F06-12: serializes cancellation versus re-registration without duplicate ACTIVE rows", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const event = await createEvent({ capacity: 1 });
      const old = await createRegistration(event.id);
      setNowProvider(() => new Date(defaultStart.getTime() - 60 * 60_000));
      const [cancelResponse, registerResponse] = await Promise.all([
        cancel(old.id),
        request(app).post(`/api/v1/events/${event.id}/registrations`).set(origin).set("Cookie", participantCookie).send({}),
      ]);
      expect([200]).toContain(cancelResponse.status);
      expect([201, 409]).toContain(registerResponse.status);
      const rows = await prisma.registration.findMany({ where: { eventId: event.id, participantId } });
      expect(rows.find(row => row.id === old.id)).toMatchObject({ status: RegistrationStatus.CANCELLED });
      expect(rows.filter(row => row.status === RegistrationStatus.ACTIVE)).toHaveLength(registerResponse.status === 201 ? 1 : 0);
      expect(rows.filter(row => row.status === RegistrationStatus.ACTIVE).length).toBeLessThanOrEqual(event.capacity);
    }
  });

  it("TEST-I15-02: observes PostgreSQL Event-lock contention for cancellation and capacity-limited re-registration", async () => {
    async function startBehindEventLock(eventId: string, startRequests: () => Array<Promise<any>>, minimumObservedWaiters: number) {
      const lockClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
      let holderPid = 0;
      let release!: () => void;
      let hasReleased = false;
      const released = new Promise<void>(resolve => { release = resolve; });
      let signalReady!: () => void;
      let rejectReady!: (error: unknown) => void;
      const ready = new Promise<void>((resolve, reject) => { signalReady = resolve; rejectReady = reject; });
      const holder = lockClient.$transaction(async transaction => {
        const rows = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        holderPid = Number(rows[0]?.pid ?? 0);
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
        if (holderPid <= 0 || lockedRows.length !== 1) throw new Error("F-06 Event lock holder failed to acquire its test Event row");
        signalReady();
        await released;
      }, { timeout: 15000 });
      const holderCompletion = holder.then(
        () => ({ status: "fulfilled" as const }),
        error => {
          rejectReady(error);
          return { status: "rejected" as const, reason: error };
        },
      );
      let pending: Promise<any>[] = [];
      const completed: boolean[] = [];
      let readinessTimer: ReturnType<typeof setTimeout> | undefined;
      let operationFailure: unknown;
      let operationFailed = false;
      let responses: any[] | undefined;
      const cleanupFailures: unknown[] = [];
      const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      try {
        await withTimeout(new Promise<void>((resolve, reject) => {
          readinessTimer = setTimeout(() => reject(new Error("F-06 Event lock holder did not become ready within 5 seconds")), 5000);
          void ready.then(resolve, reject);
        }), 5500, "F-06 lock-holder readiness wait timed out");
        if (readinessTimer) clearTimeout(readinessTimer);
        pending = startRequests().map((response, index) => { completed[index] = false; return Promise.resolve(response).then(result => { completed[index] = true; return result; }); });
        let blocked: Array<{ pid: number }> = [];
        const deadline = Date.now() + 3000;
        while (blocked.length < minimumObservedWaiters && Date.now() < deadline) {
          blocked = await prisma.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))`;
          if (blocked.length < minimumObservedWaiters) await new Promise(resolve => setTimeout(resolve, 15));
        }
        expect(blocked.length, "at least one PostgreSQL backend should be blocked by the test-owned Event lock").toBeGreaterThanOrEqual(minimumObservedWaiters);
        // This proves that at least the observed backend reached PostgreSQL and waited on the held lock.
        // The remaining HTTP promises are checked separately; their database transactions may not have started yet.
        expect(completed).toEqual(Array.from({ length: pending.length }, () => false));
        release();
        hasReleased = true;
        responses = await Promise.all(pending);
        const outcome = await holderCompletion;
        if (outcome.status === "rejected") throw outcome.reason;
      } catch (error) {
        operationFailed = true;
        operationFailure = error;
      } finally {
        if (readinessTimer) clearTimeout(readinessTimer);
        if (!hasReleased) release();
        if (pending.length > 0) {
          try {
            await withTimeout(Promise.allSettled(pending).then(() => undefined), 10000, "F-06 API requests did not settle during cleanup");
          } catch (error) {
            cleanupFailures.push(error);
          }
        }
        try {
          const outcome = await withTimeout(holderCompletion, 5000, "F-06 lock-holder transaction did not settle during cleanup");
          if (outcome.status === "rejected" && (!operationFailed || outcome.reason !== operationFailure)) cleanupFailures.push(outcome.reason);
        } catch (error) {
          cleanupFailures.push(error);
        }
        try {
          await lockClient.$disconnect();
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      if (operationFailed && cleanupFailures.length > 0) throw new AggregateError([operationFailure, ...cleanupFailures], "F-06 contention test failed and cleanup reported additional errors");
      if (operationFailed) throw operationFailure;
      if (cleanupFailures.length > 0) throw new AggregateError(cleanupFailures, "F-06 contention test cleanup failed");
      return responses!;
    }

    setNowProvider(() => new Date(defaultStart.getTime() - 60 * 60_000));
    const cancelRaceEvent = await createEvent({ capacity: 2 });
    const cancellingRegistration = await createRegistration(cancelRaceEvent.id);
    const otherActive = await createRegistration(cancelRaceEvent.id, { participantId: otherParticipantId });
    const cancelRace = await startBehindEventLock(cancelRaceEvent.id, () => [
      cancel(cancellingRegistration.id),
      request(app).post(`/api/v1/events/${cancelRaceEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({}),
    ], 1);
    expect(cancelRace[0].status).toBe(200);
    expect(cancelRace[1].status === 201 || cancelRace[1].status === 409).toBe(true);
    if (cancelRace[1].status === 409) expect(cancelRace[1].body.error.code).toBe("REGISTRATION_DUPLICATE");
    const cancelRaceRows = await prisma.registration.findMany({ where: { eventId: cancelRaceEvent.id } });
    expect(cancelRaceRows.find(row => row.id === cancellingRegistration.id)?.status).toBe(RegistrationStatus.CANCELLED);
    expect(cancelRaceRows.find(row => row.id === otherActive.id)?.status).toBe(RegistrationStatus.ACTIVE);
    expect(cancelRaceRows.filter(row => row.status === RegistrationStatus.ACTIVE).length).toBe(cancelRace[1].status === 201 ? 2 : 1);
    expect(cancelRaceRows.filter(row => row.status === RegistrationStatus.ACTIVE && row.participantId === participantId).length).toBeLessThanOrEqual(1);
    expect((await publicAvailability(cancelRaceEvent.id)).remainingPlaces).toBe(2 - cancelRaceRows.filter(row => row.status === RegistrationStatus.ACTIVE).length);

    const lastSeatEvent = await createEvent({ capacity: 1 });
    const [cancelledParticipantA, cancelledParticipantB] = await Promise.all([
      createRegistration(lastSeatEvent.id, { status: RegistrationStatus.CANCELLED }),
      createRegistration(lastSeatEvent.id, { participantId: otherParticipantId, status: RegistrationStatus.CANCELLED }),
    ]);
    const lastSeatRace = await startBehindEventLock(lastSeatEvent.id, () => [
      request(app).post(`/api/v1/events/${lastSeatEvent.id}/registrations`).set(origin).set("Cookie", participantCookie).send({}),
      request(app).post(`/api/v1/events/${lastSeatEvent.id}/registrations`).set(origin).set("Cookie", otherParticipantCookie).send({}),
    ], 1);
    expect(lastSeatRace.map(response => response.status).sort()).toEqual([201, 409]);
    expect(lastSeatRace.find(response => response.status === 409)?.body.error.code).toBe("EVENT_FULL");
    const lastSeatRows = await prisma.registration.findMany({ where: { eventId: lastSeatEvent.id } });
    expect(lastSeatRows.find(row => row.id === cancelledParticipantA.id)?.status).toBe(RegistrationStatus.CANCELLED);
    expect(lastSeatRows.find(row => row.id === cancelledParticipantB.id)?.status).toBe(RegistrationStatus.CANCELLED);
    expect(lastSeatRows.filter(row => row.status === RegistrationStatus.ACTIVE)).toHaveLength(1);
    expect(await prisma.registration.count({ where: { eventId: lastSeatEvent.id, status: RegistrationStatus.ACTIVE } })).toBeLessThanOrEqual(lastSeatEvent.capacity);
    expect((await publicAvailability(lastSeatEvent.id)).remainingPlaces).toBe(0);
  });

  it("TEST-F06-13: shares Event-then-Registration locking with a check-in storage writer", async () => {
    const event = await createEvent({ startAt: defaultStart });
    const registration = await createRegistration(event.id);
    const checkedInAt = defaultStart;
    setNowProvider(() => checkedInAt);
    const checkIn = prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE`;
      await transaction.$queryRaw`SELECT "id" FROM "Registration" WHERE "id" = ${registration.id} FOR UPDATE`;
      return transaction.attendance.create({ data: { registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt } });
    });
    const cancellation = cancel(registration.id);
    const [attendance, response] = await Promise.all([checkIn, cancellation]);
    expect(response.status).toBe(409);
    expect(["CANCELLATION_CLOSED", "REGISTRATION_CHECKED_IN"]).toContain(response.body.error.code);
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.ACTIVE, cancelledAt: null });
    expect(await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })).toMatchObject({ registrationId: registration.id, eventId: event.id, participantId, recordedByOrganizerId: organizerId, checkedInAt });
  });

  it("TEST-F06-14: rolls back a write failure without changing status, timestamp, or active count", async () => {
    const event = await createEvent({ capacity: 1 });
    const registration = await createRegistration(event.id);
    const failName = failureFunction;
    const triggerName = failureTrigger;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${failName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."status" = 'CANCELLED' THEN RAISE EXCEPTION 'F06 controlled transaction failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON "Registration" FOR EACH ROW EXECUTE FUNCTION ${failName}()`);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      setNowProvider(() => new Date(defaultStart.getTime() - 60 * 60_000));
      const response = await cancel(registration.id);
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: RegistrationStatus.ACTIVE, cancelledAt: null });
      expect(await prisma.registration.count({ where: { eventId: event.id, status: RegistrationStatus.ACTIVE } })).toBe(1);
      expect((await publicAvailability(event.id)).remainingPlaces).toBe(0);
    } finally {
      errorLog.mockRestore();
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "Registration"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failName}()`);
    }
  });
});
