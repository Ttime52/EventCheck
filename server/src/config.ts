export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.SERVER_PORT ?? 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error("SERVER_PORT must be a valid TCP port");
}
