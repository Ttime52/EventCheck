# F-03 — Public Event Discovery and Participant Registration

**Contract work item:** I-05 — Event Registration & Organizer Management
**GitHub implementation issue:** #10 — Participant Event Registration

**Contract version:** 0.3
**Status:** Draft for teammate review; implementation and verification evidence are available, but formal teammate acceptance, completion, and merge approval remain pending

> This is a versioned design and verification plan. Implementation and test evidence are reviewed separately; this contract does not by itself constitute completion or approval evidence.

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
- The five approved F-03 endpoint paths/methods and their reviewed request/response structures, envelopes, and error-handling policy are fixed below; F-04 defines the sixth approved endpoint separately. CSRF transport, pagination, and testing tools remain outside or Proposed as noted.

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

| Method and approved path | Authentication/authorization | Approved request and success representation | Approved status/failure policy |
| --- | --- | --- | --- |
| `GET /api/v1/events` | Public | Return the reviewed structure, illustrated by `{ "data": { "events": [{ "id": "event-id", "title": "Workshop", "description": "Introductory workshop", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z", "capacity": 10, "remainingPlaces": 9, "registrationAvailable": true }] } }`. | Approved `200` retrieval policy; pagination is out of scope for Sprint 1 and no private fields are returned. |
| `GET /api/v1/events/{id}` | Public | Return the reviewed structure, illustrated by `{ "data": { "event": { "id": "event-id", "title": "Workshop", "description": "Introductory workshop", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z", "capacity": 10, "remainingPlaces": 9, "registrationAvailable": true } } }`. | Approved `200` retrieval policy; privacy-preserving `404`/unavailable for missing, private, or unpublished IDs. |
| `POST /api/v1/events/{id}/registrations` | Valid Participant session; self only | No participant ID accepted; return the reviewed `{ "data": { "registration": { "id": "registration-id", "eventId": "event-id", "participantId": "participant-id", "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" } } }` structure. | Approved `201`/`400`/`401`/`403`/privacy-preserving `404`/`409`/`422`/safe `500` policy; no existence leakage. |
| `GET /api/v1/me/registrations` | Valid Participant session; ID derived exclusively from session | Return the reviewed structure, illustrated by `{ "data": { "registrations": [{ "id": "registration-id", "event": { "id": "event-id", "title": "Workshop", "description": "Introductory workshop", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z" }, "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" }] } }`; query filters by authenticated Participant. | Approved `200`/`401` policy; empty list explicit; pagination is out of scope for Sprint 1. |
| `GET /api/v1/me/registrations/{id}` | Valid Participant session; detail predicate requires `registration.participantId = session.userId` | Return the reviewed structure, illustrated by `{ "data": { "registration": { "id": "registration-id", "event": { "id": "event-id", "title": "Workshop", "description": "Introductory workshop", "location": "Room 1", "startAt": "2026-01-01T01:00:00Z", "endAt": "2026-01-01T03:00:00Z" }, "status": "ACTIVE", "registeredAt": "2026-01-01T00:00:00Z" } } }`. | Approved `200`/`401`/privacy-preserving `404` policy; cross-Participant IDs remain concealed. |

The five F-03 paths/methods, reviewed request/response structures, `{ "data": ... }` success envelope, `{ "error": { "code", "message", "details": [...] } }` error envelope, and HTTP status/error-handling policy are **Approved (Teammate Confirmed)**; F-04 defines the sixth approved endpoint separately. CSRF transport remains Proposed, and pagination is out of scope for Sprint 1; future pagination requires a separately reviewed extension. No error code or message may distinguish a private Event from a missing one. Cookie-authenticated POST uses the reviewed F-01 CSRF/origin-validation requirement; read-only GETs do not mutate domain data.

### Data, transactions, and consistency

