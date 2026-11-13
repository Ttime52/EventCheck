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
defined in `compose.yaml`. Copy the file to `.env`; `.env` is ignored and must
not contain committed credentials. The baseline has no feature-owned tables;
F-01 owns User and Session schema, F-02 owns Event, F-03 owns Registration,
and F-04 reuses those records.

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
port 3000. Authentication, event, and registration behavior are intentionally
not implemented by this baseline.

## Structure

- `client/` — React, TypeScript, and Vite frontend
- `server/` — Express, TypeScript, and Prisma backend
- `docs/` — approved requirements, design, contracts, and sprint planning

Feature branches should add their owned Prisma models and migrations without
duplicating another feature's schema. This branch is shared infrastructure;
do not commit credentials, local `.env` files, dependencies, or build output.

## Lab 5 deployment target

The future Lab 5 deployment will package the frontend and backend together in
one application image for Cloud Run. PostgreSQL will remain a separate managed
Cloud SQL service. This baseline does not add the production image, CI/CD
workflow, GCP resources, or deployment configuration.
