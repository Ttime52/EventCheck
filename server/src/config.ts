export function resolvePort(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.PORT ?? env.SERVER_PORT ?? "3000";
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT/SERVER_PORT must be a valid TCP port");
  }
  return port;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: resolvePort(),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
};
