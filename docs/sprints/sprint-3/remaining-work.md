# F-08 Progress and Sprint 3 Remaining Work

**Snapshot:** 2026-11-27
**Target completion:** 2026-12-13
**F-08 contract status:** Not found in the inspected current tree or local branches; no F-08 AC/STS set or Issue 18 progress artifact is present in those refs.

## Verified F-08 progress

F-08 is **PARTIAL**, not accepted or complete. A meaningful part of its domain behavior is already present in the Organizer registration view: the client derives active registrations, cancelled history, checked-in active registrations, not-checked-in active registrations, remaining seats, and total registration records from the existing F-04 registration and F-07 attendance responses.

The currently tested slice exercises the rule that cancelled historical rows do not consume capacity or count as active attendance, and that check-in reduces only the active not-checked-in count:

| Evidence | What it actually verifies | Result / tested version |
| --- | --- | --- |
| [`client/src/App.test.tsx`](../../../client/src/App.test.tsx), `TEST-F07 metrics exclude cancelled history from active attendance` | Mocked component data with one ACTIVE row, two CANCELLED history rows, no Attendance, and capacity five renders Active 1, Cancelled 2, Checked in 0, Not checked in 1, Remaining 4, Total records 3. | Included in the Issue 15 client suite, 29 passed on `107c93eafbc5c2afb29527336665a6d38269c478`. This is a F-07-labelled component test, not a formal F-08 STS. |
| [`e2e/f06-registration-cancellation.spec.ts`](../../../e2e/f06-registration-cancellation.spec.ts), `TEST-F06-15/TEST-I15-E2E-01` | Real UI/API/isolated-PostgreSQL journey publishes/updates an Event, registers, cancels, re-registers, checks in, and checks displayed summary counts before/after attendance and reload. The checked-in registration remains ACTIVE and cancelled history remains. | 1 focused pass and included in the full 30/30 E2E run on `107c93e`. |

These records demonstrate tested Sprint 3 progress for a useful subset of lifecycle counts. They do not establish the complete accepted F-08 behavior: the requirement/decision baseline still lists D-10 and BR-18 as proposed, the F-08 contract/AC/STS is missing, there is no dedicated summary endpoint, and no attendance-rate or zero-active N/A result is shown. Counts are currently derived in the client from separate registration and attendance requests; no single consistent-snapshot guarantee is documented or tested for F-08.

## Accepted policy and implementation boundary

| Item | Status | Evidence / implication |
| --- | --- | --- |
| FR-22 / FR-23 | Planned Must requirements for Sprint 3 in the SRS; their detailed summary policy is unresolved. | Keep IDs and allocation. Do not claim all requirements are accepted or fully implemented. |
| D-10 / BR-18 | PROPOSED. | Require recorded team decision on historical cancelled-record counts, active-only attendance numerator/denominator, one-decimal rate, zero-active N/A, consistency, and owner authorization before accepting the F-08 contract. |
| F-08 contract | NOT FOUND / NOT ACCEPTED in inspected refs. | Create/review contract with SDS, data, API/UI, authorization, AC, STS, and DoD impacts before new F-08 implementation is accepted. |
| Partial UI-derived counts | IMPLEMENTED and partially TESTED through F-07 view. | See the two executed tests above. No separate F-08 release or acceptance is claimed. |
| Attendance rate, zero-active case, consistent snapshot, report privacy, API behavior | NOT IMPLEMENTED OR VERIFIED as F-08. | Complete after policy and contract approval; keep owner scoping on the server if a summary API is introduced. |

The minimum Sprint 3 progress expectation is met by the tested domain-count slice described above. That does not complete F-08 or remove the remaining contract, implementation, verification, review, and release work.

## Remaining-work plan

Owners below are **proposed assignments**, not a record of accepted team allocation. The repository identifies Student 1 as the Issue 16 reviewer but does not record a named owner for Issue 18. Confirm the owners in the project issue tracker and revise this table if needed. Target dates are planning targets no later than 13 December 2026.

