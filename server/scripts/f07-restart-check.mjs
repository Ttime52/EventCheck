import { randomUUID, randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { PrismaClient, Role, RegistrationStatus, PublicationState } from "@prisma/client";

const value = process.env.DATABASE_URL;
const url = new URL(value ?? "");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") throw new Error("Refusing F-07 restart verification outside eventcheck_test/public");
const prisma = new PrismaClient({ datasources: { db: { url: value } } });
const port = Number(process.env.F07_RESTART_PORT ?? process.env.SERVER_PORT ?? 3199);
async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const probe = createConnection({ host: "127.0.0.1", port });
    probe.once("connect", () => { probe.destroy(); reject(new Error(`F07 restart port ${port} is already in use`)); });
    probe.once("error", error => { probe.destroy(); if (error.code === "ECONNREFUSED") resolve(); else reject(error); });
  });
}
const scrypt = promisify(nodeScrypt);
async function hashPassword(password) { const salt = randomBytes(16); const derived = await scrypt(password, salt, 64); return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`; }
const run = randomUUID();
let eventId; let organizerId; let participantId; let child; const organizerSessionId = randomUUID(); const participantSessionId = randomUUID(); const passwordHash = await hashPassword("f07-restart-password");
const waitForExit = (process, timeoutMs) => new Promise((resolve, reject) => {
  if (process.exitCode !== null || process.signalCode !== null) { resolve(); return; }
  const timer = setTimeout(() => reject(new Error("F07 API shutdown timeout")), timeoutMs);
  process.once("close", () => { clearTimeout(timer); resolve(); });
  process.once("error", error => { clearTimeout(timer); reject(error); });
});
let stopApi = async () => {};
try {
  const [organizer, participant] = await Promise.all([
    prisma.user.create({ data: { loginIdentifier: `f07-restart-o-${run}@example.test`, displayName: "F07 Restart Organizer", role: Role.ORGANIZER, passwordHash } }),
    prisma.user.create({ data: { loginIdentifier: `f07-restart-p-${run}@example.test`, displayName: "F07 Restart Participant", role: Role.PARTICIPANT, passwordHash } }),
  ]);
  organizerId = organizer.id; participantId = participant.id;
  const expiry = new Date(Date.now() + 3_600_000);
  await prisma.session.createMany({ data: [{ id: organizerSessionId, userId: organizerId, absoluteExpiry: expiry }, { id: participantSessionId, userId: participantId, absoluteExpiry: expiry }] });
  const startAt = new Date(Date.now() - 60_000);
  const event = await prisma.event.create({ data: { organizerId, title: `F07 restart ${run}`, description: "restart fixture", location: "Test", startAt, endAt: new Date(Date.now() + 3_600_000), capacity: 1, publicationState: PublicationState.PUBLISHED } });
  eventId = event.id;
  const registration = await prisma.registration.create({ data: { eventId, participantId, status: RegistrationStatus.ACTIVE } });
  const checkedInAt = new Date();
  const persistedAttendance = await prisma.attendance.create({ data: { registrationId: registration.id, eventId, participantId, recordedByOrganizerId: organizerId, checkedInAt } });
  const baseUrl = `http://127.0.0.1:${port}`;
  const childEnv = { ...process.env, DATABASE_URL: value, SERVER_PORT: String(port), CLIENT_ORIGIN: baseUrl, NODE_ENV: "test" };
  const startApi = async () => {
    await assertPortAvailable();
    child = spawn(process.execPath, ["server/dist/index.js"], { env: childEnv, stdio: "ignore" });
    let startupError;
    child.once("error", error => { startupError = error; });
    let exited = false;
    child.once("close", () => { exited = true; });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      if (exited || child.exitCode !== null || child.signalCode !== null) throw new Error(`F07 API exited before readiness`);
      try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("F07 API startup timeout");
  };
  stopApi = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    try { await waitForExit(child, 10000); } catch {
      child.kill("SIGKILL");
      await waitForExit(child, 5000);
    }
  };
  await startApi();
  const organizerCookie = `eventcheck_session=${organizerSessionId}`;
  const participantCookie = `eventcheck_session=${participantSessionId}`;
  const organizerBeforeResponse = await fetch(`${baseUrl}/api/v1/organizer/events/${eventId}/attendance`, { headers: { Cookie: organizerCookie } });
  const participantBeforeResponse = await fetch(`${baseUrl}/api/v1/me/registrations/${registration.id}/attendance`, { headers: { Cookie: participantCookie } });
  const organizerBefore = await organizerBeforeResponse.json();
  const participantBefore = await participantBeforeResponse.json();
  const expected = persistedAttendance;
  const beforeAttendance = organizerBefore?.data?.attendances?.find(item => item.id === expected.id);
  if (!organizerBeforeResponse.ok || !participantBeforeResponse.ok || JSON.stringify(beforeAttendance) !== JSON.stringify(participantBefore?.data?.attendance)) throw new Error("F07 pre-restart API retrieval mismatch");
  await stopApi();
  child = null;
  await startApi();
  const organizerAfterResponse = await fetch(`${baseUrl}/api/v1/organizer/events/${eventId}/attendance`, { headers: { Cookie: organizerCookie } });
  const participantAfterResponse = await fetch(`${baseUrl}/api/v1/me/registrations/${registration.id}/attendance`, { headers: { Cookie: participantCookie } });
  const organizerAfter = await organizerAfterResponse.json();
  const participantAfter = await participantAfterResponse.json();
  const row = await prisma.attendance.findUnique({ where: { registrationId: registration.id } });
  if (!row) throw new Error("Attendance was not persisted across restart");
  const organizerAfterAttendance = organizerAfter?.data?.attendances?.find(item => item.id === expected.id);
  const participantAfterAttendance = participantAfter?.data?.attendance;
  const sameAttendance = item => item?.id === expected.id && item.registrationId === registration.id && item.eventId === eventId && item.participantId === participantId && item.recordedByOrganizerId === organizerId && item.checkedInAt === checkedInAt.toISOString();
  if (!organizerAfterResponse.ok || !participantAfterResponse.ok || !sameAttendance(beforeAttendance) || !sameAttendance(organizerAfterAttendance) || !sameAttendance(participantBefore?.data?.attendance) || !sameAttendance(participantAfterAttendance) || await prisma.attendance.count({ where: { registrationId: registration.id } }) !== 1) throw new Error("F07 API did not preserve exact Attendance across restart");
  console.log("TEST-F07-08 restart verification passed");
} finally {
  let cleanupError;
  try {
    if (child && child.exitCode === null && child.signalCode === null) await stopApi();
    if (eventId) { await prisma.attendance.deleteMany({ where: { eventId } }); await prisma.registration.deleteMany({ where: { eventId } }); await prisma.event.delete({ where: { id: eventId } }); }
    await prisma.session.deleteMany({ where: { id: { in: [organizerSessionId, participantSessionId] } } });
    if (organizerId || participantId) await prisma.user.deleteMany({ where: { id: { in: [organizerId, participantId].filter(Boolean) } } });
  } catch (error) {
    cleanupError = error;
  } finally {
    await prisma.$disconnect();
  }
  if (cleanupError) throw cleanupError;
}
