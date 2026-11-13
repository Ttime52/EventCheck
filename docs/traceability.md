# EventCheck Requirements Traceability Matrix

## 1. Scope and status conventions

This matrix maps every baseline Functional Requirement (FR), Business Rule (BR), and Non-Functional Requirement (NFR) in [`srs.md`](srs.md) to the stable features and system responsibilities in [`features.md`](features.md), a planned sprint, and a verification method. It is a planning artifact; it does not claim that implementation or test execution has occurred.

The current SRS includes PR #4, merged into `sprint-1-staging` at commit `1f0eb85`. The `AC-*` and `TEST-*` values shown in `project_deliverable_1_v1.pdf` are appointment-system examples, not EventCheck IDs. The Sprint 1 F-01 and F-02 contracts now define planned AC and STS IDs, mapped below; both contracts are drafts for teammate review and are not accepted for implementation yet. F-03 and F-04 contracts and IDs remain unestablished. Accordingly:

- **G-01** means that Sprint 1 AC and TEST IDs are still missing for F-03, F-04, and any uncovered portions of shared requirements. Create and review those contracts, then add their mappings here before implementation. F-01/F-02 mappings are recorded below; their IDs are planned and do not imply test execution.
- **Deferred** means that AC and TEST IDs are intentionally assigned when the applicable Sprint 2 or Sprint 3 contract is prepared before implementation, as allowed by Part B.
- A planned verification method is not an executed result. Actual test name, file, command, result, and tested commit must be added when evidence exists.

## 2. Functional requirements

