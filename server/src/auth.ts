import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { safeUser } from "./security.js";

export const prisma = new PrismaClient();
export const SESSION_COOKIE = "eventcheck_session";
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type AuthenticatedRequest = Request & { user?: { id: string; displayName: string; role: Role }; sessionId?: string };
export function setSessionCookie(response: Response, id: string) {
  const secure = process.env.NODE_ENV === "production";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
}
export function clearSessionCookie(response: Response) { const secure = process.env.NODE_ENV === "production"; response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`); }
export function cookieId(request: Request) { return request.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.split("=")[1]; }
export function csrfGuard(request: Request, response: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  const origin = request.headers.origin;
  const expected = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  if (origin !== expected) return response.status(403).json({ error: { code: "CSRF_REJECTED", message: "Request denied" } });
  next();
}
export async function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const id = cookieId(request);
  if (!id) return response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  const now = new Date();
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.invalidatedAt || session.absoluteExpiry <= now || session.lastActivityAt.getTime() + IDLE_MS <= now.getTime()) {
    if (session) await prisma.session.update({ where: { id }, data: { invalidatedAt: now } });
    clearSessionCookie(response);
    return response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }
  const refreshed = await prisma.session.updateMany({ where: { id, invalidatedAt: null, absoluteExpiry: { gt: now }, lastActivityAt: { gt: new Date(now.getTime() - IDLE_MS) } }, data: { lastActivityAt: now } });
  if (refreshed.count !== 1) return response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  request.user = session.user; request.sessionId = id; next();
}
export function requireRole(role: Role) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => request.user?.role === role ? next() : response.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied" } });
}
export function newSessionId() { return randomBytes(32).toString("hex"); }
export { IDLE_MS, ABSOLUTE_MS, safeUser };