Registration requires a generated primary key `id`, non-null `eventId`, non-null `participantId`, non-null `status`, and non-null `registeredAt`; `eventId` references Event and `participantId` references User/Participant with foreign keys. Event publication state and capacity are read from the committed Event. Required referential integrity rejects orphan rows, and useful indexes include `(eventId, status)`, `(participantId, status)`, and `registeredAt` for authorized list/detail queries.

The selected technical approach for teammate review is PostgreSQL with Prisma's interactive `$transaction`. The database requirement is at most one `ACTIVE` row per `(participantId, eventId)` while retaining future `CANCELLED` history. An unrestricted permanent composite unique constraint is therefore not acceptable. The selected database strategy is a PostgreSQL partial unique index such as `UNIQUE (participantId, eventId) WHERE status = 'ACTIVE'`, created in a reviewed custom SQL Prisma migration if the selected Prisma version/schema cannot express the filtered index directly. Prisma model fields and migration history remain required; exact migration syntax and deployment ordering remain pending teammate acceptance. A rollback must restore the prior compatible schema only when no later data depends on it, and destructive history removal is not permitted.

The proposed registration transaction sequence is:

1. Validate the request through the existing F-01 session, CSRF/origin, and Participant-role middleware; derive `participantId` from the server session.
2. Start a Prisma interactive `$transaction`.
3. Lock the target Event row with PostgreSQL `SELECT ... FOR UPDATE`.
4. Verify that the locked Event exists, is `PUBLISHED`, and has valid capacity.
5. Check for an existing `ACTIVE` registration for the `(participantId, eventId)` pair and return the duplicate conflict first when one exists.
6. If no active duplicate exists, count `ACTIVE` registrations while the Event row remains locked and reject when the count equals capacity.
7. Insert one `ACTIVE` Registration with a server-generated ID and timestamp, then commit.

The partial unique index remains the database backstop for concurrent duplicate requests. A failed publication/eligibility guard, duplicate conflict, capacity conflict, validation failure, or injected persistence failure rolls back all writes. No mutable registration counter is introduced in Sprint 1; active counts are derived from committed Registration rows. Frontend button disabling and an in-memory mutex are not correctness mechanisms. This approach preserves future cancellation and re-registration compatibility by retaining cancelled rows while allowing a later active row.

**Duplicate/full precedence:** when the authenticated Participant already has an `ACTIVE` registration for the target Event, the service returns the duplicate conflict before evaluating the full-capacity outcome. This deterministic duplicate-first policy does not weaken capacity protection: new registrations still acquire the Event lock, count committed `ACTIVE` rows, and are rejected when capacity is full.

Schema requirements above are mandatory design constraints. Index names, Prisma model naming, migration command, connection-pool settings, and exact custom SQL are implementation choices that require review; this documentation creates no executable migration.

**Concurrent last place:** for capacity 1 and two distinct eligible Participants, synchronized interactive transactions serialize on the locked Event row. With no unrelated failure, exactly one commits; the other receives a safe conflict. After both responses, the real database must show one active row and zero remaining places.

**Concurrent duplicate:** for two synchronized requests from one Participant for one Event, the Event-row lock serializes the active-count/duplicate check and the partial unique index prevents a second `ACTIVE` row. At most one active row commits and one place is consumed. The rejected request leaves the original registration unchanged; the database is inspected after both responses.

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

## D. Software Test Specification

Section D defines the planned test specifications and expected assertions. Section E records the executions actually performed; a test specification is not treated as executed merely because it is listed here.

