# F-07 - Organizer Check-in and Attendance Retrieval

**Issue:** 11B - Sprint 2 Feature Contracts<br>
**Feature ID:** F-07<br>
**Contract version:** 0.2<br>
**Status:** Draft - Review Ready; pending team review; not Accepted<br>
**Updated:** 2026-11-24<br>
**Author:** Issue 11B contributor (name not recorded in the repository)<br>
**Reviewer:** Student 1 (assigned peer reviewer; review pending)<br>
**Target branch:** sprint-2-staging
**Work type:** Documentation and contract design only. No feature implementation, migration, or test execution is claimed.

## 1. Purpose and scope

F-07 proposes that only the owning Organizer record check-in for an eligible ACTIVE Registration during Q-05's proposed Event window, then lets the Organizer retrieve attendance for owned Events and a Participant retrieve attendance for their own Registration. Q-05 remains pending team approval. The contract covers organizer and participant UI states, proposed APIs, persistent associations, role/ownership enforcement, transaction boundaries, acceptance criteria, and planned tests.

This is a pre-implementation contract. The current repository has no Attendance Prisma model, Attendance migration, check-in API, or attendance UI. The System-Level SDS already defines an Attendance logical model and candidate endpoint paths, but those are design proposals, not implementation evidence or team acceptance of Q-05.

## 2. Requirement and responsibility links

| Type | IDs | F-07 coverage |
| --- | --- | --- |
| Functional requirements | FR-05, FR-14, FR-15, FR-19, FR-20, FR-21 | Protected check-in, source registration list, owner and own-registration attendance retrieval, and safe rejection. |
| Business rules | BR-02, BR-03, BR-04, BR-09, BR-11, BR-13, BR-16, BR-17 | Event ownership, privacy, authentication, active-count invariant, atomic writes, cancellation interaction, eligibility window, and duplicate prevention. |
| Non-functional requirements | NFR-01, NFR-03, NFR-04, NFR-05, NFR-06, NFR-08, NFR-09, NFR-10 | Backend access control, protected session/CSRF behavior, durable records, concurrency, rollback, accessible states, contract history, and later reproducible verification. |
| System responsibilities | SR-01, SR-02, SR-03, SR-04 | Authorization/privacy, persistent integrity/concurrency, accessible workflow, and traceable verification. |
| Related features | F-01, F-02, F-03, F-04, F-05, F-06 | Session identity, Event ownership/times, eligible registrations, owner list, capacity/deadline baseline, and cancellation exclusion after check-in. |

## 3. Dependencies and policy status

| Dependency | Existing baseline or dependency for F-07 |
| --- | --- |
| F-01 | Current backend derives identity and role from the server session. State-changing API requests use the existing Origin-based csrfGuard and configured CLIENT_ORIGIN. |
| F-02 | Event owner, startAt, and endAt are stored as UTC-based instants. No client-supplied event owner or timestamp grants authority. |
| F-03 | Supplies persisted Registration identity, eventId, participantId, and ACTIVE/CANCELLED status. Only ACTIVE rows are eligible; attendance does not change capacity. |
| F-04 | Existing GET /api/v1/organizer/events/{eventId}/registrations remains the source for the owner-scoped registration list. F-07 adds attendance data separately so the approved F-04 response need not change. |
| F-05 | Preserve the team-reviewed Q-01 to Q-03 policy recorded in F-05 v0.3 and synchronized to the SRS. F-05 v0.4 API/schema acceptance remains pending. Check-in eligibility itself depends on Event startAt/endAt, not on the registration deadline. |
| F-06 | A Registration with Attendance cannot be cancelled. F-06 and F-07 must use the same Event-then-Registration lock order and test their shared boundary. |

### Decision register

The proposals below remain Pending Team Review. No approval record for Q-05 or Q-10 is present.

