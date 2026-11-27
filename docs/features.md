# EventCheck Feature Inventory

## 1. Purpose and baseline

This inventory defines the stable product feature IDs used by the requirements traceability matrix, sprint plan, future feature contracts, Issues, and pull requests. It covers the complete baseline in [`srs.md`](srs.md), including the SRS changes accepted through PR #4 and merged into `sprint-1-staging` at commit `1f0eb85`.

The source hierarchy used for this inventory is:

1. `group_work_specs_v1.pdf` as the master Theme 3 product specification;
2. `project_deliverable_1_v1.pdf`, especially Sections 3.2 and 3.4, as the Part B and Part D assessment criteria; and
3. `srs.md` as EventCheck's requirements baseline.

No `F-*` identifiers existed in the repository before this inventory. The IDs below are therefore the initial stable feature IDs. Preserve them when a feature is refined; record an approved change instead of renumbering or silently changing its meaning.

## 2. Product feature inventory

The approved allocation remains F-01 to F-04 in Sprint 1, F-05 to F-07 in Sprint 2, and F-08 in Sprint 3. Sprint 2 staging is the implementation baseline; current status rows also include the checkpoint work on `feature/f08-registration-attendance-summary`. See [Sprint 2 AC verification](sprints/sprint-2/ac-verification.md) for the complete F-05/F-06/F-07 matrix.

| Feature ID | Feature | Scope and linked requirements | Assigned sprint | Dependencies | Contract |
| --- | --- | --- | --- | --- | --- |
| F-01 | Authentication and Session Identity | Seeded role login, identity, logout, session validation; FR-01 to FR-05, BR-04, NFR-01 to NFR-03 | Sprint 1 | Seeded synthetic accounts; establishes identity for all protected features | [Sprint 1 contract](sprints/sprint-1/f-01-authentication.md) |
| F-02 | Event Publishing and Owner Management | Organizer event create/publish/retrieve; FR-06 to FR-09, BR-01, BR-02, BR-05, BR-12, Sprint 1 BR-15 boundary | Sprint 1 | F-01; persistent Event ownership, validation, UTC instants | [Sprint 1 contract](sprints/sprint-1/f-02-event-publishing.md) |
| F-03 | Public Event Discovery and Participant Registration | Public discovery/details, self-registration, personal reads and safe rejections; FR-11 to FR-14, FR-16, BR-03 to BR-11 | Sprint 1 | F-01, F-02; server identity and transactional capacity/duplicate checks | [Sprint 1 contract](sprints/sprint-1/f-03-event-registration.md) |
| F-04 | Organizer Registration Management | Owner-scoped, private event registration list; FR-15, BR-02 to BR-04 | Sprint 1 | F-01 to F-03; event ownership and filtered registrant data | [Sprint 1 contract](sprints/sprint-1/f-04-organizer-registrations.md) |
| F-05 | Capacity and Registration Deadline Management | Owner edits to capacity/deadline and deadline eligibility; FR-10, extensions to FR-12/13/16, BR-02, BR-05, BR-09 to BR-11, BR-14/15 | Sprint 2 | F-01 to F-03; active registration count and server time | [Accepted v0.6 contract](sprints/sprint-2/f-05-capacity-deadline.md) |
| F-06 | Registration Cancellation and Re-registration | Cancel own eligible registration, preserve history, release a place once, re-register after current checks; FR-14, FR-17/18, BR-03, BR-08/09, BR-11, BR-13/14 | Sprint 2 | F-03 and F-05; checked-in guard/lock order shared with F-07 | [Accepted v0.5 contract](sprints/sprint-2/f-06-registration-cancellation.md) |
| F-07 | Organizer Check-in and Attendance Retrieval | Owner check-in during the event and authorized attendance reads; FR-19 to FR-21, BR-02 to BR-04, BR-11, BR-16/17 | Sprint 2 | F-01, F-04 to F-06; Attendance persistence and server time | [Accepted v0.5 contract](sprints/sprint-2/f-07-organizer-check-in.md) |
| F-08 | Registration and Attendance Summaries | Organizer totals and attendance rate, including lifecycle history and zero-active behavior; FR-22/23, BR-02/09/18 | Sprint 3 | F-05 to F-07 and a consistent committed data view; D-10/BR-18 approval is a gate | [Draft v0.3 contract](sprints/sprint-3/f-08-registration-attendance-summary.md); not peer reviewed or accepted |

## 3. Implementation, test, and acceptance status

`IMPLEMENTED`, `TESTED`, and `ACCEPTED` are separate states. A test run or staging merge does not alone record feature/release acceptance. The Issue 15 implementation/test source SHA is `107c93eafbc5c2afb29527336665a6d38269c478`; the current staging HEAD is merge commit `f08177c1cf4d9820846a72ef1fc1bcff55c9b96b`. Their tree diff is documentation-only. No Git release tags are present.

