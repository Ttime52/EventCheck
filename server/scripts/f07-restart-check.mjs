import { randomUUID, randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { PrismaClient, Role, RegistrationStatus, PublicationState } from "@prisma/client";

const value = process.env.DATABASE_URL;
const url = new URL(value ?? "");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") throw new Error("Refusing F-07 restart verification outside eventcheck_test/public");
const prisma = new PrismaClient({ datasources: { db: { url: value } } });
const scrypt = promisify(nodeScrypt);
async function hashPassword(password) { const salt = randomBytes(16); const derived = await scrypt(password, salt, 64); return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`; }
const run = randomUUID();
let eventId; let organizerId; let participantId; let child; const organizerSessionId = randomUUID(); const participantSessionId = randomUUID(); const passwordHash = await hashPassword("f07-restart-password");
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
  await prisma.attendance.create({ data: { registrationId: registration.id, eventId, participantId, recordedByOrganizerId: organizerId, checkedInAt: new Date() } });
  child = spawn(process.execPath, ["server/dist/index.js"], { env: { ...process.env, DATABASE_URL: value, SERVER_PORT: "3199", CLIENT_ORIGIN: "http://127.0.0.1:3199", NODE_ENV: "test" }, stdio: "ignore" });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("F07 API startup timeout")), 15000); child.once("error", reject); child.once("exit", code => reject(new Error(`F07 API exited: ${code}`))); const poll = async () => { try { if ((await fetch("http://127.0.0.1:3199/health")).ok) { clearTimeout(timer); resolve(); return; } } catch {} setTimeout(poll, 100); }; void poll(); });
  child.kill("SIGTERM"); await new Promise(resolve => child.once("exit", resolve));
  child = spawn(process.execPath, ["server/dist/index.js"], { env: { ...process.env, DATABASE_URL: value, SERVER_PORT: "3199", CLIENT_ORIGIN: "http://127.0.0.1:3199", NODE_ENV: "test" }, stdio: "ignore" });
  const deadline = Date.now() + 15000; let ready = false; while (Date.now() < deadline && !ready) { try { ready = (await fetch("http://127.0.0.1:3199/health")).ok; } catch {} if (!ready) await new Promise(resolve => setTimeout(resolve, 100)); }
  if (!ready) throw new Error("F07 API did not restart");
  const row = await prisma.attendance.findUnique({ where: { registrationId: registration.id } });
  if (!row) throw new Error("Attendance was not persisted across restart");
  const apiResponse = await fetch(`http://127.0.0.1:3199/api/v1/me/registrations/${registration.id}/attendance`, { headers: { Cookie: `eventcheck_session=${participantSessionId}` } });
  const apiBody = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok || apiBody?.data?.attendance?.registrationId !== registration.id || apiBody.data.attendance.eventId !== eventId || apiBody.data.attendance.participantId !== participantId || !apiBody.data.attendance.checkedInAt) throw new Error("F07 API did not return the persisted Attendance after restart");
  console.log("TEST-F07-08 restart verification passed");
} finally {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  if (eventId) { await prisma.attendance.deleteMany({ where: { eventId } }); await prisma.registration.deleteMany({ where: { eventId } }); await prisma.event.delete({ where: { id: eventId } }); }
  await prisma.session.deleteMany({ where: { id: { in: [organizerSessionId, participantSessionId] } } });
  if (organizerId || participantId) await prisma.user.deleteMany({ where: { id: { in: [organizerId, participantId].filter(Boolean) } } });
  await prisma.$disconnect();
}