| Test ID | AC | Level | Preconditions and steps | Expected result and database/privacy assertions |
| --- | --- | --- | --- | --- |
| TEST-F03-01 | AC-F03-01 | API Integration | Seed published Events; call list/detail anonymously and authenticated. | Published public projections return without registrant, credential, session, or owner-private fields. Unpublished-event coverage is pending because the current F-02 schema does not represent an unpublished state. |
| TEST-F03-02 | AC-F03-02 | API/UI | Use event fixtures with capacity/remaining values and UTC instants; inspect detail. | Values and availability are correct; display is labelled Asia/Bangkok UTC+7. |
| TEST-F03-03 | AC-F03-03 | UI/E2E | Exercise loading, empty, full, validation, error, success, keyboard, and focus states. | States are explicit, accessible, and do not leak protected data. |
| TEST-F03-04 | AC-F03-04 | API Integration | Anonymous, Participant, Organizer, and spoofed participant-ID requests. | Only Participant self-registration proceeds; server identity wins; denied requests mutate nothing. |
| TEST-F03-05 | AC-F03-05 | API/Database Integration | Submit missing, malformed, and nonexistent Event IDs. | Privacy-preserving unavailable/not-found outcome does not distinguish missing/private Events; zero Registration rows and unchanged capacity/counts. Unpublished-event coverage remains pending because the current F-02 schema has no unpublished state. |
| TEST-F03-06 | AC-F03-06 | API/Database Integration | Valid Participant registers for published Event; inspect response and database. | One active row with stable ID, correct foreign keys, timestamp, and one consumed place. |
| TEST-F03-07 | AC-F03-07 | API/Database Integration | Create registrations for two Participants; retrieve each personal list and individual detail, inspect Event identity/details, Registration identity/status/timestamp, substitute the other Participant's registration ID, then repeat retrieval through a fresh PrismaClient connection. | Each Participant sees only their own list/detail with required Event and Registration fields; direct ID substitution is denied; persistence across a fresh database connection is verified. Real API restart persistence is evidenced separately by TEST-F03-13. |
| TEST-F03-08 | AC-F03-08 | API/Database Integration | Register once, repeat active request, including identifier tampering. | Actionable duplicate conflict; original row/count unchanged; no private leakage. |
| TEST-F03-09 | AC-F03-09 | API/Database Integration | Fill the Event with Participant A, then have a different eligible Participant B with no existing `ACTIVE` registration for that Event attempt registration. | Participant B receives the full-capacity conflict; active count equals capacity; no extra row/place consumption. A separate already-registered case follows duplicate-first precedence under TEST-F03-08/20. |
| TEST-F03-10 | AC-F03-10 | Database Integration | Capacity 1; synchronize two distinct eligible Participant requests; inspect committed state. | Exactly one success; one conflict; one active row; remaining places zero. Five fresh races were executed in the current PostgreSQL integration run; the five-race quantity remains a documented Sprint 1 verification target subject to team review. |
| TEST-F03-11 | AC-F03-11 | Database Integration | Synchronize two requests from one Participant for one Event. | At most one active row and one consumed place; original row unchanged. Five fresh same-Participant races were executed in the current PostgreSQL integration run; the five-race quantity remains a documented Sprint 1 verification target subject to team review. |
| TEST-F03-12 | AC-F03-12 | Database Integration | Inject failure during registration insert/commit and compare before/after state. | The transaction helper verification shows safe failure with no partial row/count/place change; API-level post-insert fault injection and false-201 verification remain pending. |
| TEST-F03-13 | AC-F03-13 | API/Database Integration | Register, stop the API process, start a new API process against the same isolated database, create a fresh session, then retrieve personal list/detail. | The current run retrieved the same persisted Registration and Event association with `ACTIVE` status after a real API restart. |
| TEST-F03-14 | AC-F03-14 | E2E/Review | Inspect contract history, AC/TEST map, implementation result table, and tested commit at completion review. | Stable IDs and actual evidence exist before Done; planned tests are not treated as executed. |
| TEST-F03-15 | AC-F03-15 | Review/Planning | Review the proposed operation set, workload, fresh-pair fixture rule, metrics, target, and Sprint 3 execution boundary against NFR-07/SR-06. | Method is reproducible and complete; p95/zero-error targets remain Proposed; no Sprint 1 benchmark is run or claimed. |
| TEST-F03-16 | AC-F03-16 | E2E | Organizer logs in with F-01, creates/publishes a valid Event through F-02, verifies public F-03 discovery, Participant logs in and registers, retrieves My Registrations, then the owning Organizer retrieves the same Event's registrations through F-04 using UI, API, and PostgreSQL. Try another Organizer's list request. | Stable Event and Registration IDs persist; Participant/Event/status/timestamp associations match; owner sees the same committed row; another Organizer is denied; no private fields or session material leak. Planned only; not implemented or executed. |
| TEST-F03-17 | AC-F03-06 | Unit | Evaluate registration eligibility with valid Event/Participant context and active-capacity state without HTTP or database. | Eligible case allows evaluation with server identity supplied by the caller boundary; no persistence or concurrency guarantee is inferred. |
| TEST-F03-18 | AC-F03-09 | Unit | Evaluate capacities 0, 1, and active counts at/over capacity. | Full states reject and available state allows evaluation; no database guarantee is inferred. |
| TEST-F03-19 | AC-F03-08, AC-F03-11 | Unit | Evaluate no active row, existing ACTIVE row, and cancelled row for one Participant/Event pair. | Existing ACTIVE maps to duplicate conflict; no active/cancelled state remains eligible for later policy checks; database uniqueness is not claimed by this unit test. |
| TEST-F03-20 | AC-F03-05, AC-F03-08, AC-F03-09, AC-F03-12 | Unit | Map missing, unpublished, duplicate, full, malformed, and persistence-failure domain outcomes to safe errors; include an already-registered Participant targeting a full Event. | Error mapping is actionable and privacy-preserving without revealing private Event existence; an existing ACTIVE registration maps to duplicate before full-capacity handling. |
| TEST-F03-21 | AC-F03-02, AC-F03-09 | Unit | Evaluate capacity and active-count boundary values. | Remaining places equals capacity minus active count; zero is unavailable and negative persisted states are rejected. |

