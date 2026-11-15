# EventCheck Feature Inventory

## 1. Purpose and baseline

This inventory defines the stable product feature IDs used by the requirements traceability matrix, sprint plan, future feature contracts, Issues, and pull requests. It covers the complete baseline in [`srs.md`](srs.md), including the SRS changes accepted through PR #4 and merged into `sprint-1-staging` at commit `1f0eb85`.

The source hierarchy used for this inventory is:

1. `group_work_specs_v1.pdf` as the master Theme 3 product specification;
2. `project_deliverable_1_v1.pdf`, especially Sections 3.2 and 3.4, as the Part B and Part D assessment criteria; and
3. `srs.md` as EventCheck's requirements baseline.

No `F-*` identifiers existed in the repository before this inventory. The IDs below are therefore the initial stable feature IDs. Preserve them when a feature is refined; record an approved change instead of renumbering or silently changing its meaning.

## 2. Product feature inventory

| Feature ID | Feature | Concise description | Related requirements | Dependencies and prerequisites | Planned sprint |
| --- | --- | --- | --- | --- | --- |
| F-01 | Authentication and Session Identity | Authenticate seeded Participant and Organizer accounts; expose safe current-user identity; end and validate server-side sessions; provide the identity foundation for every protected operation. | FR-01 to FR-05; BR-04; NFR-02, NFR-03 | Seeded synthetic accounts and roles; approved D-02 and Q-09; session, cookie, CSRF, expiry, and renewal details completed in the System-Level SDS and feature contract. No feature prerequisite. | Sprint 1 |
| F-02 | Event Publishing and Owner Management | Let an Organizer create, validate, publish, persist, and retrieve owned university events. Sprint 1 publication requires the agreed fields and fixes published capacity after publication. | FR-06 to FR-09; BR-01, BR-02, BR-05, BR-12; Sprint 1 boundary of BR-15; NFR-01, NFR-04, NFR-06, NFR-08 | F-01; persistent Event storage and ownership link; approved D-03, D-04, D-08, and Q-11; backend role and ownership enforcement. | Sprint 1 |
| F-03 | Public Event Discovery and Participant Registration | Let visitors discover published events and view public details; let an authenticated Participant register themself, retrieve their persisted registrations, and receive safe, actionable rejection outcomes. | FR-11 to FR-14 and FR-16 for Sprint 1 behavior; BR-03 to BR-11; NFR-01, NFR-04 to NFR-08 | F-01 and F-02; approved Q-08; authoritative server identity; transactional database enforcement for duplicate and capacity rules. | Sprint 1 |
| F-04 | Organizer Registration Management | Let an Organizer retrieve the registration list for an owned event, including only the defined event-scoped participant and registration fields. | FR-15; BR-02 to BR-04; NFR-01, NFR-04, NFR-08 | F-01 to F-03; owner-scoped registration retrieval and explicit empty state; private-data filtering. | Sprint 1 |
| F-05 | Capacity and Registration Deadline Management | Let an owning Organizer atomically change a published event's capacity before start and optionally set a registration deadline; display and enforce the effective deadline and closed-registration outcome. | FR-10; Sprint 2 extensions of FR-12, FR-13, and FR-16; BR-02, BR-05, BR-09 to BR-11, BR-14, BR-15; NFR-01, NFR-04 to NFR-06, NFR-08 | F-01 to F-03; active-registration counts and server-authoritative time; resolve Q-01 to Q-03 and approve the affected policy before accepting the contract. | Sprint 2 |
| F-06 | Registration Cancellation and Re-registration | Let a Participant cancel an eligible own registration, preserve cancellation history, release one place exactly once, see cancelled status, and register again only after all current rules pass. | Sprint 2 extension of FR-14; FR-17, FR-18; BR-03, BR-08, BR-09, BR-11, BR-13, BR-14; NFR-01, NFR-04 to NFR-06, NFR-08 | F-03 and F-05; lifecycle persistence; coordinate the checked-in guard with F-07; resolve Q-04, Q-06, and the affected part of Q-10 before accepting the contract. | Sprint 2 |
| F-07 | Organizer Check-in and Attendance Retrieval | Let only the owning Organizer check in an eligible active registrant during the allowed window; prevent duplicate or invalid attendance; let authorized Organizers and Participants retrieve attendance. | FR-19 to FR-21; BR-02 to BR-04, BR-11, BR-16, BR-17; NFR-01, NFR-04 to NFR-06, NFR-08 | F-01, F-04, F-05, and F-06; persistent Attendance records and server-authoritative time; resolve Q-05 and the affected part of Q-10 before accepting the contract. | Sprint 2 |
| F-08 | Registration and Attendance Summaries | Show an owning Organizer consistent event-level registration and attendance totals, remaining places, not-checked-in count, and attendance rate, including cancellation history and zero-denominator handling. | FR-22, FR-23; BR-02, BR-09, BR-18; NFR-01, NFR-04, NFR-06, NFR-08 | F-05 to F-07; a consistent committed data view; approve or revise proposed D-10 and BR-18 through change control before accepting the contract. | Sprint 3 |

## 3. Cross-cutting system responsibilities

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

## 4. Increment boundaries

The following split prevents mixed-sprint requirements from being silently completed or deferred as a whole:

| Baseline item | Sprint 1 boundary | Later extension |
| --- | --- | --- |
| FR-12 | F-03 shows public details, UTC+7 display time, capacity, remaining places, and availability. | F-05 adds the optional deadline display in Sprint 2. |
| FR-13 | F-03 registers an authenticated Participant under the Sprint 1 eligibility rules, with no time-based closure. | F-05 applies BR-14's effective deadline in Sprint 2. |
| FR-14 | F-03 retrieves active personal registrations and proves persistence. | F-06 exposes the cancelled lifecycle state in Sprint 2. |
| FR-16 | F-03 explains malformed, missing, unpublished, duplicate, and full outcomes. | F-05 adds the closed-registration outcome in Sprint 2. |
| BR-15 | F-02 treats published capacity as fixed. | F-05 adds the proposed controlled capacity-edit workflow in Sprint 2. |
| NFR-07 | SR-06 defines the proposed performance target and reproducible method. | SR-06 performs quantitative verification in Sprint 3. |
| NFR-11 | SR-05 proves documented local execution and deployment suitability. | Lab 5 proves container/cloud delivery; the responsibility is retained through Sprints 2 and 3. |

## 5. Decision status and change control

This inventory carries forward approved SRS decisions D-02, D-03, D-04, D-08 and resolved questions Q-08, Q-09, Q-11. It does not elevate proposed policies to approved decisions.

Before their affected feature contracts are accepted:

- F-05 must resolve Q-01 to Q-03.
- F-06 must resolve Q-04 and Q-06, and address Q-10.
- F-07 must resolve Q-05 and address Q-10.
- F-08 must confirm or revise D-10 and BR-18, and address Q-10.
- SR-06 must confirm or revise the proposed numerical targets identified by D-12.

Q-07 remains outside the baseline: Organizer-initiated event cancellation has no feature ID or FR. This inventory does not add it. Any approved scope or policy change must update `srs.md`, this inventory, `traceability.md`, the sprint plan, and affected contracts while preserving existing IDs and recording the rationale.
