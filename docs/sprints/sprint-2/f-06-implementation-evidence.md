# F-06 Implementation and Verification Evidence

**Feature:** F-06 Registration Cancellation and Re-registration  
**Contract:** [F-06 v0.5](f-06-registration-cancellation.md)  
**Status at verification snapshot:** Implemented and verified on `feature/f06-registration-cancellation` (2026-11-25); this snapshot predates PR #59/#61 integration. Current release status is in the note below.<br>
**Verified:** 2026-11-25 (Asia/Bangkok)  
**Source state:** `HEAD` was `38f0e589a9b6a377b89a65805d5eb9cb25d40784`; the implementation and evidence changes were uncommitted in the shared worktree when these checks ran.

**Current integration status (2026-11-27):** This verification remains evidence for the dated feature-branch run, not the current release status. PR #59 later merged F-06 into `feature/sprint-2-e2e`, and PR #61 integrated the Issue 15 tested tree into `sprint-2-staging` at `f08177c`. The later integrated regression and current AC-to-test results are recorded in the [Sprint 2 AC matrix](ac-verification.md) and [Issue 15 integration report](integration-verification.md). No formal Sprint 2 release acceptance/deployment is recorded.

F-06 lets a Participant cancel an eligible registration, retains the cancelled row and its timestamp, returns capacity once, and permits a later F-03 registration only after current eligibility checks. F-07 was accepted separately; Issue 13 adds the shared Attendance persistence required by the cancellation guard but does not add F-07 check-in or attendance retrieval routes or UI.

## Acceptance criteria coverage

| Acceptance criterion | Implemented behavior and executed evidence |
| --- | --- |
| AC-F06-01 | Session-derived Participant identity, CSRF, role and ownership checks, privacy-preserving 404, invalid session, malformed JSON, and invalid body: TEST-F06-01. |
| AC-F06-02 | Cancellation strictly before Event start remains allowed after registration deadline; server time and persisted cancelledAt are checked: TEST-F06-02. |
| AC-F06-03 | One millisecond before start succeeds; exact start and after start reject without mutation or capacity change: TEST-F06-03. |
| AC-F06-04 | Repeated cancellation returns the same status and original cancelledAt, including after start: TEST-F06-04 and TEST-F06-11. |
| AC-F06-05 | Persisted Attendance blocks cancellation and remains unchanged: TEST-F06-05 and the storage-level F-07 writer in TEST-F06-13. |
| AC-F06-06 | Public remaining places and ACTIVE counts fall exactly once and remain stable on retry: TEST-F06-03, TEST-F06-04, TEST-F06-06, and TEST-F06-11. |
| AC-F06-07 | Participant list/detail and Organizer list retain cancelled status and timestamp; a new Prisma client and a restarted API process read the same record: TEST-F06-07 and `f06-restart-check.mjs`. |
| AC-F06-08 | F-03 creates a distinct ACTIVE row and leaves the old cancelled row unchanged: TEST-F06-08, TEST-F06-12, and TEST-F06-15. |
| AC-F06-09 | Explicit/default deadline, full Event, and duplicate ACTIVE conflicts create no extra registration: TEST-F06-09 and TEST-F06-10. |
| AC-F06-10 | Simultaneous cancellations and cancellation/re-registration races preserve the one-ACTIVE-row and capacity invariants: TEST-F06-11 and TEST-F06-12. |
| AC-F06-11 | Cancellation and a check-in storage writer use Event-then-Registration locks; an exact-start cancellation cannot produce CANCELLED plus Attendance: TEST-F06-13. This does not claim an F-07 HTTP endpoint. |
| AC-F06-12 | Rejected authorization/body/boundary requests preserve state; a controlled PostgreSQL trigger failure returns safe 500 and rolls back: TEST-F06-01, TEST-F06-03, and TEST-F06-14. The database also rejects invalid status/cancelledAt combinations. |
| AC-F06-13 | Participant list/detail show status and timestamps; confirmation, keyboard operation, loading/error/retry state, and retained history are checked in client tests and TEST-F06-15. |

## Implementation