### Proposed Performance Verification Method

This method is **Proposed** and is documented/reviewed in Sprint 1; quantitative execution belongs to Sprint 3. Measure the published-event list, published-event detail, and eligible Participant registration through the real API and database. Use fresh eligible Participant–Event pairs with sufficient capacity for registration requests. The proposed target is p95 latency at most two seconds for each operation with zero unexpected server errors; numerical targets remain subject to team review.

Record latency, request counts, errors, environment, tested commit, and database persistence (including accepted registrations). The Sprint 3 workload is 20 sequential requests per operation plus 60 seconds using 10 concurrent clients, 100 Events, and 1,000 seeded Registrations. Do not bypass validation or weaken business rules.

## E. Contract history and completion evidence

### Version history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial F-03 design, AC, planned STS, concurrency scenarios, and proposed performance method. |
| 0.2 | 2026-11-15 | Draft for teammate review | Recorded the selected Prisma interactive transaction, PostgreSQL Event-row locking, active-registration partial unique index, session-derived Participant identity, no mutable counter, future cancellation compatibility, and duplicate-first precedence when an already-registered Participant targets a full Event. Pending teammate acceptance. |
| 0.3 | 2026-11-15 | Draft for teammate review | Added current uncommitted verification evidence, including isolated PostgreSQL integration/browser results as reported and a real API restart persistence check. F-04-dependent, unpublished-state, performance, and final completion evidence remain pending. |

### Baseline and open decisions

- Approved baseline: D-02, D-04, D-08, Q-08, Q-09, Q-11, and the team-approved React/TypeScript/Vite, Node.js/Express/TypeScript, PostgreSQL, and Prisma stack.
- Selected technical approach pending teammate acceptance: Prisma interactive `$transaction`; PostgreSQL `SELECT ... FOR UPDATE` on the target Event row; active-registration counting after the lock; a partial unique index on `(participantId, eventId)` filtered to `status = 'ACTIVE'`; session-derived Participant identity through the existing F-01 middleware; and no separate mutable registration counter in Sprint 1.
- Proposed/open: exact custom SQL migration and rollback/deployment ordering, CSRF transport details, testing tools, and NFR-05/NFR-07 numerical targets. Pagination is out of scope for Sprint 1. The five F-03 endpoint paths/methods and reviewed request/response/error policy are teammate-confirmed; physical implementation details remain outside this contract approval.