| Decision | Proposed behavior | Rationale | Affected features / requirements | Dependencies | Status and approval record |
| --- | --- | --- | --- | --- | --- |
| Q-05 | Only the owning Organizer may check in an existing ACTIVE Registration for their Event. Server time must be in [startAt, endAt): start is included and end is excluded. Do not provide QR scanning or Participant self-check-in. | Keeps attendance under the Event owner's control and gives exact, testable time boundaries without adding devices or external services. | F-07; FR-19 to FR-21; BR-16, BR-17 | F-01, F-02, F-04, F-06; D-08/Q-11 server UTC time | Pending Team Review in SRS. No approval or reviewer decision is recorded. Student 1 peer review is pending and is not policy approval. |
| Q-10 | Retain synthetic Registration and Attendance history for the project and assessment period; do not add automatic deletion or a retention-management interface. Any real-user production policy needs separate review. | Supports assessment persistence and review of recorded attendance without asserting a production retention policy. | F-06/F-07; FR-14, FR-21 to FR-23; NFR-04 | Durable database and restrictive references | Pending Team Review in SRS. No approval or reviewer decision is recorded. |

## 4. Feature-level SDS

### 4.1 Workflow and state

1. The owning Organizer opens an owned Event and its F-04 registration list.
2. The UI loads attendance separately and joins by registrationId. A Registration with no Attendance is shown as Not Checked In only after a successful attendance retrieval; a retrieval error is not treated as an empty result.
3. The Organizer selects an ACTIVE Registration. The UI may disable check-in outside the apparent window, but the backend always repeats role, ownership, status, and time checks.
4. The backend derives the Event and Participant associations from the Registration, verifies the request's selected event context, and inserts exactly one Attendance row in one transaction.
5. The service samples authoritative UTC time after acquiring the shared locks. Eligibility is inclusive at startAt and exclusive at endAt.
6. The owner can retrieve all Attendance rows for one owned Event, including an explicit empty array. A Participant can retrieve only the Attendance associated with their own Registration.
7. If the own Registration has no Attendance, the Participant response explicitly represents no record and the UI shows Not Checked In. Absence is not proof that the person attended.

| Registration / Attendance state | Request / condition | Proposed result |
| --- | --- | --- |
| ACTIVE, no Attendance | Owning Organizer, matching Event, startAt <= server time < endAt | Insert one Attendance and commit. |
| ACTIVE, no Attendance | Before startAt or at/after endAt | Reject with no Attendance row. |
| CANCELLED | Any check-in request | Reject; no Attendance row. |
| No Registration | Organizer selects a Participant without a Registration | Reject; no Attendance row. |
| Registration belongs to another Event | Submitted event context does not match the Registration's eventId | Safe rejection; no Attendance row. |
| Attendance exists | Repeated or concurrent request | Return duplicate conflict; preserve original Attendance ID, actor, and checkedInAt. |
| No Attendance on own Registration | Participant retrieves attendance | Return an explicit null Attendance; render Not Checked In. |

### 4.2 User interface

F-07 requires changes to the existing Organizer registration-list flow and a Participant attendance view. The current Organizer list already provides event-scoped Registration rows; the Attendance UI is not implemented.

| Screen or control | Role | Required behavior |
| --- | --- | --- |
| Owned Event registrations | Owning Organizer | Reuse the existing F-04 list and selected Event. Show Registration state, attendance state, and a check-in action only for ACTIVE rows. |
| Check-in action | Owning Organizer | Provide a labelled action for an eligible ACTIVE Registration. Disable while pending. Show a success status and checked-in time after the server confirms commit. A click never implies success by itself. |
| Attendance state | Owning Organizer | Show Checked In with labelled Asia/Bangkok (UTC+7) time when present; show Not Checked In only after the attendance query succeeds; show a retry/error state when it fails. |
| Event attendance view | Owning Organizer | Show the event's Attendance records and an explicit empty state. Records remain scoped to the selected owned Event. |
| My Registration attendance detail | Participant | On an own Registration, show Checked In with time or Not Checked In when the authorized response has no record. Do not expose other Participants. |
| Safe denial/error state | Visitor, Participant on organizer action, non-owner | Show a safe denial/not-found state without revealing another Organizer's Event or its registration list. |

All controls are labelled, keyboard-operable, and have visible focus. Loading, empty, success, validation, session, permission, conflict, and persistence states are explicit and announced. No QR scanner or Participant check-in control is in scope.

### 4.3 API contract

The routes below match candidate endpoint paths in the System-Level SDS. They are proposed new routes, not current server endpoints. F-04's registration-list API remains unchanged. All success and error bodies use the reviewed F-03/F-04 envelopes.

