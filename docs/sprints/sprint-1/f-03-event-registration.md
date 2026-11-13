# F-03 — Public Event Discovery and Participant Registration

**Issue:** I-05 — Contract: Event Registration & Organizer Management

**Contract version:** 0.1
**Status:** Draft for teammate review; not yet accepted for implementation

> This is a versioned design and verification plan. It records no implementation, test execution, review approval, or completion evidence.

## A. Feature overview

### Scope and objective

F-03 lets visitors browse published University Events and public details, then lets an authenticated Participant register themself and retrieve persisted personal registrations. It provides explicit availability, empty, success, validation, and conflict states while keeping registrant and credential data private.

### Requirement and responsibility links

| Type | IDs | F-03 coverage |
| --- | --- | --- |
| Functional requirements | FR-11, FR-12, FR-13, FR-14, FR-16 | Public discovery, self-registration, personal retrieval, and safe rejection outcomes |
| Business rules | BR-03 to BR-11 | Privacy, valid event association, publication eligibility, uniqueness, capacity, concurrency, and atomic writes |
| Non-functional requirements | NFR-01, NFR-04 to NFR-10 | Privacy, persistence, concurrency, safe recovery, accessibility, maintainability, verification, and performance method |
| System responsibilities | SR-01, SR-02, SR-03, SR-04, SR-06 | Authorization, persistent integrity, accessible states, traceability, and performance method |
| Approved decisions | D-02, D-04, D-08, Q-08, Q-09, Q-11 | Single-role accounts, public discovery, UTC storage, Asia/Bangkok presentation, server identity, and no Sprint 1 time cutoff |

### Dependencies and authorization

- F-01 supplies the validated server-side session and Participant role; identity is derived from that session, never from request fields.
- F-02 supplies committed Event records and the publication boundary. Only successfully committed published Events are eligible for public discovery and registration.
- PostgreSQL and Prisma are team-approved core technologies. Registration uniqueness, foreign keys, and capacity guards are database-backed.
- The five approved F-03 endpoint paths/methods are fixed below; F-04 defines the sixth approved endpoint separately. Response envelopes, field schemas, error codes, CSRF transport, pagination, and testing tools remain Proposed.

Visitors may list published Events and view public details without login under Q-08. Participants may register only themselves and retrieve only their own records. Organizers do not use F-03 to register; backend role checks deny Organizer registration requests. UI route guards are navigation aids, not authorization.

### Sprint 1 scope and exclusions

Included: published list/detail, public projection, capacity and remaining-place display, Asia/Bangkok (UTC+7) presentation of UTC instants, self-registration, persisted personal list/detail, duplicate/full/unpublished/missing-event rejection, transaction-safe last-place and duplicate races, rollback on failure, and accessible states.

Excluded: cancellation, re-registration, deadlines or time-based closure, capacity editing, check-in, attendance, summaries, QR codes, notifications, waitlists, and any requirement to register before event start. These remain later features or outside scope.

## B. Feature design / Feature SDS

### UI screens and flows

| Screen/component | Permitted roles | Behavior |
| --- | --- | --- |
| Published Event List | Visitor, Participant, Organizer | Load published public projection; show explicit loading, populated, and empty states. |
| Published Event Detail | Visitor, Participant, Organizer | Show title, description, location, UTC+7-labelled times, capacity, remaining places, and availability. |
| Participant Registration | Participant | Submit self-registration; show validation, duplicate/full/unpublished conflict, success, and loading states. |
| My Registrations List | Participant | Retrieve only current Participant's persisted registrations; show empty state. |
| My Registration Detail | Participant | Open one own registration by ID; show event identity/details, active status, and registration time. |

Public list/detail responses contain no registrant identities, credentials, password hashes, session IDs, or unrelated user fields. A full Event displays zero remaining places and unavailable registration; the backend rechecks availability at submission. Errors are actionable without revealing private-record existence. Controls have visible labels, keyboard focus, announced status, and no color-only meaning.

