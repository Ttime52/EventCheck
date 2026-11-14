# F-02 — Event Publishing and Owner Management

**Issue:** I-04 — Contract: Authentication & Event Publishing

**Implementation issue:** GitHub Issue #9 — Issue 7: Feature Event Creation & Publishing

**Pull request:** PR #17 (`feature/07-event-creation-publishing`)

**Contract version:** 0.4

**Status:** Approved/Accepted for Implementation; completion and merge approval remain pending

**Baseline:** EventCheck SRS, Feature Inventory, Traceability Matrix, Sprint Plan, and System-Level SDS reviewed for Issue I-04.

> This is a versioned design and verification plan. The F-02 design is accepted for implementation; acceptance does not mark the feature Done, merged, or released.

## A. Feature overview

### Scope and objective

Allow an authenticated Organizer to create and publish a valid University Event in one workflow, persist it, and retrieve only events that Organizer owns. Assign ownership from the validated F-01 session at the backend. Make committed published events available through the F-03 public discovery boundary.

### Requirement and responsibility links

| Type | IDs | F-02 coverage |
| --- | --- | --- |
| Functional requirements | FR-06 to FR-09 | Organizer creation, required-field validation, publication, and owned-event retrieval |
| Business rules | BR-01, BR-02, BR-05, BR-12, BR-15 Sprint 1 boundary | Organizer-only publication; owner-only management; positive integer capacity; complete valid details; capacity fixed after publication during Sprint 1 |
| Non-functional requirements | NFR-01, NFR-04, NFR-06, NFR-08, NFR-09, NFR-10 | Backend authorization/privacy, persistence, safe failure, accessible states, and traceable/reproducible verification |
| System responsibilities | SR-01, SR-02, SR-03, SR-04, SR-05 | Authorization/privacy, integrity, UI states, contracts/evidence, and local configuration readiness |
| Approved decisions | D-02, D-04, D-08, Q-08, Q-09, Q-11 | Session identity; required fields and combined create/publish; fixed Sprint 1 capacity; UTC persistence and labelled Asia/Bangkok display/input; public discovery boundary |

### Dependencies and prerequisites

- F-01 valid server-side session with role Participant or Organizer; the backend derives the owner from that session.
- PostgreSQL and Prisma are team-approved core technology selections in the System-Level SDS. The reviewed route names, request/response envelopes, error codes, and status choices are approved for this F-02 implementation.
- Seed only synthetic test events and users. No real credentials, production data, or production secrets belong in fixture files or evidence.
- Coordinate the published event projection and endpoint with F-03; this contract verifies the publication integration boundary, not all public discovery behavior.
- F-04 may consume F-02 owned-event identity for registration-list retrieval. Its contract must reuse F-02 event IDs and owner predicate and define its own registration-list fields.

### Actors and permissions

| Actor | Allowed | Denied |
| --- | --- | --- |
| Unauthenticated visitor | Read public published event discovery/details under Q-08 | Create, publish, or retrieve management records |
| Participant | Read public published events | Create/publish/manage events or retrieve Organizer management records |
| Owning Organizer | Create/publish event with owner assigned from session; list and open own event management details | Select another owner; edit published capacity in Sprint 1; access another Organizer's event |
| Non-owning Organizer | Read public published events; create an event owned by their own identity | Read/manage another Organizer's event or use a client-supplied owner override |

All checks run in the backend on direct API calls. Hiding buttons or route guards is not authorization.

### Sprint 1 boundaries and exclusions

Included: required title, description, location, start date/time, end date/time, and positive integer capacity; validation; combined create-and-publish; persisted event; organizer-owned event list/detail; ownership and role checks; public-discovery integration.

No separate draft workflow or draft UI is required. Sprint 1 published capacity is fixed. Capacity editing and registration-deadline management (FR-10, Sprint 2 Q-01 to Q-03) are excluded. Event cancellation, attendance, participant registration and registration lists are outside F-02 and remain in other contracts. No future event-only validations (such as requiring the start to be in the future) are added unless approved through the SRS.

## B. Feature design / Feature SDS

### Architecture and create/publish workflow

The Organizer UI gathers event fields and sends a request to the backend. F-01 middleware validates the session. The API/service validates required fields and capacity, parses date-time instants, and assigns the authenticated user as owner. The service stores the validated event with published state in a single transaction. A failed validation or failed insert leaves no partially published Event. The event-management query filters by the session-derived Organizer ID. The public discovery service may return the committed public projection only after the create transaction commits.

