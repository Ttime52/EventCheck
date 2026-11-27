# F-08 Progress and Sprint 3 Remaining Work

**Snapshot:** 2026-11-27
**Target completion:** 2026-12-13
**Pre-implementation contract baseline:** `5c8ca563fea5b9a9f87a785de7dde875990838dd` on `feature/f08-registration-attendance-summary`.
**F-08 contract status:** Draft v0.4 at [F-08 contract](f-08-registration-attendance-summary.md); v0.1 was committed before source/test changes. Independent Student 1 review and D-10/BR-18 approval remain unrecorded. The user directly authorized a checkpoint-limited API slice against provisional rules; this is not feature acceptance.
**Implementation status:** Organizer summary API and three unit/isolated-PostgreSQL tests implemented and executed at source commit `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`. Full server PostgreSQL integration passed 90/90, plus typecheck/build/Prisma validation. Peer-reviewed PR, Sprint 3 release integration, and final F-08 acceptance remain pending.

## Sprint 3 scope and contract coverage

The [Feature Inventory](../../features.md) allocates F-01 to F-04 to Sprint 1, F-05 to F-07 to Sprint 2, and F-08 as the only new feature in Sprint 3. The [SRS](../../srs.md) Sprint 3 row allocates FR-22, FR-23, BR-18, final cross-product NFR verification, and NFR-07 quantitative measurement. The [Sprint Plan](../plan.md) explicitly includes F-01 to F-07 only for integration, regression, and defect correction, not as new Sprint 3 scope. No additional product feature is proposed.

The complete F-08 Feature-Level SDS, UI/API/data proposals, draft AC-F08-01 to 06, planned TEST-F08-01 to 07, DoD, and decision history are in the linked contract. The [Group Work Specification](../../group_work_specs_v1.pdf) requires feature contracts before implementation with Feature-Level SDS, applicable UI/API/data specs, stable AC, STS, DoD, and evidence links (Section 8.2, page 10); Sprint 3 contracts, working progress, and remaining work are required at the 29 November checkpoint (Section 7, page 9; Deliverable 2 Part C, page 12). The repository copy is labelled a draft for instructor review.

| Remaining item | Sprint 3 contract/evidence coverage |
| --- | --- |
| F-08 | Draft contract v0.4 covers the feature design, AC, STS, and DoD. A bounded Organizer summary API is implemented against provisional rules; D-10/BR-18, peer review, and feature acceptance remain pending. |
| SR-01 | F-08 owner/role/privacy design and TEST-F08-05. |
| SR-02 | Single-statement PostgreSQL snapshot, aggregate reconciliation, read-only behavior, and TEST-F08-02 to 04. Whole-product regression remains. |
| SR-03 | Loading/empty/error/retry/refresh, keyboard, responsive behavior, TEST-F08-06/07, and final manual viewport review. |
| SR-04 | Contract history, approved decisions, AC-to-actual-test evidence, tested SHA, substantive peer review, and release record. Peer review is not yet recorded. |
| SR-05 | Existing shared deployment responsibility; no new F-08 configuration or secret is proposed. Exact candidate/deployment evidence remains open. |
| SR-06 | Existing NFR-07 workload for F-03 operations, not a new feature or F-08 performance target. D-12 approval and TEST-SR06-01 are pending. |

**Part C status:** The Feature Inventory/SRS identify F-08 as the only remaining new Sprint 3 feature; F-01 to F-07 are regression/integration only. The contract v0.1 was committed before source/test implementation and contains the complete SDS, UI/API/data design, numbered AC, STS, DoD, dependencies, and history. A meaningful API slice and 90/90 PostgreSQL integration run now provide checkpoint progress. Independent contract/code review, policy approval, full F-08 coverage, final PR/release integration, and release acceptance remain open; no peer review is claimed.

**Sprint 2 baseline status:** F-05 to F-07 contracts and their implementation are integrated in staging. Formal Sprint 2 release acceptance and a release tag are not recorded. The Sprint 3 plan lists an integrated Sprint 2 release as a prerequisite; disposition is pending. The current GitHub Actions PR workflow covers sprint-1-staging, sprint-2-staging, and main. No sprint-3-staging branch/CI target exists, so the F-08 PR base must be agreed by the team.

## Verified F-08 progress