| Method and path | Authentication and scope | Request | Proposed success response |
| --- | --- | --- | --- |
| POST /api/v1/organizer/registrations/{registrationId}/attendance | Valid Organizer session. Backend resolves the Registration/Event and verifies event.organizerId = session.userId. | JSON body with eventId identifying the Event currently selected in the UI. It is a context assertion only; ownership, participantId, actor, and time are never trusted from the body. | 201 with data.attendance containing id, registrationId, eventId, participantId, recordedByOrganizerId, and checkedInAt in UTC ISO 8601. |
| GET /api/v1/organizer/events/{eventId}/attendance | Valid Organizer session; event owner must equal session.userId. | No request body. | 200 with data.attendances array for that Event; empty array is explicit. |
| GET /api/v1/me/registrations/{registrationId}/attendance | Valid Participant session; Registration must belong to session.userId. | No request body. | 200 with data.attendance object or null. A missing/other Participant's Registration returns privacy-preserving 404. |
| GET /api/v1/organizer/events/{eventId}/registrations | Existing F-04 approved route, unchanged. | No request body. | Existing event-scoped Registration list. The client joins this list with the separate attendance response by registrationId. |

The check-in POST is protected by the existing Origin-based CSRF guard. Retrieval GETs do not mutate domain state and do not require CSRF tokens. No API accepts participantId, organizerId, recordedByOrganizerId, checkInAt, status, or Attendance IDs as authority.

| Condition | HTTP outcome | Proposed code / behavior |
| --- | --- | --- |
| Missing, expired, revoked session | 401 | UNAUTHENTICATED |
| Participant attempts organizer check-in | 403 | FORBIDDEN |
| Missing, malformed, or disallowed Origin on check-in | 403 | CSRF_REJECTED; no database mutation |
| Missing Event/Registration or cross-owner/private row | 404 | Safe not-found; do not reveal another owner's records |
| Participant requests another Participant's Registration | 404 | REGISTRATION_NOT_FOUND |
| CANCELLED or otherwise ineligible Registration | 409 | REGISTRATION_NOT_ACTIVE |
| Before startAt or at/after endAt | 409 | CHECK_IN_WINDOW_CLOSED |
| Event context does not match Registration | 404 | REGISTRATION_NOT_FOUND; no wrong-Event association |
| Duplicate or concurrent duplicate | 409 | ATTENDANCE_ALREADY_EXISTS; retain original actor/time |
| Malformed JSON syntax | 400 | MALFORMED_JSON |
| Syntactically valid JSON with invalid fields | 422 | VALIDATION_ERROR with field details |
| Unexpected persistence failure | 500 | INTERNAL_SERVER_ERROR; no false success |

Exact new route details and codes remain Proposed until feature-contract review. An owner-scoped response never includes credentials, session identifiers, or unrelated user fields.

### 4.4 Data and persistence

| Item | Current repository state | F-07 contract requirement |
| --- | --- | --- |
| Registration | Existing Prisma Registration contains id, eventId, participantId, status, and registeredAt. | Reuse this row as the authoritative source of the event and participant association. Only status=ACTIVE is eligible. |
| Attendance | No Prisma model or migration exists. System-Level SDS defines logical fields for event, registration, participant, recording Organizer, and check-in time. | Add an Attendance model with id, registrationId, eventId, participantId, recordedByOrganizerId, and checkedInAt. Derive the related IDs from the locked Registration and authenticated owner, never from untrusted identity fields. |
| Uniqueness | No Attendance constraint exists. | Unique registrationId enforces at most one Attendance per Registration. |
| Referential integrity | Registration foreign keys already use ON DELETE RESTRICT. | Add restrictive foreign keys from Attendance to Registration, Event, and Participant/User. Retain records during the project/assessment period under proposed Q-10. |
| Association consistency | Ordinary foreign keys alone do not ensure that Attendance.eventId and participantId match its Registration. | Use a composite foreign key from (registrationId, eventId, participantId) to the matching Registration identity, and a composite Event-owner relation for (eventId, recordedByOrganizerId), or an equivalent reviewed database constraint. Backend checks remain required. |
| Query support | Event and Registration indexes exist; no Attendance query index exists. | Add an Event/time index for owner retrieval and an optional Participant/time index if needed for own attendance reads. Unique registrationId remains mandatory. |