| Requirement | Feature or responsibility | Planned sprint | Planned verification | AC/Test IDs or status |
| --- | --- | --- | --- | --- |
| FR-01 — Valid login | F-01; SR-05 | Sprint 1 | API/integration and selected UI journey using valid seeded Participant and Organizer credentials; confirm subsequent protected requests use the server-assigned identity and role. | AC-F01-01 / TEST-F01-01 |
| FR-02 — Invalid login | F-01; SR-01, SR-05 | Sprint 1 | Negative API/UI cases for invalid and missing credentials; assert generic failure, no session, and no credential or account-existence leakage. | AC-F01-02 / TEST-F01-02 |
| FR-03 — Logout | F-01 | Sprint 1 | Auth lifecycle integration test: logout invalidates the server session, clears the browser cookie, and rejects replay of the invalidated identifier. | AC-F01-04 / TEST-F01-04 |
| FR-04 — Current identity | F-01; SR-01 | Sprint 1 | Integration cases for valid, missing, invalid, expired, and revoked sessions; return only identifier, display name, and role for a valid session. | AC-F01-03, 05, 06, 07 / TEST-F01-03, 05, 06, 07 |
| FR-05 — Protected access | F-01; SR-01 | Sprint 1; extend in Sprints 2-3 | Direct API matrix for unauthenticated, wrong-role, cross-participant, and cross-owner requests; assert no protected fields or mutations for every applicable operation. | F-01: AC-F01-05, 08 / TEST-F01-05, 08; later extensions: G-01 / Deferred |
| FR-06 — Create event | F-02; SR-01, SR-02 | Sprint 1 | API/database integration: Organizer-created event receives stable identity and authenticated owner and survives retrieval; anonymous and Participant attempts leave no event. | AC-F02-02, 06, 07, 12, 13 / TEST-F02-02, 06, 07, 12, 13 |
| FR-07 — Validate event details | F-02; SR-02, SR-03 | Sprint 1 | Boundary tests for blank fields, invalid instants, equal/reversed times, and missing/zero/negative/fractional capacity; assert field errors and no partial publication. | AC-F02-01, 03, 04, 05, 12 / TEST-F02-01, 03, 04, 05, 12 |
| FR-08 — Publish event | F-02; SR-01, SR-02 | Sprint 1 | Owner publication integration and end-to-end cases; verify persisted publication and public discovery, and deny unauthorized publication without state change. | AC-F02-02, 06, 07, 10, 11, 12 / TEST-F02-02, 06, 07, 10, 11, 12 |
| FR-09 — Retrieve owned events | F-02; SR-01 | Sprint 1 | Organizer retrieval and empty-state cases plus cross-owner identifier substitution; unpublished records, if supported, remain owner-only. | AC-F02-08, 09, 13 / TEST-F02-08, 09, 13 |
| FR-10 — Modify capacity and deadline | F-05; SR-01, SR-02 | Sprint 2 | Controlled-time and transactional integration tests for valid edits, invalid deadline, nonpositive or below-active capacity, at/after-start edit, and capacity-edit/registration race; inspect unchanged rejected state. | Deferred to Sprint 2 contract |
| FR-11 — List published events | F-03; SR-01, SR-03 | Sprint 1 | Anonymous and authenticated API/UI cases for populated and empty lists; unpublished events and all participant/private fields are absent. | G-01 — none established |
| FR-12 — View event details | F-03; F-05; SR-01, SR-03, SR-06 | Sprint 1; deadline extension in Sprint 2 | Sprint 1 detail tests cover agreed fields, labelled UTC+7 time, capacity, remaining places, full/unavailable state, and privacy; Sprint 2 adds optional deadline display. | Sprint 1: G-01; Sprint 2: Deferred |
| FR-13 — Register for event | F-03; F-05; SR-01, SR-02, SR-06 | Sprint 1; deadline extension in Sprint 2 | Real API/database registration and selected UI journey; assert persisted identity/status, authenticated self-association, no spoofed participant, and later controlled-time deadline enforcement. | Sprint 1: G-01; Sprint 2: Deferred |
| FR-14 — Retrieve own registrations | F-03; F-06; SR-01, SR-02 | Sprint 1; cancelled-state extension in Sprint 2 | Personal list/detail after refresh and application restart, including required event/status/time fields; cross-participant denial; Sprint 2 shows retained cancelled state. | Sprint 1: G-01; Sprint 2: Deferred |
| FR-15 — Retrieve event registrations | F-04; SR-01, SR-02 | Sprint 1 | Owner list/detail integration cases for populated and empty events; verify exact event scope and allowed fields; deny Participants and unrelated Organizers. | G-01 — none established |
| FR-16 — Explain registration rejection | F-03; F-05; SR-01 to SR-03 | Sprint 1; closed-registration extension in Sprint 2 | Authorized rejection matrix for malformed, missing, unpublished, duplicate, and full targets, then closed registration in Sprint 2; verify actionable safe outcomes and no invalid record/place consumption. | Sprint 1: G-01; Sprint 2: Deferred |
| FR-17 — Cancel own registration | F-06; SR-01, SR-02 | Sprint 2 | Controlled-time, persistence, repeat, concurrent, checked-in, and cross-participant cases; cancellation releases exactly one place, preserves history, and denied attempts change nothing. | Deferred to Sprint 2 contract |
| FR-18 — Register again after cancellation | F-06; SR-02 | Sprint 2 | Eligible and ineligible re-registration integration cases; retain prior cancelled record, recheck current deadline/capacity/publication rules, and assert at most one active record. | Deferred to Sprint 2 contract |
| FR-19 — Record check-in | F-07; SR-01, SR-02 | Sprint 2 | Owner check-in API/database and UI cases; inspect the single persisted event, registration, participant, actor, and timestamp association; deny other actors. | Deferred to Sprint 2 contract |
| FR-20 — Reject invalid check-in | F-07; SR-01 to SR-03 | Sprint 2 | Active, cancelled, unregistered, wrong-event, before-start, at-end, and sequential/concurrent duplicate fixtures; assert permitted explanation and unchanged prior state. | Deferred to Sprint 2 contract |
| FR-21 — Retrieve attendance | F-07; SR-01, SR-03 | Sprint 2 | Owner and corresponding-Participant retrieval plus cross-owner/cross-participant denial; show time when present and “not checked in” when absent without inferring attendance. | Deferred to Sprint 2 contract |
| FR-22 — Registration summary | F-08; SR-01 to SR-03 | Sprint 3 | Known persisted fixtures with active, cancelled, and re-registered records; reconcile capacity, counts, and remaining places and deny cross-owner access. | Deferred to Sprint 3 contract |
| FR-23 — Attendance summary | F-08; SR-01 to SR-03 | Sprint 3 | Known attendance fixtures; reconcile checked-in and not-checked-in active counts, one-decimal rate, and zero-active N/A behavior; deny cross-owner access. | Deferred to Sprint 3 contract |