F-08 is **PARTIAL**, not accepted or complete. The previous client-derived metrics panel and historical Issue 15 evidence remain as documented below. This checkpoint adds a database-backed `GET /api/v1/organizer/events/:eventId/summary` route and a pure calculation helper. The API is owner-scoped, uses one parameterized PostgreSQL statement for a consistent statement snapshot, returns aggregate fields only, and performs no writes. The UI has not been changed to consume it.

| Evidence | What it actually verifies | Result / tested version |
| --- | --- | --- |
| [`server/src/event-summary.test.ts`](../../../server/src/event-summary.test.ts), TEST-F08-01 | Zero-active null rate; one-active zero rate; 1/3, 2/3, and 3/3 rates; remaining/not-checked-in calculations; negative, unsafe, and contradictory values rejected. | 2/2 tests passed with `npm.cmd run test --workspace server -- src/event-summary.test.ts` at `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`. Initial expected RED was missing helper module; after implementation the same tests passed. |
| [`server/src/f08.integration.test.ts`](../../../server/src/f08.integration.test.ts), TEST-F08-02 | Isolated PostgreSQL fixture with capacity 10, three ACTIVE rows, two CANCELLED rows for one Participant, and one ACTIVE Attendance; exact aggregate response, no participant/row data, and before/after domain-row equality. | 1/1 passed under `npm.cmd run test --workspace server -- src/f08.integration.test.ts`. |
| [`server/src/f08.integration.test.ts`](../../../server/src/f08.integration.test.ts), supplemental zero-active API check / read-only part of TEST-F08-04 | Owned Event with no Registrations returns zero counts, remaining capacity, and API `attendanceRate: null`. | 1/1 passed in the F-08 isolated PostgreSQL suite. UI N/A remains unimplemented. |
| [`server/src/f08.integration.test.ts`](../../../server/src/f08.integration.test.ts), TEST-F08-05 | Anonymous, Participant, non-owner, malformed/nonexistent Event IDs, expired and revoked sessions; safe 401/403/404 outcomes and no Event/Registration/Attendance changes. | 1/1 passed in the same F-08 isolated PostgreSQL suite. |
| [`server/scripts/integration-check.mjs`](../../../server/scripts/integration-check.mjs) | Full guarded PostgreSQL server integration suite; 90 tests across auth, events, registration, organizer management, F-05/F-06/F-07/F-08, and provisioning. | `npm.cmd run test:integration --workspace server` exited 0; 90/90 passed and the F-06 API restart verification passed. One F-07 injected-failure test logged its expected controlled error while passing. |
| Root quality commands | Server/client typecheck and build; Prisma schema validation. | `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run prisma:validate` all exited 0. |
| Historical [`client/src/App.test.tsx`](../../../client/src/App.test.tsx) and [`e2e/f06-registration-cancellation.spec.ts`](../../../e2e/f06-registration-cancellation.spec.ts) | F-07-labelled mocked metrics and earlier real UI/API/isolated-PG lifecycle counts. | 29 client tests and 30 Playwright tests passed on `107c93e`; preserved as historical partial evidence, not current F-08 API verification. |

The PostgreSQL tests ran on a temporary PostgreSQL 18 cluster bound to `127.0.0.1:5433`, in a new `eventcheck_test` database after applying the seven existing migrations. The configured `eventcheck` database and the PostgreSQL service on port 5432 were not used. No F-08 migration/schema change was made. Source commit `25664f864a5b70a2d6fc1675c0c663a61a0d80bd` is recorded for the tested code. No screenshot or Playwright F-08 run is claimed.

### Draft AC status against executed evidence

The IDs/formulas below remain draft proposals pending D-10/BR-18 and peer review. Status is limited to what the current API/tests demonstrate.

