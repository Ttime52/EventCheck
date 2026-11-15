import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

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

  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  try {
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
    await stop(web);
    await stop(api);
    throw error;
  }

  return async () => {
    await stop(web);
    await stop(api);
  };
}