## 3. Business rules

| Requirement | Feature or responsibility | Planned sprint | Planned verification | AC/Test IDs or status |
| --- | --- | --- | --- | --- |
| BR-01 — Organizer publication role | F-02; SR-01 | Sprint 1 | Direct anonymous and Participant create/publish requests; compare database state before and after denial. | AC-F02-06 / TEST-F02-06 |
| BR-02 — Event ownership | F-02, F-04 to F-08; SR-01 | Establish Sprint 1; extend Sprints 2-3 | Two Organizers attempt cross-owner reads and writes for every introduced management operation; reject client owner override with no data or mutation. | F-02: AC-F02-07, 08, 09 / TEST-F02-07, 08, 09; F-04 Sprint 1: G-01; later extensions: Deferred |
| BR-03 — Registration privacy | F-03, F-04, F-06, F-07; SR-01 | Establish Sprint 1; extend Sprint 2 | Two Participants substitute registration identifiers; verify owner list exception is read-only and event-scoped; deny impersonated cancellation and unrelated attendance access. | Sprint 1: G-01; Sprint 2: Deferred |
| BR-04 — Authentication required | F-01 to F-08 as applicable; SR-01 | Establish Sprint 1; retain Sprints 2-3 | Missing, invalid, expired, and revoked session tests on protected operations; public discovery remains available and returns no private data. | F-01: AC-F01-05, 08 / TEST-F01-05, 08; F-02: AC-F02-06, 07, 09 / TEST-F02-06, 07, 09; F-03/F-04: G-01; later regression: Deferred |
| BR-05 — Positive event capacity | F-02, F-05; SR-02 | Sprint 1; editing in Sprint 2 | Inputs missing, 0, -1, 1.5, and 1 at publication and later edit; invalid input leaves publication/capacity unchanged. | F-02: AC-F02-05 / TEST-F02-05; Sprint 2: Deferred |
| BR-06 — Valid event association | F-03; SR-02 | Sprint 1 | Invalid/nonexistent event and spoofed participant requests; inspect storage for no orphan or invalid Registration. | G-01 — none established |
| BR-07 — Published event eligibility | F-02, F-03; SR-01, SR-02 | Sprint 1 | Anonymous/authenticated discovery inspection and direct registration by known unpublished ID; assert omission, denial, and no consumed place. | F-02 publication visibility boundary: AC-F02-11 / TEST-F02-11; F-03 discovery/registration: G-01 |
| BR-08 — One active registration | F-03, F-06; SR-02 | Sprint 1; re-registration extension in Sprint 2 | Sequential and synchronized same-Participant requests; inspect committed active count and place consumption; repeat after cancellation in Sprint 2. | Sprint 1: G-01; Sprint 2: Deferred |
| BR-09 — Capacity invariant | F-03, F-05, F-06, F-08; SR-02 | Establish Sprint 1; retain Sprints 2-3 | Fill event, submit extra request, cancel once, re-register, edit capacity, and reconcile summaries; inspect committed counts and unchanged rejected state. | Sprint 1: G-01; later extensions: Deferred |
| BR-10 — Concurrent last place | F-03, F-05; SR-02 | Sprint 1; capacity-edit extension in Sprint 2 | Synchronized real API/database races for two eligible Participants and for capacity edit versus registration; inspect records and capacity, not only response codes. | Sprint 1: G-01; Sprint 2: Deferred |
| BR-11 — Rejected writes are atomic | F-03, F-05 to F-07; SR-02 | Establish Sprint 1; extend Sprint 2 | Exercise each rejection path and controlled persistence failures; compare before/after records and counts for no partial registration, edit, cancellation, or attendance transition. | Sprint 1: G-01; Sprint 2: Deferred |
| BR-12 — Complete publication details | F-02; SR-02 | Sprint 1 | Missing/whitespace fields, invalid instants, equal/reversed times, and positive-capacity boundaries; publication remains false on rejection. | AC-F02-03, 04, 05 / TEST-F02-03, 04, 05 |
| BR-13 — Cancellation lifecycle | F-06; SR-02 | Sprint 2 | Fixed-clock before/at-start, after-deadline, checked-in, repeated, and concurrent cancellation cases; release a place once and preserve state/history. | Deferred to Sprint 2 contract |
| BR-14 — Registration deadline | F-05, F-06; SR-02 | Sprint 2 | Fixed-clock immediately before/at/after explicit and start-default deadlines; invalid deadline edits and re-registration checks leave no partial data. | Deferred to Sprint 2 contract |
| BR-15 — Capacity modification | F-02, F-05; SR-02 | Fixed boundary in Sprint 1; edit workflow in Sprint 2 | Sprint 1 confirms published capacity cannot change; Sprint 2 tests below-active, nonpositive, at/after-start, and edit/registration-race cases with unchanged rejection state. | F-02 Sprint 1 boundary: AC-F02-10 / TEST-F02-10; Sprint 2: Deferred |
| BR-16 — Check-in eligibility | F-07; SR-01, SR-02 | Sprint 2 | Authorized active registration at start and before end plus cancelled, unregistered, wrong-event, before-start, and at/after-end cases; inspect no invalid Attendance. | Deferred to Sprint 2 contract |
| BR-17 — Duplicate attendance prevention | F-07; SR-02 | Sprint 2 | Sequential and synchronized duplicate check-ins; assert one record and preservation of original actor/time. | Deferred to Sprint 2 contract |
| BR-18 — Summary reconciliation | F-08; SR-01, SR-02 | Sprint 3 | Consistent known fixtures including cancellation, re-registration, attendance, zero active count, cross-owner request, and concurrent change; verify formulas and retrieval failure rather than contradictory totals. | Deferred to Sprint 3 contract |

