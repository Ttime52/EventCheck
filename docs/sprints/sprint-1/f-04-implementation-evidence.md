# F-04 Implementation Evidence

This record documents F-04 implementation verification, historical working-tree TDD evidence, and teammate-reported independent verification of PR #19. Contract acceptance is confirmed; final PR approval, merge, and Sprint 1 completion are not claimed.

## Tested revision and contract status

- Branch: `feature/09-organizer-registration-management`
- Tested base revision: `fabfc2f64947f43c2bb15e2e718f9d6da68cc2e3` (`origin/sprint-1-staging`)
- Tracking issue: [Issue #11](https://github.com/Ttime52/EventCheck/issues/11), titled “Issue 9: [Feature] Organizer Registration Management”; the GitHub issue has no description, so scope comes from the supplied implementation request and F-04 contract.
- Implementation PR: [#19](https://github.com/Ttime52/EventCheck/pull/19).
- Independently tested implementation commit: `3d130deb06cda356c78b0e1204f652a879be62b5` (`feat: organizer registration management`). The earlier base SHA above identifies the historical TDD baseline, not the final reviewed implementation.
- On 2026-11-15, the teammate confirmed acceptance of the F-04 v0.1 contract for Sprint 1 with documented follow-ups. Contract v0.2 records that decision; scope and stable AC/TEST IDs are unchanged. Final PR approval and DoD completion remain pending.

## TDD evidence

The new UI and database integration tests were run before the product implementation:

- `npm.cmd run test --workspace client -- --reporter=dot`: the four initial F-04 UI tests failed because the registrations navigation was not present; the 15 existing tests passed.
- The targeted `server/src/organizer-registrations.integration.test.ts` Vitest run, with `DATABASE_URL` set to the guarded isolated E2E database, failed all six tests because the registrations endpoint did not exist and returned 404.

After implementing the route and UI, the original tests passed: 4/4 UI tests and 6/6 database integration tests. Follow-up checklist tests then covered a temporary UI request failure/retry and a seventh API integration assertion that snapshots every Registration field before and after retrieval; they also passed. Final counts are 5 F-04 UI tests and 7 F-04 database integration tests. These red/green steps were performed on the working tree; no commit hash is assigned to either step.

## Acceptance-criteria evidence

| Acceptance criterion | Test IDs and evidence | Result |
| --- | --- | --- |
| AC-F04-01 | TEST-F04-01; owner-scoped API/database integration, unchanged-row snapshot, and the full registration journey in `e2e/f04-organizer-registrations.spec.ts` | API pass; independent full browser suite passed at the tested SHA; historical teardown caveat retained below |
| AC-F04-02 | TEST-F04-01/02/08; exact API projection and `client/src/App.test.tsx` Bangkok timestamp assertion | Pass |
| AC-F04-03 | TEST-F04-03; API empty collection, UI loading/empty state, and initial empty list in the browser journey | Pass |
| AC-F04-04 | TEST-F04-04; multiple Events and event-bound query result | Pass |
| AC-F04-05 | TEST-F04-05/07; non-owner Organizer receives privacy-preserving not-found | Pass |
| AC-F04-06 | TEST-F04-06; visitor, Participant, and expired-session API cases; UI expired-session handling | Pass |
| AC-F04-07 | TEST-F04-05/07; invalid/missing/cross-owner Event IDs and spoofed owner query values | Pass |
| AC-F04-08 | TEST-F04-01/02/08; selected database fields and response projection, including UI assertion that a password-hash field is not rendered | Pass |
| AC-F04-09 | TEST-F04-09; committed registration retrieved after stopping and restarting the built API process and creating a fresh session | Pass |
| AC-F04-10 | TEST-F04-02/03/06/10; semantic region/status/alert roles, labelled controls, loading/empty/success/error/retry states, retry button keyboard focusability, and focused list heading | Implemented and covered by UI assertions; the browser journey assertions passed. A separate exhaustive keyboard-only audit is not recorded. |
| AC-F04-11 | This table maps each stable AC to implemented tests and results; tested base SHA and command results are recorded here | Pending: contract accepted, but final PR review and completion evidence must still be recorded |

## Historical local commands and results

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

## Independent teammate verification

The teammate reported the following independent results on 2026-11-15 for PR #19 at **`3d130deb06cda356c78b0e1204f652a879be62b5`**. These are teammate-supplied results, not a new execution by the documentation editor. Commands below identify the repository entry points for reproducing each check; the teammate did not supply the literal shell transcript or environment setup commands.

| Repository command / check | Independently reported result |
| --- | --- |
| `npm run test --workspace server` | Backend unit: 7/7 passed; integration verified separately below |
| `npm run test:integration --workspace server` with `DATABASE_URL` targeting isolated `eventcheck_test/public` | PostgreSQL integration: 36/36 passed |
| `npm run test --workspace client` | Frontend Vitest: 20/20 passed |
| `npm run test:e2e` | Full Playwright: 16/16 passed, exit code 0 |
| `npm run typecheck` | Passed |
| `npm run build` | Production build passed |
| Manual UI verification | Passed, as reported by teammate |

The successful independent full Playwright run resolves the earlier clean-exit verification gap for this tested commit. The interrupted targeted local run remains in the historical table above and is not relabelled as successful. No additional skip counts or individual manual checks are inferred from the supplied review.

## AC-F04-10: specific UI and browser coverage

The Playwright test `TEST-F04-01/02/03/10: Organizer views persisted registrations from an owned Event` in `e2e/f04-organizer-registrations.spec.ts` exercises the real UI/API/database journey. The reported 16/16 result is the full suite count, not 16 F-04-specific cases.

| State / accessibility check | Source and actual assertions |
| --- | --- |
| Empty state | Playwright locates the named `Registrations for <title>` region and checks `No registrations for this event yet.` before anyone registers. |
| Success and navigation | Playwright publishes an Event, opens owned Event details and registrations, navigates back, switches to Participant registration, then logs in again as Organizer and checks `1 registration`, `Demo Participant`, `Participant ID`, and `ACTIVE` in that Event's named region. |
| Accessible names and focus | Playwright uses labelled login/form fields and named buttons, tabs, forms, regions, and headings; it explicitly asserts the level-2 registration heading is focused in both empty and populated states. |
| Loading and empty announcements | Component test `TEST-F04-03/10` holds the fetch pending, checks the named region's status says `Loading registrations...`, then checks `0 registrations` and the explicit empty message. |
| Permitted fields and Bangkok time | Component test `TEST-F04-02/10` checks count, display name, participant identifier, ACTIVE state, Bangkok timestamp, return navigation, and that an injected password-hash value is not rendered. |
| Permission/privacy state | Component test `TEST-F04-10: shows a safe permission error without displaying registration data` checks an alert and absence of participant data after a 403 response. |
| Temporary failure and retry | Component test `TEST-F04-10: exposes a retry for a temporary registration-list failure` checks the alert, Retry button `tabIndex === 0`, and successful retry to the empty state. |
| Expired authentication | Component test `TEST-F04-06/10` checks that a 401 response returns to the labelled Login form and removes participant data. |

Loading, permission, failure/retry, and expired-session checks above are component tests, not additional Playwright scenarios. Role, ownership, and unavailable-ID authorization are also verified by real API/database integration tests. The teammate reports manual UI verification passed but did not provide an itemized accessibility audit. No exhaustive keyboard-only browser audit or browser interception tests for all error states are claimed.

## Review and completion status

The F-04 contract is teammate-accepted for Sprint 1 with documented follow-ups. Independent verification is recorded for the exact PR #19 commit above, including a clean full Playwright run. **AC-F04-11 remains pending** until final PR review and completion evidence are recorded. Final PR approval, merge/release evidence, and Sprint 1 Definition of Done completion remain outstanding. This documentation update does not grant final PR approval.