For PostgreSQL composite foreign keys, the referenced keys must be unique. Add a unique key on Registration (id, eventId, participantId) and Event (id, organizerId), or use an equivalent reviewed constraint strategy. These keys are logically unique because id is already a primary key; the composite keys let the database enforce that copied Attendance associations match the Registration and that recordedByOrganizerId is the Event owner.

Persist checkedInAt as a UTC instant from the authoritative server/database clock. Display it as a clearly labelled Asia/Bangkok (UTC+7) time. A Registration with no Attendance is not given a synthetic or default Attendance row. No attendance counter or summary is stored; F-08 owns derived summaries in Sprint 3.

### 4.5 Transaction, concurrency, and security

- A check-in transaction locks the selected Event first, then the Registration row. It verifies the owner, request context, ACTIVE status, absence of Attendance, and time window after locking; it inserts Attendance and commits atomically.
- F-06 cancellation uses the same Event-then-Registration order. Both operations reread current Registration and Attendance after locks. A committed Attendance blocks cancellation. A cancellation committed before check-in changes status to CANCELLED, so check-in rejects.
- Read the decision time after lock acquisition, from one authoritative UTC server clock. If PostgreSQL provides the time, use a value reflecting the post-lock decision point rather than a transaction-start timestamp. Never trust browser time.
- The unique Attendance.registrationId constraint is a database backstop for concurrent duplicate check-ins. On a uniqueness race, roll back and map to ATTENDANCE_ALREADY_EXISTS without replacing the original record.
- Check-in uses authenticated Organizer role and backend ownership derived from Event.organizerId and the validated session. A client eventId is only compared with the Registration's actual eventId; it does not grant access.
- On any validation, authorization, uniqueness, or persistence failure, rollback all writes and return no Attendance success object.

### 4.6 Cross-feature consistency

1. ACTIVE registrations consume capacity regardless of Attendance. Check-in does not release a place or change Registration.status.
2. A cancelled Registration is never eligible for check-in; a checked-in Registration cannot subsequently be cancelled under F-06.
3. Attendance has a unique Registration association. Event and Participant are those already referenced by that Registration, with consistency enforced by reviewed constraints.
4. F-04's owner registration list remains the source for selecting a Registration. F-07 adds separate Attendance retrieval rather than changing the approved F-04 response.
5. Proposed Q-05's interval is [startAt, endAt): an exact startAt check-in is allowed; an exact endAt check-in is denied. All comparisons use server UTC instants and Q-11's display/input convention. This behavior remains unapproved until Q-05 is resolved.
6. Organizer reads and writes are restricted to owned Events. Participants can read only Attendance for their own Registration; a missing record is rendered Not Checked In only after a successful authorized read.
7. F-06 and F-07 share row-lock order and transaction policy. No state may commit as both CANCELLED and attended.

## 5. Validation, errors, permissions, and boundaries

| Case | Expected result |
| --- | --- |
| Owning Organizer, matching Event, ACTIVE Registration, now=startAt | Create one Attendance. |
| Owning Organizer, matching Event, ACTIVE Registration, now inside the event | Create one Attendance. |
| now immediately before startAt | Reject; no Attendance. |
| now=endAt or after endAt | Reject; no Attendance. |
| CANCELLED Registration | Reject; no Attendance. |
| No Registration for the selected Participant/Event | Reject; no Attendance. |
| Registration belongs to a different Event than request context | Safe rejection; no Attendance. |
| Repeat or concurrent check-in | One row only; duplicate conflict preserves original checkedInAt and recorder. |
| Non-owning Organizer | Safe 404 and no private data or mutation. |
| Participant uses organizer check-in route | 403 and no mutation. |
| No valid session | 401 with allowed Origin; disallowed/missing Origin on POST is rejected by csrfGuard with 403 first. |
| Organizer event has no Attendance rows | 200 with an empty attendances array. |
| Own Registration has no Attendance | 200 with attendance=null; UI shows Not Checked In. |
| Attendance retrieval fails | Show error/retry; never infer Not Checked In from a failed request. |
| Persistence failure | Roll back; no partial Attendance or false success. |