## 4. Non-functional requirements

All twelve NFRs in the SRS are treated as important and are mapped below.

| Requirement | Feature or responsibility | Planned sprint | Planned verification | AC/Test IDs or status |
| --- | --- | --- | --- | --- |
| NFR-01 — Backend authorization without private-data leakage | SR-01; F-01 to F-08 as applicable | Establish/verify Sprint 1; extend Sprints 2-3 | Integration matrix for every protected operation and public response-field inspection; require zero protected fields and zero unauthorized mutations. | F-01: AC-F01-03, 05, 08 / TEST-F01-03, 05, 08; F-02: AC-F02-06 to 09, 11 / TEST-F02-06 to 09, 11; F-03/F-04 and later extensions: G-01 / Deferred |
| NFR-02 — Password and session-material protection | F-01; SR-05 | Establish/verify Sprint 1; retain Sprints 2-3 | Inspect synthetic credential storage, hashing library/salts, session configuration, cookie flags, responses, client artifacts, and routine logs; automated hashing/session checks. | F-01: AC-F01-02, 09, 11 / TEST-F01-02, 09, 11; later regression: Deferred |
| NFR-03 — Documented authentication lifecycle | F-01 | Establish/verify Sprint 1; regress Sprints 2-3 | Controlled-time lifecycle tests for valid/invalid login, identity, idle and absolute expiry, revocation, logout, replay, fixation, and CSRF behavior; inspect SDS/configuration. | F-01: AC-F01-01, 04, 05, 06, 07, 10 / TEST-F01-01, 04, 05, 06, 07, 10; later regression: Deferred |
| NFR-04 — Preserve committed domain data | SR-02; F-02 to F-08 as introduced | Establish/verify Sprint 1; extend Sprint 2; deploy at Lab 5 | Real-database restart/retrieval for Event and Registration, later Cancellation and Attendance; repeat with configured durable database after Lab 5. | F-02 Event: AC-F02-02, 13 / TEST-F02-02, 13; F-03/F-04 persistence: G-01; later extensions: Deferred |
| NFR-05 — Concurrency-safe capacity and uniqueness | SR-02; F-03, F-05 to F-07 | Establish/verify Sprint 1; extend Sprint 2; regress Sprint 3 | Sprint 1 proposed 5 fresh last-place and 5 same-Participant races; Sprint 2 edit/registration, repeated-cancellation, and duplicate-check-in races; Sprint 3 expands the first two sets to 20; inspect committed state. | Sprint 1: G-01; later extensions: Deferred |
| NFR-06 — Safe recovery from rejected or failed writes | SR-02; F-02, F-03, F-05 to F-08 | Establish/verify Sprint 1; extend Sprints 2-3 | Negative integration cases and controlled failure injection with database before/after comparison; require unchanged state and no false success. | F-02: AC-F02-03, 04, 05, 12 / TEST-F02-03, 04, 05, 12; other feature coverage: G-01 / Deferred |
| NFR-07 — Reproducible API response-time target | SR-06; F-03 | Define method Sprint 1; quantify Sprint 3 | Review target/workload method in Sprint 1; in Sprint 3 run 20 sequential requests per operation and the specified 60-second, 10-client workload against the real API/database; record p95, counts, errors, environment, commit, and persisted registrations. | Sprint 1 method: G-01; Sprint 3 execution: Deferred |
| NFR-08 — Accessible workflow state and errors | SR-03; F-01 to F-08 | Establish/verify Sprint 1; extend Sprint 2; final review Sprint 3 | Manual keyboard and 1280/390-pixel viewport walkthrough by both students plus selected UI end-to-end checks for labels, focus, and loading/empty/error/success states. | F-01: AC-F01-12 / TEST-F01-12; F-02: AC-F02-01, 14 / TEST-F02-01, 14; F-03/F-04 and later extensions: G-01 / Deferred |
| NFR-09 — Maintainability through versioned requirements and contracts | SR-04 | Establish/verify Sprint 1; maintain Sprints 2-3 | Review feature-to-requirement links, pre-implementation contract history, SDS responsibility allocation, Issues/PRs, teammate review, change revisions, and regression links. | F-01: AC-F01-13 / TEST-F01-13; F-02: AC-F02-15 / TEST-F02-15; F-03/F-04: G-01; review/evidence remains pending |
| NFR-10 — Reproducible automated verification | SR-04 | Establish/verify Sprint 1; expand Sprints 2-3 | Execute documented clean build/test commands; retain command, counts, failures/skips, tested commit, actual-database assertions, and selected end-to-end results; require zero failed required checks. | F-01: AC-F01-13 / TEST-F01-13; F-02: AC-F02-15 / TEST-F02-15; F-03/F-04: G-01; test execution/evidence remains pending |
| NFR-11 — Repeatable deployment | SR-05 | Design/local verification Sprint 1; operational verification Lab 5; retain Sprints 2-3 | Reproduce clean local setup in Sprint 1; at Lab 5 demonstrate fresh container/GCP journey, durable restart, gated failing check, pipeline, and commit identity; regression-check later releases. | Sprint 1: G-01; Lab 5 and later evidence: Deferred |
| NFR-12 — Externalized configuration and no real secrets | SR-05 | Establish/verify Sprint 1; extend at Lab 5 and Sprints 2-3 | Review documented variables and safe examples; inspect repository/client artifacts/logs; secret scan; missing-variable safe-startup failure; reproduce synthetic seed. | F-01 partial: AC-F01-09 / TEST-F01-09; remaining configuration/startup checks: G-01 |

