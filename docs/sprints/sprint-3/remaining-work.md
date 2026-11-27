# F-08 Progress and Sprint 3 Remaining Work

**Snapshot:** 2026-11-27
**Target completion:** 2026-12-13
**Current baseline:** feature/f08-registration-attendance-summary at 21669b9b902967219724d8a62d29574f3ff0c987, based on origin/sprint-2-staging.
**F-08 contract status:** Draft v0.1 Review Ready at [F-08 contract](f-08-registration-attendance-summary.md); D-10/BR-18 approval, Student 1 review, Sprint 2 release dependency, and Sprint 3 PR target remain unresolved. No F-08 implementation was started in this task.

## Sprint 3 scope and contract coverage

The [Feature Inventory](../../features.md) allocates F-01 to F-04 to Sprint 1, F-05 to F-07 to Sprint 2, and F-08 as the only new feature in Sprint 3. The [SRS](../../srs.md) Sprint 3 row allocates FR-22, FR-23, BR-18, final cross-product NFR verification, and NFR-07 quantitative measurement. The [Sprint Plan](../plan.md) explicitly includes F-01 to F-07 only for integration, regression, and defect correction, not as new Sprint 3 scope. No additional product feature is proposed.

The complete F-08 Feature-Level SDS, UI/API/data proposals, draft AC-F08-01 to 06, planned TEST-F08-01 to 07, DoD, and decision history are in the linked contract. The [Group Work Specification](../../group_work_specs_v1.pdf) requires feature contracts before implementation with Feature-Level SDS, applicable UI/API/data specs, stable AC, STS, DoD, and evidence links (Section 8.2, page 10); Sprint 3 contracts, working progress, and remaining work are required at the 29 November checkpoint (Section 7, page 9; Deliverable 2 Part C, page 12). The repository copy is labelled a draft for instructor review.

| Remaining item | Sprint 3 contract/evidence coverage |
| --- | --- |
| F-08 | Draft contract v0.1 covers the feature design. D-10/BR-18 and peer review are pending; no feature code is authorized by this draft. |
| SR-01 | F-08 owner/role/privacy design and TEST-F08-05. |
| SR-02 | Single-statement PostgreSQL snapshot, aggregate reconciliation, read-only behavior, and TEST-F08-02 to 04. Whole-product regression remains. |
| SR-03 | Loading/empty/error/retry/refresh, keyboard, responsive behavior, TEST-F08-06/07, and final manual viewport review. |
| SR-04 | Contract history, approved decisions, AC-to-actual-test evidence, tested SHA, substantive peer review, and release record. Peer review is not yet recorded. |
| SR-05 | Existing shared deployment responsibility; no new F-08 configuration or secret is proposed. Exact candidate/deployment evidence remains open. |
| SR-06 | Existing NFR-07 workload for F-03 operations, not a new feature or F-08 performance target. D-12 approval and TEST-SR06-01 are pending. |

**Part C status:** The full remaining-feature contract content is prepared and prior meaningful database-backed summary progress is documented below. The contract is not yet reviewed or accepted; the pending approvals are a gate. Do not proceed with F-08 implementation or describe Part C as fully accepted until policy decisions and Student 1 review are recorded.

**Sprint 2 baseline status:** F-05 to F-07 contracts and their implementation are integrated in staging. Formal Sprint 2 release acceptance and a release tag are not recorded. The Sprint 3 plan lists an integrated Sprint 2 release as a prerequisite; disposition is pending. The current GitHub Actions PR workflow covers sprint-1-staging, sprint-2-staging, and main. No sprint-3-staging branch/CI target exists, so the F-08 PR base must be agreed by the team.

## Verified F-08 progress

F-08 is **PARTIAL**, not accepted or complete. A meaningful part of its domain behavior is already present in the Organizer registration view: the client derives active registrations, cancelled history, checked-in active registrations, not-checked-in active registrations, remaining seats, and total registration records from the existing F-04 registration and F-07 attendance responses.

The currently tested slice exercises the rule that cancelled historical rows do not consume capacity or count as active attendance, and that check-in reduces only the active not-checked-in count:

| Evidence | What it actually verifies | Result / tested version |
| --- | --- | --- |
| [`client/src/App.test.tsx`](../../../client/src/App.test.tsx), `TEST-F07 metrics exclude cancelled history from active attendance` | Mocked component data with one ACTIVE row, two CANCELLED history rows, no Attendance, and capacity five renders Active 1, Cancelled 2, Checked in 0, Not checked in 1, Remaining 4, Total records 3. | Included in the Issue 15 client suite, 29 passed on `107c93eafbc5c2afb29527336665a6d38269c478`. This is a F-07-labelled component test, not a formal F-08 STS. |
| [`e2e/f06-registration-cancellation.spec.ts`](../../../e2e/f06-registration-cancellation.spec.ts), `TEST-F06-15/TEST-I15-E2E-01` | Real UI/API/isolated-PostgreSQL journey publishes/updates an Event, registers, cancels, re-registers, checks in, and checks displayed summary counts before/after attendance and reload. The checked-in registration remains ACTIVE and cancelled history remains. | 1 focused pass and included in the full 30/30 E2E run on `107c93e`. |