## 6. Acceptance criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F07-01 | FR-15, FR-19, FR-21, BR-02, BR-17, NFR-01, NFR-08 | The owning Organizer can view the existing event-scoped Registration list with attendance status joined by registrationId. Only after attendance retrieval succeeds does a missing row display as Not Checked In; empty, loading, and error states are explicit. |
| AC-F07-02 | FR-19, BR-02, BR-09, BR-16, NFR-04, Q-05 | A valid owner check-in for an ACTIVE Registration in the proposed Q-05 window persists exactly one Attendance with matching Registration, Event, Participant, recording Organizer, and server timestamp. |
| AC-F07-03 | FR-19, FR-20, BR-16, D-08, Q-05, Q-11 | Under proposed Q-05, the check-in interval is [startAt, endAt): at startAt and during the Event a valid check-in may succeed; before startAt, at endAt, and after endAt it is rejected without Attendance. |
| AC-F07-04 | FR-20, BR-11, BR-16 | A CANCELLED Registration, an unregistered Participant, or a Registration whose eventId does not match the selected Event context is rejected without creating or changing Attendance. |
| AC-F07-05 | FR-05, FR-19, FR-20, BR-02, BR-03, BR-04, NFR-01, NFR-03, Q-05 | Under proposed Q-05, only an authenticated owning Organizer may check in or retrieve owner-scoped attendance. Participants, anonymous callers, expired sessions, and non-owning Organizers are denied safely; state-changing requests also require the existing CSRF/Origin check. |
| AC-F07-06 | FR-19, FR-20, BR-17, NFR-05 | Sequential and concurrent duplicate check-ins produce at most one Attendance. A duplicate outcome leaves the original Attendance ID, recorder, timestamp, and Registration state unchanged. |
| AC-F07-07 | FR-21, BR-02, NFR-01 | An owning Organizer retrieves only Attendance rows for the selected owned Event. A no-attendance Event returns an explicit empty collection; another Organizer receives a safe denial/not-found with no data. |
| AC-F07-08 | FR-21, BR-03, BR-04, NFR-01, NFR-08 | A Participant can retrieve Attendance only through their own Registration. A valid own Registration with no Attendance returns an explicit null and renders Not Checked In; another Participant's Registration is concealed. |
| AC-F07-09 | FR-19, FR-21, BR-11, NFR-04, Q-10 | Committed Attendance and its original associations/time remain retrievable after application restart. No automatic deletion is introduced while Q-10 is pending. |
| AC-F07-10 | FR-17, FR-19, FR-20, BR-11, BR-13, BR-16, NFR-05 | F-06 cancellation and F-07 check-in serialize using one Event-then-Registration lock order. The final state never has both CANCELLED status and Attendance for the same Registration. |
| AC-F07-11 | FR-19, FR-20, BR-11, NFR-06 | Authorization, validation, conflict, uniqueness, or injected persistence failure creates no partial Attendance and returns no false success. |
| AC-F07-12 | FR-19, FR-21, NFR-08 | Organizer and Participant attendance views expose labelled, keyboard-accessible controls and explicit loading, empty, checked-in, not-checked-in, permission, retry, and error states. No QR or Participant self-check-in control is presented. |

## 7. Software Test Specifications

These are planned specifications only. No F-07 implementation or test execution is claimed. Test fixtures use UTC instants; user-facing time is labelled Asia/Bangkok (UTC+7).

### TEST-F07-01 - Owner check-in creates one associated Attendance

- **Related AC / requirements:** AC-F07-01, AC-F07-02; FR-15, FR-19, FR-21; BR-02, BR-16; Q-05.
- **Level:** Integration.
- **Preconditions and data:** Organizer O owns E1. Participant P has ACTIVE Registration R1 for E1. E1 starts at 2026-11-25T04:00:00Z and ends at 05:00:00Z. Server time is 04:30:00Z. One second Registration is CANCELLED and one ACTIVE Registration has no Attendance.
- **Steps and inputs:** O loads the F-04 registration route and attendance route, then POSTs the check-in request for R1 with body {"eventId":"E1"} and allowed Origin.
- **Expected / database and authorization verification:** Return 201. Exactly one Attendance row references R1, E1, P, and O with checkedInAt=04:30:00Z. R1 remains ACTIVE and capacity count is unchanged. The other ACTIVE row displays Not Checked In only after its attendance query succeeds; CANCELLED remains ineligible.

### TEST-F07-02 - Check-in time-window boundaries

