import { createServer } from "node:http";
import { app } from "./app.js";
import { config } from "./config.js";

const server = createServer(app);
server.listen(config.port, () => {
  console.log(`EventCheck API listening on port ${config.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