These records demonstrate tested Sprint 3 progress for a useful subset of lifecycle counts. They do not establish the complete accepted F-08 behavior: D-10 and BR-18 remain proposed; the F-08 contract/AC/STS now exist only as an unaccepted draft; there is no dedicated summary endpoint; and no attendance-rate or zero-active N/A result is shown. Counts are currently derived in the client from separate registration and attendance requests; no single consistent-snapshot guarantee is implemented or tested for F-08.

### Draft AC status against actual baseline evidence

The AC IDs below are draft proposals. The baseline evidence predates this contract and is mapped as progress evidence only. No TEST-F08 or TEST-SR06 case has been executed.

| Draft AC | Baseline implementation/evidence status | Actual executed test record | Planned draft test |
| --- | --- | --- | --- |
| AC-F08-01 | PARTIAL. Client filters persisted F-04 Registration rows into ACTIVE and CANCELLED counts; historical cancelled rows are represented separately. | client/src/App.test.tsx, test named “TEST-F07 metrics exclude cancelled history from active attendance”: component input was mocked; included in command npm.cmd test, client 29 passed, commit 107c93eafbc5c2afb29527336665a6d38269c478. Real-data lifecycle case e2e/f06-registration-cancellation.spec.ts, TEST-F06-15/TEST-I15-E2E-01, passed 1/1 within npm.cmd run test:e2e -- --workers=1 --reporter=line (30 passed total) at the same commit. | TEST-F08-01, 02, 03, 07 - NOT RUN |
| AC-F08-02 | PARTIAL. Client computes capacity minus ACTIVE rows; cancelled rows do not consume a place in the tested view. | The same component assertion and joined PostgreSQL E2E case above; historical result only. | TEST-F08-01, 02, 07 - NOT RUN |
| AC-F08-03 | PARTIAL. Client joins owner-scoped attendance data by Registration and excludes CANCELLED rows from current attendance metrics. | The component test checks cancelled exclusion with no Attendance; joined TEST-I15-E2E-01 verifies the persisted check-in changes the displayed metric and reloads. The test did not cover duplicate Attendance rows or a formal F-08 API. | TEST-F08-01, 02, 03, 07 - NOT RUN |
| AC-F08-04 | NOT IMPLEMENTED / NOT VERIFIED. No rate calculation or zero-active N/A display exists. | No matching test or API result found. | TEST-F08-01, 06, 07 - NOT RUN |
| AC-F08-05 | NOT VERIFIED for F-08. Existing F-04/F-07 routes have owner checks, but no F-08 summary route exists to test directly. | Existing F-04/F-07 authorization cases do not establish security behavior for a new summary endpoint. | TEST-F08-05, 07 - NOT RUN |
| AC-F08-06 | PARTIAL historical progress evidence. A real UI/API/isolated-PostgreSQL journey exercised registration, cancellation, re-registration, check-in, summary counts, and reload. This does not close an accepted F-08 criterion. | TEST-F06-15/TEST-I15-E2E-01 passed 1/1, within 30/30 Playwright E2E; command and commit are recorded in the AC-F08-01 row and [Issue 15 integration evidence](../sprint-2/integration-verification.md). | TEST-F08-02, 03, 07 - NOT RUN |

No new screenshots were created. No new API response or test output is claimed. The existing E2E result and test source are the available program evidence for the partial count workflow.

## Accepted policy and implementation boundary

| Item | Status | Evidence / implication |
| --- | --- | --- |
| FR-22 / FR-23 | Planned Must requirements for Sprint 3 in the SRS; their detailed summary policy is unresolved. | Keep IDs and allocation. Do not claim all requirements are accepted or fully implemented. |
| D-10 / BR-18 | PROPOSED. | Require recorded team decision on historical cancelled-record counts, active-only attendance numerator/denominator, one-decimal rate, zero-active N/A, consistency, and owner authorization before accepting the F-08 contract. |
| F-08 contract | Draft v0.1 Review Ready; NOT ACCEPTED. | Obtain team decisions and Student 1 review, record findings/dispositions, and accept/revise the contract before F-08 implementation. |
| Partial UI-derived counts | IMPLEMENTED and partially TESTED through F-07 view. | See the two executed tests above. No separate F-08 release or acceptance is claimed. |
| Attendance rate, zero-active case, consistent snapshot, report privacy, API behavior | NOT IMPLEMENTED OR VERIFIED as F-08. | Complete after policy and contract approval; keep owner scoping on the server if a summary API is introduced. |

The historical domain-count slice is meaningful Sprint 3 implementation progress. It does not complete F-08. Contract content is now prepared, while policy approval, peer review, implementation, verification, and release work remain.

## Remaining-work plan