- **Related AC / requirements:** AC-F07-03; FR-19, FR-20; BR-16; D-08, Q-05, Q-11.
- **Level:** Integration.
- **Preconditions and data:** Use separate eligible ACTIVE Registration/Event fixtures with startAt=2026-11-25T04:00:00Z and endAt=05:00:00Z, each owned by the test Organizer. Freeze the server clock.
- **Steps and inputs:** Submit at 03:59:59Z, exactly 04:00:00Z, 04:30:00Z, 04:59:59Z, exactly 05:00:00Z, and 05:00:01Z.
- **Expected / database and authorization verification:** Before-start, exact-end, and after-end return CHECK_IN_WINDOW_CLOSED with zero Attendance rows. Exact start, mid-event, and one second before end may each create exactly one correctly associated row.

### TEST-F07-03 - Cancelled, unregistered, and wrong-Event cases

- **Related AC / requirements:** AC-F07-04; FR-20; BR-06, BR-11, BR-16.
- **Level:** API.
- **Preconditions and data:** O owns E1 and E2. Provide a CANCELLED R1 for E1, no Registration for Participant P on E1, and ACTIVE R2 associated with E2. Server time is 04:30:00Z for both Events.
- **Steps and inputs:** POST check-in for R1; submit a nonexistent/unregistered Registration ID; then submit R2 with selected eventId=E1. Include valid allowed Origin.
- **Expected / database and authorization verification:** Each request returns a safe conflict/not-found result. No Attendance row is created for E1 or E2. In particular, eventId context cannot change R2's stored Event association.

### TEST-F07-04 - Check-in authentication, role, owner, and CSRF matrix

- **Related AC / requirements:** AC-F07-05; FR-05, FR-19, FR-20; BR-02, BR-03, BR-04; NFR-01, NFR-03; Q-05.
- **Level:** API.
- **Preconditions and data:** Organizer O1 owns E1; O2 owns E2; P is a Participant with eligible R1 on E1. Configure CLIENT_ORIGIN and snapshot Attendance rows.
- **Steps and inputs:** POST as O1 with valid Origin; repeat without session, with expired/revoked session, as P, as O2, and as O1 with missing/disallowed Origin. Call organizer attendance GET for E1 as O2. Call Participant own-attendance GET for R1 as another Participant.
- **Expected / database and authorization verification:** O1's valid call may proceed; missing/expired session with allowed Origin returns 401; Participant returns 403 on check-in; O2 gets safe 404 for E1; invalid Origin returns 403 CSRF_REJECTED before database work. Retrieval is owner/self scoped. All denied POSTs leave Attendance unchanged and return no private fields.

### TEST-F07-05 - Sequential and concurrent duplicate check-in

- **Related AC / requirements:** AC-F07-06; FR-19, FR-20; BR-17; NFR-05.
- **Level:** Integration.
- **Preconditions and data:** O owns E1; R1 is ACTIVE and eligible at 04:30:00Z. Use valid sessions and two synchronized clients.
- **Steps and inputs:** Submit one check-in, then retry sequentially; for a fresh fixture, release two simultaneous check-in POSTs from a barrier.
- **Expected / database and authorization verification:** The first request creates one row. Sequential retry returns ATTENDANCE_ALREADY_EXISTS. In the race, at most one request returns success and the loser gets a safe duplicate outcome. Database has one Attendance for R1; original id, recordedByOrganizerId, and checkedInAt never change.

### TEST-F07-06 - Organizer attendance retrieval scope and empty state

- **Related AC / requirements:** AC-F07-07; FR-21; BR-02, BR-04; NFR-01.
- **Level:** API.
- **Preconditions and data:** O1 owns E1 with two Attendance rows; O2 owns E2 with one. Create a third owned Event E3 with no Attendance.
- **Steps and inputs:** GET attendance for E1 and E3 as O1, then request E1 as O2. Try a modified Event ID.
- **Expected / database and authorization verification:** E1 returns exactly its two rows, E3 returns 200 with an empty array, and O2 receives safe 404 with no E1 metadata. No Participant or unrelated Event row leaks.

### TEST-F07-07 - Participant own attendance and missing record

- **Related AC / requirements:** AC-F07-08; FR-21; BR-03, BR-04; NFR-01, NFR-08.
- **Level:** API.
- **Preconditions and data:** Participant P1 owns active R1 with Attendance. P1 also owns active R2 without Attendance. P2 owns R3 with Attendance.
- **Steps and inputs:** GET attendance for R1, R2, and R3 as P1; then repeat R2 as P2.
- **Expected / database and authorization verification:** R1 returns its own Attendance only; R2 returns 200 with attendance=null; R3 requested as P1 returns privacy-preserving 404. No other Participant, organizer, Event, or session fields are returned.

