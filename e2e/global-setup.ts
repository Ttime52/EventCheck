import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient, PublicationState, RegistrationStatus, Role } from "@prisma/client";

const scrypt = promisify(nodeScrypt);
async function hashPassword(password: string) { const salt = randomBytes(16); const derived = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`; }

function isolatedDatabaseUrl() {
  const value = process.env.E2E_DATABASE_URL;
  if (!value) throw new Error("Missing E2E_DATABASE_URL");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/eventcheck_test" || url.searchParams.get("schema") !== "public") {
    throw new Error("E2E_DATABASE_URL must point to isolated eventcheck_test/public");
  }
  return value;
}

async function assertFreePort(port: number) {
  const probe = createServer();
  await new Promise<void>((resolveListen, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolveListen);
  });
  await new Promise<void>((resolveClose, reject) => probe.close(error => error ? reject(error) : resolveClose()));
}

async function waitForHealth(child: ChildProcess, url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`E2E server exited before ready: ${url} (${child.exitCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch { /* Wait for the server to bind. */ }
    await delay(150);
  }
  throw new Error(`E2E server did not become ready: ${url}`);
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolveStop => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolveStop(); }, 5_000);
    timer.unref();
    child.once("exit", () => { clearTimeout(timer); resolveStop(); });
    child.kill("SIGTERM");
  });
}

export default async function globalSetup() {
  const databaseUrl = isolatedDatabaseUrl();
  const apiPort = Number(process.env.E2E_API_PORT ?? "3101");
  const webPort = Number(process.env.E2E_WEB_PORT ?? "5178");
  await assertFreePort(apiPort);
  await assertFreePort(webPort);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const run = randomUUID();
  const password = `f07-e2e-${randomUUID()}`;
  let organizer: { id: string; loginIdentifier: string } | undefined;
  let participant: { id: string; loginIdentifier: string } | undefined;
  let event: { id: string; title: string } | undefined;
  let registration: { id: string } | undefined;
  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  const cleanup = async () => {
    await stop(web);
    await stop(api);
    if (event) {
      await prisma.attendance.deleteMany({ where: { eventId: event.id } });
      if (registration) await prisma.registration.deleteMany({ where: { id: registration.id } });
      await prisma.event.deleteMany({ where: { id: event.id } });
    }
    const userIds = [organizer?.id, participant?.id].filter((id): id is string => Boolean(id));
    if (userIds.length) {
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  };
  try {
    const passwordHash = await hashPassword(password);
    organizer = await prisma.user.create({ data: { loginIdentifier: `f07-e2e-organizer-${run}@example.test`, displayName: "F07 E2E Organizer", role: Role.ORGANIZER, passwordHash }, select: { id: true, loginIdentifier: true } });
    participant = await prisma.user.create({ data: { loginIdentifier: `f07-e2e-participant-${run}@example.test`, displayName: "F07 E2E Participant", role: Role.PARTICIPANT, passwordHash }, select: { id: true, loginIdentifier: true } });
    const startAt = new Date(Date.now() - 60_000);
    event = await prisma.event.create({ data: { organizerId: organizer.id, title: `F07 E2E Event ${run}`, description: "F07 fixture", location: "F07 Test Hall", startAt, endAt: new Date(Date.now() + 3_600_000), capacity: 5, publicationState: PublicationState.PUBLISHED }, select: { id: true, title: true } });
    registration = await prisma.registration.create({ data: { eventId: event.id, participantId: participant.id, status: RegistrationStatus.ACTIVE }, select: { id: true } });
    process.env.E2E_F07_ORGANIZER_LOGIN = organizer.loginIdentifier;
    process.env.E2E_F07_PARTICIPANT_LOGIN = participant.loginIdentifier;
    process.env.E2E_F07_ORGANIZER_PASSWORD = password;
    process.env.E2E_F07_PARTICIPANT_PASSWORD = password;
    process.env.E2E_F07_EVENT_TITLE = event.title;
    process.env.E2E_F07_REGISTRATION_ID = registration.id;
    api = spawn(process.execPath, [resolve("server/dist/index.js")], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl, CLIENT_ORIGIN: `http://127.0.0.1:${webPort}`, SERVER_PORT: String(apiPort) },
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForHealth(api, `http://127.0.0.1:${apiPort}/health`);
    web = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "client", "--host", "127.0.0.1", "--port", String(webPort)], {
      cwd: process.cwd(),
      env: { ...process.env, VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForHealth(web, `http://127.0.0.1:${webPort}/`);
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) { console.error("F07 fixture cleanup also failed during setup:", cleanupError); }
    await prisma.$disconnect();
    throw error;
  }

  return async () => {
    try { await cleanup(); } finally { await prisma.$disconnect(); }
  };
}