Owners below are **proposed assignments**, not a record of accepted team allocation. The repository identifies Student 1 as the Issue 16 reviewer but does not record a named owner for Issue 18. Confirm the owners in the project issue tracker and revise this table if needed. Target dates are planning targets no later than 13 December 2026.

| Feature / AC / gap ID | Current status | Completed and verified work | Missing implementation or verification | Dependencies | Next action | Responsible student (proposed) | Target date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-08 / D-10 / BR-18 / REVIEW-F08-01 | DRAFT REVIEW READY; policy and peer review pending | Draft contract v0.1 contains scope, design, AC, STS, DoD, history, and gates | Record team approval/revision of D-10/BR-18; Student 1 substantive review; resolve Sprint 2 release and Sprint 3 PR-target dependencies | Integrated Sprint 2 code baseline; policy decisions; reviewer; integration target | Update SRS/contract with actual decision and review evidence before implementation | Team; Student 1 review; individual author to confirm | 2026-11-29 |
| F-08 summary implementation | PARTIAL; implementation gate open | Client derives lifecycle/capacity counts from existing F-04/F-07 responses | Approved summary API and UI rate/N/A/consistent snapshot behavior | Accepted D-10/BR-18 and F-08 contract; Sprint 2 dependency and PR target | Implement after all gates are recorded; do not alter F-05/F-06/F-07 behavior | Owner to confirm | 2026-12-06 |
| F-08 AC/STS verification | NOT RUN for draft TEST-F08 IDs | Historical F-07 metrics component and joined E2E results on 107c93e are documented above | Execute draft tests after review, update IDs/wording if contract changes, cover database math, zero active, security, UI, lifecycle, snapshot, and regression | Accepted contract and implementation | Run against isolated PostgreSQL and UI; record exact commands, counts, results, and SHA; mark unrun tests NOT RUN | Owner/reviewer to confirm | 2026-12-09 |
| LAB6-GAP-01 / LAB7-GAP-01 / UAT-GAP-01 | OPEN EVIDENCE GAP | Sprint 1 UAT test/handoff/execution templates exist on the Sprint 1 staging history; UAT execution remains NOT RUN | Lab 6 and Lab 7 reports were not found in inspected refs; UAT lacks URL/revision/run/sign-off | Locate source submissions; identify safe non-production test revision | Review actual Lab/UAT submissions, record each finding and re-test, or explicitly report unavailable evidence | Student 1 + Student 2; assignment to confirm | 2026-12-03 |
| NFR-07 / SR-06 | PROPOSED TARGET; measurement not run | Workload/method is documented in SRS/F-03 contract; TEST-SR06-01 is planned in the F-08 contract coverage | Team approval/revision of numerical target and actual benchmark with p95, counts, errors, environment, and persisted outcomes | Stable integrated candidate and realistic fixtures | Confirm target; run the accepted workload on real API/database and record results | Owner/reviewer to confirm | 2026-12-10 |
| Issue 17 candidate regression and release | Release acceptance not recorded | Issue 15 reports 87/87 PostgreSQL integration, 30/30 Playwright and passing build/typecheck/Prisma checks on 107c93e; CI run 45869394130 passed on corrected head | Repeat required full suite on exact candidate, record release decision, tag/commit, and any remaining defects | PR #61 staging integration; exact candidate commit | Record candidate SHA, test commands/counts/skips, review/release decision, GCP deployment/revision and smoke/persistence evidence or mark unavailable | Student 1 + Student 2; reviewer/author split to record | 2026-12-12 |
| Deliverable 2 self-contained PDF | NOT ASSEMBLED in Issue 16 | Repository documentation and evidence map prepared | Copy complete engineering documents/evidence into one PDF, then assign real page numbers and verify pages | Issue 17 completion and approved final candidate | Assemble, render and inspect PDF; fill page references in the evidence map after assembly | Student 1 + Student 2 | 2026-12-13 |

## Source links

- [SRS](../../srs.md), [Feature Inventory](../../features.md), and [Requirements Traceability Matrix](../../traceability.md).
- [System-Level SDS](../../system-sds.md) and [Sprint plan](../plan.md).
- [F-08 draft contract](f-08-registration-attendance-summary.md), [Issue 18 PR description draft](issue-18-pr-description.md), and [Group Work Specification](../../group_work_specs_v1.pdf).

## AI-use declaration

OpenAI Codex assisted repository and Group Work Specification review, Sprint 3 scope/traceability analysis, and drafting of the F-08 Feature-Level SDS, proposed AC/STS, DoD, and evidence/status updates on 2026-11-27. Both students remain responsible for checking the source, approving policy decisions, reviewing the draft, and supervising any later implementation and test execution. No F-08 runtime code or test implementation was produced in this task.
- [Sprint 2 AC verification](../sprint-2/ac-verification.md) and [Issue 15 integration evidence](../sprint-2/integration-verification.md).
- [Issue 16 Deliverable 2 rubric-to-evidence map](../../deliverable-2-evidence-map.md).