1. Organizer opens the Create and Publish Event view.
2. UI accepts title, description, location, start date/time, end date/time, and capacity; it labels entered/displayed time as Asia/Bangkok (UTC+7).
3. UI converts entered time to an offset-aware ISO 8601 instant for the approved F-02 API. Backend validates nonblank text, valid instants, end strictly after start, and positive integer capacity.
4. Backend derives owner from the authenticated Organizer session. It does not trust a client-supplied owner ID or publication state.
5. On valid input, the backend inserts one Event with published state and commits. It returns a safe event-management summary.
6. On invalid input or storage failure, the backend returns a safe error and commits no partial event.
7. Organizer event list/detail queries filter by that same server-derived owner. A committed published event becomes eligible for F-03 public list/detail retrieval.

There is no separate draft state in this chosen Sprint 1 workflow. The reviewed REST-like routes, API envelopes, and error policy below are approved for F-02 implementation.

### Validation and state rules

| Field/rule | Accepted condition | Rejection behavior |
| --- | --- | --- |
| Title, description, location | Each is present and not blank after whitespace-only validation | Identify the invalid field; do not create or publish a partial event |
| Start/end | Each represents a valid date-time instant; end is strictly later than start | Return field-level safe validation; do not create or publish |
| Timezone | UI input/display is explicitly labelled Asia/Bangkok (UTC+7); stored and compared value is the corresponding UTC instant | Reject malformed/unparseable input; never silently reinterpret it as server-local time |
| Capacity | JSON numeric integer greater than zero | Reject missing, zero, negative, fractional, string, or non-numeric capacity; no event row |
| Owner | Always authenticated Organizer ID from validated F-01 session | Client owner override is rejected as an unsupported field in the approved request schema |
| Publication | Combined create-and-publish produces a published Event only after all validation succeeds | No public discovery on failed validation/write |
| Sprint 1 capacity | Capacity cannot be modified after publication in Sprint 1 | No capacity-edit UI or supported update API; the Sprint 2 edit route is not available in this increment |

Text maximum lengths and a canonical trimming policy are not established in the SRS/SDS. They remain open for a future reviewed extension; the current implementation does not invent silent limits in the approved F-02 contract.

### Normal, alternative, failure, and boundary scenarios

- Valid Organizer submits a complete event with positive integer capacity and end after start: one published, owned, persisted Event is created.
- Title, description, or location is empty/whitespace: field-level rejection and no Event row.
- Start/end is malformed, equal, or reversed: rejection and no Event row.
- Capacity is missing, zero, negative, fractional, string, or nonnumeric: rejection and no Event row; capacity 1 is accepted if other fields are valid.
- Anonymous or Participant submits create-and-publish directly: deny with no Event row.
- Organizer attempts to inject another Organizer's ID: reject the unsupported field; no event is created under the injected owner.
- Organizer list/detail returns only owned events; empty list is explicit. Missing and non-owned detail use a privacy-preserving outcome.
- No event-update endpoint exists in Sprint 1. A direct attempt to alter title, time, or capacity must not change stored data.
- Only a successfully committed published event is discoverable through F-03. Public response is the F-03 public projection, not a management record.
- Database failure after validation returns a safe failure and leaves no partial Event.

### User interface specifications

| Screen/component | Fields and interaction |
| --- | --- |
| Organizer Event List | Shows only the current Organizer's events; includes an explicit empty state and navigation to create/publish. |
| Create and Publish Event | Required title, description, location, start date/time, end date/time, and capacity fields. Start/end inputs and rendered values are labelled “Asia/Bangkok (UTC+7).” Submit publishes directly after validation; no draft UI is required. |
| Owned Event Detail | Shows the selected owned event's management fields and published state. Non-owner detail must not render private management content. |

UI state requirements:

- Loading: event list/detail show loading indicators; disable duplicate create submission while request is in progress.
- Success: confirm event publication and show the persisted event identifier/details returned by the backend.
- Empty: organizer list explains that no owned events exist and offers Create Event.
- Validation errors: map API field errors to the corresponding controls; explain end-after-start and positive integer capacity.
- Authentication error: expired/missing session returns to Login through F-01 without treating local UI role as authority.
- Permission error: safe denied/not-found state for wrong-role/non-owner access; unauthorized controls remain unavailable, but direct requests are still tested.
- Accessibility: visible labels, keyboard order/focus, announced status, no color-only errors, and responsive form under NFR-08.

