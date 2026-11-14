# F-02 Implementation Evidence

This file records verification for F-02 implementation Issue #9 and PR #17. The F-02 Engineering Contract is version 0.4 and Approved/Accepted for Implementation; contract acceptance does not mark the feature Done, merged, or released.

## Tested revisions

- Branch: `feature/07-event-creation-publishing`
- PR: [#17](https://github.com/Ttime52/EventCheck/pull/17), base `sprint-1-staging`, closing reference `Closes #9`
- PR #17 tested commit: `46e4de9663799dc3c519d934f6a10acfd3852fe9` (`feat: event creation and publishing`)
- Local follow-up base: `ebd18d706f40af3373cc518678693bd8bd5d59c3` (`feat: event detail read-only`)
- Current targeted browser-test additions: uncommitted working-tree changes; not yet pushed to PR #17.

The PR #17 baseline evidence is tied to the exact tested SHA above. The local follow-up verification is reported separately and does not claim that the uncommitted browser additions are already present in PR #17.

## TDD evidence

The validation unit test was run before its implementation existed:

```text
& 'node_modules/.bin/vitest.cmd' run server/src/events.test.ts
Error: Cannot find module './events.js'
```

After `server/src/events.ts` was implemented, the same command passed with 3 tests. The red/green sequence was run against the uncommitted working tree above; no fabricated commit hash is assigned to either step.

## AC-to-test evidence

| Acceptance criteria | Test IDs / evidence | Result |
| --- | --- | --- |
| AC-F02-01 | TEST-F02-01; `client/src/App.test.tsx`; F-02 Playwright form and keyboard tests | Pass at PR baseline and final full Playwright rerun; keyboard reachability verified across all form controls |
| AC-F02-02 | TEST-F02-02; `server/src/events.integration.test.ts`; F-02 Playwright publish/reload flow | Pass at PR #17 tested commit and final full Playwright rerun |
| AC-F02-03 | TEST-F02-03; `server/src/events.test.ts`; API integration; invalid-input browser test | Backend/unit and final full Playwright rerun pass |
| AC-F02-04 | TEST-F02-04; unit and API cases for malformed, timezone-free, equal, and reversed instants | Pass at PR #17 tested commit |
| AC-F02-05 | TEST-F02-05; unit/API cases for omitted, zero, negative, fractional, string, and capacity 1; invalid-capacity browser test | Backend/unit and final full Playwright rerun pass |
| AC-F02-06 | TEST-F02-06; API CSRF/anonymous/Participant cases; Participant and expired-session browser tests | API pass at PR #17 and final full Playwright rerun pass |
| AC-F02-07 | TEST-F02-07; API owner-override rejection and server-derived owner persistence | Pass at PR #17 tested commit |
| AC-F02-08 | TEST-F02-08; API owner filtering, tampered query, and explicit empty list | Pass at PR #17 tested commit |
| AC-F02-09 | TEST-F02-09; API owner/cross-owner/Participant/visitor detail cases; `client/src/App.test.tsx`; Organizer detail browser flow | API/unit and final full Playwright rerun pass |
| AC-F02-10 | TEST-F02-10; API unsupported PATCH and unchanged database snapshot | Pass at PR #17 tested commit |
| AC-F02-11 | TEST-F02-11; F-03 public discovery boundary | Deferred until F-03 integration and Sprint 1 release verification |
| AC-F02-12 | TEST-F02-12; API controlled transaction failure and unchanged row count | Pass at PR #17 tested commit |
| AC-F02-13 | TEST-F02-13; fresh Prisma client persistence and owner detail retrieval | Pass at PR #17 tested commit |
| AC-F02-14 | TEST-F02-14; accessible Organizer form/list/detail states; `client/src/App.test.tsx`; F-02 Playwright publish, validation, keyboard, role, and session tests | Existing UI/unit, PR baseline, and final full Playwright rerun pass |
| AC-F02-15 | TEST-F02-15; contract history, PR #17, exact tested SHA, commands, counts, and disclosed skips | Contract accepted for implementation; Done/merge/release approval remains pending |

## Commands and results

All commands below were run on 2026-11-14 against the isolated PostgreSQL database `eventcheck_test` on `127.0.0.1:5433` where noted.

| Command | Result |
| --- | --- |
| PR #17 reported verification at `46e4de9663799dc3c519d934f6a10acfd3852fe9` | Unit tests: 13 passed; PostgreSQL integration: 14 passed; Playwright: 10 passed; Prisma validation/generation: passed; typecheck/build: passed |
| `npm.cmd run prisma:validate` | Passed in local follow-up verification |
| `npm.cmd run prisma:generate` | Passed in local follow-up verification |
| `npm.cmd run typecheck` | Passed in local follow-up verification |
| `npm.cmd test` | 15 passed, 14 integration tests skipped without `DATABASE_URL` in local follow-up verification |
| `DATABASE_URL=postgresql://eventcheck@127.0.0.1:5433/eventcheck_test?schema=public npm.cmd run test:integration --workspace server` | 14 passed (7 F-01 + 7 F-02) at the PR #17 tested database revision |
| `npm.cmd run build` | Passed for server and client in local follow-up verification |
| `npx.cmd prisma migrate deploy --schema server/prisma/schema.prisma` with `eventcheck_test` | Applied both checked-in migrations to the isolated E2E database |
| `npm.cmd run db:seed --workspace server` with `eventcheck_test` | Seeded the Demo Participant and Demo Organizer accounts |
| `npm.cmd run test:e2e` with Docker PostgreSQL and root `.env` | Final clean-server rerun: 14 passed, 0 failed, 0 skipped (9 F-01 tests + 5 F-02 tests; 2 workers; 16.3s) |

The final E2E command used the approved elevated local execution path because the restricted Windows sandbox causes `tsx` to fail with `uv_os_get_passwd ... ENOMEM` before the application starts. The missing isolated `eventcheck_test` database was created in Docker, migrated, and seeded with the `eventcheck` database user before the final run. `playwright.config.ts` now loads the ignored root `.env`, derives the isolated E2E URL and seeded account credentials when explicit E2E variables are absent, and normalizes Docker's `localhost` loopback URL. The browser follow-up also scopes the published badge and post-reload location to the current event card, and verifies keyboard reachability without assuming a single Tab transition through Chromium's `datetime-local` control.

## PR scope and issue reference

- The F-01-related changes in PR #17 are limited to exporting the existing `AuthenticatedRequest` type for F-02 route typing and extending the existing integration runner to execute the F-02 suite alongside F-01. Both are required for F-01/F-02 session-authorization integration and should remain in this PR.
- No unrelated F-01 product behavior, session policy, or security rule was changed by F-02.
- The repository issue was verified against GitHub: [Issue #9](https://github.com/Ttime52/EventCheck/issues/9) is titled “Issue 7: [Feature] Event Creation & Publishing”, so `Closes #9` in [PR #17](https://github.com/Ttime52/EventCheck/pull/17) is the correct closing reference.

## Implemented API surface

- `POST /api/v1/events` — Organizer-only, CSRF-protected create-and-publish.
- `GET /api/v1/organizer/events` — authenticated Organizer's published owned events; server-derived ownership.
- `GET /api/v1/organizer/events/:eventId` — owner-only management detail.
- `PATCH /api/v1/organizer/events/:eventId` — explicit Sprint 1 unsupported boundary; no mutation.

F-03 public discovery, PR review/merge approval, and final Sprint 1 release approval remain pending. The F-02 contract review is recorded as accepted for implementation in v0.4; this does not mark F-02 Done.
