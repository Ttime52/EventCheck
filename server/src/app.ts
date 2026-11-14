import express from "express";
import { prisma, requireAuth, csrfGuard, newSessionId, setSessionCookie, clearSessionCookie, safeUser, ABSOLUTE_MS, requireRole, type AuthenticatedRequest } from "./auth.js";
import { verifyPassword } from "./security.js";
import { PublicationState, Role } from "@prisma/client";
import { eventView, validateCreateEventInput } from "./events.js";

export const app = express();

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

app.patch("/api/v1/organizer/events/:eventId", requireAuth, requireRole(Role.ORGANIZER), (_request, response) => {
  return response.status(404).json({ error: { code: "UNSUPPORTED_OPERATION", message: "Event updates are not available in Sprint 1" } });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const parseError = error as { type?: string; status?: number };
  if (parseError.type === "entity.parse.failed" || parseError.status === 400) {
    return response.status(400).json({ error: { code: "MALFORMED_JSON", message: "Request body must be valid JSON" } });
  }
  console.error(error);
  return response.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" } });
});