### API specifications

The System-Level SDS describes /api/v1 and JSON envelopes. The route names, field names, stable error codes, response envelopes, and status choices below are the reviewed and approved F-02 API contract. F-03 public discovery remains a separate contract and integration boundary.

Approved conventions: HTTPS; JSON; success { "data": ... }; error { "error": { "code": "...", "message": "...", "details": [...] } }; statuses from the SDS. Cookie-authenticated state-changing create requests must pass the reviewed CSRF/origin check.

| Method and approved path | Authentication/authorization | Request | Success response | Failure and persistence |
| --- | --- | --- | --- | --- |
| POST /api/v1/events | Valid session; Organizer role; CSRF protection | title, description, location, offset-aware startAt, endAt, positive integer capacity. Do not accept organizerId or publicationState; the approved schema rejects unknown owner override. | 201, data.event = { id, title, description, location, startAt, endAt, capacity, publicationState: "PUBLISHED" }; dates serialized as UTC ISO 8601. | 401 no session; 403 wrong role; 422 field validation; 400 malformed body; safe 500 on unexpected write failure. Any rejection/failure leaves no partial event. |
| GET /api/v1/organizer/events | Valid session; Organizer role | No owner parameter; filter is server-derived | 200 array of that Organizer's management summaries; empty array is explicit | 401 missing/invalid/expired session; 403 wrong role; no other owner's events returned |
| GET /api/v1/organizer/events/{eventId} | Valid session; Organizer role and owner predicate | Path contains target event ID; caller cannot change owner | 200 own management detail | 401; wrong role safe 403; missing or non-owned event safe 404; no private detail in error |
| PATCH /api/v1/organizer/events/{eventId} | Not a supported Sprint 1 operation for any actor | No Sprint 1 request schema | No success behavior in this contract | Approved boundary outcome: 404/unsupported route, no mutation. Capacity/deadline editing is Sprint 2 and requires its own reviewed contract. |

For create, the response and stored event contain the selected fields, stable ID, derived owner link in persistence, and published state. Do not expose internal credentials/session data or unrelated user data. GET /api/v1/events and GET /api/v1/events/{eventId} belong to F-03; F-02 only requires an integration check that its committed published event is visible through that public contract with the public projection.

### Data specifications

| Entity | Logical fields | Required constraints and ownership |
| --- | --- | --- |
| Event | Stable event ID; Organizer owner ID; title; description; location; start UTC instant; end UTC instant; positive integer capacity; publication state | Exactly one valid Organizer owner; required fields nonblank; end after start; capacity greater than zero; valid Event persists; combined workflow sets published state. No Sprint 1 deadline field or accepted capacity edit. |
| User (reference) | User ID and role | Event owner FK references a seeded/valid Organizer; role is read from authenticated session and server-side User record |

Persistence and migration expectations:

- Insert the Event and its published state as one transaction. Invalid input, authorization rejection, or transaction failure leaves no Event or partially published state (NFR-06).
- Stable Event identity, owner link and accepted fields survive application restart against the configured real database (NFR-04).
- Use versioned migrations for Event fields, ownership FK, publication state, positive-capacity/date integrity constraints, and indexes aligned with the System-Level SDS. Do not claim migrations have been created or run.
- Seed only reproducible synthetic accounts/events. Feature tests should create isolated event fixtures; no real user data or credentials.
- Store date-time values as UTC instants. Convert initial form input from labelled Asia/Bangkok (UTC+7); serialize instants as UTC ISO 8601 per the approved F-02 API convention.
- A successful create-and-publish commit is the visibility boundary for F-03 discovery. Public projection, registration capacity consumption, and registration concurrency are owned by F-03, not duplicated here.