### Current verification evidence

The following results apply to the current uncommitted working tree and are not tied to a tested commit SHA:

| Check | Command/evidence | Result | Scope and limitation |
| --- | --- | --- | --- |
| Backend unit tests | `npm test --workspace=server -- --run` | 7 passed | Unit coverage only; database integration is recorded separately. |
| Frontend unit tests | `npm test --workspace=client -- --run` | 15 passed | Includes Participant/Organizer dashboard-tab and registration interaction coverage. |
| PostgreSQL integration | `DATABASE_URL="<redacted isolated eventcheck_test URL>" npm run test:integration --workspace=server` | 28 passed, 0 failed, 0 skipped | Executed against isolated `127.0.0.1:5433/eventcheck_test?schema=public`; no development database access. |
| Playwright E2E | `E2E_DATABASE_URL="<redacted isolated eventcheck_test URL>" E2E_API_PORT=3211 E2E_WEB_PORT=5288 npx playwright test --reporter=line --timeout=30000` | 15 passed, 0 failed, 0 skipped | Playwright received the explicit isolated URL and temporary ports; broader F-03 negative/browser coverage remains limited. |
| TypeScript/build/Prisma | `npm run typecheck`; `npm run build`; `DATABASE_URL="<redacted isolated eventcheck_test URL>" npm run prisma:validate` | Passed | Results apply to the current uncommitted working tree. |
| Real API restart persistence | `DATABASE_URL="<redacted isolated eventcheck_test URL>" SERVER_PORT=3199 npm run dev --workspace server`; create/register a run-scoped Event; stop that process; run the same command again; call `GET /api/v1/me/registrations/{id}` | Passed | Returned the same Registration ID, Event ID, and `ACTIVE` status after restart. Run-scoped fixtures were deleted afterward. |
| Formatting | `git diff --check` | Passed | No whitespace errors. |

The restart check used a run-scoped Event and Registration on `eventcheck_test` only. It verified a real API process restart, not merely a fresh PrismaClient connection.

### Acceptance evidence status

| AC group | Current status | Reason |
| --- | --- | --- |
| AC-F03-01 to AC-F03-11 | Verified within the supported Sprint 1 scope by the current 28-test PostgreSQL suite plus frontend/browser evidence | The current schema represents only `PUBLISHED`, so unpublished-event coverage remains a documented limitation; broader browser negative-case coverage is also limited. |
| AC-F03-12 | Partial | Database rollback is covered through the controlled transaction helper; API-level post-insert fault injection and false-201 assertion remain pending. |
| AC-F03-13 | Verified for this run | Real API process was stopped and restarted against `eventcheck_test`; the same Registration was retrieved with ownership and `ACTIVE` status. |
| AC-F03-14 | Pending | Final contract/review evidence and tested commit are not recorded yet. |
| AC-F03-15 | Planning verified only | Performance method is documented; no quantitative benchmark is claimed. |
| AC-F03-16 | Pending | The end-to-end Organizer-to-Participant journey is present, but the F-04 owner registration-list step is not implemented in this scope. |

### Future completion evidence placeholders

- Teammate review: **TBD** — review decision and findings.
- Implementation Issue/PR: **TBD** — link, branch, and merged commit.
- Actual test source/results: Recorded above for the current uncommitted working tree; final release evidence remains **TBD**.
- Tested commit/release evidence: **TBD** — the reported results have no commit SHA until the F-03 changes are committed.

The contract remains Draft for teammate review. F-04-dependent verification, unpublished-event coverage, quantitative performance execution, API-level post-insert rollback evidence, the open ON DELETE CASCADE/history-retention decision, and final completion evidence remain pending.