| Feature | Implementation status | Test execution status | Acceptance status | Actual PR / commit / release evidence | Remaining gaps |
| --- | --- | --- | --- | --- | --- |
| F-01 | IMPLEMENTED | TESTED; Sprint 1 verified 37/37 PostgreSQL integration and 16/16 E2E at the accepted candidate; Issue 15 regression included auth suites, 87/87 integration and 30/30 E2E on `107c93e` | ACCEPTED for Sprint 1 | Issue #8 / `feature/06-auth-role-access`; accepted integrated candidate `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e` (PR #20); current regression: [`auth.integration.test.ts`](../server/src/auth.integration.test.ts), [`f01-auth.spec.ts`](../e2e/f01-auth.spec.ts) | No F-01-specific release gap; final release regression remains an Issue 17 gate. |
| F-02 | IMPLEMENTED | TESTED in Sprint 1 and Issue 15 regression; see `events.integration.test.ts` and `f02-event-publishing.spec.ts` | ACCEPTED for Sprint 1 | Issue #9 / PR #17; accepted candidate `da3fa630`; regression SHA `107c93e` | Sprint 1 schema supports only `PUBLISHED`; unpublished-state negative coverage remains the recorded accepted limitation. |
| F-03 | IMPLEMENTED | TESTED in Sprint 1 and Issue 15 regression; see public-events/registration integration suites and `f03-registration.spec.ts` | ACCEPTED for Sprint 1 | Issue #12 / PR #20; accepted candidate `da3fa630`; regression SHA `107c93e` | Unpublished Event state and quantitative NFR-07 measurement remain outside verified Sprint 1 scope. |
| F-04 | IMPLEMENTED | TESTED in Sprint 1 and Issue 15 regression; see `organizer-registrations.integration.test.ts` and `f04-organizer-registrations.spec.ts` | ACCEPTED for Sprint 1 | Issue #11 / PR #19; accepted candidate `da3fa630`; regression SHA `107c93e` | No feature-specific gap recorded; repeat in final candidate verification. |
| F-05 | IMPLEMENTED and integrated to `sprint-2-staging` | TESTED: all 12 automated ACs passed; AC-F05-13 evidence review recorded PASS (manual, not automated). Overall suite: Issue 15 87/87 PostgreSQL integration and 30/30 E2E on `107c93e` | Contract v0.6 ACCEPTED; Sprint 2 release acceptance not recorded | Feature PR #58; integration/test PR #61 merged at `f08177c`; test SHA `107c93e`; see [AC matrix](sprints/sprint-2/ac-verification.md) | Issue 17 must repeat full verification on its exact release candidate; no Sprint 2 release tag/deployment recorded. |
| F-06 | IMPLEMENTED and integrated to `sprint-2-staging` | TESTED: AC-F06-01 to AC-F06-13 passed in Issue 15 evidence; test SHA `107c93e` | Contract v0.5 ACCEPTED; Sprint 2 release acceptance not recorded | Feature PR #59; integration/test PR #61 merged at `f08177c`; test SHA `107c93e`; see [AC matrix](sprints/sprint-2/ac-verification.md) | Issue 17 final-candidate verification and release acceptance remain open. |
| F-07 | IMPLEMENTED and integrated to `sprint-2-staging` | TESTED: AC-F07-01 to AC-F07-12 passed in Issue 15 evidence; test SHA `107c93e` (restart check itself last recorded on `b9df85c`, same application code) | Contract v0.5 ACCEPTED; Sprint 2 release acceptance not recorded | Feature PR #60; integration/test PR #61 merged at `f08177c`; see [AC matrix](sprints/sprint-2/ac-verification.md) | Issue 17 final-candidate verification and release acceptance remain open. |
| F-08 | PARTIAL; existing Organizer panel remains client-derived; a separate owner-scoped database-backed summary API is implemented on the feature branch | TESTED PARTIAL SLICE: unit calculations and 3 isolated-PostgreSQL API tests pass; full guarded server PostgreSQL integration passes 90/90, plus typecheck/build/Prisma validation. Exact source SHA is pending commit. Historical F-07 client and TEST-I15-E2E-01 results on `107c93e` remain distinct | NOT ACCEPTED; D-10/BR-18 remain proposed; contract v0.3 has no independent review record | No PR submission, peer review, merge, or release evidence; UI still does not consume the API | Organizer UI/accessibility, cancellation/re-registration/check-in refresh E2E, concurrent-writer snapshot experiment, final tested SHA, policy and peer review, confirmed PR base, integration and release remain open. |

