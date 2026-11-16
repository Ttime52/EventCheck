# Lab 5 Episode 2 — Cloud Readiness (Issue #24)

This note records local source-level readiness work only. It does not claim Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, IAM, CI/CD, or GCP deployment has been configured.

| Check | Status | Evidence |
|---|---|---|
| Persistent storage | PASS | `server/prisma/schema.prisma` stores User, Session, Event, and Registration in PostgreSQL. No required domain data is stored on container disk. |
| Production-safe seed | PASS | `server/src/seed-policy.ts` permits only exact `development` or `test`; `server/prisma/seed.ts` retains idempotent `upsert` behavior and reads passwords from environment variables. |
| No development authentication shortcut | PASS | `server/src/auth.ts` always resolves identity from the database-backed session and applies role middleware; no development login bypass is enabled. |
| Database-backed sessions | PASS | `Session` is a Prisma model in PostgreSQL and `requireAuth` reads/updates it through Prisma. |
| Cloud Run port | PASS | `server/src/config.ts` prefers `PORT`, falls back to `SERVER_PORT`, validates 1–65535, and `server/src/index.ts` listens on `0.0.0.0`. |
| Database readiness | PASS | `GET /api/ready` executes `SELECT 1`, returns safe 200/503 JSON, and keeps `/health` as liveness. |

## Environment variables

`.env.example` documents local PostgreSQL variables, `DATABASE_URL`, `CLIENT_ORIGIN`, `NODE_ENV`, `PORT`, `SERVER_PORT`, and synthetic seed password placeholders. `.env` remains ignored. Production values must be supplied through the deployment secret/configuration mechanism; no real credentials belong in this repository.

## Local verification

```sh
npm run typecheck
npm run build
npm test --workspace=server -- --run
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/api/ready
```

The readiness unit tests mock Prisma for success/failure paths; they do not modify a database. Do not run migrations or seed commands against production. Before database-dependent tests, use only the guarded isolated target `127.0.0.1:5433/eventcheck_test?schema=public`.

## Remaining Lab 5 work

- Package the application according to the reviewed Docker/Cloud Run architecture.
- Provision Cloud SQL, Artifact Registry, Secret Manager, and Workload Identity Federation only through the approved deployment workflow.
- Add GitHub Actions build/test/deploy evidence and trace the deployed commit SHA.
- Verify persistence after restart/redeployment in the isolated approved cloud environment.
