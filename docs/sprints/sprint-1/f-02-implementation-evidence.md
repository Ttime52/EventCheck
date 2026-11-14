# F-02 Implementation Evidence

This file records verification for Issue #7 without changing the F-02 Engineering Contract. The contract currently remains version 0.1 and marked “Draft for teammate review; not yet accepted for implementation”; its completion placeholders remain unchanged until the contract is reviewed and approved.

## Tested revision

- Branch: `feature/07-event-creation-publishing`
- Baseline `HEAD`: `2c7f790`
- F-02 changes: uncommitted working-tree changes, intentionally not committed, pushed, or opened as a PR in this task.

Because there is no F-02 commit or teammate review yet, AC-F02-15 is not complete.

## TDD evidence

The validation unit test was run before its implementation existed:

```text
& 'node_modules/.bin/vitest.cmd' run server/src/events.test.ts
Error: Cannot find module './events.js'
```

After `server/src/events.ts` was implemented, the same command passed with 3 tests. The red/green sequence was run against the uncommitted working tree above; no fabricated commit hash is assigned to either step.

## AC-to-test evidence

| Acceptance criteria | Evidence | Result |
| --- | --- | --- |
| AC-F02-01 | `client/src/App.test.tsx`, `e2e/f02-event-publishing.spec.ts` | Pass |
| AC-F02-02 | `server/src/events.integration.test.ts`, F-02 Playwright flow | Pass |
| AC-F02-03 | `server/src/events.test.ts`, API integration cases for blank/omitted text fields, UI validation mapping | Pass |
| AC-F02-04 | Unit and API cases for malformed, timezone-free, equal, and reversed instants | Pass |
| AC-F02-05 | Unit and API cases for omitted, zero, negative, fractional, string, and capacity 1 | Pass |
| AC-F02-06 | API integration cases for CSRF, anonymous, and Participant requests | Pass |
| AC-F02-07 | API integration owner-override rejection and server-derived owner persistence | Pass |
| AC-F02-08 | API integration owner filtering, tampered query, and explicit empty list | Pass |
| AC-F02-09 | API integration owner, cross-owner, Participant, visitor, and safe detail access | Pass |
| AC-F02-10 | API integration unsupported PATCH and unchanged database snapshot | Pass |
| AC-F02-11 | F-03 public discovery integration | Deferred until F-03 integration |
| AC-F02-12 | API integration controlled transaction failure and unchanged row count | Pass |
| AC-F02-13 | Fresh Prisma client persistence and owner detail retrieval | Pass |
| AC-F02-14 | Accessible Organizer form, empty/success/validation states, integration authorization, Playwright reload flow | Pass for implemented F-02 scope; full keyboard/expired-UI review remains for teammate review |
| AC-F02-15 | Contract/review/commit evidence | Incomplete: draft contract, no teammate review, no F-02 commit/PR |

## Commands and results

All commands below were run on 2026-11-14 against the isolated PostgreSQL database `eventcheck_test` on `127.0.0.1:5433` where noted.

| Command | Result |
| --- | --- |
| `npm.cmd run prisma:validate` | Passed |
| `npm.cmd run prisma:generate` | Passed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test` | 13 passed, 14 integration tests skipped without `DATABASE_URL` |
| `DATABASE_URL=postgresql://eventcheck@127.0.0.1:5433/eventcheck_test?schema=public npm.cmd run test:integration --workspace server` | 14 passed (7 F-01 + 7 F-02) |
| `npm.cmd run build` | Passed for server and client |
| `E2E_DATABASE_URL=... npm.cmd run test:e2e` | 10 passed (all F-01 tests plus F-02 Organizer publish/reload) |

The E2E command required the approved elevated local execution path because the restricted Windows sandbox caused `tsx` to fail with `uv_os_get_passwd ... ENOMEM` before the application started. The rerun outside that restriction passed.

## Implemented API surface

- `POST /api/v1/events` — Organizer-only, CSRF-protected create-and-publish.
- `GET /api/v1/organizer/events` — authenticated Organizer's published owned events; server-derived ownership.
- `GET /api/v1/organizer/events/:eventId` — owner-only management detail.
- `PATCH /api/v1/organizer/events/:eventId` — explicit Sprint 1 unsupported boundary; no mutation.

F-03 public discovery, teammate contract review, risk acceptance, PR review, and final release approval remain outside this evidence run.