### API specifications

| Method and approved path | Authentication/authorization | Proposed request and success representation | Proposed status/failure policy |
| --- | --- | --- | --- |
| `GET /api/v1/events` | Public | Return an illustrative Proposed shape such as `{ "data": { "events": [{ "id": "event-id", "title": "Workshop", "description": "...", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z", "capacity": 10, "remainingPlaces": 9, "registrationAvailable": true }] } }`. | `200`; optional bounded pagination only, no private fields. |
| `GET /api/v1/events/{id}` | Public | Return `{ "data": { "event": { "id": "event-id", "title": "...", "description": "...", "location": "...", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z", "capacity": 10, "remainingPlaces": 9, "registrationAvailable": true } } }` as an illustrative Proposed shape. | `200`; privacy-preserving `404`/unavailable for missing, private, or unpublished IDs. |
| `POST /api/v1/events/{id}/registrations` | Valid Participant session; self only | No participant ID accepted; return an illustrative Proposed shape such as `{ "data": { "registration": { "id": "registration-id", "eventId": "event-id", "participantId": "participant-id", "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" } } }`. | Proposed `201`; `400` malformed, `401` missing/invalid session, `403` wrong role, privacy-preserving `404`, `409` duplicate/full, `422` invalid domain input, safe `500` failure. |
| `GET /api/v1/me/registrations` | Valid Participant session; ID derived exclusively from session | Return an illustrative Proposed shape such as `{ "data": { "registrations": [{ "id": "registration-id", "event": { "id": "event-id", "title": "Workshop", "description": "...", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z" }, "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" }] } }`; query filters by authenticated Participant. | Proposed `200`; empty list explicit; `401` invalid session. Optional bounded pagination only. |
| `GET /api/v1/me/registrations/{id}` | Valid Participant session; detail predicate requires `registration.participantId = session.userId` | Return an illustrative Proposed shape such as `{ "data": { "registration": { "id": "registration-id", "event": { "id": "event-id", "title": "Workshop", "description": "...", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z" }, "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" } } }`. | Proposed `200`; privacy-preserving `404` for missing or another Participant's ID; `401` invalid session. |

The five F-03 paths and methods above are **Approved (Teammate Confirmed)**; F-04 defines the sixth approved endpoint separately. Request fields, response fields, exact status codes, error codes, pagination, and CSRF transport remain Proposed. Success responses use `{ "data": ... }`; failures use `{ "error": { "code", "message", "details": [...] } }`. No error code or message may distinguish a private Event from a missing one. Cookie-authenticated POST uses the reviewed F-01 CSRF/origin-validation mechanism; read-only GETs do not mutate domain data. Sprint 1 pagination is optional: local lists may return all authorized records, while bounded pagination may be added through a separately reviewed convention.

### Data, transactions, and consistency

Registration requires a generated primary key `id`, non-null `eventId`, non-null `participantId`, non-null `status`, and non-null `registeredAt`; `eventId` references Event and `participantId` references User/Participant with foreign keys. Event publication state and capacity are read from the committed Event. Required referential integrity rejects orphan rows, and useful indexes include `(eventId, status)`, `(participantId, status)`, and `registeredAt` for authorized list/detail queries.

The database requirement is at most one `ACTIVE` row per `(participantId, eventId)` while retaining future `CANCELLED` history. An unrestricted permanent composite unique constraint is therefore not acceptable. The proposed PostgreSQL strategy is a partial unique index such as `UNIQUE (participantId, eventId) WHERE status = 'ACTIVE'`, created in a reviewed custom SQL Prisma migration if the selected Prisma version/schema cannot express the filtered index directly. Prisma model fields and migration history remain required; exact migration syntax and deployment ordering remain implementation decisions. A rollback must restore the prior compatible schema only when no later data depends on it, and destructive history removal is not permitted.