## 4. Cross-cutting system responsibilities

These responsibilities are not extra user-facing features. They identify ownership for requirements that apply across several features, as permitted by Part B of the deliverable specification.

| Responsibility ID | System responsibility | Related requirements | Applies to | Establishment and verification allocation |
| --- | --- | --- | --- | --- |
| SR-01 | Backend Authorization and Data Privacy | FR-05; BR-01 to BR-04; NFR-01 | F-01 to F-08 wherever an operation or record is protected | Establish and verify in Sprint 1; extend to new Sprint 2 and Sprint 3 operations; regress through release. |
| SR-02 | Persistent Integrity, Atomicity, and Concurrency | BR-05 to BR-18 as applicable; NFR-04 to NFR-06 | F-02 to F-08 | Establish event/registration guarantees in Sprint 1; extend to lifecycle, capacity, and attendance transitions in Sprint 2; add summary reconciliation and regress/harden the whole product in Sprint 3. |
| SR-03 | Accessible Workflow State and Error Communication | NFR-08 | All user-facing parts of F-01 to F-08 | Establish for the Sprint 1 journey; extend in Sprint 2; extend to F-08 and perform the final keyboard, viewport, and state review in Sprint 3. |
| SR-04 | Traceable Contracts and Reproducible Verification | NFR-09, NFR-10 | F-01 to F-08 and all releases | Establish before and during Sprint 1; maintain for every later feature, change, test result, review, and release. |
| SR-05 | Deployment Readiness, Configuration, and Secret Safety | NFR-02, NFR-11, NFR-12 | Authentication and the shared application/runtime used by F-01 to F-08 | Design and verify local readiness in Sprint 1; complete operational Docker, CI/CD, GCP, and durable-storage checks at Lab 5; retain in Sprints 2 and 3. |
| SR-06 | Reproducible Performance Engineering | NFR-07 | The published-event list, event detail, and eligible-registration operations in F-03, plus their shared stack | Define the proposed target and method in Sprint 1; run the specified quantitative verification in Sprint 3 after integration. |

Lab 5 is a separate course checkpoint, not a fourth sprint. Its operational work extends SR-05 without moving any product feature out of its planned sprint.

## 5. Increment boundaries

The following split prevents mixed-sprint requirements from being silently completed or deferred as a whole:

| Baseline item | Sprint 1 boundary | Later extension |
| --- | --- | --- |
| FR-12 | F-03 shows public details, UTC+7 display time, capacity, remaining places, and availability. | F-05 adds the optional deadline display in Sprint 2. |
| FR-13 | F-03 registers an authenticated Participant under the Sprint 1 eligibility rules, with no time-based closure. | F-05 applies BR-14's effective deadline in Sprint 2. |
| FR-14 | F-03 retrieves active personal registrations and proves persistence. | F-06 exposes the cancelled lifecycle state in Sprint 2. |
| FR-16 | F-03 explains malformed, missing, unpublished, duplicate, and full outcomes. | F-05 adds the closed-registration outcome in Sprint 2. |
| BR-15 | F-02 treats published capacity as fixed. | F-05 adds the accepted controlled capacity-edit workflow in Sprint 2. |
| NFR-07 | SR-06 defines the proposed performance target and reproducible method. | SR-06 performs quantitative verification in Sprint 3. |
| NFR-11 | SR-05 proves documented local execution and deployment suitability. | Lab 5 proves container/cloud delivery; the responsibility is retained through Sprints 2 and 3. |

## 6. Decision status and change control

This inventory carries forward SRS decisions D-02 to D-09 and Q-01 to Q-06, Q-08 to Q-11 at their recorded approval level. F-05 v0.6, F-06 v0.5, and F-07 v0.5 contracts are accepted. Implementations and test outcomes are recorded separately above and in the linked evidence. The Sprint 2 PR #61 merge proves integration into staging; it does not replace Issue 17's exact-candidate release verification or formal release record.

F-08 remains partial: draft v0.3 defines proposed AC/STS and DoD and the checkpoint API slice is implemented and locally verified. D-10 and BR-18 still require team approval or revision; Student 1 review is not recorded. The direct user instruction authorized this API slice but did not accept the rules or full feature. Q-10 remains limited to synthetic project history; real-user policy is separate. Peer review, remaining UI/STS work, source commit identity, and Sprint 2 release/PR-target dependencies remain open. SR-06 numeric targets in D-12 also remain proposed and require review before quantitative performance verification.

Q-07 remains outside the baseline: Organizer-initiated event cancellation has no feature ID or FR. This inventory does not add it. Any approved scope or policy change must update `srs.md`, this inventory, `traceability.md`, the sprint plan, and affected contracts while preserving existing IDs and recording the rationale.
