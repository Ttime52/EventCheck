# EventCheck

EventCheck is a Sprint 1 university event registration application. Organizers publish events and view registrations for their own events. Participants discover published events, register, and retrieve saved registrations. The server enforces roles, Event ownership, capacity, and duplicate registration rules in PostgreSQL.

## Requirements and stack

- Node.js 20.6 or later and npm (the commands below use Node's `--env-file` option)
- Docker Desktop or Docker Engine with Compose
- React, TypeScript, and Vite frontend; Express, TypeScript, Prisma, and PostgreSQL backend
- Vitest, Supertest, and Playwright for automated verification

The frontend normally runs at `http://localhost:5173` and proxies `/api` to the backend at `http://localhost:3000`. The roles are `ORGANIZER` and `PARTICIPANT`. Session identity, permissions, capacity, and ownership are enforced by the backend.

## Install and configure

From the repository root:

```sh
npm ci
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Edit the ignored `.env` for your machine. Set `DATABASE_URL` and the `POSTGRES_*` values for the local container. Set `SEED_ORGANIZER_PASSWORD` and `SEED_PARTICIPANT_PASSWORD` to local synthetic passwords before seeding. The example file contains sample values only. Do not commit `.env` or put credentials in screenshots.

A local development URL has this form, with your own local values:

```text
DATABASE_URL="postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck?schema=public"
```

## Docker Compose and production migrations

The full application stack in `docker-compose.yml` is for local development
only. Its `migrate` service applies migrations and runs the synthetic demo seed
for the local PostgreSQL volume. Do not use this migration-and-seed workflow in
production.

Production deployments use the root `Dockerfile` for the unified API and SPA
image. Run `prisma migrate deploy` as a separate, one-shot production migration
job with the production `DATABASE_URL` supplied securely. Do not run
`npm run db:seed` or `server/prisma/seed.ts` in production; the synthetic seed
is restricted to `NODE_ENV=development` or `test` under the Issue #24 policy.
Production account provisioning, if needed, must be a separate explicitly
approved process.

## PostgreSQL, migrations, and seed data

```sh
docker compose -f compose.db-only.yaml up -d postgres
docker compose -f compose.db-only.yaml ps
node --env-file=.env node_modules/prisma/build/index.js migrate deploy --schema server/prisma/schema.prisma
node --env-file=.env node_modules/prisma/build/index.js generate --schema server/prisma/schema.prisma
node --env-file=.env node_modules/tsx/dist/cli.mjs server/prisma/seed.ts
```

Wait for the PostgreSQL health check before migrating. The checked-in migrations create the F-01 User/Session, F-02 Event, and F-03 Registration schema and referential restrictions. F-04 reuses the same schema. Synthetic seeding is allowed only when `NODE_ENV` is exactly `development` or `test`; production, unknown, and unset values are rejected. It upserts `organizer@example.test` and `participant@example.test` using passwords supplied through the `SEED_*_PASSWORD` environment variables. Production demo-account provisioning must use a separate explicitly controlled process.

`docker compose -f compose.db-only.yaml stop postgres` preserves the named data volume. `docker compose -f compose.db-only.yaml down -v` deletes local data; use it only for an intentional development reset.

## Run the application

Start the backend in one terminal:

```sh
npm run build --workspace server
node --env-file=.env server/dist/index.js
```

Cloud Run supplies the `PORT` environment variable; the server prefers it and falls back to local `SERVER_PORT` (3000). The liveness endpoint is `GET /health`. The database readiness endpoint is `GET /api/ready`; it returns `200 {"status":"ready"}` only when PostgreSQL responds and `503 {"status":"unavailable"}` otherwise.

Start the frontend in another:

```sh
npm run dev --workspace client
```

Rebuild and restart the backend after editing its source. The root `npm run dev` starts both workspace development scripts if the required environment variables have already been exported into that shell.

## Checks and isolated database tests

```sh
npm run typecheck
npm run build
npm test
npm run prisma:validate
```

`npm test` runs server unit and frontend component tests. Database integration tests skip when `DATABASE_URL` is unset. Their runner accepts only the isolated `127.0.0.1:5433/eventcheck_test?schema=public` database and rejects other URLs. Create that separate local database once. For the example Compose user:

```sh
docker compose -f compose.db-only.yaml exec -T postgres psql -U eventcheck -d postgres -c 'CREATE DATABASE eventcheck_test;'
```

If it already exists, skip creation. Add a separate test URL to the ignored `.env`, replacing the placeholders with your local test credentials:

```text
E2E_DATABASE_URL="postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public"
```

In PowerShell, set `DATABASE_URL` to that exact test URL before applying migrations and running integration tests:

```powershell
$env:DATABASE_URL = "postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public"
npm exec -- prisma migrate deploy --schema server/prisma/schema.prisma
npm run test:integration --workspace server
Remove-Item Env:DATABASE_URL
```

In a POSIX shell, prefix each migration or integration command with `DATABASE_URL='postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public'`. The test fixtures use synthetic records and clean up their own rows. Keep the development and test databases separate.

Playwright loads the ignored `.env` automatically. It uses `E2E_DATABASE_URL`, starts isolated API and Vite processes on ports 3101 and 5178, and uses the synthetic seeded accounts. Apply the checked-in migrations to `eventcheck_test` and seed it with matching local passwords before running:

```sh
npm run test:e2e
```

The optional `E2E_ORGANIZER_LOGIN`, `E2E_PARTICIPANT_LOGIN`, `E2E_ORGANIZER_PASSWORD`, and `E2E_PARTICIPANT_PASSWORD` override the default seeded account identifiers and `SEED_*_PASSWORD` values. `E2E_CAPTURE_EVIDENCE=1` additionally captures synthetic UI, API, and database observations for the Sprint 1 journey.

## Sprint 1 capabilities and limits

- F-01: seeded login/logout, current-user retrieval, server-side sessions, and role restrictions.
- F-02: Organizer event publication, validation, persistence, and owned-event reads.
- F-03: public discovery, Participant registration/retrieval, duplicate and capacity rejection, and transactional concurrency protection.
- F-04: owner-only Organizer registration lists, safe empty/error states, and permitted participant fields.

Cancellation, check-in, attendance reporting, capacity editing, and Cloud Run deployment are later work. Sprint 1 release still requires teammate review, final integration checks, and the Product Definition of Done.

## Troubleshooting

- **Express `404 Cannot GET` for a new API route:** stop the older process on port 3000, rebuild the server, and restart it. A registered protected route returns JSON 401 without a session.
- **Vite selects 5174:** another frontend is using 5173. Stop the old process; the default backend `CLIENT_ORIGIN` is 5173.
- **Login or API requests fail:** check PostgreSQL health, the backend terminal, `DATABASE_URL`, `CLIENT_ORIGIN`, and matching seed passwords.
- **Prisma reports missing tables:** apply the checked-in migrations to the selected database and regenerate Prisma Client.
- **Integration/E2E rejects a URL:** confirm the exact `127.0.0.1:5433/eventcheck_test?schema=public` target; the guard rejects other databases.

## Repository layout

- `client/` — frontend and component tests
- `server/` — API, Prisma schema/migrations, unit and PostgreSQL integration tests
- `e2e/` — Playwright browser tests
- `docs/` — requirements, designs, contracts, traceability, and verification evidence