The service executes registration in a PostgreSQL transaction using an Event-row lock or equivalent atomic conditional capacity guard, then checks active uniqueness and inserts the Registration. The transaction commits only when the Event is published, the Participant/Event association is valid, no active duplicate exists, and active count is below capacity. A failed guard, partial-index uniqueness conflict, validation failure, or injected persistence failure rolls back all writes. Frontend button disabling and an in-memory mutex are not correctness mechanisms.

Schema requirements above are mandatory design constraints. Index names, Prisma model naming, migration command, connection-pool settings, and exact custom SQL are implementation choices that require review; this documentation creates no executable migration.

**Concurrent last place:** for capacity 1 and two distinct eligible Participants, synchronized requests serialize on the Event guard or atomic update. With no unrelated failure, exactly one commits; the other receives a safe conflict. After both responses, the real database must show one active row and zero remaining places.

**Concurrent duplicate:** for two synchronized requests from one Participant for one Event, at most one active row commits and one place is consumed. The rejected request leaves the original registration unchanged; the database is inspected after both responses.

**Controlled failure:** inject a failure during insert/commit and verify no Registration row, active-count change, or false success remains. Existing committed Events and Registrations are unchanged.

### Cross-feature integration

- F-01 → F-03: session middleware derives the Participant identity and role; missing, expired, or revoked sessions cannot register.
- F-02 → F-03: only committed published Events enter the public projection and eligibility checks.
- F-03 → F-04: F-04 reads the same committed Registration rows created here.
- Future features may add cancellation, deadlines, capacity changes, check-in, or summaries through reviewed migrations/contracts without changing Sprint 1 invariants.

## C. Acceptance Criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F03-01 | FR-11, Q-08, NFR-01 | Visitor and authenticated users receive only published public Events; unpublished rows and private/registrant fields are absent. |
| AC-F03-02 | FR-12, D-08, Q-11, NFR-08 | Event detail shows required public fields, capacity, remaining places, availability, and UTC instants rendered with Asia/Bangkok (UTC+7) labels. |
| AC-F03-03 | FR-11, FR-12, NFR-08 | Loading, populated, empty, full/unavailable, validation, error, and success states are explicit and keyboard-accessible. |
| AC-F03-04 | FR-13, BR-03, BR-04, NFR-01 | Only an authenticated Participant can register; identity is derived from the session and client participant IDs are ignored or rejected. |
| AC-F03-05 | FR-13, BR-06, BR-07 | Missing, malformed, nonexistent, or unpublished Event identifiers are rejected without a Registration or consumed place. |
| AC-F03-06 | FR-13, BR-08 | A successful eligible request creates exactly one persisted active Registration with stable ID, authenticated Participant, Event, and timestamp. |
| AC-F03-07 | FR-14, BR-03, NFR-01 | A Participant can retrieve a personal registration list and open an individual registration containing the Event identity and required Event details, Registration identity and active status, and registration timestamp; direct substitution of another Participant's registration ID is denied. |
| AC-F03-08 | FR-16, BR-08, NFR-06 | A duplicate active request returns an actionable conflict and leaves the original registration and counts unchanged. |
| AC-F03-09 | FR-16, BR-09, NFR-06 | A full Event returns an actionable unavailable conflict and does not create a row or consume a place. |
| AC-F03-10 | BR-09, BR-10, NFR-05 | Two distinct eligible Participants racing for the last place produce exactly one success, one safe conflict, one committed active row, and zero remaining places. |
| AC-F03-11 | BR-08, NFR-05 | Two synchronized requests by the same Participant produce at most one active row and one consumed place; the original row remains unchanged. |
| AC-F03-12 | BR-11, NFR-06 | A controlled persistence failure or rejected write rolls back with no partial Registration, count change, or false success. |
| AC-F03-13 | FR-14, NFR-04 | Accepted Registration data remains retrievable after application restart from the configured database. |
| AC-F03-14 | NFR-09, NFR-10, SR-04 | The reviewed contract retains stable IDs and every AC maps to a planned test and later actual evidence before Done. |
| AC-F03-15 | NFR-07, SR-06 | The Sprint 1 contract documents and reviews the Proposed reproducible performance method and target; no quantitative performance execution is required or claimed in Sprint 1. |
| AC-F03-16 | FR-11, FR-13, FR-14, FR-15, BR-02, BR-03, BR-04, NFR-01, NFR-04 | The planned end-to-end journey creates/publishes an Event as an Organizer, discovers it publicly, registers as a Participant, retrieves the personal Registration, and retrieves the same committed Registration through F-04; ownership, persistence, privacy, and stable associations are verified. |

