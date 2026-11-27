# F-07 Verification Evidence

## Integration status and evidence reconciliation — 2026-11-27

This file contains feature-owner snapshots from the F-07 branch; they are not all results from one run or one tested SHA. The clean-commit verification at `6c50a02` is historical. Later Issue 15 evidence records the F-07 restart check and focused F-07 browser run on `b9df85c`, then the integrated PostgreSQL and full Playwright runs on `107c93e` (87/87 PostgreSQL integration and 30/30 E2E across F-05/F-06/F-07 and Sprint 1 regressions). The `107c93e` run did not repeat the dedicated F-07 restart script. The [AC matrix](ac-verification.md) and [Issue 15 integration report](integration-verification.md) are the current source for those later results. No result in this file establishes formal Sprint 2 release acceptance or GCP deployment.

The owner-reported 2026-11-26 working-tree results below have no new tested SHA and must remain separate from clean-commit and Issue 15 results. One inherited note mentions `24/24` without a named suite, command, output, or tested version; that count is unresolved and excluded from the verification totals unless its source is supplied.

## Latest owner verification — 2026-11-26, 19:24 ICT

The owner executed the corrected working tree against isolated `127.0.0.1:5433/eventcheck_test?schema=public`. This run reported F-07 integration 16 passed, 0 failed; full server 128 passed, 0 failed, 0 skipped across 16/16 passing files; server/client typecheck PASS; production build PASS; TEST-F07-08 restart PASS; and `git diff --check` PASS. The deliberate TEST-F07-10 failure after Attendance INSERT is expected rollback-test output.

Separate earlier successful executions after the latest corrections reported F-06 repeated cancellation 3/3 PASS, F-07 Playwright 10/10 PASS, full Playwright 30/30 PASS and all six browser boundaries PASS. Client Vitest 29/29 PASS was executed separately in Codex. These are separate runs, not one combined execution.

Historical incidents are retained: full Playwright 29 passed/1 failed on F-06 before recovery; server runs with 16 skipped and with 44 passed/84 skipped arose from environment configuration and did not establish full server verification. After database configuration was restored, all 128 server tests executed successfully with zero skips in the 19:24 run. No new commit SHA is assigned to these working-tree results.

Verified blocker assertions in `server/src/f07.integration.test.ts`: `TEST-F07-04: preserves associations and safe validation outcomes` uses two persisted, same-owner Events and asserts 404 `REGISTRATION_NOT_FOUND`, unchanged Registration and unchanged Attendance collection; `TEST-F07-04: rejects expired and revoked sessions on Organizer and Participant routes` preserves GET coverage and independently tests POST with an unused expired session and a revoked session, exact 401 `UNAUTHENTICATED`, and unchanged state; the denied-access matrix asserts the permitted error shape and absence of private field names, login identifier, password hash, participant ID and cookie value. F-06 browser recovery verifies heading-focus readiness, keyboard activation, confirmation dialog and HTTP 200.

This document records the current implementation evidence for F-07 without changing the accepted contract or STS definitions.

## Owner review snapshot — 2026-11-26

- Branch: `feature/51-f07-check-in-attendance`
- Current HEAD: `8298951d9b3c86cabfa3832856b92d1a6b333a1b`; working tree is dirty.
- Historical confirmed clean-tree implementation commit: `6c50a024ee682f7b3d2fb968d663805336867ec3`.
- Latest results belong to the corrected uncommitted working tree based on the current HEAD, not the historical clean commit or a later documentation-only commit.

## Evidence matrix

| AC | Accepted STS | Executable evidence | Result | Limitation |
|---|---|---|---|---|
| AC-F07-01 | TEST-F07-01, TEST-F07-11 | `server/src/f07.integration.test.ts` owner check-in assertions; `e2e/f07-check-in.spec.ts` Organizer journey | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-02 | TEST-F07-01, TEST-F07-11 | API Attendance association assertions and Organizer status/timestamp assertions | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-03 | TEST-F07-02 (server), TEST-F07-11 (browser) | Server boundary assertions plus six Organizer browser cases: before-start, exact-start, during-window, end-1ms, exact-end and after-end | PASS — confirmed 2026-11-26 macOS run | Browser clock is presentation-only; no claim is made that it changes server time |
| AC-F07-04 | TEST-F07-03 | `server/src/f07.integration.test.ts`: cancelled, malformed/unregistered, nonexistent, wrong-Event and invalid-association requests; exact status/error and no-write assertions | PASS — confirmed 16/16 macOS integration run | No mandatory STS scenario remains missing |
| AC-F07-05 | TEST-F07-04 | `server/src/f07.integration.test.ts`: unauthenticated, Participant/wrong-role, non-owner, expired/revoked session, Origin/CSRF, cross-participant privacy and no-disclosure assertions | PASS — confirmed 16/16 macOS integration run | No mandatory STS scenario remains missing |
| AC-F07-06 | TEST-F07-05 | `server/src/f07.integration.test.ts` duplicate prevention and persisted Attendance retrieval | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-07 | TEST-F07-06, TEST-F07-11 | Multi-event scope/order/ownership/empty API assertions plus deferred loading, 503 alert, keyboard Retry and recovery browser assertions | PASS — confirmed 10/10 F-07 and 30/30 full Playwright runs | No mandatory STS scenario remains missing |
| AC-F07-08 | TEST-F07-07, TEST-F07-12 | Participant API retrieval plus scoped Checked In/Not Checked In assertions before and after reload | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-09 | TEST-F07-08 | Application restart persistence | PASS — TEST-F07-08 exit code 0 | Tested at `6c50a02` |
| AC-F07-10 | TEST-F07-09 | Cancellation/check-in race and lock contention | PASS — both PostgreSQL scenarios | Tested at `6c50a02` |
| AC-F07-11 | TEST-F07-10 | API transaction rollback and recovery | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-12 | TEST-F07-11, TEST-F07-12 | Organizer/Participant journeys, ACTIVE/CANCELLED history, no self-check-in, persistence, keyboard traversal, loading/error/retry and accessible feedback | PASS — confirmed 2026-11-26 macOS run | No additional mandatory STS scenario remains unexecuted |

