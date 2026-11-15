# EventCheck Three-Sprint Plan

## 1. Planning basis

This plan allocates the complete EventCheck baseline in [`../srs.md`](../srs.md) using the stable IDs in [`../features.md`](../features.md). It follows Theme 3 in `group_work_specs_v1.pdf` and Part D, Section 3.4 of `project_deliverable_1_v1.pdf`.

The plan is prospective. A feature is complete only when its reviewed contract, implementation, verification, integration, and evidence satisfy the criteria below; allocation alone is not a completion claim. Proposed or pending SRS policies remain unresolved until an approved, recorded decision is made.

## 2. Sprint allocation summary

| Sprint | Goal and required checkpoint | Included feature IDs | Cross-cutting responsibilities | Expected completion outcome |
| --- | --- | --- | --- | --- |
| Sprint 1 — Engineering baseline | Deliver a small working domain slice with authentication, permissions, business-rule validation, and database persistence. | F-01, F-02, F-03, F-04 | Establish SR-01 to SR-05; define the SR-06 target and method only. | A locally reproducible UI-to-API-to-database journey for authentication, event publication, public discovery, participant registration/retrieval, and owner registration management, including rule and access rejections. Deliverable 1 checkpoint: 8 November 2026. |
| Sprint 2 — Core expansion | Complete the core feature expansion under reviewed engineering contracts while preserving the Sprint 1 guarantees. | F-05, F-06, F-07 | Extend SR-01 to SR-05; maintain the approved SR-06 method. | An integrated, tested increment covering deadline/capacity management, cancellation/re-registration, organizer check-in, and authorized attendance retrieval. Deliverable 2 checkpoint: 29 November 2026. |
| Sprint 3 — Completion and hardening | Complete the remaining feature, integration, failure handling, usability, authorization, regression testing, and defect correction. | F-08; F-01 to F-07 are included for integration and regression, not as new scope. | Final verification and hardening of SR-01 to SR-06, including quantitative SR-06 testing. | A complete release with reconciled event summaries, full-product regression and NFR evidence, resolved accepted defects, reproducible delivery, and disclosed residual debt. Progress/contracts at 29 November; final release by 13 December 2026. |

Lab 5 operationalizes Docker, CI/CD, GCP, and durable deployment for SR-05 after the Sprint 1 release. It is a separate checkpoint, not another sprint and not a reason to defer Sprint 1 persistence or access-control work.

## 3. Sprint 1 — Engineering baseline

| Plan element | Sprint 1 plan |
| --- | --- |
| Goal | Build the required Theme 3 vertical slice with real authentication and identity, backend role/ownership permissions, meaningful publication/registration rules, and persistent Event and Registration data. |
| Included features | F-01 Authentication and Session Identity; F-02 Event Publishing and Owner Management; F-03 Public Event Discovery and Participant Registration; F-04 Organizer Registration Management. |
| Key dependencies and prerequisites | Accepted SRS baseline; approved D-02, D-03, D-04, D-08, Q-08, Q-09, and Q-11; System-Level SDS for architecture, data ownership, permission matrix, session lifecycle, configuration, and deployment suitability; reproducible synthetic seed accounts; reviewed F-01 to F-04 contracts, AC, STS, and Definition of Done before implementation. |
| Expected outcome | The seven-step critical journey works through the UI, API/application layer, and real database: Organizer login; valid positive-capacity event publication; Participant login; public discovery; registration; personal persisted retrieval; and owning Organizer registration-list retrieval. Logout/current identity, restart persistence, safe rejection, and forbidden operations are observable. |

### Scope

- F-01 establishes login, invalid-login handling, current identity, logout, server-side session validation, and the protected-operation foundation.
- F-02 establishes Organizer-owned event creation/publication/retrieval using the agreed fields, positive capacity, UTC persistence, labelled Asia/Bangkok display/input, and fixed published capacity.
- F-03 establishes public published-event listing/detail, authenticated self-registration, personal persisted retrieval, and malformed/missing/unpublished/duplicate/full rejection outcomes. Sprint 1 has no registration deadline or time-based closure.
- F-04 establishes owner-only, event-scoped registration-list retrieval with explicit empty state and the allowed participant fields.
- SR-01 to SR-05 are established for this slice. SR-06 defines the proposed response-time target and reproducible methodology; quantitative performance results remain allocated to Sprint 3.

### Completion criteria