| Draft AC | Status | Executed evidence / remaining limit |
| --- | --- | --- |
| AC-F08-01 | VERIFIED against draft wording; acceptance pending | TEST-F08-02 returns committed ACTIVE/CANCELLED record totals, including two historical rows for the same Participant. D-10/BR-18 policy approval remains pending. |
| AC-F08-02 | VERIFIED against draft wording; acceptance pending | TEST-F08-01/02 verifies capacity minus ACTIVE count and cancelled-history exclusion. D-10/BR-18 policy approval remains pending. |
| AC-F08-03 | PARTIAL - API arithmetic verified | TEST-F08-01/02 verifies checked-in and not-checked-in counts for ACTIVE records. Cancellation/re-registration/check-in transition workflow remains TEST-F08-03/07. |
| AC-F08-04 | PARTIAL - API rate/null verified | Unit/API tests cover one-decimal rate and null at zero active. UI N/A display, loading, failure, retry, refresh, and keyboard behavior remain TEST-F08-06/07. |
| AC-F08-05 | VERIFIED for tested API behavior; acceptance pending | TEST-F08-05 covers session/role/owner concealment and safe denial shapes. Independent peer review and UI integration remain pending. |
| AC-F08-06 | VERIFIED against draft wording; acceptance pending | Meaningful committed-PostgreSQL summary workflow passed TEST-F08-02 on source commit `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`. The AC remains draft and unaccepted until review. |

TEST-F08-03 (lifecycle transition/retrieval sequence), TEST-F08-04 concurrent-writer snapshot experiment, TEST-F08-06 (UI), TEST-F08-07 (Playwright), and TEST-SR06-01 remain NOT RUN. The one-statement query supports the documented snapshot design, but no concurrent API experiment has verified it.

## Accepted policy and implementation boundary

| Item | Status | Evidence / implication |
| --- | --- | --- |
| FR-22 / FR-23 | Planned Must requirements for Sprint 3 in the SRS; their detailed summary policy is unresolved. | Keep IDs and allocation. Do not claim all requirements are accepted or fully implemented. |
| D-10 / BR-18 | PROPOSED. | Require recorded team decision on historical cancelled-record counts, active-only attendance numerator/denominator, one-decimal rate, zero-active N/A, consistency, and owner authorization before accepting the F-08 contract. |
| F-08 contract | Draft v0.4; NOT PEER REVIEWED OR ACCEPTED. | Student 1/team review, findings/dispositions, and D-10/BR-18 decision are required before contract acceptance and release integration. |
| Partial UI-derived counts | IMPLEMENTED and partially TESTED through F-07 view. | See the two executed tests above. No separate F-08 release or acceptance is claimed. |
| Checkpoint summary API | IMPLEMENTED and database-tested in this branch worktree. | API counts/rate/null/authorization/read-only cases pass; no independent peer review, PR, merge, or release is claimed. |
| F-08 Organizer UI, lifecycle refresh, concurrent-writer test, Playwright flow | NOT IMPLEMENTED/NOT RUN. | Complete remaining AC/STSs after contract and policy review; preserve current F-04/F-07 workflows. |

The historical UI-derived counts and the new API slice are meaningful Sprint 3 progress. They do not complete or accept F-08. Policy approval, peer review, remaining UI/lifecycle/concurrency tests, PR integration, final regression, deployment, and release work remain.

## Remaining-work plan

Owners below are **proposed assignments**, not a record of accepted team allocation. The repository identifies Student 1 as the Issue 16 reviewer but does not record a named owner for Issue 18. Confirm the owners in the project issue tracker and revise this table if needed. Target dates are planning targets no later than 13 December 2026.

