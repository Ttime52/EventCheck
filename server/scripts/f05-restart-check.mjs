import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { PrismaClient } from "@prisma/client";

function isolated(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test" && url.searchParams.get("schema") === "public";
  } catch { return false; }
}

const databaseUrl = process.env.DATABASE_URL;
if (!isolated(databaseUrl)) throw new Error("DATABASE_URL must target 127.0.0.1:5433/eventcheck_test?schema=public");
const organizerLogin = process.env.E2E_ORGANIZER_LOGIN;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
if (!organizerLogin || !organizerPassword) throw new Error("E2E organizer credentials are required");

const port = process.env.F05_RESTART_PORT ?? "3199";
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let child;
let eventId;

async function assertFreePort(value) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(Number(value), "127.0.0.1", resolve); });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}

async function waitReady() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null) throw new Error(`Restart API exited before readiness (${child.exitCode})`);
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become ready on dedicated port ${port}`);
}

async function start() {
  await assertFreePort(port);
  child = spawn(process.execPath, ["dist/index.js"], { env: { ...process.env, DATABASE_URL: databaseUrl, SERVER_PORT: port, PORT: port, NODE_ENV: "test", CLIENT_ORIGIN: origin }, stdio: ["ignore", "ignore", "pipe"] });
  let startupError = "";
  child.stderr?.on("data", chunk => { startupError += String(chunk); });
  child.once("error", error => { startupError += error.message; });
  try {
    await waitReady();
  } catch (error) {
    const detail = startupError.trim();
    throw new Error(`${error instanceof Error ? error.message : "API readiness failed"}${detail ? `: ${detail}` : ": no startup output captured"}`);
  }
  if (startupError) throw new Error(`API startup warning/error: ${startupError}`);
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("API shutdown timed out")); }, 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
  child = undefined;
}

try {
  await assertFreePort(port);
  await start();
  const login = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ loginIdentifier: organizerLogin, password: organizerPassword }) });
  if (!login.ok) throw new Error("Organizer login failed");
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Session cookie was not returned");
  const created = await fetch(`http://127.0.0.1:${port}/api/v1/events`, { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ title: `F05 restart ${crypto.randomUUID()}`, description: "Restart verification", location: "Lab 5", startAt: "2099-11-26T09:00:00+07:00", endAt: "2099-11-26T12:00:00+07:00", capacity: 3 }) });
  const createdBody = await created.json();
  if (!created.ok) throw new Error("Event fixture creation failed");
  eventId = createdBody.data.event.id;
  const updated = await fetch(`http://127.0.0.1:${port}/api/v1/organizer/events/${eventId}`, { method: "PATCH", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ capacity: 4, registrationDeadline: "2099-11-26T08:00:00+07:00" }) });
  if (!updated.ok) throw new Error("Event settings update failed");
  await stop();
  await start();
  const detail = await fetch(`http://127.0.0.1:${port}/api/v1/organizer/events/${eventId}`, { headers: { Origin: origin, Cookie: cookie } });
  const detailBody = await detail.json();
  const organizerEvent = detailBody.data.event;
  const publicResponse = await fetch(`http://127.0.0.1:${port}/api/v1/events/${eventId}`);
  const publicEvent = (await publicResponse.json()).data.event;
  if (!detail.ok || organizerEvent.capacity !== 4 || organizerEvent.registrationDeadline !== "2099-11-26T01:00:00.000Z" || publicEvent.capacity !== 4 || publicEvent.remainingPlaces !== 4 || publicEvent.registrationAvailable !== true || publicEvent.registrationOpen !== true || publicEvent.registrationDeadline !== "2099-11-26T01:00:00.000Z") throw new Error("Restarted API returned inconsistent persisted values");
  console.log("F-05 restart verification passed");
} finally {
  await stop();
  if (eventId) {
    try { await prisma.registration.deleteMany({ where: { eventId } }); await prisma.event.delete({ where: { id: eventId } }); }
    catch (error) { console.error(`F-05 fixture cleanup failed for owned Event ${eventId}: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
  }
  await prisma.$disconnect();
}
