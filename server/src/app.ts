import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma, requireAuth, csrfGuard, newSessionId, setSessionCookie, clearSessionCookie, safeUser, ABSOLUTE_MS, requireRole, type AuthenticatedRequest } from "./auth.js";
import { verifyPassword } from "./security.js";
import { PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { eventView, publicEventView, validateCreateEventInput } from "./events.js";
import { decideCancellation } from "./registration-lifecycle.js";

export const app = express();
let nowProvider = () => new Date();
export function setNowProvider(provider: () => Date) { nowProvider = provider; }

const offsetDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
function validOffsetDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !offsetDateTimePattern.test(value) || Number.isNaN(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCFullYear() === year && new Date(Date.UTC(year, month - 1, day)).getUTCMonth() === month - 1 && new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

app.use(express.json());
app.use(csrfGuard);

app.post("/api/v1/auth/login", async (request, response, next) => {
  try {
    const { loginIdentifier, password } = request.body ?? {};
    const user = typeof loginIdentifier === "string" ? await prisma.user.findUnique({ where: { loginIdentifier } }) : null;
    if (!user || typeof password !== "string" || !(await verifyPassword(password, user.passwordHash))) return response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
    const previousId = request.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith("eventcheck_session="))?.split("=")[1];
    if (previousId) await prisma.session.updateMany({ where: { id: previousId, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    const id = newSessionId();
    await prisma.session.create({ data: { id, userId: user.id, absoluteExpiry: new Date(Date.now() + ABSOLUTE_MS) } });
    setSessionCookie(response, id);
    response.json({ data: { user: safeUser(user) } });
  } catch (error) { next(error); }
});
app.get("/api/v1/me", requireAuth, (request, response) => response.json({ data: { user: safeUser((request as any).user) } }));
app.post("/api/v1/auth/logout", requireAuth, async (request, response, next) => {
  try { await prisma.session.update({ where: { id: (request as any).sessionId }, data: { invalidatedAt: new Date() } }); clearSessionCookie(response); response.status(204).send(); } catch (error) { next(error); }
});

app.post("/api/v1/events", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const authRequest = request as AuthenticatedRequest;
  const validation = validateCreateEventInput(request.body);
  if (!validation.ok) return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Event details are invalid", details: validation.issues } });

  try {
    const event = await prisma.$transaction((transaction) => transaction.event.create({
      data: {
        organizerId: authRequest.user!.id,
        ...validation.value,
        publicationState: PublicationState.PUBLISHED,
      },
    }));
    return response.status(201).json({ data: { event: eventView(event) } });
  } catch (error) {
    return next(error);
  }
});

export async function createRegistration(eventId: string, participantId: string, afterInsert?: (registrationId: string) => void) {
  return prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
    if (locked.length === 0) throw Object.assign(new Error("EVENT_NOT_FOUND"), { code: "EVENT_NOT_FOUND" });
    const event = await transaction.event.findUnique({ where: { id: eventId } });
    if (!event || event.publicationState !== PublicationState.PUBLISHED) throw Object.assign(new Error("EVENT_NOT_FOUND"), { code: "EVENT_NOT_FOUND" });
    const effectiveDeadline = event.registrationDeadline ?? event.startAt;
    if (nowProvider() >= effectiveDeadline) throw Object.assign(new Error("REGISTRATION_CLOSED"), { code: "REGISTRATION_CLOSED" });
    const duplicate = await transaction.registration.findFirst({ where: { eventId, participantId, status: RegistrationStatus.ACTIVE } });
    if (duplicate) throw Object.assign(new Error("REGISTRATION_DUPLICATE"), { code: "REGISTRATION_DUPLICATE" });
    const activeCount = await transaction.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } });
    if (activeCount >= event.capacity) throw Object.assign(new Error("EVENT_FULL"), { code: "EVENT_FULL" });
    const registration = await transaction.registration.create({ data: { eventId, participantId, status: RegistrationStatus.ACTIVE } });
    afterInsert?.(registration.id);
    return registration;
  });
}

