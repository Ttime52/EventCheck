# Issue 18 - PR Description Draft

**Purpose:** Contract-review PR text prepared for Issue 18. This draft is not a submitted GitHub PR.

## Proposed title

Draft F-08 registration and attendance summary contract for review

## Base branch

**Pending team decision.** The feature branch was already created from origin/sprint-2-staging at 21669b9b902967219724d8a62d29574f3ff0c987. No sprint-3-staging branch exists in the inspected refs. The current GitHub Actions pull_request trigger covers sprint-1-staging, sprint-2-staging, and main only. Confirm the Sprint 3 PR target and CI behavior before opening the PR.

## Summary

- Adds a review-ready F-08 Feature-Level SDS for the only new product feature allocated to Sprint 3.
- Specifies proposed owner-only summary API, PostgreSQL aggregate/snapshot approach, metrics, UI states, draft AC-F08-01 to 06, planned TEST-F08-01 to 07, DoD, dependencies, and decision history.
- Audits the remaining Sprint 3 system responsibilities SR-01 to SR-06. F-01 to F-07 remain regression/integration scope only.
- Updates SRS status history, Feature Inventory, traceability, Sprint Plan, System-Level SDS, and Deliverable 2 evidence map to identify the draft and keep proposed policies separate from accepted behavior.
- Records the current policy/release/PR-target gates before feature implementation.

## Contract and decision status

- D-10 and BR-18 remain Proposed. The contract draft is not accepted.
- Q-10 is accepted for synthetic project and assessment history only; no production retention policy is inferred.
- Student 1 is the requested reviewer, but no substantive review record exists in this draft.
- No API, UI, database schema, migration, or runtime code is implemented by this documentation change.

## Proposed API/database/UI

- Proposed read-only GET /api/v1/organizer/events/{eventId}/summary, protected by session, Organizer role, and Event ownership.
- Proposed one parameterized PostgreSQL statement through Prisma, selecting Event capacity and aggregate counts from the same statement snapshot.
- Proposed metrics: capacity, active and cancelled Registration record counts, remaining seats, checked-in and not-checked-in ACTIVE counts, and one-decimal attendance rate. API rate is null when activeCount is zero; UI renders N/A.
- Proposed safe 401/403/404 outcomes and generic 500 errors, with no Participant-level fields in the summary response.
- Proposed integration in OrganizerRegistrationsView with loading, empty, error, retry, refresh, and accessible keyboard behavior. F-04 active/history list separation and F-07 controls remain intact.

These are review proposals, not implemented or accepted behavior. See the contract for exact request/response shapes, AC, STS, and DoD.

## AC-to-test coverage

| Draft AC | Planned test coverage | Current execution status |
| --- | --- | --- |
| AC-F08-01 | TEST-F08-01/02/03/07 | Partial historical F-07/F-06 count evidence only; draft tests NOT RUN. |
| AC-F08-02 | TEST-F08-01/02/07 | Partial historical count evidence; draft tests NOT RUN. |
| AC-F08-03 | TEST-F08-01/02/03/07 | Partial historical attendance count evidence; draft tests NOT RUN. |
| AC-F08-04 | TEST-F08-01/06/07 | Rate and zero-active behavior not implemented; NOT RUN. |
| AC-F08-05 | TEST-F08-05/07 | No F-08 endpoint exists; direct F-08 authorization tests NOT RUN. |
| AC-F08-06 | TEST-F08-02/03/07 | Historical meaningful workflow passed in TEST-I15-E2E-01; not a formal F-08 test execution or accepted AC closure. |

TEST-SR06-01 is separately planned for Sprint 3 SR-06/NFR-07 measurement and does not add a feature or a summary API performance target.

## Actual evidence and verification

- Historical progress: client/src/App.test.tsx test "TEST-F07 metrics exclude cancelled history from active attendance" used mocked component input and passed as part of 29 client tests under npm.cmd test on implementation commit 107c93eafbc5c2afb29527336665a6d38269c478.
- Historical database-backed progress: e2e/f06-registration-cancellation.spec.ts, TEST-F06-15/TEST-I15-E2E-01, passed 1/1 within 30/30 Playwright E2E using npm.cmd run test:e2e -- --workers=1 --reporter=line on the same implementation commit. It exercised persisted registration, cancellation, re-registration, check-in, displayed counts, and reload.
- These older F-07/F-06-labeled results demonstrate partial progress only. They do not execute the newly drafted TEST-F08 cases or test a summary endpoint.
- No application tests, typecheck, build, PostgreSQL summary test, or Playwright run were performed for this documentation-only draft. No screenshots or new API results were produced.
- Current documentation branch baseline is 21669b9b902967219724d8a62d29574f3ff0c987. This is not a newly tested F-08 implementation SHA.

## Remaining work and target dates

- By 2026-11-29: approve or revise D-10/BR-18; record Student 1 review; confirm Sprint 2 release dependency and Sprint 3 PR target.
- By 2026-12-06: after gates, implement the accepted F-08 API/UI behavior without changing F-05/F-06/F-07 behavior.
- By 2026-12-09: execute accepted AC-linked unit, isolated PostgreSQL, security, UI, and E2E tests; record all commands/results/commit SHA.
- By 2026-12-10: approve or revise D-12/NFR-07 target and run or explicitly leave the quantitative performance measurement open.
- By 2026-12-12: repeat final candidate integration/regression/release verification and report defects, skips, and deployment evidence.
- By 2026-12-13: complete the final release and report any residual debt.

## Reviewer checklist

- Confirm F-08 is the only new Sprint 3 feature and SR-01 to SR-06 are covered without adding scope.
- Review each proposed D-10/BR-18 definition, especially cancelled record counting, rate rounding/null behavior, single-snapshot semantics, and owner visibility.
- Review F-08 AC and STS against the existing Prisma schema, API envelopes, authorization behavior, and accepted F-05/F-06/F-07 contracts.
- Confirm tests include real isolated PostgreSQL data, unauthorized/cross-owner requests, cancellation/re-registration, check-in, concurrent change, zero-active, refresh/reload, and no summary writes.
- Record specific findings/questions and dispositions. Do not mark the contract accepted until team policy decisions and review are recorded.
- Confirm release/branch/CI target before any feature implementation PR is opened.

## Approval gate

This contract-review draft is ready for Student 1 review. F-08 implementation and feature integration remain blocked by unapproved D-10/BR-18, missing review evidence, unresolved Sprint 2 release dependency, and unresolved Sprint 3 PR target. No review, acceptance, PR submission, integration, or merge is claimed.
