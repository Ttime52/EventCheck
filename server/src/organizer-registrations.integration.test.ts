import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import request from "supertest";
import { PrismaClient, PublicationState, RegistrationStatus, Role } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./auth.js";
import { hashPassword } from "./security.js";
import { isIsolatedTestDatabase } from "./test-database.js";

const runId = randomUUID();
const password = "f04-organizer-fixture-password";
const origin = { Origin: "http://localhost:5173" };
const isolatedDatabase = isIsolatedTestDatabase();
const ownerALogin = `f04-owner-a-${runId}@example.test`;
const ownerBLogin = `f04-owner-b-${runId}@example.test`;
const participantALogin = `f04-participant-a-${runId}@example.test`;
const participantBLogin = `f04-participant-b-${runId}@example.test`;
const userIds: string[] = [];
const eventIds: string[] = [];
let ownerAId = "";
let ownerBId = "";
let participantAId = "";
let participantBId = "";
let ownEventId = "";
let otherOwnedEventId = "";
let otherOwnersEventId = "";
let emptyEventId = "";

async function login(loginIdentifier: string) {
  const response = await request(app).post("/api/v1/auth/login").set(origin).send({ loginIdentifier, password });
  expect(response.status).toBe(200);
  return response.headers["set-cookie"];
}

async function createEvent(organizerId: string, title: string) {
  const event = await prisma.event.create({
    data: {
      organizerId,
      title,
      description: "A synthetic F-04 registration list fixture.",
      location: "Engineering Building 1",
      startAt: new Date("2026-12-10T02:00:00.000Z"),
      endAt: new Date("2026-12-10T04:00:00.000Z"),
      capacity: 10,
      publicationState: PublicationState.PUBLISHED,
    },
  });
  eventIds.push(event.id);
  return event.id;
}

async function register(eventId: string, participantLogin: string) {
  const response = await request(app)
    .post(`/api/v1/events/${eventId}/registrations`)
    .set(origin)
    .set("Cookie", await login(participantLogin))
    .send({});
  expect(response.status).toBe(201);
  return response.body.data.registration as { id: string; eventId: string; participantId: string; status: string; registeredAt: string };
}