## C. Acceptance Criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F02-01 | FR-07, D-04, D-08, NFR-08 | The Organizer form presents all six required fields and clearly labels start/end entry and display as Asia/Bangkok (UTC+7); it does not require a draft step. |
| AC-F02-02 | FR-06, FR-08, D-04, D-08, NFR-04 | A valid submission creates exactly one persisted, published Event with the submitted title, description, location, capacity, UTC instants, stable ID, and owner derived from the Organizer session. |
| AC-F02-03 | FR-07, BR-12, NFR-06 | Missing or whitespace-only title, description, or location is rejected with field feedback and creates no Event or published record. |
| AC-F02-04 | FR-07, BR-12, D-08, NFR-06 | Invalid start/end instants, equal start/end, and end-before-start are rejected; no server-local reinterpretation or partial record occurs. |
| AC-F02-05 | FR-07, BR-05, NFR-06 | Missing, zero, negative, fractional, string, or nonnumeric capacity is rejected without persistence; capacity 1 is accepted with otherwise valid input. |
| AC-F02-06 | FR-06, FR-08, BR-01, NFR-01 | Anonymous callers and Participants cannot create/publish an Event through direct API requests; denial leaves database state unchanged. |
| AC-F02-07 | FR-06, BR-02, NFR-01 | Event owner always equals the authenticated Organizer. Under the approved request schema, a client owner override is rejected with a safe field validation error (422) and cannot create or expose an event under another user's ownership. |
| AC-F02-08 | FR-09, BR-02, NFR-01 | Organizer event list returns only that Organizer's events and gives an explicit empty result when none exist; client-supplied owner filters cannot reveal another owner's rows. |
| AC-F02-09 | FR-09, BR-02, NFR-01 | The owning Organizer can retrieve management details for an owned event; another Organizer, Participant, or visitor receives no private detail, with missing/non-owned access handled safely. |
| AC-F02-10 | FR-08, BR-15 Sprint 1 boundary, D-04 | Sprint 1 has no supported event-update/capacity-edit UI or API. A direct edit attempt cannot change a published event's capacity or other fields. |
| AC-F02-11 | FR-08, D-04, Q-08, Q-11 | Only a successfully committed published Event is visible through the F-03 public-discovery integration; public output follows F-03's limited projection and excludes owner-management/private fields. |
| AC-F02-12 | FR-07, FR-08, NFR-06 | Validation rejection or controlled persistence failure returns a safe failure and leaves the Event table/publication state unchanged; no partial Event is reported as success. |
| AC-F02-13 | FR-06, FR-09, NFR-04 | A successfully accepted Event and its owner/fields/publication state remain retrievable after application restart from the configured database. |
| AC-F02-14 | FR-06 to FR-09, NFR-08 | Form, list, and detail views have accessible labels/focus plus explicit loading, success, empty, validation, authentication, and permission states. |
| AC-F02-15 | NFR-09, NFR-10 | The accepted F-02 contract retains version history and stable IDs; every AC maps to an actual test result and tested commit before the feature is declared Done, with failures/skips disclosed and required checks passing. |

## D. Software Test Specification

Tests below verify this contract through UI, API and real-database boundaries. The repository records executable unit, integration, frontend, and Playwright tests for the implemented scope; the actual commands and results are recorded in the implementation evidence. Read-only/UI/review tests assert no database change; write tests state the expected committed row or unchanged before-state.