## 5. Coverage result

| Requirement class | Baseline IDs | Mapped | Uncovered |
| --- | ---: | ---: | ---: |
| Functional requirements | 23 | 23 | 0 |
| Business rules | 18 | 18 | 0 |
| Important non-functional requirements | 12 | 12 | 0 |
| **Total** | **53** | **53** | **0** |

There are no requirement-to-feature or requirement-to-responsibility coverage gaps in the current baseline. “Mapped” means allocated and planned; it does not mean implemented, accepted, or verified.

## 6. Explicit gaps and unresolved information

| Gap | Status | Affected scope | Required treatment |
| --- | --- | --- | --- |
| G-01 — F-03/F-04 and remaining Sprint 1 AC/TEST mappings are unestablished | Open artifact gap | F-03 and F-04; uncovered Sprint 1 portions of shared requirements, including remaining NFR-12 configuration/startup checks | Create and review the F-03/F-04 contracts, add their AC/STS IDs and mappings here, and cover any remaining Sprint 1 gaps before implementation. F-01/F-02 IDs are now mapped above; their contracts are still drafts for teammate review. Do not copy illustrative IDs from the assessment PDF. |
| G-02 — Later-sprint lifecycle and management policies remain proposed | Open decisions | Q-01 to Q-06 and Q-10; D-05 to D-07, D-09, D-10, D-13; F-05 to F-08 and later-sprint allocation | Resolve each affected policy through team review before accepting that feature's contract. Preserve the current proposal until an approved change is recorded. |
| G-03 — Numerical acceptance targets remain proposed | Open target review | D-12; NFR-05, NFR-07, NFR-08; F-01 and SR-03, SR-06 | Confirm feasibility or record a justified, approved requirement revision before the affected contract or quantitative verification. Do not silently relax an invariant. |
| G-04 — No execution evidence exists in this documentation baseline | Expected at planning stage | All planned tests, manual checks, releases, and NFR evidence | Add actual file/test name, command, result, and tested commit only after execution. Failed or skipped checks must remain visible. |
| G-05 — Authentication status wording was internally inconsistent | Resolved | D-02 and Q-09 approve the server-side session design and 30-minute idle/8-hour absolute lifecycle; NFR-02/NFR-03 now state the same approved architecture and values, and D-12 no longer classifies expiry targets as proposals. | Closed by this SRS revision. Preserve the approved mechanism and values in F-01, the System-Level SDS, and the associated verification evidence. |
| G-06 — The System-Level SDS artifact was missing at the earlier baseline | Resolved artifact; design follow-up remains | `docs/system-sds.md` now provides the architecture, data, API, authentication/session, access-control, and deployment-intent baseline; exact session-store schema, API names, configuration details, and operational evidence remain pending | Use the current System-Level SDS as the design baseline and review its listed open technical decisions before implementation. Add migration, implementation, deployment, and operational verification evidence only after those activities occur; this update makes no such claim. |
| G-07 — The SRS Sprint 2 summary omits two stated extensions | Baseline summary inconsistency | FR-13's Sprint 2 deadline enforcement and FR-14's Sprint 2 cancelled-status visibility appear in their requirement rows but are not named in Section 10's Sprint 2 allocation summary. | This matrix follows the individual FR statements by mapping the FR-13 extension to F-05 and the FR-14 extension to F-06. Clarify the summary in a future reviewed SRS revision without changing either requirement's ID or meaning. |