Sprint 1 is complete only when all of the following are true:

1. Reviewed feature contracts for F-01 to F-04 contain stable AC and TEST IDs, and the G-01 entries in `traceability.md` are updated before implementation evidence is accepted.
2. The complete seven-step journey and persisted retrieval work through the UI, API/application layer, and real database; accepted Event and Registration records survive application restart.
3. Backend enforcement covers anonymous, wrong-role, cross-participant, and cross-owner requests. Hidden controls alone do not count as authorization.
4. Automated verification covers valid/invalid login, identity/session/logout behavior, required event validation, publication ownership, unpublished-event rejection, participant spoofing, duplicate registration, full capacity, atomic rejection, and synchronized same-participant and last-place races. Committed database state is inspected.
5. Selected UI/end-to-end checks cover the critical journey and explicit loading, empty, error, and success states. The planned keyboard and viewport walkthrough is recorded honestly.
6. Clean local setup, build, test, seed, and restart instructions reproduce the increment with no failed required checks. Test commands, counts, failures/skips, tested commit, and known limitations are retained.
7. Features are integrated through bounded Issues, branches, teammate-reviewed PRs into sprint staging, followed by an integration run and a reviewed release to `main`. Both students rotate author/reviewer and participate in requirements, tests, implementation, and review.
8. Local deployment suitability, externalized configuration, and secret safety are verified. Completed Docker, CI/CD, GCP, and durable-cloud checks remain at Lab 5 as specified.

### Not in Sprint 1

Capacity editing, registration deadlines, cancellation, re-registration after cancellation, check-in, attendance retrieval, and summaries remain in later sprints. A draft-event UI is not required; combined create-and-publish may satisfy F-02. Self-registration, password recovery, and advanced account administration remain outside the baseline.

## 4. Sprint 2 — Core expansion

| Plan element | Sprint 2 plan |
| --- | --- |
| Goal | Add the major remaining lifecycle and attendance workflows under reviewed contracts without weakening Sprint 1 authorization, persistence, duplicate, capacity, or concurrency guarantees. |
| Included features | F-05 Capacity and Registration Deadline Management; F-06 Registration Cancellation and Re-registration; F-07 Organizer Check-in and Attendance Retrieval. |
| Key dependencies and prerequisites | Accepted Sprint 1 release and regression suite; maintained Lab 5 delivery foundation; reviewed decisions for Q-01 to Q-06 and the affected retention question Q-10; updated SDS/data migration and permission impacts; controlled server-time test support; reviewed feature contracts before implementation. F-06 and F-07 require one shared lifecycle/integrity review because cancellation after check-in is forbidden. |
| Expected outcome | The owner can safely manage capacity/deadline, a Participant can cancel and conditionally re-register with history preserved, and the owner can record eligible attendance while authorized users retrieve it. New state transitions persist, remain private, and are safe at boundaries and under specified races. |

### Scope and execution order

1. Implement F-05 first so the authoritative deadline, active-count, and capacity-edit rules are available to later transitions.
2. Implement F-06 next, preserving cancellation history and exactly-once place release while reusing current publication, deadline, and capacity checks.
3. Implement F-07 against the established registration lifecycle, then complete the shared F-06/F-07 integration cases for checked-in cancellation and attendance privacy.
4. Re-run the Sprint 1 suite after each integration. Use small feature/fix branches and rotate author/reviewer responsibilities; do not divide permanent documentation and coding roles.

### Completion criteria

Sprint 2 is complete only when all of the following are true:

1. Q-01 to Q-06 and affected Q-10 policy choices are approved or revised in the SRS before the relevant contract is accepted; requirement and feature IDs remain stable.
2. F-05 to F-07 each have a reviewed pre-implementation design, AC, STS, Definition of Done, data/API/UI impacts, and traceability links.
3. Capacity/deadline edits, cancellation/re-registration, check-in, and attendance retrieval pass normal, authorization, validation, fixed-clock boundary, persistence, and safe-failure cases.
4. Integration verification covers an unsafe capacity reduction, capacity-edit/registration race, repeated/concurrent cancellation, duplicate/concurrent check-in, wrong-event attendance, and the interaction between checked-in and cancellation state.
5. Sprint 1 regressions remain passing; actual commands, results, failures/skips, test files/names, and tested commit are retained.
6. The integrated Sprint 2 release is reviewed, reproducible, and complete by the 29 November checkpoint. Any accepted defect or incomplete evidence remains explicit rather than being treated as complete.

