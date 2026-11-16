# Lab 5 Episode 2 — Deployment Plan

## Deployment status

This is the initial deployment plan for EventCheck Issue #24 (the Student Guide
calls the corresponding exercise “Issue #2”). The repository contains local
cloud-readiness changes for seed safety, Cloud Run port handling, database
sessions, and a PostgreSQL readiness endpoint. Docker packaging, CI/CD, GCP
resources, and a production deployment are not implemented or verified by this
document.

The six source-level checks are recorded separately in
[`cloud-readiness.md`](./cloud-readiness.md). This document describes the
intended deployment architecture and the operational contract that must be
reviewed before deployment.

## Target architecture (planned)

The intended architecture is:

- React + TypeScript + Vite frontend packaged with the application.
- Node.js + Express + TypeScript backend serving the API and the built UI from
  a Cloud Run application container.
- Cloud SQL for PostgreSQL as the persistent store for User, Session, Event,
  and Registration data.
- Artifact Registry for versioned application images.
- Secret Manager for `DATABASE_URL`, session-related configuration, and other
  sensitive runtime values.
- GitHub Actions for build/test and deployment workflows, authenticated to GCP
  through Workload Identity Federation.

These services and the single-container packaging workflow are planned Lab 5
choices. No Cloud Run service, Cloud SQL instance, Artifact Registry
repository, Secret Manager secret, IAM binding, or GitHub Actions deployment is
claimed here.

## Environment configuration

The root [`.env.example`](../../../.env.example) contains placeholders only.
Local and test values must remain in the ignored `.env` file; production values
must be supplied by the approved deployment configuration or secret mechanism.

| Variable | Local/test use | Production intent |
|---|---|---|
| `NODE_ENV` | `development` or `test` for local synthetic seed operations | `production`; synthetic seed is rejected |
| `PORT` | Optional local override | Cloud Run supplied listener port |
| `SERVER_PORT` | Local fallback, default `3000` | Not required when Cloud Run supplies `PORT` |
| `DATABASE_URL` | Local PostgreSQL or isolated test PostgreSQL URL | Cloud SQL PostgreSQL URL supplied securely |
| `CLIENT_ORIGIN` | Local frontend origin, normally `http://localhost:5173` | Approved deployed frontend origin |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Docker Compose PostgreSQL settings | Not a substitute for managed Cloud SQL configuration |
| `SEED_PARTICIPANT_PASSWORD` / `SEED_ORGANIZER_PASSWORD` | Synthetic local/test seed passwords | Must not be used as an implicit production provisioning mechanism |
| `E2E_DATABASE_URL` | Optional isolated E2E database only | Not a production setting |
| `E2E_API_PORT` / `E2E_WEB_PORT` | Isolated Playwright ports | Not a production setting |
| `E2E_ORGANIZER_LOGIN` / `E2E_PARTICIPANT_LOGIN` | Optional E2E account overrides | Not a production setting |
| `E2E_ORGANIZER_PASSWORD` / `E2E_PARTICIPANT_PASSWORD` | Optional E2E password overrides; otherwise use `SEED_*_PASSWORD` | Not a production setting |
| `E2E_CAPTURE_EVIDENCE` | Optional local evidence capture flag | Not a production setting |
| `VITE_API_PROXY_TARGET` | Local Vite proxy target | Build/deployment routing decision remains to be finalized |

No real passwords, tokens, service-account keys, or complete production
connection strings belong in this repository or in screenshots.

## Local build and verification

From the repository root, the existing scripts are:

```sh
npm ci
npm run prisma:generate
npm run typecheck
npm run build
npm test
npm run prisma:validate
```

`npm run prisma:validate` reads the Prisma datasource configuration and may
require `DATABASE_URL` to be supplied in the environment such as 
```sh
DATABASE_URL="postgresql://user:placeholder@127.0.0.1:5433/eventcheck_test?schema=public" npm run prisma:validate
```
A placeholder URL is
sufficient for schema validation only; it does not prove database connectivity.
Database-dependent integration tests must use the repository's exact guarded
isolated target:

```text
postgresql://<local-user>:<local-password>@127.0.0.1:5433/eventcheck_test?schema=public
```

Readiness can be checked against a locally running API without changing the
database:

```sh
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/api/ready
```

The repository's integration and E2E guards reject other database targets. Do
not run migrations, seeds, or tests against the development database when
collecting Episode 2 evidence.

## Health and readiness endpoints

- `GET /health` is the liveness endpoint and returns HTTP 200 when the process
  is running.
- `GET /api/ready` performs a lightweight PostgreSQL query. It returns HTTP
  200 with `{ "status": "ready" }` when the database responds and HTTP 503
  with `{ "status": "unavailable" }` when it cannot be reached. Internal
  database details are not returned.

## Production migration and seeding policy (planned contract)

1. Production schema migration and synthetic seeding are separate operations.
2. Production schema changes use the approved versioned Prisma migration
   process, such as `prisma migrate deploy`, with the production
   `DATABASE_URL` supplied securely.
3. A production deployment must not execute `server/prisma/seed.ts` or an
   equivalent synthetic development seed.
4. The current seed policy remains fail-closed: synthetic seeding is allowed
   only when `NODE_ENV` is exactly `development` or `test`.
5. If demo accounts are required for Lab 5 or Lab 6 UAT, they must be created
   by a separate, explicitly authorized, idempotent provisioning process.
6. Production demo passwords must come from Secret Manager or another approved
   secure secret mechanism.
7. Production passwords must never be hardcoded, committed, printed, or shown
   in screenshots.
8. Provisioning must not reset production data or overwrite unrelated users.
9. The production provisioning process is **PLANNED, not implemented** in this
   repository. No working production provisioning command is claimed.
10. Future Episode 5 and Episode 7 deployment scripts must be reviewed to
    ensure they never combine production migration with the development seed.

## Review boundary

This document does not claim deployment, cloud-resource creation, billing/IAM
configuration, CI/CD execution, or production verification. Those claims
require separate evidence tied to a reviewed commit and deployed revision.