## Historical macOS verification

The feature owner reported, against the then-tested working tree:

- Server/PostgreSQL: 123/123 PASS
- F-07 integration: 11/11 PASS
- Frontend Vitest: 28/28 PASS
- Playwright: 22/22 PASS
- TypeScript and production build: PASS
- `git diff --check`: PASS

These are historical results and are not claimed as execution in the current environment. They predate the confirmed commit below.

## Historical Confirmed macOS Verification — Tested Commit 31eb71b

The owner executed this verification from a clean working tree at
`31eb71bf07ddadf3032c8b6e07045b390b038795`; HEAD matched this commit before and after the run. The database target was the isolated `127.0.0.1:5433/eventcheck_test?schema=public` database.

| Command | Result |
|---|---|
| `npm run test --workspace server -- src/f07.integration.test.ts --no-file-parallelism` | 16 passed, 0 failed |
| `npm run test --workspace server -- --no-file-parallelism` | 128 passed, 0 failed |
| `npm run test --workspace client` | 29 passed, 0 failed |
| `npm run test:e2e` | 22 passed, 0 failed; Organizer and Participant F-07 journeys passed |
| `node server/scripts/f07-restart-check.mjs` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git show --check --oneline HEAD` | PASS |

This was a previously tested implementation revision. It is retained for history; the latest confirmed revision is documented below.

## Confirmed macOS Verification — Tested Commit 6c50a02

The owner executed this regression from a clean working tree at
`6c50a024ee682f7b3d2fb968d663805336867ec3`; HEAD matched this commit before and after the run. The database target was the isolated `127.0.0.1:5433/eventcheck_test?schema=public` database.

| Command | Result |
|---|---|
| `npm run test --workspace server -- src/f07.integration.test.ts --no-file-parallelism` | 16 passed, 0 failed |
| `npm run test --workspace server -- --no-file-parallelism` | 128 passed, 0 failed |
| `npm run test --workspace client` | 29 passed, 0 failed |
| `npm run test:e2e` | 22 passed, 0 failed; TEST-F07-11 Organizer and TEST-F07-12 Participant passed |
| `node server/scripts/f07-restart-check.mjs` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git show --check --oneline HEAD` | PASS |

This is a historical clean-commit verification. Later working-tree runs are recorded separately; a subsequent documentation-only commit is not a tested implementation SHA.

## Latest owner-reported macOS verification (2026-11-25)

The feature owner previously reported the following run against isolated `127.0.0.1:5433/eventcheck_test?schema=public`:

- F-07 PostgreSQL integration: 16/16 PASS
- Full server suite: 128/128 PASS
- TEST-F07-08 restart verification: PASS, exit code 0
- TEST-F07-09 lock-contention scenarios: both PASS
- TEST-F07-10 API rollback and recovery: PASS
- Frontend Vitest: 29/29 PASS
- TEST-F07-11 Organizer: PASS
- TEST-F07-12 Participant: PASS
- Full Playwright: 22/22 PASS
- TypeScript, production build and `git diff --check`: PASS

These results are historical owner-provided evidence and are superseded for commit identity by the confirmed `6c50a02` run above.

Reported commands were the server suite with `--no-file-parallelism`, the F-07 integration run, `node server/scripts/f07-restart-check.mjs`, `npm run test --workspace client`, `npm run test:e2e`, typecheck, build and `git diff --check`. The owner also reported the historical two F-07 browser cases individually passing within the full browser run.

## Historical macOS boundary run — 2026-11-26

The first execution of the six newly added browser boundary scenarios reported 4 passed, 1 failed and 5 not run. The failure was the before-start case because the original `page.clock.install({ time })` clock advanced during navigation; this was a test-clock defect. The subsequent corrected run using `setFixedTime(timestamp)` passed, as recorded below.

## Confirmed macOS Verification — 2026-11-26 corrected boundary run

The owner subsequently executed the corrected working-tree tests against isolated `127.0.0.1:5433/eventcheck_test?schema=public`:

