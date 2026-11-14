# EventCheck

Initial shared engineering baseline for the EventCheck Sprint 1 application.

## Prerequisites

- Node.js 20 or later
- Docker Desktop (or Docker Engine with Compose) for the local database

## Setup

```sh
npm install
cp .env.example .env
npm run prisma:generate
```

The default `.env.example` values connect Prisma to the PostgreSQL container
defined in `compose.yaml` on host port 5433. Copy the file to `.env`; `.env` is
ignored and must not contain committed credentials. The current branch contains
the F-01 User/Session schema; F-02 owns Event, F-03 owns Registration, and F-04
reuses those records when those features are implemented.

## Local PostgreSQL

Start the database and wait for its health check:

```sh
docker compose up -d postgres
docker compose ps
```

The `eventcheck-postgres-data` named volume preserves data across container
restarts. Stop the container without deleting data with:

```sh
docker compose stop postgres
```

Remove the container and its persisted local data only when intentionally
resetting the development database:

```sh
docker compose down -v
```

After starting PostgreSQL, Prisma commands can use the `DATABASE_URL` from
`.env`:

```sh
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

## Development and checks

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run prisma:validate
npm run db:migrate
```

The frontend runs on port 5173 and proxies `/api` requests to the backend on
port 3000. F-01 authentication is implemented with seeded local accounts,
server-side PostgreSQL sessions, role checks, and cookie-based login/logout.
F-02 event publishing and F-03/F-04 registration behavior remain pending.

To seed local accounts, set `SEED_PARTICIPANT_PASSWORD` and
`SEED_ORGANIZER_PASSWORD` in the ignored `.env`, then run `npm run db:seed`.
Synthetic seeding refuses to run when `NODE_ENV=production`.

Run unit and frontend tests with `npm test`. Database-backed F-01 integration
verification requires the Docker PostgreSQL service and a separate test
database URL. Create `eventcheck_test`, apply the versioned migration, and run
the suite with:

```sh
DATABASE_URL="postgresql://eventcheck:change-me@127.0.0.1:5433/eventcheck_test?schema=public" \
  npm run test:integration --workspace server
```

F-02-dependent authorization journeys remain pending until F-02 is implemented. They are Sprint 1 release gates and must be executed and recorded before the integrated Sprint 1 release is accepted.

## Structure

- `client/` — React, TypeScript, and Vite frontend
- `server/` — Express, TypeScript, and Prisma backend
- `docs/` — approved requirements, design, contracts, and sprint planning

Feature branches should add their owned Prisma models and migrations without
duplicating another feature's schema. This F-01 branch contains authentication
and shared baseline work; F-02 event-publishing integration remains pending.
Do not commit credentials, local `.env` files, dependencies, or build output.

## Lab 5 deployment target

The future Lab 5 deployment will package the frontend and backend together in
one application image for Cloud Run. PostgreSQL will remain a separate managed
Cloud SQL service. This baseline does not add the production image, CI/CD
workflow, GCP resources, or deployment configuration.
