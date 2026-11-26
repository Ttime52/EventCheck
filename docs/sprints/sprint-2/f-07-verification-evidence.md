# F-07 Verification Evidence

This document records the current implementation evidence for F-07 without changing the accepted contract or STS definitions.

## Review snapshot

- Branch: `feature/51-f07-check-in-attendance`
- Confirmed tested implementation commit: `6c50a024ee682f7b3d2fb968d663805336867ec3`
- Working tree at review start: clean.
- The latest confirmed macOS run below was executed at commit `6c50a024ee682f7b3d2fb968d663805336867ec3`; any later documentation-only commit is separate.

## Evidence matrix

| AC | Accepted STS | Executable evidence | Result | Limitation |
|---|---|---|---|---|
| AC-F07-01 | TEST-F07-01, TEST-F07-11 | `server/src/f07.integration.test.ts` owner check-in assertions; `e2e/f07-check-in.spec.ts` Organizer journey | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-02 | TEST-F07-01, TEST-F07-11 | API Attendance association assertions and Organizer status/timestamp assertions | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-03 | TEST-F07-02, TEST-F07-11 | Time-window API/UI boundaries | PARTIAL — API boundaries executed | Browser before/during/after eligibility and clock-skew cases are not separately evidenced |
| AC-F07-04 | TEST-F07-03 | `server/src/f07.integration.test.ts` cancelled, unregistered, nonexistent-registration and wrong-Event assertions with no unauthorized Attendance writes | PARTIAL — latest macOS evidence | Core invalid-association cases executed; any remaining contract-specific edge case must be verified from the individual assertions |
| AC-F07-05 | TEST-F07-04 | `server/src/f07.integration.test.ts` unauthenticated, expired/revoked-session, role, ownership and Origin/CSRF assertions | PARTIAL — latest macOS evidence | Authorization matrix executed; full STS privacy/error-response permutations are not independently documented as separate cases |
| AC-F07-06 | TEST-F07-05 | `server/src/f07.integration.test.ts` duplicate prevention and persisted Attendance retrieval | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-07 | TEST-F07-06, TEST-F07-11 | Multi-event scoping, ordering, empty state and ownership isolation in `server/src/f07.integration.test.ts`; Organizer retry assertions and browser journey | PARTIAL — latest macOS evidence | Aggregate browser result does not independently evidence every accepted loading/error/retry permutation |
| AC-F07-08 | TEST-F07-07, TEST-F07-12 | Participant API retrieval plus scoped Checked In/Not Checked In assertions before and after reload | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-09 | TEST-F07-08 | Application restart persistence | PASS — TEST-F07-08 exit code 0 | Tested at `6c50a02` |
| AC-F07-10 | TEST-F07-09 | Cancellation/check-in race and lock contention | PASS — both PostgreSQL scenarios | Tested at `6c50a02` |
| AC-F07-11 | TEST-F07-10 | API transaction rollback and recovery | PASS — confirmed macOS run | Tested at `6c50a02` |
| AC-F07-12 | TEST-F07-11, TEST-F07-12 | Organizer/Participant browser assertions, including CANCELLED history, exact ACTIVE/CANCELLED card scoping, absence of Participant check-in controls, Checked In/Not Checked In persistence after reload, keyboard focus and status feedback | PARTIAL — confirmed macOS run | Empty/error/retry and complete privacy/accessibility matrix are not all independently evidenced |

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

This is the latest tested implementation revision. Any subsequent documentation-only commit must not be represented as the tested implementation SHA.

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

Reported commands were the server suite with `--no-file-parallelism`, the F-07 integration run, `node server/scripts/f07-restart-check.mjs`, `npm run test --workspace client`, `npm run test:e2e`, typecheck, build and `git diff --check`. The owner also reported the two F-07 browser cases individually passing within the full browser run.

## Remaining coverage gaps

- AC-F07-03: executable API boundary coverage is present, but separate browser eligibility checks for before-start, in-window, and at/after-end behavior are not individually evidenced.
- AC-F07-04: the newly executed invalid-association and nonexistent-registration assertions are recorded; any additional STS edge case not represented by those assertions remains open.
- AC-F07-05: expired/revoked-session and authorization assertions were executed; remaining gap is independent evidence for every required protected-information/error permutation.
- AC-F07-07: multi-event scoping, ordering, ownership isolation and retry assertions were executed; every documented loading/error variant is not independently mapped.
- AC-F07-12: browser coverage now includes CANCELLED history and participant attendance persistence; empty/error/retry and complete privacy/keyboard matrix remains partial.