| Feature / AC / gap ID | Current status | Completed and verified work | Missing implementation or verification | Dependencies | Next action | Responsible student (proposed) | Target date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-08 / D-10 / BR-18 | PLANNED; policy pending | Partial lifecycle count UI and tests documented above | Approve or revise definitions, including cancelled-history count, attendance rate, zero-active display, and consistent-read meaning | Accepted F-05 to F-07 behavior | Record decision rationale/status in SRS; create F-08 contract, AC, STS and DoD; preserve existing IDs | Student 1: policy/review; Student 2: contract support | 2026-11-29 |
| F-08 summary implementation | PARTIAL | Client already derives six lifecycle/capacity counts from existing registration and attendance data | Full approved summary behavior; decide whether one owner-scoped summary API/transaction is needed for consistency; implement rate and N/A behavior | Approved D-10/BR-18 and accepted F-08 contract | Implement remaining data/UI behavior and record API/schema changes only if approved | Student 2: implementation; Student 1: review | 2026-12-06 |
| F-08 AC/STS verification | NOT VERIFIED | F-07 metrics component test and joined E2E passed on `107c93e` | Dedicated accepted AC-to-test mapping for all summary rules, zero active case, cross-owner denial, cancelled histories, and concurrent update semantics | F-08 contract and implementation | Add/execute contract-defined checks against the integrated database and UI; record actual output and tested SHA | Student 2: execution; Student 1: evidence review | 2026-12-09 |
| LAB6-GAP-01 / LAB7-GAP-01 / UAT-GAP-01 | OPEN EVIDENCE GAP | Sprint 1 UAT test/handoff/execution templates exist on the Sprint 1 staging history; UAT execution remains NOT RUN | Lab 6 and Lab 7 reports were not found in inspected refs; UAT lacks URL/revision/run/sign-off | Locate source submissions; identify safe non-production test revision | Review actual Lab/UAT submissions, record each finding and re-test, or explicitly report unavailable evidence | Student 1 + Student 2; assignment to confirm | 2026-12-03 |
| NFR-07 / SR-06 | PROPOSED TARGET; measurement not run | Workload/method is documented in SRS/F-03 contract | Team approval/revision of numerical target and actual benchmark with p95, counts, errors, environment and persisted outcomes | Stable integrated candidate and realistic fixtures | Confirm target; run the accepted workload on real API/database and record results | Student 2: measurement; Student 1: review | 2026-12-10 |
| Issue 17 candidate regression and release | NOT YET VERIFIED | Issue 15 reports 87/87 PostgreSQL integration, 30/30 Playwright and passing build/typecheck/Prisma checks on `107c93e`; CI run 45869394130 passed on corrected head | Repeat required full suite on exact release candidate, report release decision and any remaining defects | PR #61 staging integration; F-08 scope; identified candidate commit | Record candidate SHA, test commands/counts/skips, review/release decision, GCP deployment/revision and smoke/persistence evidence or mark unavailable | Student 1 + Student 2; reviewer/author split to record | 2026-12-12 |
| Deliverable 2 self-contained PDF | NOT ASSEMBLED in Issue 16 | Repository documentation and evidence map prepared | Copy complete engineering documents/evidence into one PDF, then assign real page numbers and verify pages | Issue 17 completion and approved final candidate | Assemble, render and inspect PDF; fill page references in the evidence map after assembly | Student 1 + Student 2 | 2026-12-13 |

## Source links

- [SRS](../../srs.md), [Feature Inventory](../../features.md), and [Requirements Traceability Matrix](../../traceability.md).
- [System-Level SDS](../../system-sds.md) and [Sprint plan](../plan.md).
- [Sprint 2 AC verification](../sprint-2/ac-verification.md) and [Issue 15 integration evidence](../sprint-2/integration-verification.md).
- [Issue 16 Deliverable 2 rubric-to-evidence map](../../deliverable-2-evidence-map.md).