### TEST-F07-08 - Attendance survives application restart

- **Related AC / requirements:** AC-F07-09; FR-19, FR-21; NFR-04; Q-10.
- **Level:** Integration.
- **Preconditions and data:** Persist one Attendance for R1 with known id, eventId, participantId, recordedByOrganizerId, and checkedInAt. Use a real isolated PostgreSQL database.
- **Steps and inputs:** Read via the owning Organizer route and Participant own-registration route, restart the application without resetting the database, then repeat both reads.
- **Expected / database and authorization verification:** Both authorized reads return the same Attendance ID and time after restart. Database still has one row, associations match R1, and no cleanup occurred.

### TEST-F07-09 - Check-in and cancellation race

- **Related AC / requirements:** AC-F07-10; FR-17, FR-19, FR-20; BR-11, BR-13, BR-16; NFR-05.
- **Level:** Integration.
- **Preconditions and data:** R1 is ACTIVE with no Attendance; E1 starts at 2026-11-25T04:00:00Z and ends at 05:00:00Z. Prepare two fixtures: server time exactly 04:00:00Z and server time 03:59:59Z. Use authorized Participant and owning Organizer sessions.
- **Steps and inputs:** At exact start, synchronize F-06 cancel(R1) and F-07 check-in(R1); repeat with the pre-start fixture.
- **Expected / database and authorization verification:** At exact start, cancellation is denied and check-in may create one Attendance. Before start, check-in is denied and cancellation may transition to CANCELLED. In both cases, there is never a committed state with CANCELLED plus Attendance, and Event/Registration counts remain valid.

### TEST-F07-10 - Attendance transaction rollback

- **Related AC / requirements:** AC-F07-11; FR-19, FR-20; BR-11; NFR-06.
- **Level:** Integration.
- **Preconditions and data:** Eligible R1 at 04:30:00Z with no Attendance. Snapshot Registration, Attendance, and active count. Use a test-only injected persistence failure after the proposed Attendance insert but before commit.
- **Steps and inputs:** Submit valid owner check-in, trigger failure, then read state in a fresh transaction.
- **Expected / database and authorization verification:** Return safe 500, no success representation, zero Attendance rows for R1, unchanged ACTIVE Registration, and unchanged count.

### TEST-F07-11 - Organizer registration/check-in UI journey

- **Related AC / requirements:** AC-F07-01, AC-F07-02, AC-F07-03, AC-F07-07, AC-F07-12; FR-15, FR-19, FR-20, FR-21; NFR-08; Q-05.
- **Level:** E2E.
- **Preconditions and data:** Seed owning Organizer O, one ACTIVE eligible R1, one ACTIVE un-attended R2, one CANCELLED Registration, and an empty owned Event. Start the test within E1's check-in window.
- **Steps and inputs:** Keyboard-navigate from My Events to registrations; check in R1; refresh; inspect attendance state for R1/R2 and the empty Event; attempt to check in the cancelled row. Exercise loading and failed-attendance-fetch states.
- **Expected / database and authorization verification:** The UI announces success and checked-in time for R1, shows Not Checked In for R2 only after a successful query, keeps CANCELLED ineligible, and shows an explicit empty/error state. Keyboard focus and labels are visible. Database contains only the authorized R1 Attendance.

### TEST-F07-12 - Participant attendance UI journey

- **Related AC / requirements:** AC-F07-08, AC-F07-12; FR-21; BR-03, BR-04; NFR-01, NFR-08.
- **Level:** E2E.
- **Preconditions and data:** Seed Participant P1 with an own Registration that has Attendance and a second own Registration without Attendance; seed P2 with a private Registration.
- **Steps and inputs:** Sign in as P1, keyboard-open each own Registration's attendance detail, refresh the page, and attempt an altered P2 Registration ID.
- **Expected / database and authorization verification:** P1 sees the checked-in timestamp on the first and Not Checked In on the second. The altered ID is denied without revealing P2's record. Labels, focus, loading, and error states are usable; no self-check-in control appears.

## 8. F-07 Definition of Done