| Test ID | AC | Level | Preconditions and inputs | Planned steps | Expected result and database/privacy assertions |
| --- | --- | --- | --- | --- | --- |
| TEST-F02-01 | AC-F02-01 | UI | Organizer session; form available; keyboard-only navigation | Open form; inspect field labels, required markers, timezone label, and number/date inputs; submit the empty form with keyboard | Six required fields are clear; time entry/display says Asia/Bangkok UTC+7; no draft step; controls have labels/focus; validation appears and no Event row is created |
| TEST-F02-02 | AC-F02-02 | API Integration + Database Integration | Seeded Organizer; valid title/description/location; start before end with +07:00 offsets; capacity 1 | Submit create-and-publish; retrieve returned ID as owner; inspect DB fields | One row exists; stable ID; owner equals session user; fields match; UTC instants equal converted input; positive capacity; state published |
| TEST-F02-03 | AC-F02-03 | Unit + API Integration | Valid Organizer session; parameterized blank, whitespace-only, and omitted value for each required text field | Submit each invalid payload | Field-level safe validation; zero Event rows and no public item; existing records unchanged |
| TEST-F02-04 | AC-F02-04 | Unit + API Integration | Valid Organizer; malformed instant, equal instants, end earlier than start | Submit each boundary payload | Rejected as date validation; no local-time fallback; zero created/published rows |
| TEST-F02-05 | AC-F02-05 | Unit + API Integration | Valid text/date fields; capacity cases: omitted, 0, -1, 1.5, string, nonnumeric, and 1 | Submit each case | All invalid capacities return field error and no row; positive integer 1 succeeds; state matches AC |
| TEST-F02-06 | AC-F02-06 | API Integration | No session and Participant session; before-state Event count recorded | Call create-and-publish directly as both actors | Safe 401/403 outcomes; no Event row, publication, or ownership change; no hidden-control assumption |
| TEST-F02-07 | AC-F02-07 | API Integration + Database Integration | Organizer A and B; valid payload containing attempted owner override to B | Submit as A with owner override; query result and DB | The approved schema returns a safe 422 field-validation result; no Event is created under A or B. |
| TEST-F02-08 | AC-F02-08 | API Integration + Database Integration | Two Organizers with separate events; one account with none | Call owned-event list as each; attempt owner filter for the other ID | Each list contains only its own events; empty case returns explicit empty array; tampered filter cannot widen scope |
| TEST-F02-09 | AC-F02-09 | API Integration | Event owned by Organizer A; Organizer B, Participant, visitor; nonexistent ID | Fetch management detail as each actor | Owner receives detail; all other access returns safe denial/not-found with no title, owner ID, or private management fields |
| TEST-F02-10 | AC-F02-10 | API Integration + Database Integration | Published event with capacity 1; stored snapshot; candidate update route | Attempt Sprint 1 PATCH/update as owner and non-owner | No supported update succeeds; capacity and other fields remain unchanged; response uses reviewed unsupported/denied result |
| TEST-F02-11 | AC-F02-11 | API Integration / E2E boundary | F-03 public discovery routes and seeded published/unpublished fixtures | Create valid published Event through F-02; query public list/detail; query an unpublished fixture if the product supports one | New Event appears only after commit through F-03; fields match the public projection; unpublished fixture remains absent; no owner/private data exposed. Do not duplicate F-03's complete contract suite. |
| TEST-F02-12 | AC-F02-12 | Database Integration | Valid Organizer/payload; DB failure injection at Event insert/commit; before-state snapshot | Submit request with controlled failure; query DB and public list afterward | Safe failure; no success body; no Event row/publication/partial owner link; diagnostic log contains no secrets |
| TEST-F02-13 | AC-F02-13 | Database Integration | Accepted Event; stable configured database and restart procedure | Create event; restart application; retrieve owned list/detail using a fresh valid session | Same Event ID, owner, fields, UTC values, capacity, and published state are retrieved; no reliance on client storage |
| TEST-F02-14 | AC-F02-14 | UI / E2E | Organizer, Participant, visitor; loading, validation, empty, success, expired, and forbidden fixtures | Inspect list and form states; submit valid/invalid event; access F-02 route with wrong role/owner; use keyboard | Loading/success/empty/error states are explicit and accessible; a valid submit creates one published Event, while invalid/denied attempts leave Event state unchanged; unauthorized view reveals no private data; focus remains operable |
| TEST-F02-15 | AC-F02-15 | E2E (contract/evidence review) | Accepted F-02 contract; completed implementation, test result table, and release candidate when feature completion is reviewed | Trace each F-02 requirement to AC, each AC to a TEST ID and actual result, then inspect history, teammate PR review, command, counts, and tested commit | IDs are stable and unique; every AC has evidence tied to the tested release; required checks pass; failure/skip status and review findings are visible. This review is planned and has not been performed. |

Important TDD candidates: TEST-F02-03 to TEST-F02-05 for required fields, time order, and capacity; TEST-F02-06/07/09 for backend permission and ownership; TEST-F02-12 for rejected/failed write atomicity. Preserve red-before-correction and green-after-correction evidence with the actual test revision and commit IDs when implemented.

## E. Contract history and completion evidence