Q-07 is not a coverage gap: Organizer-initiated event cancellation is explicitly outside the three-sprint baseline and has no FR. The out-of-scope decision must be revisited through change control if that capability is later requested.

## 7. Approved changes carried forward

PR #4 accepted the current SRS into `sprint-1-staging`. This matrix carries forward the following items whose SRS status is **Agreed - Approved** or **Agreed - Resolved**; this wording does not claim separate instructor or stakeholder approval beyond the SRS record.

| Decision | Accepted baseline effect | Traceability impact |
| --- | --- | --- |
| D-02 | Seeded, single-role synthetic accounts and server-side sessions with Secure, HttpOnly cookies; no account-administration UI. | F-01; FR-01 to FR-05; NFR-02, NFR-03; SR-05. |
| D-03 | University Events context, including workshops, seminars, and student activities. | Product terminology and all F-02 to F-08 domain behavior. |
| D-04 | Sprint 1 event fields; optional deadline in Sprint 2; combined create-and-publish allowed; Sprint 1 published capacity fixed. | F-02, F-05; FR-06 to FR-12; BR-12, BR-15. |
| D-08 | Store/compare UTC-based instants and initially display/input labelled Asia/Bangkok time. | F-02, F-03, F-05 to F-07; FR-07, FR-12; BR-12 to BR-16. |
| Q-08 | Public discovery is allowed, while registration and private/management operations remain protected. | F-03; FR-11, FR-12; BR-04, BR-07; NFR-01. |
| Q-09 | Server-side session lifecycle, expiry, logout invalidation, fixation/CSRF protections, and no identifier leakage. | F-01; FR-01 to FR-05; BR-04; NFR-02, NFR-03. |
| Q-11 | UTC persistence/comparison, labelled Asia/Bangkok input/display, server-authoritative later time rules, and no Sprint 1 cutoff. | F-02, F-03, F-05 to F-07; FR-07, FR-12; BR-12 to BR-16. |

This documentation change adds feature and responsibility mappings only. It does not add, remove, renumber, approve, or change the meaning of any FR, BR, NFR, decision, or open question.

## 8. Maintenance rule

When a contract, requirement, or implementation changes, update this matrix in the same reviewed change. Preserve requirement and feature IDs; record the rationale and approval status; update affected sprint allocation and verification; and retain prior execution results rather than rewriting history.
