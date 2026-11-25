# F-07 Verification Evidence

This document records the current implementation evidence for F-07 without changing the accepted contract or STS definitions.

## Review snapshot

- Branch: `feature/51-f07-check-in-attendance`
- Current HEAD (not claimed as the macOS tested revision): `d3c52a24e6f4e0dda728577b246141d0a979d95b`
- Working tree at review start: clean.
- The owner-reported macOS results below are recorded separately from this HEAD because no tested SHA was supplied.

## Evidence matrix

| AC | Accepted STS | Executable evidence | Result | Limitation |
|---|---|---|---|---|
| AC-F07-01 | TEST-F07-01, TEST-F07-11 | `server/src/f07.integration.test.ts` owner check-in assertions; `e2e/f07-check-in.spec.ts` Organizer journey | PASS — latest macOS evidence | Exact tested SHA not supplied |
| AC-F07-02 | TEST-F07-01, TEST-F07-11 | API Attendance association assertions and Organizer status/timestamp assertions | PASS — latest macOS evidence | Exact tested SHA not supplied |
| AC-F07-03 | TEST-F07-02, TEST-F07-11 | Time-window API/UI boundaries | PARTIAL — API boundaries executed | Browser before/during/after eligibility and clock-skew cases are not separately evidenced |
| AC-F07-04 | TEST-F07-03 | `server/src/f07.integration.test.ts` cancelled, unregistered, nonexistent-registration and wrong-Event assertions with no unauthorized Attendance writes | PARTIAL — latest macOS evidence | Core invalid-association cases executed; any remaining contract-specific edge case must be verified from the individual assertions |
| AC-F07-05 | TEST-F07-04 | `server/src/f07.integration.test.ts` unauthenticated, expired/revoked-session, role, ownership and Origin/CSRF assertions | PARTIAL — latest macOS evidence | Authorization matrix executed; full STS privacy/error-response permutations are not independently documented as separate cases |
| AC-F07-06 | TEST-F07-05 | `server/src/f07.integration.test.ts` duplicate prevention and persisted Attendance retrieval | PASS — latest macOS evidence | Exact tested SHA not supplied |
| AC-F07-07 | TEST-F07-06, TEST-F07-11 | Multi-event scoping, ordering, empty state and ownership isolation in `server/src/f07.integration.test.ts`; Organizer retry assertions and browser journey | PARTIAL — latest macOS evidence | Aggregate browser result does not independently evidence every accepted loading/error/retry permutation |
| AC-F07-08 | TEST-F07-07, TEST-F07-12 | Participant API retrieval plus scoped Checked In/Not Checked In assertions before and after reload | PASS — latest macOS evidence | Exact tested SHA not supplied |
| AC-F07-09 | TEST-F07-08 | Application restart persistence | PASS — TEST-F07-08 exit code 0 | Owner-reported; exact tested SHA not supplied |
| AC-F07-10 | TEST-F07-09 | Cancellation/check-in race and lock contention | PASS — both PostgreSQL scenarios | Owner-reported; exact tested SHA not supplied |
| AC-F07-11 | TEST-F07-10 | API transaction rollback and recovery | PASS | Owner-reported; exact tested SHA not supplied |
| AC-F07-12 | TEST-F07-11, TEST-F07-12 | Organizer/Participant browser assertions, including CANCELLED history, scoped Checked In/Not Checked In persistence after reload, keyboard focus and status feedback | PARTIAL — latest macOS evidence | Empty/error/retry and complete privacy/accessibility matrix are not all independently evidenced |

## Historical macOS verification

The feature owner reported, against the then-tested working tree:

- Server/PostgreSQL: 123/123 PASS
- F-07 integration: 11/11 PASS
- Frontend Vitest: 28/28 PASS
- Playwright: 22/22 PASS
- TypeScript and production build: PASS
- `git diff --check`: PASS

These are historical results and are not claimed as execution in the current environment. The tested SHA must be recorded from the corresponding macOS run; this document does not invent a SHA.

## Latest owner-reported macOS verification (2026-11-25)

The feature owner reports the following latest run against isolated `127.0.0.1:5433/eventcheck_test?schema=public`:

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

These results are owner-provided and are kept separate from execution in this environment. They were run against isolated `127.0.0.1:5433/eventcheck_test?schema=public`. The exact tested commit SHA was not provided, so this document does not invent one.

Reported commands were the server suite with `--no-file-parallelism`, the F-07 integration run, `node server/scripts/f07-restart-check.mjs`, `npm run test --workspace client`, `npm run test:e2e`, typecheck, build and `git diff --check`. The owner also reported the two F-07 browser cases individually passing within the full browser run.

## Remaining coverage gaps

- AC-F07-03: executable API boundary coverage is present, but separate browser eligibility checks for before-start, in-window, and at/after-end behavior are not individually evidenced.
- AC-F07-04: the newly executed invalid-association and nonexistent-registration assertions are recorded; any additional STS edge case not represented by those assertions remains open.
- AC-F07-05: expired/revoked-session and authorization assertions were executed; remaining gap is independent evidence for every required protected-information/error permutation.
- AC-F07-07: multi-event scoping, ordering, ownership isolation and retry assertions were executed; every documented loading/error variant is not independently mapped.
- AC-F07-12: browser coverage now includes CANCELLED history and participant attendance persistence; empty/error/retry and complete privacy/keyboard matrix remains partial.

The latest macOS results are owner-reported for the working-tree implementation; the current Codex environment did not execute PostgreSQL or browser tests. Aggregate suite totals do not convert an AC to full PASS when mandatory STS sub-scenarios are not independently asserted.

## Current-session verification

Executed against the current checkout (without database access):

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run test --workspace client` — 29/29 PASS
- `npx playwright test e2e/f07-check-in.spec.ts --list` — 2 tests discovered; browser execution NOT RUN because the isolated database URL was not configured
- `git diff --check` — PASS

## Regression and API compatibility

F-03/F-04/F-05/F-06 regressions are covered by the reported full server and Playwright suites. The accepted F-04 response remains the original five-field shape; this implementation does not add `cancelledAt`. F-07 history therefore displays the participant, CANCELLED status and original registration timestamp, while cancellation time remains unavailable unless a separately approved response is introduced.