### Not in Sprint 2

Event-level registration and attendance summaries remain F-08 in Sprint 3. Report export, platform-wide analytics, QR/scanner check-in, self-check-in, and Organizer-initiated event cancellation remain outside the baseline.

## 5. Sprint 3 — Completion and hardening

| Plan element | Sprint 3 plan |
| --- | --- |
| Goal | Complete the last baseline feature, integrate the whole product, verify remaining quality targets, correct accepted defects, and prepare a reproducible final release. |
| Included features | F-08 Registration and Attendance Summaries; F-01 to F-07 for full-product integration, regression, and defect correction only. |
| Key dependencies and prerequisites | Integrated Sprint 2 release; approved or revised D-10/BR-18 summary policy and affected Q-10 retention treatment; known UAT/defect status; stable performance fixtures and environment; retained CI/deployment foundation; Sprint 3 contract for F-08 before implementation. |
| Expected outcome | The owning Organizer receives consistent registration/attendance summaries, and the complete product meets its authorized workflow, persistence, failure-handling, accessibility, reproducibility, performance, deployment, and traceability obligations with known debt disclosed. |

### Scope

- Implement F-08 with consistent committed counts for capacity, active/cancelled registrations, remaining places, checked-in active registrants, not-checked-in active registrants, one-decimal attendance rate, and zero-active N/A behavior.
- Harden safe failure and user-facing states across F-01 to F-08 without adding new baseline capabilities.
- Run full authorization, persistence, transaction, concurrency, UI, and end-to-end regression, including the proposed expanded last-place and duplicate-registration race samples.
- Execute SR-06's approved quantitative workload against the real API and database; record p95 response times, request counts, unexpected errors, environment, tested commit, and persisted outcomes.
- Resolve and re-test accepted defects, perform final keyboard/viewport review, update traceability with actual evidence, and verify the repeatable release/deployment path.

### Completion criteria

Sprint 3 and the product baseline are complete only when all of the following are true:

1. F-08's reviewed contract precedes implementation, and its summary formulas and policy status match the approved SRS without silent changes.
2. Known fixtures, including cancellation, re-registration, attendance, zero denominator, cross-owner access, and concurrent change, reconcile without contradictory totals or private-data leakage.
3. Required automated and selected end-to-end/regression checks pass on the final commit; failures, skips, accepted defects, residual debt, and environment limitations are explicit.
4. NFR-07 quantitative testing and the final NFR-01 to NFR-12 verification are recorded with reproducible methods and release identity. Proposed targets are confirmed or changed through review before being used as acceptance thresholds.
5. Requirements, features, contracts, AC, tests, actual results, Issues, PRs, reviews, deployment, and release reference form an auditable chain. All 53 baseline requirements retain a mapped final status.
6. The complete product is reproducible and released by 13 December 2026. At the 29 November checkpoint, any unfinished Sprint 3 work has contracts, demonstrated progress, and an explicit remaining-work list.

## 6. Feasibility and change control

The allocation is bounded for two students: Sprint 1 contains one required vertical slice; Sprint 2 uses the ordered F-05 to F-07 lifecycle expansion; Sprint 3 contains one remaining functional feature and reserves most effort for integration and evidence. Work should use small Issues and branches, alternating author/reviewer responsibilities so both students participate across requirements, design, tests, implementation, delivery, and review.

The following gates prevent planning assumptions from becoming silent requirements changes:

| Gate | Required action |
| --- | --- |
| Before Sprint 1 contracts are accepted | Supply F-01 to F-04 AC/STS IDs and reconcile any SRS status ambiguity around proposed numerical targets, while preserving the agreed authentication design. |
| Before F-05 to F-07 contracts are accepted | Resolve Q-01 to Q-06 and affected Q-10; approve any resulting SRS revision and update feature/traceability links. |
| Before F-08 contract or final quantitative verification is accepted | Confirm or revise D-10/BR-18, affected Q-10, and D-12 numerical targets through recorded review. |
| When scope or policy changes | Update the SRS, feature inventory, traceability matrix, this plan, and affected contracts in one reviewed change; preserve IDs and prior history. |

No excluded capability is contingency work for these sprints. If schedule pressure occurs, the team must report incomplete baseline work and replan through approval rather than silently removing a requirement, weakening a rule/test, or marking planned verification as executed.