## D. Software Test Specification (planned; not executed)

| Test ID | AC | Level | Preconditions and steps | Expected result and database/privacy assertions |
| --- | --- | --- | --- | --- |
| TEST-F03-01 | AC-F03-01 | API Integration | Seed published/unpublished Events; call list/detail anonymously and authenticated. | Only published public projections return; no registrant, credential, session, or owner-private fields. |
| TEST-F03-02 | AC-F03-02 | API/UI | Use event fixtures with capacity/remaining values and UTC instants; inspect detail. | Values and availability are correct; display is labelled Asia/Bangkok UTC+7. |
| TEST-F03-03 | AC-F03-03 | UI/E2E | Exercise loading, empty, full, validation, error, success, keyboard, and focus states. | States are explicit, accessible, and do not leak protected data. |
| TEST-F03-04 | AC-F03-04 | API Integration | Anonymous, Participant, Organizer, and spoofed participant-ID requests. | Only Participant self-registration proceeds; server identity wins; denied requests mutate nothing. |
| TEST-F03-05 | AC-F03-05 | API/Database Integration | Submit missing, malformed, nonexistent, private, and unpublished Event IDs. | Privacy-preserving unavailable/not-found outcome does not distinguish missing/private/unpublished Events; zero Registration rows and unchanged capacity/counts. |
| TEST-F03-06 | AC-F03-06 | API/Database Integration | Valid Participant registers for published Event; inspect response and database. | One active row with stable ID, correct foreign keys, timestamp, and one consumed place. |
| TEST-F03-07 | AC-F03-07 | API/Database Integration | Create registrations for two Participants; retrieve each personal list and individual detail, inspect Event identity/details, Registration identity/status/timestamp, substitute the other Participant's registration ID, then repeat retrieval after application restart. | Each Participant sees only their own list/detail with required Event and Registration fields; direct ID substitution is denied; authorized records remain retrievable after restart. |
| TEST-F03-08 | AC-F03-08 | API/Database Integration | Register once, repeat active request, including identifier tampering. | Actionable duplicate conflict; original row/count unchanged; no private leakage. |
| TEST-F03-09 | AC-F03-09 | API/Database Integration | Fill Event, then submit another eligible registration. | Full conflict; active count equals capacity; no extra row/place consumption. |
| TEST-F03-10 | AC-F03-10 | Database Integration | Capacity 1; synchronize two distinct eligible Participant requests; inspect committed state. | Exactly one success; one conflict; one active row; remaining places zero. Sprint 1 plans five fresh races of this type, subject to the SRS proposed target and team review; execution is not claimed. |
| TEST-F03-11 | AC-F03-11 | Database Integration | Synchronize two requests from one Participant for one Event. | At most one active row and one consumed place; original row unchanged. Sprint 1 plans five fresh same-Participant races, subject to the SRS proposed target and team review; execution is not claimed. |
| TEST-F03-12 | AC-F03-12 | Database Integration | Inject failure during registration insert/commit and compare before/after state. | Safe failure; no partial row/count/place change or false success. |
| TEST-F03-13 | AC-F03-13 | API/Database Integration | Register, restart application, create fresh session, retrieve personal list/detail. | Same persisted registration and Event association are returned. |
| TEST-F03-14 | AC-F03-14 | E2E/Review | Inspect contract history, AC/TEST map, implementation result table, and tested commit at completion review. | Stable IDs and actual evidence exist before Done; planned tests are not treated as executed. |
| TEST-F03-15 | AC-F03-15 | Review/Planning | Review the proposed operation set, workload, fresh-pair fixture rule, metrics, target, and Sprint 3 execution boundary against NFR-07/SR-06. | Method is reproducible and complete; p95/zero-error targets remain Proposed; no Sprint 1 benchmark is run or claimed. |
| TEST-F03-16 | AC-F03-16 | E2E | Organizer logs in with F-01, creates/publishes a valid Event through F-02, verifies public F-03 discovery, Participant logs in and registers, retrieves My Registrations, then the owning Organizer retrieves the same Event's registrations through F-04 using UI, API, and PostgreSQL. Try another Organizer's list request. | Stable Event and Registration IDs persist; Participant/Event/status/timestamp associations match; owner sees the same committed row; another Organizer is denied; no private fields or session material leak. Planned only; not implemented or executed. |
| TEST-F03-17 | AC-F03-06 | Unit | Evaluate registration eligibility with valid Event/Participant context and active-capacity state without HTTP or database. | Eligible case allows evaluation with server identity supplied by the caller boundary; no persistence or concurrency guarantee is inferred. |
| TEST-F03-18 | AC-F03-09 | Unit | Evaluate capacities 0, 1, and active counts at/over capacity. | Full states reject and available state allows evaluation; no database guarantee is inferred. |
| TEST-F03-19 | AC-F03-08, AC-F03-11 | Unit | Evaluate no active row, existing ACTIVE row, and cancelled row for one Participant/Event pair. | Existing ACTIVE maps to duplicate conflict; no active/cancelled state remains eligible for later policy checks; database uniqueness is not claimed by this unit test. |
| TEST-F03-20 | AC-F03-05, AC-F03-08, AC-F03-09, AC-F03-12 | Unit | Map missing, unpublished, duplicate, full, malformed, and persistence-failure domain outcomes to safe errors. | Error mapping is actionable and privacy-preserving without revealing private Event existence. |
| TEST-F03-21 | AC-F03-02, AC-F03-09 | Unit | Evaluate capacity and active-count boundary values. | Remaining places equals capacity minus active count; zero is unavailable and negative persisted states are rejected. |