- F-07 PostgreSQL integration: 16/16 PASS
- F-07 Playwright: 10/10 PASS, including all six browser boundary scenarios
- Full Playwright E2E: 30/30 PASS
- Restart verification: PASS
- Server and client typecheck: PASS
- Production build: PASS
- `git diff --check`: PASS

The six passing TEST-F07-11 browser scenarios assert: before start (Upcoming/disabled), exact start (Ongoing/enabled), during window (Ongoing/enabled), end-1ms (Ongoing/enabled), exact end (Ended/disabled), and after end (Ended/disabled). These are browser presentation checks; server-authoritative boundary enforcement remains evidenced by TEST-F07-02 integration tests using the controlled server clock. The run was against the working tree and is not attributed to an older clean commit.

## Remaining coverage gaps

- AC-F07-03: all six server-authoritative and browser presentation boundaries now have passing evidence; the browser clock is not treated as server-clock manipulation.
- AC-F07-04: all mandatory invalid/cancelled/association scenarios in TEST-F07-03 were executed in the 16/16 integration run.
- AC-F07-05: all mandatory authentication, authorization, CSRF and privacy scenarios in TEST-F07-04 were executed in the 16/16 integration run.
- AC-F07-07: multi-event scope/order/ownership/empty API cases and loading/error/retry/recovery UI cases were executed in the reported integration and 10/10 browser runs.
- AC-F07-12: Organizer/Participant journeys, CANCELLED history, persistence, keyboard and loading/error/retry assertions passed in the corrected 30/30 run.

Historical uncommitted working-tree results are kept separate from the confirmed clean-tree macOS run at `6c50a02`. The current Codex environment did not execute PostgreSQL or browser tests; PASS statuses for the latest additions are owner-reported from 2026-11-26.

## Assertion-level audit for PR #60

- **AC-F07-03:** `TEST-F07-02` covers server-authoritative boundaries and six `TEST-F07-11` browser scenarios cover the corresponding presentation states; both passed in the 2026-11-26 owner run.
- **AC-F07-04:** `TEST-F07-03` and the explicit invalid-association assertions cover every accepted cancelled, malformed/unregistered, nonexistent and wrong-Event case; all passed in the 16/16 integration run.
- **AC-F07-05:** `TEST-F07-04` covers unauthenticated, wrong-role, non-owner, expired/revoked, CSRF and cross-participant privacy; all passed in the 16/16 integration run.
- **AC-F07-07:** `TEST-F07-06` covers multi-event scope/order/empty/ownership, while the F07 browser loading/error/retry tests cover deferred loading, 503 alert, keyboard Retry and recovery; all passed in the reported runs.
- **AC-F07-12:** `TEST-F07-11` and `TEST-F07-12` cover Organizer check-in, CANCELLED history, scoped attendance persistence after reload, loading/error/retry and keyboard assertions; these passed in the 2026-11-26 owner run.

## Local reviewer-environment check (database and E2E not run)

Executed against the current checkout (without database access):

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run test --workspace client` — 29/29 PASS
- `npx playwright test e2e/f07-check-in.spec.ts --list` — 10 tests discovered in this environment; owner executed all 10 on macOS
- `git diff --check` — PASS

Database-backed and browser execution was **NOT RUN** in this environment because both `DATABASE_URL` and `E2E_DATABASE_URL` were unset; no database target could be verified safely. The owner-reported 16/16, 30/30, and 29/29 results are described in the dated run notes above, but do not have a unique implementation SHA. The `24/24` count in the original working note is untraceable and is not included in those results.

The previously uncommitted Playwright additions are not part of the historical `6c50a02` run; their successful execution is recorded in the separate 2026-11-26 working-tree run above.

The six deterministic `TEST-F07-11` browser boundary cases passed in the owner-executed 2026-11-26 macOS run.

## Historical macOS Playwright Verification — Previous Working Tree

The owner previously executed the updated `TEST-F07-12` registration-card locators against an uncommitted working tree. That run is retained as historical evidence; the clean-tree `6c50a02` run above is authoritative for the latest verification.

The previously uncommitted Playwright change replaced programmatic focus with keyboard `Enter` activation and Back navigation assertions; it is included in the corrected 2026-11-26 owner run above.

The additional `TEST-F07-11` loading/error/retry cases were included in the corrected 10/10 owner run; they were not executed in this Codex environment.

| Command / check | Result |
|---|---|
| Targeted F-07 Playwright | 2 passed, 0 failed (`TEST-F07-11` Organizer and `TEST-F07-12` Participant) |
| Full Playwright E2E | 22 passed, 0 failed |
| Server TypeScript build | PASS |
| `git diff --check` | PASS |

These results are separate historical evidence and must not be retroactively attributed to `6c50a02`.

## Regression and API compatibility

F-03/F-04/F-05/F-06 regressions are covered by the reported full server and Playwright suites. The accepted F-04 response remains the original five-field shape; this implementation does not add `cancelledAt`. F-07 history therefore displays the participant, CANCELLED status and original registration timestamp, while cancellation time remains unavailable unless a separately approved response is introduced.