Historical uncommitted working-tree results are kept separate from the confirmed clean-tree macOS run at `6c50a02`. The current Codex environment did not execute PostgreSQL or browser tests. Aggregate suite totals do not convert an AC to full PASS when mandatory STS sub-scenarios are not independently asserted.

## Assertion-level audit for PR #60

- **AC-F07-03:** `TEST-F07-02: enforces exact check-in window boundaries` covers before-start and exact-end rejection, while `TEST-F07-02: accepts check-in exactly at Event start` covers the start boundary. Browser before/during/after button eligibility and clock-skew behavior are not independently asserted; PARTIAL remains.
- **AC-F07-04:** `TEST-F07-03: rejects cancelled check-ins`, `TEST-F07-04: preserves associations and safe validation outcomes`, and the nonexistent-registration assertion in the authorization matrix cover cancelled, mismatched Event, malformed/unregistered and nonexistent IDs with no Attendance writes. Any additional response-code permutation remains PARTIAL.
- **AC-F07-05:** `TEST-F07-01`, the unauthenticated/wrong-role/non-owner/CSRF matrix, and `TEST-F07-04: rejects expired and revoked sessions...` cover the required authorization paths. The complete STS response/privacy permutation is not independently enumerated; PARTIAL remains.
- **AC-F07-07:** `TEST-F07-06: scopes Organizer attendance retrieval by Event with stable ordering` covers multi-event scope, deterministic ordering, empty Event and ownership isolation. `TEST-F07 attendance loading error preserves registrations and exposes retry` covers frontend retry. Other UI loading/error permutations are not all separately executed; PARTIAL remains.
- **AC-F07-12:** `TEST-F07-11` and `TEST-F07-12` cover Organizer check-in, CANCELLED history, scoped attendance persistence after reload and focus assertions. The updated Participant journey additionally asserts exact fixture-card identity, absence of Participant self-check-in controls, and keyboard focus on the selected card; these additions passed in the confirmed `6c50a02` run. Empty/error/retry and complete privacy/keyboard matrix is not independently covered; PARTIAL remains.

## Current-session verification

Executed against the current checkout (without database access):

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run test --workspace client` — 29/29 PASS
- `npx playwright test e2e/f07-check-in.spec.ts --list` — 2 tests discovered; browser execution NOT RUN because the isolated database URL was not configured
- `git diff --check` — PASS

Database-backed and browser execution was **NOT RUN** in this environment because both `DATABASE_URL` and `E2E_DATABASE_URL` were unset; no database target could be verified safely. The 16/16, 128/128 and 22/22 results above remain owner-reported for the clean-tree commit `6c50a02`.

The previously uncommitted Playwright additions are included in the confirmed `6c50a02` run; no current uncommitted test result is being claimed here.

## Historical macOS Playwright Verification — Previous Working Tree

The owner previously executed the updated `TEST-F07-12` registration-card locators against an uncommitted working tree. That run is retained as historical evidence; the clean-tree `6c50a02` run above is authoritative for the latest verification.

The current uncommitted Playwright change replaces programmatic focus with keyboard `Enter` activation and Back navigation assertions in `e2e/f07-check-in.spec.ts`; it requires a fresh macOS browser run and is not counted as PASS here.

| Command / check | Result |
|---|---|
| Targeted F-07 Playwright | 2 passed, 0 failed (`TEST-F07-11` Organizer and `TEST-F07-12` Participant) |
| Full Playwright E2E | 22 passed, 0 failed |
| Server TypeScript build | PASS |
| `git diff --check` | PASS |

These results are separate historical evidence and must not be retroactively attributed to `6c50a02`.

## Regression and API compatibility

F-03/F-04/F-05/F-06 regressions are covered by the reported full server and Playwright suites. The accepted F-04 response remains the original five-field shape; this implementation does not add `cancelledAt`. F-07 history therefore displays the participant, CANCELLED status and original registration timestamp, while cancellation time remains unavailable unless a separately approved response is introduced.