### Proposed Performance Verification Method

This method is **Proposed** and is documented/reviewed in Sprint 1; quantitative execution belongs to Sprint 3. Measure the published-event list, published-event detail, and eligible Participant registration through the real API and database. Use fresh eligible Participant–Event pairs with sufficient capacity for registration requests. The proposed target is p95 latency at most two seconds for each operation with zero unexpected server errors; numerical targets remain subject to team review.

Record latency, request counts, errors, environment, tested commit, and database persistence (including accepted registrations). The Sprint 3 workload is 20 sequential requests per operation plus 60 seconds using 10 concurrent clients, 100 Events, and 1,000 seeded Registrations. Do not bypass validation or weaken business rules.

## E. Contract history and completion evidence

### Version history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial F-03 design, AC, planned STS, concurrency scenarios, and proposed performance method. |

### Baseline and open decisions

- Approved baseline: D-02, D-04, D-08, Q-08, Q-09, Q-11, and the team-approved React/TypeScript/Vite, Node.js/Express/TypeScript, PostgreSQL, and Prisma stack.
- Proposed/open: request/response fields and envelopes, exact statuses/error codes, pagination, CSRF transport, testing tools, and NFR-05/NFR-07 numerical targets. The five F-03 endpoint paths/methods are teammate-confirmed; complete API contracts are not yet approved.

### Future completion evidence placeholders

- Teammate review: **TBD** — review decision and findings.
- Implementation Issue/PR: **TBD** — link, branch, and merged commit.
- Actual test source/results: **TBD** — files, commands, counts, failures/skips, and results.
- Tested commit/release evidence: **TBD** — tested SHA, release reference, and persistence/concurrency evidence.

No implementation or test execution is claimed. The contract must be accepted and reconciled with F-01, F-02, and F-04 before implementation.
