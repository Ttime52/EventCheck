# F-04 Implementation Evidence

This record documents the working-tree implementation and verification for F-04 Organizer Registration Management. It does not claim contract acceptance, a merged PR, or Sprint 1 completion.

## Tested revision and contract status

- Branch: `feature/09-organizer-registration-management`
- Tested base revision: `fabfc2f64947f43c2bb15e2e718f9d6da68cc2e3` (`origin/sprint-1-staging`)
- Tracking issue: [Issue #11](https://github.com/Ttime52/EventCheck/issues/11), titled “Issue 9: [Feature] Organizer Registration Management”; the GitHub issue has no description, so scope comes from the supplied implementation request and F-04 contract.
- F-04 implementation and tests: uncommitted working-tree changes; no implementation commit or PR exists yet.
- Contract: [F-04 Organizer Registration Management](./f-04-organizer-registrations.md), version 0.1. Its API path, response shape, and status policy are marked teammate-confirmed, while the document header still says “Draft for teammate review; not yet accepted for implementation” and its closing section says acceptance is required before implementation. This implementation follows the specified API and behavior at the user's direction. The contract was not edited; contract acceptance and reconciliation remain review items.

## TDD evidence

The new UI and database integration tests were run before the product implementation:

- `npm.cmd run test --workspace client -- --reporter=dot`: the four initial F-04 UI tests failed because the registrations navigation was not present; the 15 existing tests passed.
- The targeted `server/src/organizer-registrations.integration.test.ts` Vitest run, with `DATABASE_URL` set to the guarded isolated E2E database, failed all six tests because the registrations endpoint did not exist and returned 404.

After implementing the route and UI, the original tests passed: 4/4 UI tests and 6/6 database integration tests. Follow-up checklist tests then covered a temporary UI request failure/retry and a seventh API integration assertion that snapshots every Registration field before and after retrieval; they also passed. Final counts are 5 F-04 UI tests and 7 F-04 database integration tests. These red/green steps were performed on the working tree; no commit hash is assigned to either step.

## Acceptance-criteria evidence

| Acceptance criterion | Test IDs and evidence | Result |
| --- | --- | --- |
| AC-F04-01 | TEST-F04-01; owner-scoped API/database integration, unchanged-row snapshot, and the full registration journey in `e2e/f04-organizer-registrations.spec.ts` | API pass; browser assertions pass, with runner teardown caveat below |
| AC-F04-02 | TEST-F04-01/02/08; exact API projection and `client/src/App.test.tsx` Bangkok timestamp assertion | Pass |
| AC-F04-03 | TEST-F04-03; API empty collection, UI loading/empty state, and initial empty list in the browser journey | Pass |
| AC-F04-04 | TEST-F04-04; multiple Events and event-bound query result | Pass |
| AC-F04-05 | TEST-F04-05/07; non-owner Organizer receives privacy-preserving not-found | Pass |
| AC-F04-06 | TEST-F04-06; visitor, Participant, and expired-session API cases; UI expired-session handling | Pass |
| AC-F04-07 | TEST-F04-05/07; invalid/missing/cross-owner Event IDs and spoofed owner query values | Pass |
| AC-F04-08 | TEST-F04-01/02/08; selected database fields and response projection, including UI assertion that a password-hash field is not rendered | Pass |
| AC-F04-09 | TEST-F04-09; committed registration retrieved after stopping and restarting the built API process and creating a fresh session | Pass |
| AC-F04-10 | TEST-F04-02/03/06/10; semantic region/status/alert roles, labelled controls, loading/empty/success/error/retry states, retry button keyboard focusability, and focused list heading | Implemented and covered by UI assertions; the browser journey assertions passed. A separate exhaustive keyboard-only audit is not recorded. |
| AC-F04-11 | This table maps each stable AC to implemented tests and results; tested base SHA and command results are recorded here | Evidence recorded; contract acceptance and review remain pending |

## Commands and results

Database commands below used only the isolated local PostgreSQL database `eventcheck_test` on `127.0.0.1:5433`. The integration runner refuses any other database URL. No development database migration was run for F-04.

| Command / check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed for server and client |
| `npm.cmd run build` | Passed for server and client |
| `npm.cmd test` | Passed: server unit tests 7 passed, 36 database integration tests skipped because `DATABASE_URL` was not set for this command; client tests 20 passed |
| `npm.cmd run test:integration --workspace server` with `DATABASE_URL` set to the validated `E2E_DATABASE_URL` | Passed: 36 database integration tests (7 F-01, 7 F-02, 5 F-03 public discovery, 10 F-03 registration, 7 F-04). The F-04 suite verifies retrieval leaves all persisted Registration fields unchanged. |
| `npm.cmd run prisma:validate` | Passed |
| `npm.cmd run test:e2e -- --grep TEST-F04` | The F-04 browser test reported 1 passed and completed its assertions. Playwright then held its parent process open after the web/API listeners stopped; the process was interrupted, so this command did not exit cleanly and is not counted as a clean suite pass. |
| Lint | No lint script is configured in the root or workspace package manifests. |

F-04 adds no schema change or migration. The pre-existing F-03 migrations needed by the isolated test database were applied there; this did not create a migration file or touch the development database. The integration runner compiles the server before running suites so TEST-F04-09 can exercise the built server across a real process restart. The Playwright web-server configuration starts that built server and Vite directly because `tsx watch` failed to start in this environment with `uv_os_get_passwd ... ENOMEM`.

## Implemented API and UI

- `GET /api/v1/organizer/events/:eventId/registrations` requires a valid Organizer session, validates the Event ID, checks Event ownership using the session identity, and returns a privacy-preserving 404 for invalid, missing, or non-owned Events.
- The read selects only registration ID, participant ID/display name, status, and registration time; rows are event-scoped and deterministically ordered. UTC timestamps are serialized by the API and displayed in Asia/Bangkok by the UI.
- The Organizer can open registrations from an owned Event's detail view, see explicit loading/empty/success/error states, and return to the same Event detail. No registration mutation or schema migration was added.
- The new API integration suite is `server/src/organizer-registrations.integration.test.ts`; UI tests are in `client/src/App.test.tsx`; the end-to-end journey is `e2e/f04-organizer-registrations.spec.ts`.

## Review and completion status

The source, tests, and traceable evidence are ready for teammate review. F-04 contract acceptance, a clean Playwright runner exit, review/PR, merge, and Sprint 1 release approval remain outstanding. The uncommitted working tree has not been pushed or published.