- `server/prisma/schema.prisma` and migration `20261125160000_f06_cancellation_attendance_guard` add nullable Registration.cancelledAt, the ACTIVE/CANCELLED timestamp invariant, and shared Attendance relations/constraints. The existing partial unique ACTIVE index is unchanged.
- `server/src/app.ts` implements `POST /api/v1/me/registrations/:registrationId/cancel`, includes cancelledAt in Participant registration list/detail, and keeps F-03 registration as the re-registration route. Cancellation locks Event then Registration, reads Attendance after locking, samples server time after the locks, and updates status/timestamp atomically.
- `server/src/registration-lifecycle.ts` contains the pure cancellation decision; its five unit cases are in `server/src/registration-lifecycle.test.ts`.
- `client/src/App.tsx` adds labelled cancellation controls with confirmation and pending state, retained cancelled history, conflict/session/error states, and “Register again” through the existing F-03 route. The Participant registration list has an explicit retry when it cannot load. No “Refresh events” button was added.
- `server/src/f06.integration.test.ts` implements TEST-F06-01 through TEST-F06-14 against isolated PostgreSQL. `e2e/f06-registration-cancellation.spec.ts` implements TEST-F06-15. `server/scripts/f06-restart-check.mjs` stops and starts a real local API process against the same isolated database and checks Participant list/detail and Organizer history afterward.
- Existing Sprint 1/F-05 fixtures that create CANCELLED rows now set the required cancelledAt. `server/scripts/integration-check.mjs` includes F-05 and F-06 suites and invokes the restart check.
- `e2e/f02-event-publishing.spec.ts` had one stale assertion expecting the old Sprint 1 Participant placeholder. It now asserts the existing F-03 Discover Events panel and Participant tab.

## Executed checks

| Command/check | Result |
| --- | --- |
| `prisma validate --schema server/prisma/schema.prisma` | Passed. |
| `prisma migrate deploy --schema server/prisma/schema.prisma` with `DATABASE_URL` validated as `127.0.0.1:5433/eventcheck_test?schema=public` | F-06 migration applied successfully. Development database was not migrated. |
| `npm.cmd test` | Passed: 44 server tests and 25 client tests. The default run skipped 68 database integration cases because it is intentionally not directed at the isolated test database; these were run separately below. |
| `npm.cmd run test:integration --workspace server` with the validated isolated `E2E_DATABASE_URL` assigned to `DATABASE_URL` | Passed: 68/68 PostgreSQL integration tests across F-01 to F-06 and production provisioning. The F-06 suite passed 15/15. The real API restart persistence check passed. |
| `npm.cmd run typecheck` | Passed for server and client. |
| `npm.cmd run build` | Passed for server and client. |
| `npm.cmd run test:e2e -- --workers=1 --reporter=line` | Passed: 20/20 Playwright tests, including the F-06 keyboard cancellation, reload/history, and re-registration journey. After hardening fixture cleanup, focused `TEST-F06-15` passed again (1/1). The isolated database was seeded with the two synthetic demo accounts. |
| `git diff --check` | Passed with no whitespace errors. Git reported LF-to-CRLF conversion warnings for `docs/features.md`, this evidence file, and the F-06 Playwright spec. |

The standard `npm.cmd run db:seed --workspace server` invocation could not start on this Windows host: `tsx` failed in `uv_os_get_passwd` before opening a database connection. The same repository seed policy and password-hashing functions were run through the already-built Node modules, with `DATABASE_URL` independently checked to equal the isolated `eventcheck_test/public` target. No development or production account was changed.

An initial Playwright run also exposed the missing synthetic accounts and the stale F-02 assertion described above. After fixing only this local test setup and the outdated assertion, the complete E2E suite passed. At the time this 2026-11-25 feature-branch evidence was prepared, it did not itself represent an external reviewer, PR, merge, or release; later PR #59/#61 integration is recorded in the current-status note above.

## PR-ready summary

**Title:** Implement F-06 registration cancellation and re-registration

**Description:** Add Participant-owned cancellation before Event start with idempotent retries, persisted cancellation time, Attendance guard, and Event-then-Registration locking. Preserve cancelled rows and capacity accounting, expose cancellation history in Participant views, and reuse F-03 registration for eligibility-checked re-registration. Add the lifecycle invariant, shared Attendance persistence, integration/restart coverage, and an accessible confirmation flow. F-07 check-in and attendance retrieval operations/UI remain outside this change.

**Implementation evidence:** [F-06 implementation and verification evidence](https://github.com/Ttime52/EventCheck/blob/feature/f06-registration-cancellation/docs/sprints/sprint-2/f-06-implementation-evidence.md)

**Verification:** 68 PostgreSQL integration tests, 20 Playwright tests, 69 unit/component tests, typecheck, build, Prisma validation, and API restart persistence check pass on the isolated test database.