app.post("/api/v1/events/:eventId/registrations", requireAuth, requireRole(Role.PARTICIPANT), async (request, response, next) => {
  const authRequest = request as AuthenticatedRequest;
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  const body = request.body ?? {};
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0) {
    return response.status(422).json({ error: { code: "INVALID_REGISTRATION_REQUEST", message: "Registration request must not contain client-controlled fields" } });
  }

  try {
    const registration = await createRegistration(eventId, authRequest.user!.id);
    return response.status(201).json({ data: { registration: { id: registration.id, eventId: registration.eventId, participantId: registration.participantId, status: registration.status, registeredAt: registration.registeredAt.toISOString() } } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EVENT_NOT_FOUND") return response.status(404).json({ error: { code, message: "Event not found" } });
    if (code === "REGISTRATION_DUPLICATE") return response.status(409).json({ error: { code, message: "Participant is already registered for this event" } });
    if (code === "EVENT_FULL") return response.status(409).json({ error: { code, message: "Event is full" } });
    if (code === "REGISTRATION_CLOSED") return response.status(409).json({ error: { code, message: "Registration is closed" } });
    if ((error as { code?: string }).code === "P2002") return response.status(409).json({ error: { code: "REGISTRATION_DUPLICATE", message: "Participant is already registered for this event" } });
    return next(error);
  }
});

export async function cancelRegistration(registrationId: string, participantId: string) {
  return prisma.$transaction(async (transaction) => {
    const owned = await transaction.registration.findFirst({ where: { id: registrationId, participantId }, select: { eventId: true } });
    if (!owned) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });

    const eventLock = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Event" WHERE "id" = ${owned.eventId} FOR UPDATE`;
    if (eventLock.length === 0) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });
    const registrationLock = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Registration" WHERE "id" = ${registrationId} AND "participantId" = ${participantId} FOR UPDATE`;
    if (registrationLock.length === 0) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });

    const registration = await transaction.registration.findFirst({
      where: { id: registrationId, participantId },
      select: { id: true, eventId: true, participantId: true, status: true, registeredAt: true, cancelledAt: true, event: { select: { startAt: true } }, attendance: { select: { id: true } } },
    });
    if (!registration) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });

    const decisionTime = nowProvider();
    const decision = decideCancellation(registration.status, registration.attendance !== null, registration.event.startAt, decisionTime);
    if (decision === "ALREADY_CANCELLED") return registration;
    if (decision !== "CANCEL") throw Object.assign(new Error(decision), { code: decision });

    const cancelledAt = decisionTime;
    await transaction.registration.update({ where: { id: registration.id }, data: { status: RegistrationStatus.CANCELLED, cancelledAt } });
    return { ...registration, status: RegistrationStatus.CANCELLED, cancelledAt };
  });
}

app.post("/api/v1/me/registrations/:registrationId/cancel", requireAuth, requireRole(Role.PARTICIPANT), async (request, response, next) => {
  const registrationId = Array.isArray(request.params.registrationId) ? request.params.registrationId[0] : request.params.registrationId;
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
    const fields = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).map(field => ({ field, message: `${field} is not accepted` })) : [{ field: "body", message: "Request must be an empty JSON object" }];
    return response.status(422).json({ error: { code: "INVALID_CANCELLATION_REQUEST", message: "Cancellation request must not contain client-controlled fields", details: fields } });
  }

  try {
    const registration = await cancelRegistration(registrationId, (request as AuthenticatedRequest).user!.id);
    return response.status(200).json({ data: { registration: {
      id: registration.id,
      eventId: registration.eventId,
      participantId: registration.participantId,
      status: registration.status,
      registeredAt: registration.registeredAt.toISOString(),
      cancelledAt: registration.cancelledAt?.toISOString() ?? null,
    } } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "REGISTRATION_NOT_FOUND") return response.status(404).json({ error: { code, message: "Registration not found" } });
    if (code === "REGISTRATION_CHECKED_IN") return response.status(409).json({ error: { code, message: "A checked-in registration cannot be cancelled" } });
    if (code === "CANCELLATION_CLOSED") return response.status(409).json({ error: { code, message: "Cancellation is closed because the event has started" } });
    return next(error);
  }
});

function attendanceView(attendance: { id: string; registrationId: string; eventId: string; participantId: string; recordedByOrganizerId: string; checkedInAt: Date }) {
  return { ...attendance, checkedInAt: attendance.checkedInAt.toISOString() };
}