F-07 implementation is Done only after every item is evidenced on the reviewed Sprint 2 release. These are future completion criteria, not claims that work is complete.

- [ ] Team resolves or revises Q-05 and affected Q-10 in the SRS; obtain teammate acceptance of F-05 v0.4 API/schema details before implementation relies on that baseline.
- [ ] A teammate other than the author accepts this versioned contract and reviews all API/schema changes before implementation.
- [ ] Reviewed migration adds Attendance, uniqueness, restrictive foreign keys, association-consistency constraints, and query indexes; rollback does not rewrite applied migration history.
- [ ] Backend derives identity and ownership from the session, validates Origin/CSRF, enforces ACTIVE status and [startAt, endAt), and samples server time after the shared Event/Registration locks.
- [ ] F-06 and F-07 share a lock order and pass the start-boundary race; no Registration can be both CANCELLED and attended.
- [ ] Every AC-F07-01 through AC-F07-12 is implemented and mapped to actual TEST results. Authorization, wrong Event, boundary, duplicate/concurrent, rollback, restart, and retrieval tests pass.
- [ ] Organizer and Participant views show accurate attendance states and accessible loading, empty, success, conflict, retry, and error states. Not Checked In appears only after a successful read.
- [ ] Real database restart verification confirms Attendance associations and timestamps persist. Q-10 remains explicitly proposed until team decision.
- [ ] Sprint 1/F-03/F-04/F-05/F-06 regression checks pass; actual commands, results, counts, failures/skips, database, and tested commit are recorded.
- [ ] Issue/branch/PR, substantive Student 1 peer review, staging integration, and accepted release identity are recorded. This contract task records no such review or release.

## 9. Risks and unresolved repository questions

| Item | Current observation | Required treatment |
| --- | --- | --- |
| Q-05 approval | SRS Q-05 is Open - Proposed; System-Level SDS calls the check-in rule Proposed. | Keep the interval and actor rule Pending Team Review until approved. |
| Q-10 retention | SRS leaves retention Pending Team Review. | The contract proposes assessment-period synthetic-data retention and no automatic deletion; production rules need separate review. |
| F-05 dependency status | Q-01 to Q-03 policy review is recorded in F-05 v0.3 and synchronized to the SRS. F-05 v0.4 API/schema acceptance remains pending. | Obtain final teammate acceptance of F-05 v0.4 before F-07 implementation depends on its public Event representation. |
| Schema gap | No Attendance model or migration exists. | Review and apply additive schema changes before implementation; no migration is included here. |
| Cross-entity integrity | Attendance.eventId and participantId must match the linked Registration; recording Organizer must own the Event. | Enforce with reviewed composite constraints plus backend authorization checks. |
| F-06 race | Cancellation and check-in are mutually exclusive lifecycle outcomes. | Use one lock order and test both before-start and exact-start outcomes. |
| Existing route proposal | System-Level SDS candidate paths are not current endpoints. | Review proposed paths/envelopes before treating them as accepted API contracts. |

## 10. Version and decision history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-24 | Draft - Review Ready; pending team review | Initial F-07 scope, workflow, candidate API/data model, AC, planned STS, DoD, shared cancellation/check-in transaction rules, and unresolved decision register. No implementation or test result recorded. |
| 0.2 | 2026-11-24 | Draft - Review Ready; pending team review | Corrected Q-05 wording to remain proposed, linked Q-05 to check-in AC/STS, and synchronized the F-05 dependency status with the SRS. No policy approval, implementation, or test execution is claimed. |

### Review record

| Review item | Status |
| --- | --- |
| Student 1 peer review | Pending |
| Team policy confirmation for Q-05 and Q-10 | Pending |
| Contract acceptance | Pending |
| Implementation, migration, and test execution | Not started by this documentation change |
| PR/release approval | Pending |

### Related baseline

- [SRS](../../srs.md), [Feature Inventory](../../features.md), [Traceability Matrix](../../traceability.md), [System-Level SDS](../../system-sds.md), and [Sprint Plan](../plan.md).
- [F-03 Participant Registration](../sprint-1/f-03-event-registration.md), [F-04 Organizer Registration Management](../sprint-1/f-04-organizer-registrations.md), [F-05 Capacity and Deadline](f-05-capacity-deadline.md), and [F-06 Cancellation and Re-registration](f-06-registration-cancellation.md).
