import express from "express";
import { prisma, requireAuth, csrfGuard, newSessionId, setSessionCookie, clearSessionCookie, safeUser, ABSOLUTE_MS } from "./auth.js";
import { verifyPassword } from "./security.js";
import { Role } from "@prisma/client";

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
app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" } });
});