app.post("/api/v1/organizer/registrations/:registrationId/attendance", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const organizerId = (request as AuthenticatedRequest).user!.id;
  const registrationId = Array.isArray(request.params.registrationId) ? request.params.registrationId[0] : request.params.registrationId;
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "eventId") || typeof body.eventId !== "string") {
    return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "eventId is required", details: [{ field: "eventId", message: "eventId is required" }] } });
  }
  try {
    const attendance = await prisma.$transaction(async transaction => {
      const owned = await transaction.registration.findUnique({ where: { id: registrationId }, select: { id: true, eventId: true, participantId: true } });
      if (!owned || owned.eventId !== body.eventId) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });
      const lockedEvent = await transaction.$queryRaw<Array<{ id: string; organizerId: string; startAt: Date; endAt: Date }>>`SELECT "id", "organizerId", "startAt", "endAt" FROM "Event" WHERE "id" = ${owned.eventId} FOR UPDATE`;
      if (!lockedEvent[0] || lockedEvent[0].organizerId !== organizerId) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });
      const lockedRegistration = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Registration" WHERE "id" = ${registrationId} FOR UPDATE`;
      if (!lockedRegistration[0]) throw Object.assign(new Error("REGISTRATION_NOT_FOUND"), { code: "REGISTRATION_NOT_FOUND" });
      const registration = await transaction.registration.findUnique({ where: { id: registrationId }, select: { status: true, participantId: true } });
      if (!registration || registration.status !== RegistrationStatus.ACTIVE) throw Object.assign(new Error("REGISTRATION_NOT_ACTIVE"), { code: "REGISTRATION_NOT_ACTIVE" });
      const existing = await transaction.attendance.findUnique({ where: { registrationId } });
      if (existing) throw Object.assign(new Error("ATTENDANCE_ALREADY_EXISTS"), { code: "ATTENDANCE_ALREADY_EXISTS", existing });
      const now = nowProvider();
      if (now < lockedEvent[0].startAt || now >= lockedEvent[0].endAt) throw Object.assign(new Error("CHECK_IN_WINDOW_CLOSED"), { code: "CHECK_IN_WINDOW_CLOSED" });
      return transaction.attendance.create({ data: { registrationId, eventId: owned.eventId, participantId: registration.participantId, recordedByOrganizerId: organizerId, checkedInAt: now } });
    });
    return response.status(201).json({ data: { attendance: attendanceView(attendance) } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "REGISTRATION_NOT_FOUND") return response.status(404).json({ error: { code, message: "Registration not found" } });
    if (code === "REGISTRATION_NOT_ACTIVE") return response.status(409).json({ error: { code, message: "Registration is not active" } });
    if (code === "CHECK_IN_WINDOW_CLOSED") return response.status(409).json({ error: { code, message: "Check-in window is closed" } });
    if (code === "ATTENDANCE_ALREADY_EXISTS" || code === "P2002") return response.status(409).json({ error: { code: "ATTENDANCE_ALREADY_EXISTS", message: "Registration is already checked in" } });
    return next(error);
  }
});

