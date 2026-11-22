# Lab 5 Episodes 2, 4, and 7 — Deployment Plan

## Deployment status

This document records the deployment architecture for EventCheck Issue #24,
the pull-request CI boundary for Issue #26, and the Episode 7 release procedure
(the Student Guide labels these exercises as Issues #2, #4, and #7). Source-
level cloud-readiness, Docker packaging, GitHub Actions CI, and a historical
Cloud Run release are documented below. Current production state must still be
checked against the latest GitHub Actions run and Cloud Run revision.

The six source-level checks are recorded separately in
[`cloud-readiness.md`](./cloud-readiness.md). This document describes the implemented deployment architecture, verified historical release evidence, and operational procedures for subsequent deployments.

## Target architecture and verified release boundary

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

The single-container packaging and deployment workflow are implemented. A
historical release was verified for Cloud Run service `eventcheck` in project
`cpe334-th-008`, region `asia-southeast1`, using revision
`eventcheck-00006-mqn` and production URL
<https://eventcheck-4otxlp3nna-as.a.run.app>. This evidence is tied to release
commit `945a59c`, Release PR [#41](https://github.com/Ttime52/EventCheck/pull/41),
Feature PR [#40](https://github.com/Ttime52/EventCheck/pull/40), and Actions run
[#44999977201](https://github.com/Ttime52/EventCheck/actions/runs/44999977201).
It is historical evidence, not a claim that this remains the latest revision.
Production demo-account provisioning remains a separate manual operation and
has not been claimed as executed.

## Environment configuration

The root [`.env.example`](../../../.env.example) contains placeholders only.
Local and test values must remain in the ignored `.env` file; production values
must be supplied by the approved deployment configuration or secret mechanism.

| Variable | Purpose | Local/Test Use | Production Use | Secret? | Source |
|---|---|---|---|---|---|
| `NODE_ENV` | Selects runtime mode and seed policy | `development` or `test`; synthetic seed is allowed | Set to `production`; synthetic seed is rejected | No | Local `.env`, Compose, or Cloud Run environment |
| `PORT` | HTTP listener port | Optional local override | Supplied by Cloud Run | No | Cloud Run runtime; local `.env` override |
| `SERVER_PORT` | Local fallback listener port | Defaults to `3000` when `PORT` is absent | Not required when Cloud Run supplies `PORT` | No | Local `.env` |
| `DATABASE_URL` | Prisma PostgreSQL connection | Local Compose database or guarded `eventcheck_test` URL | Cloud SQL URL supplied through Secret Manager | Yes | Local ignored `.env`, Compose-generated value, or `eventcheck-database-url` |
| `CLIENT_ORIGIN` | Allowed browser Origin for cookie-authenticated writes and CSRF checks | Normally `http://localhost:5173` | Must equal the deployed browser origin | No | Local `.env` or reviewed Cloud Run environment configuration |
| `SERVE_CLIENT` | Enables Express to serve the built frontend | Usually unset during Vite development | `true` in the unified production image | No | Root Dockerfile/runtime environment |
| `POSTGRES_USER` | Local PostgreSQL username | Compose database and generated `DATABASE_URL` | Not used as a Cloud SQL substitute | No | Local `.env` or Compose defaults |
| `POSTGRES_PASSWORD` | Local PostgreSQL password | Compose database and generated `DATABASE_URL` | Not used for managed Cloud SQL | Yes | Local ignored `.env` or Compose-only secret input |
| `POSTGRES_DB` | Local PostgreSQL database name | Defaults to `eventcheck` in Compose | Not a production Cloud SQL setting | No | Local `.env` or Compose defaults |
| `POSTGRES_PORT` | Host port mapped to local PostgreSQL | Defaults to `5433` in Compose | Not used by Cloud Run | No | Local `.env` or Compose defaults |
| `SEED_PARTICIPANT_PASSWORD` | Synthetic Participant seed password | Required for local/test seed | Must not be supplied to production seed | Yes | Local ignored `.env` or CI test environment |
| `SEED_ORGANIZER_PASSWORD` | Synthetic Organizer seed password | Required for local/test seed | Must not be supplied to production seed | Yes | Local ignored `.env` or CI test environment |
| `ADMIN_PASSWORD` | Legacy/local Compose migration input | Only if a local Compose customization consumes it | Not a production provisioning mechanism | Yes | Local ignored `.env`/Compose only |
| `DEMO_USER_PASSWORD` | Legacy/local Compose migration input | Only if a local Compose customization consumes it | Not a production provisioning mechanism | Yes | Local ignored `.env`/Compose only |
| `SEED_DEMO_DATA` | Local Compose demo-data switch | Compose-only flag when explicitly used | Not used by production deployment | No | Local `.env` or Compose defaults |
| `E2E_DATABASE_URL` | Isolated Playwright database connection | Must target `127.0.0.1:5433/eventcheck_test?schema=public` | Not a production setting | Yes | Local ignored `.env` or CI job environment |
| `E2E_API_PORT` / `E2E_WEB_PORT` | Isolated Playwright server ports | Defaults to `3101` / `5178` | Not a production setting | No | Local `.env` or CI job environment |
| `E2E_ORGANIZER_LOGIN` / `E2E_PARTICIPANT_LOGIN` | Synthetic E2E account identifiers | Optional overrides; safe test accounts only | Not a production setting | No | Local `.env` or CI job environment |
| `E2E_ORGANIZER_PASSWORD` / `E2E_PARTICIPANT_PASSWORD` | Synthetic E2E account passwords | Optional overrides; otherwise use `SEED_*_PASSWORD` | Not a production setting | Yes | Local ignored `.env` or CI secret/environment configuration |
| `E2E_CAPTURE_EVIDENCE` | Enables optional local browser evidence capture | `0` or `1` for Playwright runs | Not a production setting | No | Local `.env` |
| `VITE_API_PROXY_TARGET` | Vite development proxy target for `/api` | Normally `http://localhost:3000` | Not used by the unified runtime image | No | Local `.env` or CI build configuration |
| `PROVISION_ORGANIZER_EMAIL` / `PROVISION_PARTICIPANT_EMAIL` | One-time production demo login identifiers | Not used by local seed or normal tests | Supplied only to the explicitly authorized provisioning Cloud Run Job | No | Secret Manager-backed Cloud Run Job environment |
| `PROVISION_ORGANIZER_PASSWORD` / `PROVISION_PARTICIPANT_PASSWORD` | One-time production demo passwords | Not used by local seed or normal tests | Supplied only from Secret Manager to the provisioning job | Yes | Secret Manager-backed Cloud Run Job environment |
| `GCP_PROJECT_ID` / `GCP_REGION` | Deployment project and region | Not required for local app execution | Required by the deployment workflow | No | GitHub `demo` environment variables |
| `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` | Keyless GitHub-to-GCP authentication | Not required locally | Required by the deployment workflow | `WIF_SERVICE_ACCOUNT`: No; provider: No | GitHub `demo` environment variables |
| `SMOKE_EMAIL` | Optional authenticated smoke-test login | Not required; no login smoke test when both smoke values are absent | Optional GitHub deployment smoke test | No | GitHub `demo` environment variable |
| `SMOKE_PASSWORD` | Optional authenticated smoke-test password | Not required locally | Optional GitHub deployment smoke test | Yes | GitHub `demo` secret |
| `SMOKE_ORIGIN` | Origin sent by authenticated smoke test | Not required locally | Must match deployed `CLIENT_ORIGIN` | No | GitHub `demo` environment variable |

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
9. A separate production account provisioning command is implemented in
   `server/prisma/provision-production-accounts.ts`; it has not been run against
   Cloud SQL by this repository change. No production account creation is claimed.
10. Episode 5 and Episode 7 deployment scripts must continue to keep production migrations separate from development seeding.

## One-time production demo-account provisioning

The production provisioning utility creates a synthetic `ORGANIZER` and a
synthetic `PARTICIPANT` for the EventCheck demo. It is separate from
`server/prisma/seed.ts`, the Episode 5 migration job, and routine Episode 7
releases. It is not called by `deploy/deploy.sh`, `deploy/release.sh`, or
`.github/workflows/deploy.yml`.

The command is `npm run db:provision-production-accounts` in the server
workspace. It requires `NODE_ENV=production`, a PostgreSQL `DATABASE_URL`, and
the following values supplied to the Cloud Run Job from Secret Manager:

| Environment variable | Secret Manager secret | Purpose |
|---|---|---|
| `PROVISION_ORGANIZER_EMAIL` | `eventcheck-provision-organizer-email` | Organizer login identifier |
| `PROVISION_ORGANIZER_PASSWORD` | `eventcheck-provision-organizer-password` | Organizer password; at least 16 characters |
| `PROVISION_PARTICIPANT_EMAIL` | `eventcheck-provision-participant-email` | Participant login identifier |
| `PROVISION_PARTICIPANT_PASSWORD` | `eventcheck-provision-participant-password` | Participant password; at least 16 characters |
| `DATABASE_URL` | Existing `eventcheck-database-url` | Cloud SQL connection used by Prisma |

Emails are trimmed and normalized to lowercase. The two email addresses and the
two passwords must be different. Password values are used exactly as stored in
Secret Manager. The script validates the complete configuration before opening
a Prisma client, looks up both login identifiers case-insensitively, and checks
role conflicts before writing. Missing accounts are inserted in one database
transaction with salted scrypt hashes compatible with login. A matching existing
account is left byte-for-byte unchanged, including its display name and
password hash. If an email already belongs to the other role, the command fails
before writing either account. If an existing login identifier differs only in
letter casing, or multiple case variants exist, the command also fails closed;
it never silently treats a case-sensitive login as usable. The database
migration also adds a PostgreSQL unique index on the lowercase login identifier.
If case-insensitive duplicates already exist, the migration fails without
deleting or changing users; review and resolve conflicts explicitly before
deployment. The production seed
restriction remains in force; do not set another `NODE_ENV` or run
`server/prisma/seed.ts` in production.

### Prepare the one-time job after the application change is approved

Run these steps manually only after the provisioning code has been merged and
the Episode 7 release has successfully deployed an image containing it. They
create Secret Manager resources and a Cloud Run Job, and add secret-level IAM
access for the existing runtime service account. This repository change does
not run these commands or change GCP resources, IAM, secrets, or production data.

1. Set the project and region used by the existing EventCheck deployment in
   Cloud Shell:

   ```sh
   export PROJECT_ID=YOUR_GCP_PROJECT_ID
   export REGION=YOUR_GCP_REGION
   ```

2. Create the four secrets if they do not already exist:

   ```sh
   gcloud secrets create eventcheck-provision-organizer-email --replication-policy=automatic --project="$PROJECT_ID"
   gcloud secrets create eventcheck-provision-organizer-password --replication-policy=automatic --project="$PROJECT_ID"
   gcloud secrets create eventcheck-provision-participant-email --replication-policy=automatic --project="$PROJECT_ID"
   gcloud secrets create eventcheck-provision-participant-password --replication-policy=automatic --project="$PROJECT_ID"
   ```

   In Secret Manager, add a version to each secret with its intended value.
   Generate two different strong passwords (at least 16 characters). Do not
   put secret values in shell commands, shell history, source control, screenshots,
   or logs. If a named secret already exists, inspect its owner and versions
   before using it; do not replace a version just to rerun provisioning.

3. Grant the existing runtime account access to these four secrets individually.
   Keep the existing secret-level grant for `eventcheck-database-url`; do not
   grant project-wide Secret Manager access.

   ```sh
   RUNTIME_SA="eventcheck-runner@${PROJECT_ID}.iam.gserviceaccount.com"
   for SECRET in \
     eventcheck-provision-organizer-email \
     eventcheck-provision-organizer-password \
     eventcheck-provision-participant-email \
     eventcheck-provision-participant-password
   do
     gcloud secrets add-iam-policy-binding "$SECRET" \
       --member="serviceAccount:${RUNTIME_SA}" \
       --role="roles/secretmanager.secretAccessor" \
       --project="$PROJECT_ID"
   done
   ```

4. Deploy a dedicated one-task job using the immutable image currently serving
   EventCheck. The job uses the existing runtime service account and Cloud SQL
   connection. `gcloud run jobs deploy` creates or updates this job; it does not
   execute it.

   ```sh
   IMAGE="$(gcloud run services describe eventcheck \
     --region="$REGION" --project="$PROJECT_ID" \
     --format='value(spec.template.spec.containers[0].image)')"
   test -n "$IMAGE"

   gcloud run jobs deploy eventcheck-provision-accounts \
     --image="$IMAGE" \
     --region="$REGION" \
     --project="$PROJECT_ID" \
     --service-account="eventcheck-runner@${PROJECT_ID}.iam.gserviceaccount.com" \
     --set-cloudsql-instances="${PROJECT_ID}:${REGION}:eventcheck-pg" \
     --set-secrets="DATABASE_URL=eventcheck-database-url:latest,PROVISION_ORGANIZER_EMAIL=eventcheck-provision-organizer-email:latest,PROVISION_ORGANIZER_PASSWORD=eventcheck-provision-organizer-password:latest,PROVISION_PARTICIPANT_EMAIL=eventcheck-provision-participant-email:latest,PROVISION_PARTICIPANT_PASSWORD=eventcheck-provision-participant-password:latest" \
     --set-env-vars="NODE_ENV=production,TZ=Asia/Bangkok" \
     --command=npm \
     --args=run,db:provision-production-accounts \
     --tasks=1 \
     --max-retries=0 \
     --task-timeout=300s
   ```

5. Review the job configuration and secret versions, then explicitly execute it
   once:

   ```sh
   gcloud run jobs execute eventcheck-provision-accounts \
     --region="$REGION" --project="$PROJECT_ID" --wait
   ```

   A successful execution logs only role and outcome (for example,
   `ORGANIZER account created`); it never logs email addresses, passwords,
   password hashes, or the database URL. Check the latest execution in Cloud Run
   Jobs and its logs. On failure, confirm the job image, `NODE_ENV`, required
   secret versions, secret-level access for `eventcheck-runner`, Cloud SQL
   connection name, and database readiness. The job suppresses raw Prisma
   errors because they may contain connection details. Correct the configuration
   and execute the same job again only after reviewing it; reruns are safe and
   do not reset existing accounts.

6. Verify each account privately by signing in at the public EventCheck URL and
   confirming the expected role. Confirm the Organizer can reach event creation
   and the Participant can browse/register. Do not capture or share passwords.
   This source change and a successful job status alone are not evidence that
   account login was verified.

### Episode 7.3 authenticated smoke test

Use the provisioned `PARTICIPANT` account as the lowest-privilege smoke-test
account. In the GitHub `demo` environment, set `SMOKE_EMAIL` to that account's
email as an environment variable, `SMOKE_PASSWORD` to the same password as an
environment secret, and `SMOKE_ORIGIN` to the deployed Cloud Run service URL.
The `deploy.yml` smoke step already passes these values to
`deploy/smoke_test.py`. On a subsequent successful release it performs login,
retrieves the authenticated identity, and logs out; the expected result is
`PASS login/session/logout`. The password is supplied as an environment secret
and is not written into the workflow or this document. Configure both login
values or neither; the workflow skips the login check when both are absent and
fails closed if only one is set. Ensure the Cloud Run service's `CLIENT_ORIGIN`
equals the public service URL; `SMOKE_ORIGIN` must have that same value so the
application's Origin-based CSRF check accepts login and logout requests.

Provisioning remains a manual, one-time operation even when authenticated smoke
testing is configured. Routine releases continue to run migrations and deploy
the application without invoking the provisioning command.

## Review boundary

This document records source-level configuration and the supplied historical
deployment evidence above. It does not claim that the referenced Cloud Run
revision is still current, that production demo accounts were provisioned, or
that database persistence after a fresh production restart was independently
verified. New deployment, billing/IAM, Cloud SQL, Secret Manager, and runtime
claims require evidence tied to the relevant reviewed commit and deployed
revision.

## Episode 4 CI boundary

`.github/workflows/ci-docker.yml` is the pull-request quality gate for
`sprint-1-staging` and `main`, and can also be called with `workflow_call` or
started manually with `workflow_dispatch`. Its `test-and-docker` job installs
from the root lockfile, runs the offline deployment-script checks, uses a
throw-away GitHub Actions PostgreSQL service named `eventcheck_test`, runs
Prisma setup plus backend/frontend checks, and builds the root Docker image.

The workflow has read-only repository permissions and does not authenticate to
GCP, push images, or access production secrets. GitHub Actions success must be
verified on an actual pull request; local checks alone are not release evidence.
Episodes 5–7 remain responsible for first deployment, CI/CD authentication, and
release/persistence evidence.

## Episode 7 release procedure (implemented and repeatable)

The `.github/workflows/deploy.yml` is the Episode 7 release workflow. It has
completed the historical release recorded above; the procedure remains the
repeatable path for subsequent releases.
The repeatable path is:

1. Develop on a feature branch and open a pull request into
   `sprint-1-staging`.
2. Obtain teammate review and wait for the Episode 4 CI workflow to pass.
3. Open a release pull request from the reviewed staging state into `main`.
4. After that release pull request is merged, the deployment workflow runs on
   `main`. It builds and pushes an image tagged with the merged commit SHA,
   runs the versioned migration job, updates Cloud Run, and then runs the
   public smoke checks (`/health`, `/api/ready`, and `/`).

The deploy job uses the GitHub `demo` environment and Workload Identity
Federation. It requires `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, and
`WIF_SERVICE_ACCOUNT`; no service-account key is stored in the repository.
Optional authenticated smoke checks use `vars.SMOKE_EMAIL`, the secret
`SMOKE_PASSWORD`, and `vars.SMOKE_ORIGIN`. If neither login value is supplied,
the workflow records `SKIP login`; supplying only one value fails closed.
`SMOKE_ORIGIN` must match the deployed `CLIENT_ORIGIN` so EventCheck's Origin
and CSRF validation remains enabled.

After a successful run, inspect the workflow's **Summary** for the release
commit SHA, immutable deployed image digest, and Cloud Run service URL. The
Cloud Run revision should be checked in the Google Cloud console or with
`gcloud run revisions list/describe`, confirming that its image digest matches
the summary. The deployed image tag and workflow commit must match the merged
`main` commit. These checks are required for each new release. The historical release was verified through its successful GitHub Actions run, Cloud Run revision, and visible production UI change. Image digest consistency must be checked against the relevant workflow summary and Cloud Run revision for each release.
