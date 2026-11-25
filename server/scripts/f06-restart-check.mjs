import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient, Role, RegistrationStatus, PublicationState } from "@prisma/client";

function isolatedDatabaseUrl(value) {
  if (!value) throw new Error("Restart verification requires DATABASE_URL on eventcheck_test/public");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") {
    throw new Error("Refusing restart verification outside the isolated eventcheck_test database");
  }
  return value;
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function waitForHealth(child, url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`F06 API process exited before restart check became ready (${child.exitCode ?? child.signalCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch { /* Wait for the local API process to bind. */ }
    await delay(150);
  }
  throw new Error("F06 API process did not become ready within 30 seconds");
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolveStop => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolveStop(); }, 5_000);
    timer.unref();
    child.once("exit", () => { clearTimeout(timer); resolveStop(); });
    child.kill("SIGTERM");
  });
}

function startApi(repoRoot, databaseUrl, port, origin) {
  const serverDir = resolve(repoRoot, "server");
  return spawn(process.execPath, [resolve(serverDir, "dist/index.js")], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl, SERVER_PORT: String(port), CLIENT_ORIGIN: origin, NODE_ENV: "test" },
    stdio: "ignore",
    windowsHide: true,
  });
}

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`F06 restart request failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const databaseUrl = isolatedDatabaseUrl(process.env.DATABASE_URL);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const run = randomUUID();
const organizerLogin = `f06-restart-organizer-${run}@example.test`;
const participantLogin = `f06-restart-participant-${run}@example.test`;
const passwordHash = `unused-restart-check-${randomBytes(12).toString("hex")}`;
const participantSessionId = randomBytes(32).toString("hex");
const organizerSessionId = randomBytes(32).toString("hex");
let organizerId;
let participantId;
let eventId;
let api;

try {
  const [port, now] = await Promise.all([availablePort(), Promise.resolve(new Date())]);
  const origin = `http://127.0.0.1:${port}`;
  const organizer = await prisma.user.create({ data: { loginIdentifier: organizerLogin, displayName: "F06 Restart Organizer", role: Role.ORGANIZER, passwordHash } });
  const participant = await prisma.user.create({ data: { loginIdentifier: participantLogin, displayName: "F06 Restart Participant", role: Role.PARTICIPANT, passwordHash } });
  organizerId = organizer.id;
  participantId = participant.id;
  await prisma.session.createMany({ data: [
    { id: participantSessionId, userId: participantId, absoluteExpiry: new Date(now.getTime() + 3_600_000) },
    { id: organizerSessionId, userId: organizerId, absoluteExpiry: new Date(now.getTime() + 3_600_000) },
  ] });
  const startAt = new Date(now.getTime() + 3_600_000);
  const event = await prisma.event.create({ data: {
    organizerId,
    title: `F06 restart check ${run}`,
    description: "Synthetic restart persistence fixture",
    location: "Test Hall",
    startAt,
    endAt: new Date(startAt.getTime() + 3_600_000),
    registrationDeadline: new Date(now.getTime() - 60_000),
    capacity: 1,
    publicationState: PublicationState.PUBLISHED,
  } });
  eventId = event.id;
  const registration = await prisma.registration.create({ data: { eventId, participantId, status: RegistrationStatus.ACTIVE } });

  api = startApi(repoRoot, databaseUrl, port, origin);
  await waitForHealth(api, `${origin}/health`);
  const cancelResponse = await fetch(`${origin}/api/v1/me/registrations/${registration.id}/cancel`, {
    method: "POST",
    headers: { Origin: origin, Cookie: `eventcheck_session=${participantSessionId}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const cancelledBody = await readJson(cancelResponse);
  if (cancelledBody?.data?.registration?.status !== "CANCELLED" || !cancelledBody.data.registration.cancelledAt) throw new Error("F06 cancellation did not persist before the API restart");
  const originalCancelledAt = cancelledBody.data.registration.cancelledAt;

  await stop(api);
  api = undefined;
  api = startApi(repoRoot, databaseUrl, port, origin);
  await waitForHealth(api, `${origin}/health`);
  const headers = { Cookie: `eventcheck_session=${participantSessionId}` };
  const [listBody, detailBody, ownerBody] = await Promise.all([
    fetch(`${origin}/api/v1/me/registrations`, { headers }).then(readJson),
    fetch(`${origin}/api/v1/me/registrations/${registration.id}`, { headers }).then(readJson),
    fetch(`${origin}/api/v1/organizer/events/${eventId}/registrations`, { headers: { Cookie: `eventcheck_session=${organizerSessionId}` } }).then(readJson),
  ]);
  const listRow = listBody?.data?.registrations?.find(row => row.id === registration.id);
  const detailRow = detailBody?.data?.registration;
  const ownerRow = ownerBody?.data?.registrations?.find(row => row.id === registration.id);
  if (listRow?.status !== "CANCELLED" || listRow.cancelledAt !== originalCancelledAt) throw new Error("Participant history changed after restarting the API");
  if (detailRow?.status !== "CANCELLED" || detailRow.cancelledAt !== originalCancelledAt) throw new Error("Participant detail changed after restarting the API");
  if (ownerRow?.status !== "CANCELLED") throw new Error("Organizer history changed after restarting the API");
  const stored = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
  if (stored.status !== RegistrationStatus.CANCELLED || stored.cancelledAt?.toISOString() !== originalCancelledAt) throw new Error("A fresh database read did not find the cancelled history after API restart");
  console.log("TEST-F06-07 restart verification passed: Participant list/detail and Organizer history retained the same cancelledAt after API restart.");
} finally {
  await stop(api);
  if (eventId) {
    await prisma.attendance.deleteMany({ where: { eventId } });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  }
  await prisma.session.deleteMany({ where: { id: { in: [participantSessionId, organizerSessionId] } } });
  if (organizerId || participantId) await prisma.user.deleteMany({ where: { id: { in: [organizerId, participantId].filter(Boolean) } } });
  await prisma.$disconnect();
}