app.get("/api/v1/organizer/events/:eventId/attendance", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const organizerId = (request as AuthenticatedRequest).user!.id;
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  try {
    const event = await prisma.event.findFirst({ where: { id: eventId, organizerId }, select: { id: true } });
    if (!event) return response.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    const rows = await prisma.attendance.findMany({ where: { eventId }, orderBy: [{ checkedInAt: "asc" }, { id: "asc" }] });
    return response.json({ data: { attendances: rows.map(attendanceView) } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/me/registrations/:registrationId/attendance", requireAuth, requireRole(Role.PARTICIPANT), async (request, response, next) => {
  const participantId = (request as AuthenticatedRequest).user!.id;
  const registrationId = Array.isArray(request.params.registrationId) ? request.params.registrationId[0] : request.params.registrationId;
  try {
    const registration = await prisma.registration.findFirst({ where: { id: registrationId, participantId }, select: { id: true } });
    if (!registration) return response.status(404).json({ error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" } });
    const attendance = await prisma.attendance.findUnique({ where: { registrationId } });
    return response.json({ data: { attendance: attendance ? attendanceView(attendance) : null } });
  } catch (error) { return next(error); }
});

function registrationView(registration: { id: string; eventId: string; status: RegistrationStatus; registeredAt: Date; cancelledAt: Date | null; event: { id: string; title: string; description: string; location: string; startAt: Date; endAt: Date } }) {
  return {
    id: registration.id,
    eventId: registration.eventId,
    status: registration.status,
    registeredAt: registration.registeredAt.toISOString(),
    cancelledAt: registration.cancelledAt?.toISOString() ?? null,
    event: {
      id: registration.event.id,
      title: registration.event.title,
      description: registration.event.description,
      location: registration.event.location,
      startAt: registration.event.startAt.toISOString(),
      endAt: registration.event.endAt.toISOString(),
    },
  };
}

app.get("/api/v1/me/registrations", requireAuth, requireRole(Role.PARTICIPANT), async (request, response, next) => {
  try {
    const participantId = (request as AuthenticatedRequest).user!.id;
    const registrations = await prisma.registration.findMany({
      where: { participantId },
      include: { event: { select: { id: true, title: true, description: true, location: true, startAt: true, endAt: true } } },
      orderBy: [{ registeredAt: "desc" }, { id: "asc" }],
    });
    return response.json({ data: { registrations: registrations.map(registrationView) } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/me/registrations/:registrationId", requireAuth, requireRole(Role.PARTICIPANT), async (request, response, next) => {
  const registrationId = Array.isArray(request.params.registrationId) ? request.params.registrationId[0] : request.params.registrationId;
  try {
    const participantId = (request as AuthenticatedRequest).user!.id;
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, participantId },
      include: { event: { select: { id: true, title: true, description: true, location: true, startAt: true, endAt: true } } },
    });
    if (!registration) return response.status(404).json({ error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" } });
    return response.json({ data: { registration: registrationView(registration) } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/events", async (_request, response, next) => {
  try {
    const events = await prisma.event.findMany({ where: { publicationState: PublicationState.PUBLISHED }, orderBy: [{ startAt: "asc" }, { id: "asc" }] });
    const activeCounts = events.length === 0 ? [] : await prisma.registration.groupBy({ by: ["eventId"], where: { eventId: { in: events.map(event => event.id) }, status: RegistrationStatus.ACTIVE }, _count: { _all: true } });
    const counts = new Map(activeCounts.map(item => [item.eventId, item._count._all]));
    return response.json({ data: { events: events.map(event => publicEventView(event, counts.get(event.id) ?? 0)) } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/events/:eventId", async (request, response, next) => {
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  try {
    const event = await prisma.event.findFirst({ where: { id: eventId, publicationState: PublicationState.PUBLISHED } });
    if (!event) return response.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    const activeRegistrations = await prisma.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } });
    return response.json({ data: { event: publicEventView(event, activeRegistrations) } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/organizer/events", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const userId = (request as AuthenticatedRequest).user!.id;
  try {
    const events = await prisma.event.findMany({
      where: { organizerId: userId, publicationState: PublicationState.PUBLISHED },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
    });
    return response.json({ data: { events: events.map(eventView) } });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/v1/organizer/events/:eventId", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const userId = (request as AuthenticatedRequest).user!.id;
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId: userId, publicationState: PublicationState.PUBLISHED },
    });
    if (!event) return response.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    return response.json({ data: { event: eventView(event) } });
  } catch (error) {
    return next(error);
  }
});

const eventIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

app.get("/api/v1/organizer/events/:eventId/registrations", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const organizerId = (request as AuthenticatedRequest).user!.id;
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  if (!eventIdPattern.test(eventId)) return response.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
      select: { id: true },
    });
    if (!event) return response.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        participantId: true,
        status: true,
        registeredAt: true,
        participant: { select: { displayName: true } },
      },
    });
    return response.json({
      data: {
        registrations: registrations.map(registration => ({
          id: registration.id,
          participantId: registration.participantId,
          participantDisplayName: registration.participant.displayName,
          status: registration.status,
          registeredAt: registration.registeredAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/v1/organizer/events/:eventId", requireAuth, requireRole(Role.ORGANIZER), async (request, response, next) => {
  const organizerId = (request as AuthenticatedRequest).user!.id;
  const eventId = Array.isArray(request.params.eventId) ? request.params.eventId[0] : request.params.eventId;
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Request must be an object", details: [{ field: "body", message: "Request must be a JSON object" }] } });
  const keys = Object.keys(body);
  const recognized = keys.filter(key => key === "capacity" || key === "registrationDeadline");
  if (recognized.length === 0 || keys.some(key => !["capacity", "registrationDeadline"].includes(key))) {
    const details = keys.length === 0 ? [{ field: "body", message: "At least one update field is required" }] : keys.filter(key => !["capacity", "registrationDeadline"].includes(key)).map(field => ({ field, message: `${field} is not accepted` }));
    return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "At least one recognized update field is required", details } });
  }
  const capacity = (body as any).capacity;
  if (keys.includes("capacity") && (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0)) {
    return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "capacity must be a positive integer", details: [{ field: "capacity", message: "capacity must be a positive integer" }] } });
  }
  let deadline: Date | null | undefined;
  if (keys.includes("registrationDeadline")) {
    if ((body as any).registrationDeadline === null) deadline = null;
    else if (!validOffsetDateTime((body as any).registrationDeadline)) return response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "registrationDeadline must be an offset-aware ISO date-time or null", details: [{ field: "registrationDeadline", message: "registrationDeadline must include Z or an explicit timezone offset" }] } });
    else deadline = new Date((body as any).registrationDeadline);
  }
  try {
    const updated = await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await transaction.event.findFirst({ where: { id: eventId, organizerId, publicationState: PublicationState.PUBLISHED } });
      if (!event) throw Object.assign(new Error("EVENT_NOT_FOUND"), { code: "EVENT_NOT_FOUND" });
      if (nowProvider() >= event.startAt) throw Object.assign(new Error("EVENT_MODIFICATION_CLOSED"), { code: "EVENT_MODIFICATION_CLOSED" });
      const nextDeadline = keys.includes("registrationDeadline") ? deadline! : event.registrationDeadline;
      if (nextDeadline && nextDeadline > event.startAt) throw Object.assign(new Error("VALIDATION_ERROR"), { code: "VALIDATION_ERROR" });
      if (keys.includes("capacity")) {
        const active = await transaction.registration.count({ where: { eventId, status: RegistrationStatus.ACTIVE } });
        if (capacity < active) throw Object.assign(new Error("CAPACITY_BELOW_ACTIVE_COUNT"), { code: "CAPACITY_BELOW_ACTIVE_COUNT" });
      }
      return transaction.event.update({ where: { id: eventId }, data: { ...(keys.includes("capacity") ? { capacity } : {}), ...(keys.includes("registrationDeadline") ? { registrationDeadline: nextDeadline } : {}) } });
    });
    return response.json({ data: { event: eventView(updated) } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EVENT_NOT_FOUND") return response.status(404).json({ error: { code, message: "Event not found" } });
    if (code === "EVENT_MODIFICATION_CLOSED") return response.status(409).json({ error: { code, message: "Event modifications are closed" } });
    if (code === "CAPACITY_BELOW_ACTIVE_COUNT") return response.status(409).json({ error: { code, message: "Capacity cannot be below active registrations" } });
    if (code === "VALIDATION_ERROR") return response.status(422).json({ error: { code, message: "registrationDeadline must not be after event start", details: [{ field: "registrationDeadline", message: "registrationDeadline must not be after event start" }] } });
    return next(error);
  }
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/ready", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return response.status(200).json({ status: "ready" });
  } catch {
    return response.status(503).json({ status: "unavailable" });
  }
});

if (process.env.SERVE_CLIENT === "true") {
  const clientDistPath = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  app.use(express.static(clientDistPath));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path === "/api" || request.path.startsWith("/api/")) return next();
    response.sendFile(resolve(clientDistPath, "index.html"), error => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const parseError = error as { type?: string; status?: number };
  if (parseError.type === "entity.parse.failed" || parseError.status === 400) {
    return response.status(400).json({ error: { code: "MALFORMED_JSON", message: "Request body must be valid JSON" } });
  }
  console.error(error);
  return response.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" } });
});
