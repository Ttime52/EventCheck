import express from "express";

export const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});