async function reservePort() {
  const probe = createServer();
  await new Promise<void>((resolveListen, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve an API test port");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => probe.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function startBuiltApi() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!isIsolatedTestDatabase(databaseUrl)) throw new Error("Refusing to start the restart check outside eventcheck_test/public");
  const port = await reservePort();
  const child: ChildProcess = spawn(process.execPath, [resolve(process.cwd(), "dist/index.js")], {
    env: { ...process.env, DATABASE_URL: databaseUrl, SERVER_PORT: String(port), CLIENT_ORIGIN: "http://localhost:5173", NODE_ENV: "test" },
    stdio: "ignore",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Built API exited before becoming healthy (${child.exitCode})`);
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) {
        return {
          baseUrl,
          stop: async () => {
            if (child.exitCode !== null || child.signalCode !== null) return;
            await new Promise<void>(resolveExit => {
              const timer = setTimeout(() => { child.kill("SIGKILL"); resolveExit(); }, 5_000);
              timer.unref();
              child.once("exit", () => { clearTimeout(timer); resolveExit(); });
              child.kill("SIGTERM");
            });
          },
        };
      }
    } catch { /* The child may need another moment to bind its port. */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  child.kill("SIGKILL");
  throw new Error("Built API did not become healthy within 15 seconds");
}

async function loginToBuiltApi(baseUrl: string, loginIdentifier = ownerALogin) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ loginIdentifier, password }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Built API login did not set a session cookie");
  return cookie;
}

describe.skipIf(!isolatedDatabase)("F-04 Organizer registration management against isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!isIsolatedTestDatabase()) throw new Error("Integration tests require DATABASE_URL pointing exactly to eventcheck_test/public");
    const passwordHash = await hashPassword(password);
    const [ownerA, ownerB, participantA, participantB] = await Promise.all([
      prisma.user.create({ data: { loginIdentifier: ownerALogin, displayName: "F04 Organizer A", role: Role.ORGANIZER, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: ownerBLogin, displayName: "F04 Organizer B", role: Role.ORGANIZER, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: participantALogin, displayName: "F04 Participant A", role: Role.PARTICIPANT, passwordHash } }),
      prisma.user.create({ data: { loginIdentifier: participantBLogin, displayName: "F04 Participant B", role: Role.PARTICIPANT, passwordHash } }),
    ]);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    participantAId = participantA.id;
    participantBId = participantB.id;
    userIds.push(ownerA.id, ownerB.id, participantA.id, participantB.id);

    [ownEventId, otherOwnedEventId, otherOwnersEventId, emptyEventId] = await Promise.all([
      createEvent(ownerA.id, `F04 owned ${runId}`),
      createEvent(ownerA.id, `F04 sibling ${runId}`),
      createEvent(ownerB.id, `F04 other owner ${runId}`),
      createEvent(ownerA.id, `F04 empty ${runId}`),
    ]);
    await Promise.all([
      register(ownEventId, participantALogin),
      register(ownEventId, participantBLogin),
      register(otherOwnedEventId, participantALogin),
      register(otherOwnersEventId, participantALogin),
    ]);
  });

  afterAll(async () => {
    if (eventIds.length) await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    if (eventIds.length) await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("TEST-F04-01/02/08: returns persisted owner registrations with only approved participant fields", async () => {
    const response = await request(app).get(`/api/v1/organizer/events/${ownEventId}/registrations`).set("Cookie", await login(ownerALogin));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { registrations: expect.any(Array) } });

    const stored = await prisma.registration.findMany({
      where: { eventId: ownEventId },
      select: { id: true, participantId: true, status: true, registeredAt: true, participant: { select: { displayName: true } } },
    });
    expect(response.body.data.registrations).toHaveLength(stored.length);
    for (const row of response.body.data.registrations as Array<Record<string, unknown>>) {
      expect(Object.keys(row).sort()).toEqual(["id", "participantDisplayName", "participantId", "registeredAt", "status"]);
      expect(row).toMatchObject({
        id: expect.any(String),
        participantId: expect.any(String),
        participantDisplayName: expect.any(String),
        status: RegistrationStatus.ACTIVE,
        registeredAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
      });
      const matchingRecord = stored.find(item => item.id === row.id);
      expect(matchingRecord).toBeDefined();
      expect(row).toEqual({
        id: matchingRecord!.id,
        participantId: matchingRecord!.participantId,
        participantDisplayName: matchingRecord!.participant.displayName,
        status: matchingRecord!.status,
        registeredAt: matchingRecord!.registeredAt.toISOString(),
      });
    }
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(ownerALogin);
    expect(serialized).not.toContain(participantALogin);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("eventId");
  });

  it("TEST-F04-01: keeps persisted Registration rows unchanged during retrieval", async () => {
    const before = await prisma.registration.findMany({
      where: { eventId: ownEventId },
      orderBy: { id: "asc" },
      select: { id: true, eventId: true, participantId: true, status: true, registeredAt: true },
    });
    const response = await request(app).get(`/api/v1/organizer/events/${ownEventId}/registrations`).set("Cookie", await login(ownerALogin));
    const after = await prisma.registration.findMany({
      where: { eventId: ownEventId },
      orderBy: { id: "asc" },
      select: { id: true, eventId: true, participantId: true, status: true, registeredAt: true },
    });

    expect(response.status).toBe(200);
    expect(after).toEqual(before);
  });

  it("TEST-F04-03: returns an explicit empty collection for an owned Event without registrations", async () => {
    const response = await request(app).get(`/api/v1/organizer/events/${emptyEventId}/registrations`).set("Cookie", await login(ownerALogin));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { registrations: [] } });
  });

  it("TEST-F04-04: scopes each list to its selected Event", async () => {
    const own = await request(app).get(`/api/v1/organizer/events/${ownEventId}/registrations`).set("Cookie", await login(ownerALogin));
    const sibling = await request(app).get(`/api/v1/organizer/events/${otherOwnedEventId}/registrations`).set("Cookie", await login(ownerALogin));
    expect(own.status).toBe(200);
    expect(sibling.status).toBe(200);
    const ownIds = own.body.data.registrations.map((registration: { id: string }) => registration.id);
    const siblingIds = sibling.body.data.registrations.map((registration: { id: string }) => registration.id);
    expect(ownIds).toHaveLength(2);
    expect(siblingIds).toHaveLength(1);
    expect(ownIds).not.toEqual(expect.arrayContaining(siblingIds));
  });

  it("TEST-F04-05/07: hides cross-owner and unavailable Events and ignores spoofed query identifiers", async () => {
    const ownerCookie = await login(ownerALogin);
    const spoofed = await request(app)
      .get(`/api/v1/organizer/events/${ownEventId}/registrations`)
      .query({ organizerId: ownerBId, ownerId: ownerBId, participantId: participantAId, eventId: otherOwnersEventId })
      .set("Cookie", ownerCookie);
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.data.registrations).toHaveLength(2);
    expect(spoofed.body.data.registrations.map((registration: { participantId: string }) => registration.participantId).sort()).toEqual([participantAId, participantBId].sort());

    for (const eventId of [otherOwnersEventId, randomUUID()]) {
      const denied = await request(app).get(`/api/v1/organizer/events/${eventId}/registrations`).set("Cookie", ownerCookie);
      expect(denied.status).toBe(404);
      expect(JSON.stringify(denied.body)).not.toContain("F04 Participant");
      expect(denied.body.data).toBeUndefined();
    }
    const malformed = await request(app).get("/api/v1/organizer/events/not-a-uuid/registrations").set("Cookie", ownerCookie);
    expect(malformed.status).toBe(404);
    expect(malformed.body.data).toBeUndefined();
  });

  it("TEST-F04-06: rejects visitors, Participants, and expired Organizer sessions", async () => {
    const path = `/api/v1/organizer/events/${ownEventId}/registrations`;
    const visitor = await request(app).get(path);
    expect(visitor.status).toBe(401);
    expect(visitor.body.data).toBeUndefined();

    const participant = await request(app).get(path).set("Cookie", await login(participantALogin));
    expect(participant.status).toBe(403);
    expect(participant.body.data).toBeUndefined();

    const cookie = await login(ownerALogin);
    const sessionId = cookie[0].split(";", 1)[0].split("=", 2)[1];
    await prisma.session.update({ where: { id: sessionId }, data: { absoluteExpiry: new Date(Date.now() - 1) } });
    const expired = await request(app).get(path).set("Cookie", cookie);
    expect(expired.status).toBe(401);
    expect(expired.body.data).toBeUndefined();
  });

  it("TEST-F03-13/TEST-F04-09: retrieves Participant and Organizer registrations after restarting the built API process", async () => {
    const restartEventId = await createEvent(ownerAId, `F03 API restart ${randomUUID()}`);
    const firstApi = await startBuiltApi();
    let secondApi: Awaited<ReturnType<typeof startBuiltApi>> | undefined;
    try {
      const firstParticipantCookie = await loginToBuiltApi(firstApi.baseUrl, participantALogin);
      const created = await fetch(`${firstApi.baseUrl}/api/v1/events/${restartEventId}/registrations`, {
        method: "POST",
        headers: { Cookie: firstParticipantCookie, Origin: "http://localhost:5173", "Content-Type": "application/json" },
        body: "{}",
      });
      expect(created.status).toBe(201);
      const createdBody = await created.json() as { data: { registration: { id: string; eventId: string; participantId: string; status: string } } };
      expect(createdBody.data.registration).toMatchObject({ eventId: restartEventId, participantId: participantAId, status: "ACTIVE" });
      const participantRegistration = await prisma.registration.findUniqueOrThrow({ where: { id: createdBody.data.registration.id } });
      const firstCookie = await loginToBuiltApi(firstApi.baseUrl);
      const firstResponse = await fetch(`${firstApi.baseUrl}/api/v1/organizer/events/${restartEventId}/registrations`, { headers: { Cookie: firstCookie } });
      expect(firstResponse.status).toBe(200);
      const firstBody = await firstResponse.json() as { data: { registrations: Array<{ id: string }> } };
      const firstIds = firstBody.data.registrations.map(registration => registration.id).sort();
      expect(firstIds).toContain(participantRegistration.id);

      await firstApi.stop();
      secondApi = await startBuiltApi();
      const freshCookie = await loginToBuiltApi(secondApi.baseUrl);
      const secondResponse = await fetch(`${secondApi.baseUrl}/api/v1/organizer/events/${restartEventId}/registrations`, { headers: { Cookie: freshCookie } });
      expect(secondResponse.status).toBe(200);
      const secondBody = await secondResponse.json() as { data: { registrations: Array<{ id: string }> } };
      expect(secondBody.data.registrations.map(registration => registration.id).sort()).toEqual(firstIds);
      const participantCookie = await loginToBuiltApi(secondApi.baseUrl, participantALogin);
      const participantList = await fetch(`${secondApi.baseUrl}/api/v1/me/registrations`, { headers: { Cookie: participantCookie } });
      expect(participantList.status).toBe(200);
      const participantListBody = await participantList.json() as { data: { registrations: Array<{ id: string; event: { id: string }; status: string }> } };
      expect(participantListBody.data.registrations).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: participantRegistration.id, event: expect.objectContaining({ id: restartEventId }), status: "ACTIVE" }),
      ]));
      const participantDetail = await fetch(`${secondApi.baseUrl}/api/v1/me/registrations/${participantRegistration.id}`, { headers: { Cookie: participantCookie } });
      expect(participantDetail.status).toBe(200);
      const participantDetailBody = await participantDetail.json() as { data: { registration: { id: string; event: { id: string }; status: string; registeredAt: string } } };
      expect(participantDetailBody.data.registration).toMatchObject({ id: participantRegistration.id, event: { id: restartEventId }, status: "ACTIVE", registeredAt: participantRegistration.registeredAt.toISOString() });
    } finally {
      await secondApi?.stop();
      await firstApi.stop();
    }
  }, 40_000);
});