### Version history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial F-02 feature design, UI/API/data proposals, AC, and planned STS from the approved SRS and System-Level SDS. No implementation or verification claimed. |
| 0.2 | 2026-11-14 | Draft for teammate review | Reconciled the implemented F-02 routes, response/error envelopes, owner-only detail boundary, persistence constraints, and API/UI verification mapping with the implementation. |
| 0.3 | 2026-11-14 | Approved/Accepted for Implementation | Teammate accepted the F-02 design: Organizer-only create/list/detail APIs, session-derived ownership, six-field validation, UTC persistence with Asia/Bangkok presentation, transactional publish, and Sprint 1 no-edit boundary. Completion, release, and merge approval remain pending. |
| 0.4 | 2026-11-14 | Approved/Accepted for Implementation | Recorded PR #17, tested commit `46e4de9663799dc3c519d934f6a10acfd3852fe9`, current verification evidence, targeted browser-coverage additions, required F-01 integration scope, and deferred F-03 discovery integration. |

### Decisions and open items

Approved baseline applied: D-04 (six fields, combined create-and-publish, fixed published capacity in Sprint 1); D-08/Q-11 (UTC storage and Asia/Bangkok display/input); Q-08 public-discovery boundary; D-02/Q-09 session identity. No new business rule or requirement ID is introduced.

The following implementation decisions are confirmed for F-02: `/api/v1/events` is the Organizer-only create-and-publish route; `/api/v1/organizer/events` and `/api/v1/organizer/events/{eventId}` are owner-filtered management reads; success responses use `{ "data": ... }`; failures use `{ "error": { "code", "message", "details" } }`; validation uses 422, malformed JSON uses 400, missing session uses 401, wrong role uses 403, and missing/non-owned detail uses privacy-preserving 404. The backend derives `organizerId` from the validated session, rejects client owner/publication overrides, persists UTC instants and `PUBLISHED` state transactionally, and exposes no Sprint 1 edit/capacity-update operation.

Text maximum lengths and canonical trimming remain open for a future reviewed extension; the current F-02 implementation does not add silent limits in the approved contract. F-03 public discovery remains a deferred integration boundary and must be verified before the Sprint 1 release. Capacity/deadline editing remains excluded until Sprint 2 review.

### Teammate review and release-gate record

| Item | Record |
| --- | --- |
| Contract review decision | Teammate accepted the F-02 API routes, response/error formats, session-derived Organizer ownership, validation rules, PostgreSQL persistence, create-and-publish workflow, and read-only Sprint 1 management boundary for implementation. |
| Review date | 2026-11-14 |
| Reviewer identity | Teammate reviewer; name/handle was not included in the supplied review record. |
| Implementation issue | [GitHub Issue #9](https://github.com/Ttime52/EventCheck/issues/9) — Issue 7: Feature Event Creation & Publishing. |
| Pull request | [PR #17](https://github.com/Ttime52/EventCheck/pull/17), branch `feature/07-event-creation-publishing`, base `sprint-1-staging`. |
| Tested PR commit | `46e4de9663799dc3c519d934f6a10acfd3852fe9`. |
| Closing reference | `Closes #9` is correct for the F-02 implementation issue; it is recorded in PR #17. |
| Completion condition | Contract acceptance does not mark F-02 Done. AC-F02-11/F-03 public discovery integration, final current-PR browser evidence, teammate review/merge approval, and Sprint 1 release checks remain required. |

### Completion evidence (pending Done gate)

| Evidence | Status / future link |
| --- | --- |
| Teammate contract review and decision | Accepted for implementation on 2026-11-14; reviewer identity remains unspecified in the supplied record. |
| Implementation Issue / branch / PR | GitHub Issue #9; branch `feature/07-event-creation-publishing`; PR #17; `Closes #9` confirmed. |
| Actual test source files and names for TEST-F02-* | `server/src/events.test.ts`, `server/src/events.integration.test.ts`, `client/src/App.test.tsx`, `e2e/f02-event-publishing.spec.ts`, and F-01 integration coverage. |
| Test command, counts, failures/skips, tested commit | PR #17 reports 13 unit tests, 14 PostgreSQL integration tests, and 10 Playwright tests passed at `46e4de9663799dc3c519d934f6a10acfd3852fe9`; local follow-up verification is recorded separately in the implementation evidence. |
| TDD red/green revisions for applicable rule work | Red/green validation evidence is recorded in the implementation evidence; completion remains subject to current-PR traceability. |
| Build/integration result and accepted Sprint 1 release | Typecheck, build, Prisma validation/generation, and PR-reported integration checks passed; F-03 integration and final Sprint 1 release approval remain pending. |
