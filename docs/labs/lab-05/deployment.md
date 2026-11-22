# Lab 5 Episodes 2 and 4 — Deployment Plan

## Deployment status

This document records the planned deployment architecture for EventCheck Issue
#24 and the pull-request CI boundary for Issue #26 (the Student Guide labels
these exercises as Issues #2 and #4). Source-level cloud-readiness and Docker
packaging are present; GCP resources, CI/CD execution on GitHub, and a
production deployment are not claimed here.

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
| `CLIENT_ORIGIN` | Local frontend origin, normally `http://localhost:5173` | Must be set to the actual deployed frontend/browser origin; final production value is a deployment decision |
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
9. A separate production account provisioning command is implemented in
   `server/prisma/provision-production-accounts.ts`; it has not been run against
   Cloud SQL by this repository change. No production account creation is claimed.
10. Future Episode 5 and Episode 7 deployment scripts must be reviewed to
    ensure they never combine production migration with the development seed.

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

This document does not claim deployment, cloud-resource creation, billing/IAM
configuration, CI/CD execution, or production verification. Those claims
require separate evidence tied to a reviewed commit and deployed revision.

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

## Episode 7 release procedure (planned and repeatable)

The prepared `.github/workflows/deploy.yml` is the Episode 7 release workflow.
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
`main` commit. These deployment and revision checks are instructions for real
Episode 7 execution; this repository does not claim that a production run has
already completed.