| Feature / AC / gap ID | Current status | Completed and verified work | Missing implementation or verification | Dependencies | Next action | Responsible student (proposed) | Target date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-08 / D-10 / BR-18 / REVIEW-F08-01 | CONTRACT DRAFT v0.4; independent review and policy decision pending | Pre-implementation contract v0.1 committed at `5c8ca563`; v0.4 has full SDS, AC, STS, DoD, and API execution evidence at `25664f8` | Student 1 substantive review; record D-10/BR-18 decision/dispositions; resolve Sprint 2 release and Sprint 3 PR-target dependencies | Reviewer; team policy decision; release owner; agreed integration target | Review contract and implementation; reconcile SRS/history without converting proposals into accepted policy | Team; Student 1 review; individual author to confirm | 2026-11-29 |
| F-08 summary implementation | PARTIAL; API implemented and tested at `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`; UI not implemented | One-statement owner-scoped summary API; unit and PostgreSQL aggregate/zero/auth/read-only cases pass | Organizer view API integration, loading/error/retry/refresh, accessible rate/N/A, and final responsive review | Peer/policy review for acceptance; Sprint 2 release dependency; PR target | Finish the UI and do not change F-05/F-06/F-07 behavior | Owner to confirm | 2026-12-06 |
| F-08 AC/STS verification | PARTIAL; TEST-F08-01/02/05 pass; TEST-F08-04 partly covered | Exact test commands/results and 90/90 server PostgreSQL suite are documented above at source commit `25664f8` | TEST-F08-03 lifecycle transitions; concurrent TEST-F08-04; TEST-F08-06 UI; TEST-F08-07 Playwright; final AC/policy review | Reviewed contract, remaining UI/workflow, reproducible candidate | Execute remaining STS against isolated PostgreSQL/UI; record failures/skips and keep unrun IDs NOT RUN | Owner/reviewer to confirm | 2026-12-09 |
| F-08 PR / release candidate | NOT SUBMITTED OR INTEGRATED; local source commit exists but is not pushed | Tested feature branch commit `25664f8` and review-ready local PR description | Peer review, team-confirmed base, CI/PR checks, review disposition, merge, exact release-candidate verification | GitHub access, peer reviewer, Sprint 3 target, Sprint 2 release decision | Submit for peer review after target decision; integrate only after approval | Author/reviewer split to confirm | 2026-12-12 |
| LAB6-GAP-01 / LAB7-GAP-01 / UAT-GAP-01 | OPEN EVIDENCE GAP | Sprint 1 UAT test/handoff/execution templates exist on the Sprint 1 staging history; UAT execution remains NOT RUN | Lab 6 and Lab 7 reports were not found in inspected refs; UAT lacks URL/revision/run/sign-off | Locate source submissions; identify safe non-production test revision | Review actual Lab/UAT submissions, record each finding and re-test, or explicitly report unavailable evidence | Student 1 + Student 2; assignment to confirm | 2026-12-03 |
| NFR-07 / SR-06 | PROPOSED TARGET; measurement not run | Workload/method is documented in SRS/F-03 contract; TEST-SR06-01 is planned in the F-08 contract coverage | Team approval/revision of numerical target and actual benchmark with p95, counts, errors, environment, and persisted outcomes | Stable integrated candidate and realistic fixtures | Confirm target; run the accepted workload on real API/database and record results | Owner/reviewer to confirm | 2026-12-10 |
| Issue 17 candidate regression and release | Release acceptance not recorded | Issue 15 reports 87/87 PostgreSQL integration, 30/30 Playwright and passing build/typecheck/Prisma checks on 107c93e; CI run 45869394130 passed on corrected head | Repeat required full suite on exact candidate, record release decision, tag/commit, and any remaining defects | PR #61 staging integration; exact candidate commit | Record candidate SHA, test commands/counts/skips, review/release decision, GCP deployment/revision and smoke/persistence evidence or mark unavailable | Student 1 + Student 2; reviewer/author split to record | 2026-12-12 |
| Deliverable 2 self-contained PDF | NOT ASSEMBLED in Issue 16 | Repository documentation and evidence map prepared | Copy complete engineering documents/evidence into one PDF, then assign real page numbers and verify pages | Issue 17 completion and approved final candidate | Assemble, render and inspect PDF; fill page references in the evidence map after assembly | Student 1 + Student 2 | 2026-12-13 |

## Source links

- [SRS](../../srs.md), [Feature Inventory](../../features.md), and [Requirements Traceability Matrix](../../traceability.md).
- [System-Level SDS](../../system-sds.md) and [Sprint plan](../plan.md).
- [F-08 draft contract](f-08-registration-attendance-summary.md), [Issue 18 PR description draft](issue-18-pr-description.md), and [Group Work Specification](../../group_work_specs_v1.pdf).

## AI-use declaration

OpenAI Codex assisted repository and Group Work Specification review, Sprint 3 scope/traceability analysis, contract drafting, API/test implementation, and evidence/status updates on 2026-11-27. Both students remain responsible for checking the source, approving D-10/BR-18 policy decisions, performing substantive peer review, and supervising final implementation and release. No independent peer review or policy acceptance is claimed.
- [Sprint 2 AC verification](../sprint-2/ac-verification.md) and [Issue 15 integration evidence](../sprint-2/integration-verification.md).
- [Issue 16 Deliverable 2 rubric-to-evidence map](../../deliverable-2-evidence-map.md).
