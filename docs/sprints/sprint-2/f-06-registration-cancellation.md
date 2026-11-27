# F-06 - Registration Cancellation and Re-registration

**Issue:** 11B - Sprint 2 Feature Contracts<br>
**Feature ID:** F-06<br>
**Contract version:** 0.5<br>
**Status:** Accepted — user confirmation recorded 2026-11-25; implementation and verification complete; PR #59 and staging integration PR #61 merged; formal release acceptance pending<br>
**Contract revision:** 2026-11-25<br>
**Author:** Issue 11B contributor (name not recorded in the repository)<br>
**Reviewer:** Acceptance reported by user; reviewer identity and review artifact not recorded in the repository<br>
**Target branch:** sprint-2-staging
**Work type:** Accepted F-06 feature contract. Implementation and verification are integrated into `sprint-2-staging` via PR #61 after feature PR #59; final Sprint 2 release acceptance/deployment remain pending.

**Current implementation snapshot (2026-11-27):** F-06 is IMPLEMENTED and TESTED. Feature PR #59 was merged to `feature/sprint-2-e2e`; the Issue 15 integration/regression tree was merged by PR #61 at `f08177c`. AC-F06-01 through AC-F06-13 results and the tested implementation version are in the [Sprint 2 AC matrix](ac-verification.md) and [Issue 15 integration report](integration-verification.md). The [F-06 implementation evidence](f-06-implementation-evidence.md) below remains a dated feature-branch test record; its pre-merge status is historical. No formal Sprint 2 release acceptance or deployment is recorded.

## 1. Purpose and scope

F-06 lets a Participant cancel an eligible registration they own, retains that cancelled registration as history, releases its place exactly once, and permits a later re-registration only after the normal current eligibility checks pass. This contract covers the Participant UI, the cancellation API, persistence, transaction and authorization rules, acceptance criteria, and planned tests.

F-06 contract acceptance was confirmed by the user on 2026-11-25; no separate reviewer identity or PR artifact was supplied. Q-04, Q-06, and Q-10 are Accepted — Team Reviewed and synchronized with the SRS. The Sprint 1 RegistrationStatus enum contains ACTIVE and CANCELLED, and the database retains its partial unique index for one ACTIVE registration per Participant and Event. F-06 adds nullable cancelledAt with a database lifecycle check, the shared Attendance persistence needed for the checked-in guard, the cancellation endpoint, and the Participant workflow. Verification is recorded in [F-06 implementation evidence](f-06-implementation-evidence.md). F-07 check-in/retrieval routes and UI are not part of this implementation.

## 2. Requirement and responsibility links

| Type | IDs | F-06 coverage |
| --- | --- | --- |
| Functional requirements | FR-05, FR-13, FR-14, FR-16, FR-17, FR-18 | Protected self-cancellation, cancelled personal history, repeat registration through F-03, and clear rejection outcomes. FR-13/FR-16 Sprint 2 deadline behavior is shared with F-05. |
| Business rules | BR-02, BR-03, BR-04, BR-08, BR-09, BR-11, BR-13, BR-14, BR-15 | Ownership and privacy, authentication, one ACTIVE row, active-count capacity, atomic writes, cancellation cutoff, deadline and capacity reuse. |
| Non-functional requirements | NFR-01, NFR-03, NFR-04, NFR-05, NFR-06, NFR-08, NFR-09, NFR-10 | Backend access control, session/CSRF protections, durable history, race safety, safe rollback, accessible states, versioned contract, and later reproducible verification. |
| System responsibilities | SR-01, SR-02, SR-03, SR-04 | Authorization/privacy, persistent integrity/concurrency, accessible workflow, and traceable verification. |
| Related features | F-01, F-02, F-03, F-04, F-05, F-07 | Session identity, Event ownership and times, Registration lifecycle, owner list, capacity/deadline eligibility, and the checked-in cancellation guard. |

## 3. Dependencies and policy status

| Dependency | Existing baseline or dependency for F-06 |
| --- | --- |
| F-01 | The current backend derives user and role from the server session. Mutating API calls pass the existing Origin-based csrfGuard; the configured CLIENT_ORIGIN must match. |
| F-02 | Event identity, owner, startAt, and endAt are stored in UTC-based instants. Only the backend clock is used for the cutoff. |
| F-03 | The existing POST /api/v1/events/{eventId}/registrations route creates a self-registration. GET /api/v1/me/registrations and its detail route expose a Participant's own persisted records. F-06 reuses these routes for re-registration and history. |
| F-04 | The existing owner-scoped registration list exposes registration status. F-06 does not give an Organizer permission to cancel for a Participant. |
| F-05 | Use the accepted F-05 v0.6 Q-01/Q-02 capacity rules and Q-03 effective-deadline rule synchronized to the SRS: only ACTIVE rows count; deadline is optional, otherwise startAt is effective; registration requires server time strictly before it. `registrationAvailable` means remaining capacity and `registrationOpen` means the effective-deadline window. These fields are UI information only; the backend registration operation rechecks publication, deadline, capacity, and duplicate-ACTIVE eligibility in its transaction. F-05 API/schema and migration are integrated on the target baseline and regression-tested with F-06. |
| F-07 | Check cancellation against persisted Attendance, and share the Event-then-Registration lock order with check-in so a checked-in record cannot be cancelled. F-06 adds shared Attendance persistence; F-07 routes and UI remain out of scope. |

### Decision register

Q-04, Q-06, and Q-10 are Accepted — Team Reviewed in the PR review recorded 2026-11-24. F-06 contract and API/schema acceptance was confirmed by the user on 2026-11-25; reviewer identity and external review artifact are not recorded here.

| Decision | Policy | Rationale | Affected features / requirements | Dependencies | Status and approval record |
| --- | --- | --- | --- | --- | --- |
| Q-04 | A Participant may cancel their own ACTIVE registration strictly before Event start, including after the registration deadline, provided it has not been checked in. At or after start, or after check-in, cancellation is denied. | Allows a late withdrawal to release a place without changing an attendance record. | F-06; FR-17; BR-13; F-07 checked-in guard | F-01, F-03, F-05, F-07; D-08/Q-11 server UTC time | Accepted — Team Reviewed (PR review recorded 2026-11-24); F-06 contract accepted per user confirmation 2026-11-25. |
| Q-06 | Re-registration creates a new ACTIVE Registration only after rechecking publication, effective deadline, capacity, and duplicate-ACTIVE rules. The old CANCELLED row remains unchanged. | Preserves an auditable lifecycle and applies current eligibility rather than reviving a stale reservation. | F-03/F-05/F-06; FR-18; BR-08, BR-09, BR-14 | F-03 registration transaction and the accepted, integrated F-05 v0.6 policy/API baseline. | Accepted — Team Reviewed (PR review recorded 2026-11-24); F-06 contract accepted per user confirmation 2026-11-25. |
| Q-10 | Retain synthetic Registration and Attendance history for the project and assessment period; do not add automatic deletion or a retention-management interface. Any real-user production policy needs separate review. | Supports the assessment's persistence and history evidence without asserting a production retention policy. | F-06/F-07; FR-14, FR-18; NFR-04 | Restrictive references and durable database storage | Accepted — Team Reviewed (PR review recorded 2026-11-24); real-user production policy is separate. |

Idempotent retries on an already CANCELLED record are accepted F-06 contract behavior: return the unchanged CANCELLED state and original cancelledAt without another write or capacity release.

## 4. Feature-level SDS

### 4.1 Workflow and lifecycle

1. A Participant opens My Registrations and selects one of their ACTIVE records.
2. The UI may display a Cancel registration control when the Event has not started, but this is only a convenience. The server remains authoritative.
3. The backend validates the session and Participant role, derives participantId from the session, and selects the Registration using both its ID and that participantId. Client-supplied participant or owner IDs are not accepted.
4. Inside one database transaction, the service locks the Event row first and the Registration row second. It reloads current Registration and Attendance state after acquiring the locks.
5. If the Registration is already CANCELLED, return its current state without writing. If Attendance exists, reject. Otherwise, sample authoritative server time after the lock is acquired and require now < Event.startAt.
6. For an eligible ACTIVE row, update status to CANCELLED and set cancelledAt to the same server-generated UTC instant in one commit.
7. Active counts remain derived from Registration rows with status ACTIVE. The cancellation transition therefore removes exactly one active row from the count; no mutable capacity counter is updated.
8. Re-registration uses the existing F-03 registration operation. It creates a new Registration ID and registeredAt only if the F-03/F-05 checks pass. The old cancelled row and cancelledAt are never reset.

| Current Registration state | Request / condition | Accepted result |
| --- | --- | --- |
| ACTIVE, no Attendance | Participant owns it and server time is before startAt | Transition to CANCELLED; set cancelledAt once. |
| ACTIVE, no Attendance | Server time is equal to or later than startAt | Reject with no mutation. |
| ACTIVE, Attendance exists | Any cancellation attempt | Reject with no mutation. |
| CANCELLED | Owner retries cancellation | Return existing CANCELLED representation; do not change cancelledAt or active count. |
| CANCELLED | Owner submits a new F-03 registration request | Revalidate all current rules; create a separate ACTIVE row only when eligible. |

The cancelledAt instant records the status transition, not the time of a later retry. Attendance is not deleted or changed by cancellation.

### 4.2 User interface

The current F-03 experience includes My Registrations. F-06 requires UI changes to extend that screen and detail view:

| Screen or control | Role | Required behavior |
| --- | --- | --- |
| My Registrations list | Participant | Show every own Registration, including ACTIVE and CANCELLED history, Event identity, registered time, state, and cancelled time when present. Loading, empty, retry, and error states are explicit. |
| Registration detail | Participant | Show lifecycle state and the related Event dates in labelled Asia/Bangkok (UTC+7) display. |
| Cancel registration | Participant, own ACTIVE row | Show only as a hint when the Event appears not to have started. Disable duplicate submits while pending. Ask for a clear confirmation before a destructive-looking action. Backend eligibility is still authoritative. |
| Cancelled confirmation | Participant | On successful cancellation, show CANCELLED and cancelledAt. Do not remove the row from history. |
| Re-register | Participant | Reuse the eligible Event registration control. Show current full/closed/duplicate conflicts from the server and keep old cancelled history visible. |
| Safe failure state | Any requester | Explain unavailable, closed, checked-in, validation, session, or server outcomes without exposing another Participant's record. |

All controls are labelled and keyboard-operable with visible focus. Status and errors use an announced text state, not color alone. If the UI cannot load a current Event time or server result, it must not claim cancellation succeeded.

### 4.3 API contract

The accepted route is implemented. Existing F-03/F-04 endpoint shapes and the { "data": ... } success / { "error": ... } failure envelopes are retained.

| Method and path | Authentication and scope | Request | Accepted response |
| --- | --- | --- | --- |
| POST /api/v1/me/registrations/{registrationId}/cancel | Valid Participant session; backend predicate requires registration.participantId = session.userId. A wrong participant's ID is concealed. Existing Origin-based CSRF guard applies. | Empty JSON object: {}. No participantId, ownerId, status, or timestamp is accepted. | Initial transition: 200 with data.registration containing id, eventId, participantId, status=CANCELLED, registeredAt, and cancelledAt. An idempotent retry returns the same state and timestamp. |
| POST /api/v1/events/{eventId}/registrations | Existing F-03 endpoint, reused for re-registration. Participant identity and time are server-derived; request remains {}. | No new F-06 route. | Existing F-03 201 representation for a new ACTIVE row, or the existing safe conflict/error envelope for duplicate, full, closed, missing, or ineligible Event. |
| GET /api/v1/me/registrations and GET /api/v1/me/registrations/{registrationId} | Existing F-03 Participant-only reads. | No request body. | Backward-compatible additive nullable cancelledAt field. Existing fields and ownership filtering stay unchanged. |
| GET /api/v1/organizer/events/{eventId}/registrations | Existing F-04 owner-only read. | No request body. | Existing event-scoped rows and status remain. This feature does not authorize Organizer cancellation. Whether cancelledAt is exposed in this owner response is not required for F-06 and would need a separate F-04 response review. |

Accepted cancellation outcomes use the existing JSON error envelope:

| Condition | HTTP outcome | Accepted code / behavior |
| --- | --- | --- |
| Missing, expired, revoked session | 401 | UNAUTHENTICATED |
| Wrong role | 403 | FORBIDDEN |
| Missing or another Participant's Registration | 404 | REGISTRATION_NOT_FOUND; do not disclose record existence |
| Missing, malformed, or disallowed Origin | 403 | CSRF_REJECTED; no database mutation |
| Malformed JSON syntax | 400 | MALFORMED_JSON |
| Syntactically valid JSON with invalid body fields | 422 | INVALID_CANCELLATION_REQUEST with field details |
| Active, checked-in Registration | 409 | REGISTRATION_CHECKED_IN; preserve current state |
| Active Registration at or after startAt | 409 | CANCELLATION_CLOSED; preserve current state |
| Already CANCELLED own Registration | 200 | Return current state idempotently; not a second transition |
| Unexpected persistence failure | 500 | INTERNAL_SERVER_ERROR; do not return a success representation |

The cancellation route and error-code names in this table are accepted F-06 API details. Statuses and envelopes align with the approved F-03/F-04 conventions and current backend behavior.

### 4.4 Data and persistence

| Item | Current repository state | F-06 contract requirement |
| --- | --- | --- |
| Registration identity/status | Prisma Registration has id, eventId, participantId, status, registeredAt. RegistrationStatus already supports ACTIVE and CANCELLED. | Reuse the row and status enum. Do not introduce a separate cancellation record or overwrite a cancelled row during re-registration. |
| Cancellation time | Nullable cancelledAt DateTime is added and stored as a UTC instant. | Set it only when ACTIVE transitions to CANCELLED. |
| Active uniqueness | PostgreSQL already has a partial unique index on (participantId, eventId) WHERE status = ACTIVE. | Preserve it unchanged. It permits retained cancelled history and at most one ACTIVE row. |
| Capacity | No Registration counter is stored; current public counts query ACTIVE rows. | Keep active count derived from status=ACTIVE. Attendance does not release a place. |
| Foreign keys / deletion | Current Registration-to-Event and Registration-to-User foreign keys use ON DELETE RESTRICT. | Keep references restrictive for retained history; do not add a delete path or automatic cleanup. |

The additive migration adds an invariant equivalent to: ACTIVE implies cancelledAt is null; CANCELLED implies cancelledAt is not null. Existing ACTIVE rows backfill to null. The migration also adds shared Attendance persistence and composite references needed by the F-07 contract. It was applied to the isolated `eventcheck_test/public` database; the development database was not migrated. An optional index on cancelledAt is not required for this feature; existing participant/status and event/status indexes support the primary reads.

This contract adds no mutable active-registration counter, no separate cancellation-history table, no new capacity field, and no change to the partial active-registration index. The accepted F-05 Event.registrationDeadline field and its migration are present on the target baseline.

### 4.5 Transactions, concurrency, and security

- All F-03 registration, F-05 capacity/deadline, F-06 cancellation, and F-07 check-in transitions for an Event acquire the same Event row lock first. Cancellation and check-in then lock the Registration row. Use this global Event-then-Registration order to avoid inconsistent decisions and reduce deadlock risk.
- Re-read Registration status and Attendance after locking. Cancellation writes status and cancelledAt atomically. A repeated request cannot release another place because active counts are derived from status and no second ACTIVE-to-CANCELLED transition occurs.
- Sample server-authoritative UTC time after locks are acquired. If database time is selected, do not use a transaction-start timestamp after a lock wait; use a time source that reflects the decision point. The client clock is never trusted.
- The re-registration path uses F-03's existing Event lock, duplicate-first check, ACTIVE count, capacity guard, F-05 deadline guard, and active partial unique index. A race that observes the old ACTIVE row may return a duplicate conflict; retry after confirmed cancellation may create one new row.
- The F-01 session, Participant role, server-derived identity, and Origin-based CSRF guard apply. UI hiding is not authorization. No client field can override user, owner, status, or time.
- Any rejection or exception rolls back all changes. No Registration, timestamp, capacity count, or Attendance state may be partially changed.

### 4.6 Cross-feature consistency

1. Only ACTIVE registrations consume capacity. Cancellation changes one row to CANCELLED, so the derived active count falls by exactly one; an idempotent retry has no further effect.
2. Re-registration is a new Registration through F-03. It must pass the F-05 effective deadline and active-capacity rules at commit time. A cancellation after the effective registration deadline may succeed before start, but re-registration at that same time is closed.
3. Cancellation history remains in the old Registration row and does not reset when a new row is created. Under accepted Q-10, synthetic registration and attendance history is retained through the project and assessment period without automatic deletion.
4. Attendance is linked to Registration. If Attendance exists, F-06 cannot cancel that Registration. F-07 and F-06 share row-lock order and transaction boundaries.
5. F-06 does not modify F-05 capacity policy, F-04's Organizer authority, or F-03's approved registration endpoint and response fields except for the accepted additive cancelledAt field on Participant reads.
6. F-01 authentication, CSRF, safe errors, and server ownership checks apply to every new mutation.

## 5. Validation, errors, and boundary rules

| Case | Expected result |
| --- | --- |
| Own ACTIVE Registration, now < startAt | Cancel, including when now is at or after the F-05 effective registration deadline. |
| Own ACTIVE Registration, now = startAt | Deny; no state change. |
| Own ACTIVE Registration, now > startAt | Deny; no state change. |
| Already CANCELLED own Registration | Return unchanged cancelled state and cancelledAt; do not release another place. |
| Registration has Attendance | Deny; retain ACTIVE status and Attendance. |
| Registration belongs to another Participant | Safe 404 and no read or write. |
| Organizer calls Participant cancellation | 403 and no write. |
| No valid session | 401 when request has an allowed Origin; missing/disallowed Origin is rejected by CSRF guard with 403 before route handling. |
| Two cancellation requests race | Event/Registration locks serialize them; at most one transition and one active-count decrement. |
| Re-registration before effective deadline, capacity available | F-03 creates a new ACTIVE row after rechecking all rules. |
| Re-registration at/after effective deadline | F-05 closed-registration conflict; no new row. |
| Re-registration when full | EVENT_FULL conflict; no new row. |
| Duplicate ACTIVE row already exists | REGISTRATION_DUPLICATE conflict; existing row is unchanged. |
| Controlled transaction failure | Rollback to the pre-request status, timestamp, and active count; no false success. |

## 6. Acceptance criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F06-01 | FR-05, FR-17, BR-03, BR-04, NFR-01, NFR-03 | Only an authenticated Participant can cancel their own Registration. Identity is session-derived; anonymous, wrong-role, cross-Participant, invalid-session, and CSRF-failing requests produce safe outcomes with no mutation or private-data leak. |
| AC-F06-02 | FR-17, BR-13, BR-14, D-08, Q-04, Q-11 | An own ACTIVE Registration may be cancelled when server time is strictly before startAt, including after the effective registration deadline. Cancellation persists status=CANCELLED and a server UTC cancelledAt. |
| AC-F06-03 | FR-17, BR-13, D-08, Q-04, Q-11 | An ACTIVE Registration cannot be cancelled at or after startAt. The request leaves status, cancelledAt, and active count unchanged. |
| AC-F06-04 | FR-17, BR-13, BR-09, Q-04 | Repeating cancellation for an already CANCELLED own Registration returns its unchanged state and original cancelledAt, including on a retry after startAt; it never releases another place. |
| AC-F06-05 | FR-17, BR-13, BR-11 | A Registration with Attendance cannot be cancelled. Registration and Attendance remain unchanged. |
| AC-F06-06 | FR-17, BR-09 | One successful cancellation removes exactly one Registration from the ACTIVE count and adds exactly one remaining place. Retries and rejected requests do not change either value. |
| AC-F06-07 | FR-14, FR-17, BR-11, NFR-04, Q-10 | The old cancelled row, registeredAt, status, and cancelledAt remain retrievable after restart in the Participant's own registration history; the Organizer list continues to show its CANCELLED state. No automatic history deletion is introduced. |
| AC-F06-08 | FR-18, BR-08, BR-09, BR-14, Q-06 | Eligible re-registration for a currently PUBLISHED Event creates a distinct ACTIVE row with a new ID and registeredAt while leaving the original CANCELLED row and cancelledAt unchanged. |
| AC-F06-09 | FR-16, FR-18, BR-08, BR-09, BR-14, BR-15, Q-03, Q-06 | Re-registration at/after the effective deadline, when capacity is full, or when an ACTIVE duplicate exists is rejected after current eligibility checks. No extra ACTIVE row or place is created. |
| AC-F06-10 | FR-17, FR-18, BR-08, BR-09, BR-11, NFR-05, Q-04, Q-06 | Concurrent cancellation and re-registration operations serialize so no more than one ACTIVE row exists for the Participant/Event pair and cancellation releases no more than one place. |
| AC-F06-11 | FR-17, FR-19, BR-11, BR-13, BR-16, NFR-05 | F-06 and F-07 use one Event-then-Registration lock order. At the start boundary, check-in may succeed while cancellation is denied; a committed Attendance prevents later cancellation. |
| AC-F06-12 | FR-17, FR-18, BR-11, NFR-06 | A validation, authorization, conflict, or injected persistence failure returns no success and leaves Registration, Attendance, and derived active count at their pre-request values. |
| AC-F06-13 | FR-14, FR-17, FR-18, NFR-08 | Participant screens expose labelled status, loading, empty, success, session, conflict, and error states; controls have keyboard access and visible focus. Cancelled history remains visible after the cancellation action. |

## 7. Software Test Specifications

These specifications are implemented and mapped in the linked evidence. Each test checks persisted state where applicable. TEST-F06-13 uses a storage-level F-07 lock-order writer because the F-07 HTTP check-in endpoint is outside Issue 13.

### TEST-F06-01 - Cancellation authorization matrix

- **Related AC / requirements:** AC-F06-01; FR-05, FR-17; BR-03, BR-04; NFR-01, NFR-03.
- **Level:** API.
- **Preconditions and data:** Registration R1 is ACTIVE for Participant A on Event E1. Create Participant B, Organizer O, and expired/revoked sessions. Configure the allowed CLIENT_ORIGIN.
- **Steps and inputs:** POST {} to /api/v1/me/registrations/R1/cancel as A with allowed Origin; repeat without a session, as B, as O, and with expired/revoked sessions. Repeat a request with missing and disallowed Origin. Snapshot R1 and the ACTIVE count before each request.
- **Expected / database and authorization verification:** A receives the accepted successful response. Missing/expired/revoked session returns 401 with allowed Origin; Organizer returns 403; B receives privacy-preserving 404; invalid Origin returns 403 CSRF_REJECTED. All denied attempts leave R1 and counts byte-for-byte unchanged.

### TEST-F06-02 - Cancel after deadline but before start

- **Related AC / requirements:** AC-F06-02; FR-17; BR-13, BR-14; D-08, Q-04, Q-11.
- **Level:** Integration.
- **Preconditions and data:** E1 starts at 2026-11-25T04:00:00Z and ends at 05:00:00Z. Its explicit registrationDeadline is 03:30:00Z. R1 is ACTIVE for Participant A. Freeze server time at 03:45:00Z.
- **Steps and inputs:** POST {} to A's cancellation route with allowed Origin.
- **Expected / database and authorization verification:** Response represents R1 as CANCELLED; cancelledAt is 03:45:00Z; registeredAt and identity are unchanged; a fresh database read counts one fewer ACTIVE row. The already-passed registration deadline does not block cancellation.

### TEST-F06-03 - Event start boundary

- **Related AC / requirements:** AC-F06-02, AC-F06-03; FR-17; BR-13; D-08, Q-04, Q-11.
- **Level:** Integration.
- **Preconditions and data:** Create three equivalent ACTIVE registrations for Events starting at 2026-11-25T04:00:00Z; use independent fixtures and a controlled server clock.
- **Steps and inputs:** Cancel at 03:59:59Z, exactly 04:00:00Z, and 04:00:01Z.
- **Expected / database and authorization verification:** Only the 03:59:59Z request transitions to CANCELLED and sets cancelledAt. Exact-start and after-start requests return CANCELLATION_CLOSED. Inspect each row and per-Event ACTIVE count to confirm denied requests changed nothing.

### TEST-F06-04 - Idempotent cancellation retry

- **Related AC / requirements:** AC-F06-04, AC-F06-06; FR-17; BR-09, BR-13; Q-04.
- **Level:** API.
- **Preconditions and data:** R1 is already CANCELLED with cancelledAt=2026-11-25T03:00:00Z; Event start is 04:00:00Z. Current server time is 04:05:00Z.
- **Steps and inputs:** The owning Participant retries POST {} to the cancellation route twice.
- **Expected / database and authorization verification:** Both responses return the same CANCELLED state and original cancelledAt. No update timestamp or active count changes; no place is released on either retry.

### TEST-F06-05 - Checked-in Registration cannot be cancelled

- **Related AC / requirements:** AC-F06-05; FR-17, FR-19; BR-11, BR-13, BR-16.
- **Level:** Integration.
- **Preconditions and data:** R1 is ACTIVE and has a valid Attendance for E1 at 2026-11-25T04:15:00Z. Use a controlled time of 04:16:00Z.
- **Steps and inputs:** The owning Participant requests cancellation.
- **Expected / database and authorization verification:** Return REGISTRATION_CHECKED_IN (or the reviewed safe conflict code). R1 remains ACTIVE, cancelledAt remains null, Attendance and its original actor/time remain unchanged, and active count is unchanged.

### TEST-F06-06 - Exactly one place is released

- **Related AC / requirements:** AC-F06-06; FR-17; BR-09, BR-11.
- **Level:** Integration.
- **Preconditions and data:** E1 capacity=2, with two ACTIVE registrations and no Attendance. Read the public Event projection and database count before the request.
- **Steps and inputs:** Cancel one Registration at 2026-11-25T03:00:00Z with startAt=04:00:00Z, then retry the same cancellation.
- **Expected / database and authorization verification:** After the first transition, ACTIVE count=1 and remainingPlaces=1. After the retry, both values are still 1. The other Registration is unchanged.

### TEST-F06-07 - Cancelled history survives retrieval and restart

- **Related AC / requirements:** AC-F06-07; FR-14, FR-17; NFR-04; Q-10.
- **Level:** Integration.
- **Preconditions and data:** Participant A has one cancelled R1 with registeredAt=2026-11-24T04:00:00Z and cancelledAt=2026-11-25T03:00:00Z. The Event owner is Organizer O.
- **Steps and inputs:** Read A's list/detail and O's existing Event registration list; restart the application without resetting the database; repeat both reads.
- **Expected / database and authorization verification:** R1 remains present with the same ID, status, registeredAt, and cancelledAt in Participant history; the owner list shows its CANCELLED state. No cleanup or data recreation occurs.

### TEST-F06-08 - Eligible re-registration creates a new row

- **Related AC / requirements:** AC-F06-08; FR-13, FR-18; BR-08, BR-09, BR-14; Q-06.
- **Level:** Integration.
- **Preconditions and data:** R1 is CANCELLED; E1 is PUBLISHED, capacity=2 with one other ACTIVE row, registrationDeadline=2026-11-25T03:30:00Z, startAt=04:00:00Z. Current time is 03:20:00Z.
- **Steps and inputs:** Participant A calls the existing F-03 POST /api/v1/events/E1/registrations with {}.
- **Expected / database and authorization verification:** Return the F-03 201 shape for new R2 with status ACTIVE, a different ID, and new registeredAt. R1 remains CANCELLED with its original cancelledAt; exactly two ACTIVE rows exist and capacity is not exceeded.

### TEST-F06-09 - Re-registration deadline boundary

- **Related AC / requirements:** AC-F06-09; FR-16, FR-18; BR-14; Q-03, Q-06.
- **Level:** Integration.
- **Preconditions and data:** Use fresh cancelled histories, published Events with spare capacity, explicit deadline 2026-11-25T03:30:00Z and a separate Event with no deadline and startAt=04:00:00Z.
- **Steps and inputs:** Call the F-03 registration route at explicit deadline-1 second (03:29:59Z), exact deadline (03:30:00Z), deadline+1 second (03:30:01Z), and at the no-deadline Event's startAt (04:00:00Z).
- **Expected / database and authorization verification:** Only the before-deadline request may create a new ACTIVE row. Exact/after/default-start requests return the reviewed REGISTRATION_CLOSED conflict and create no row or place consumption. Old cancelled rows remain unchanged.

### TEST-F06-10 - Full Event and existing ACTIVE duplicate

- **Related AC / requirements:** AC-F06-09; FR-16, FR-18; BR-08, BR-09, BR-14, BR-15; Q-03, Q-06.
- **Level:** API.
- **Preconditions and data:** Fixture A: R1 is CANCELLED, another Participant fills E1 capacity=1, and deadline is still open. Fixture B: Participant A already has an ACTIVE R2 and an older cancelled R1.
- **Steps and inputs:** Re-register A on full E1; then call the F-03 registration route for Fixture B's Event with {}.
- **Expected / database and authorization verification:** Fixture A returns EVENT_FULL; Fixture B returns REGISTRATION_DUPLICATE. Neither creates a row, changes a status/timestamp, or exceeds capacity. The existing ACTIVE index remains the database backstop.

### TEST-F06-11 - Concurrent cancellation requests

- **Related AC / requirements:** AC-F06-04, AC-F06-06, AC-F06-10; FR-17; BR-09, BR-11, BR-13; NFR-05; Q-04.
- **Level:** Integration.
- **Preconditions and data:** One ACTIVE R1, no Attendance, Event capacity=1, and server time 03:00:00Z before start 04:00:00Z. Use two synchronized API clients with the same Participant session.
- **Steps and inputs:** Release both POST {} cancellation requests from a barrier; then issue one normal F-03 registration request after both responses.
- **Expected / database and authorization verification:** Requests serialize; at most one ACTIVE-to-CANCELLED transition occurs and cancelledAt is stable. The later re-registration creates at most one ACTIVE row. Final ACTIVE count is 0 before re-registration and 1 afterward; capacity is never exceeded.

### TEST-F06-12 - Cancellation versus re-registration race

- **Related AC / requirements:** AC-F06-08, AC-F06-10; FR-17, FR-18; BR-08, BR-09, BR-11; NFR-05; Q-04, Q-06.
- **Level:** Integration.
- **Preconditions and data:** One ACTIVE R1 for Participant A, capacity=1, no Attendance, deadline open, and fixed time 03:00:00Z before start.
- **Steps and inputs:** Synchronize POST cancel(R1) and F-03 POST registration(E1) from A. Repeat with fresh fixtures for five race attempts or the team-approved NFR-05 sample.
- **Expected / database and authorization verification:** If registration acquires the Event lock first, it may receive duplicate conflict before cancellation commits; if cancellation commits first, re-registration may create one new row. In every outcome, old history is retained, no more than one ACTIVE row exists, count <= capacity, and no false success is returned.

### TEST-F06-13 - Cancellation and check-in race

- **Related AC / requirements:** AC-F06-05, AC-F06-11; FR-17, FR-19, FR-20; BR-11, BR-13, BR-16; NFR-05.
- **Level:** Integration.
- **Preconditions and data:** One ACTIVE R1 with no Attendance; Event starts at 2026-11-25T04:00:00Z and ends at 05:00:00Z. Use fixed server time exactly 04:00:00Z and synchronized F-06/F-07 requests with valid owner/Participant sessions.
- **Steps and inputs:** Start cancellation and owner check-in concurrently.
- **Expected / database and authorization verification:** Cancellation is closed at startAt. Check-in may create exactly one Attendance. Final Registration remains ACTIVE, cancelledAt is null, and Attendance references the same Registration/Event/Participant and authenticated owner. No interleaving may produce CANCELLED plus Attendance.

### TEST-F06-14 - Transaction rollback on persistence failure

- **Related AC / requirements:** AC-F06-12; FR-17, FR-18; BR-11; NFR-06.
- **Level:** Integration.
- **Preconditions and data:** ACTIVE R1 with no Attendance; snapshot its status, cancelledAt, Event active count, and Registration history. Use a test-only injected failure after the status/timestamp write but before commit.
- **Steps and inputs:** Submit cancellation, trigger the injected exception, then read state in a fresh transaction.
- **Expected / database and authorization verification:** Return safe 500; status remains ACTIVE, cancelledAt remains null, active count and history equal the snapshot, and no success response is emitted.

### TEST-F06-15 - Participant cancellation UI journey

- **Related AC / requirements:** AC-F06-02, AC-F06-04, AC-F06-07, AC-F06-13; FR-14, FR-17, FR-18; NFR-08.
- **Level:** E2E.
- **Preconditions and data:** Seed Participant A with one ACTIVE eligible Registration and one historical CANCELLED Registration; seed the owning Organizer. Use an Event starting at 2026-11-25T04:00:00Z.
- **Steps and inputs:** Keyboard-navigate to My Registrations, open the eligible record, cancel and confirm, retry after refresh, and inspect both history rows. Also exercise empty/loading/error state with controlled API responses.
- **Expected / database and authorization verification:** Controls have labels and visible focus; success and CANCELLED history are announced; the old row remains and a retry does not hide it. Verify the database contains exactly the expected status transition and cancelledAt; no API/UI path cancels another Participant's row.

## 8. F-06 Implementation and Release Status

F-06 implementation and AC verification are complete and staging-integrated as recorded above. The final checklist item distinguishes the remaining reviewed-release gate from completed feature work.

- [x] Confirmed the SRS reflects Accepted — Team Reviewed Q-04, Q-06, and Q-10 and the accepted F-05 v0.6 API/schema baseline.
- [x] F-06 contract acceptance recorded per user confirmation on 2026-11-25; reviewer identity and external review artifact were not supplied in the repository.
- [x] Additive migration adds cancelledAt and its lifecycle invariant; the existing partial unique ACTIVE index and restrictive history references remain valid.
- [x] F-06 backend uses session-derived Participant identity, CSRF protection, Event-then-Registration locks, server time after lock acquisition, and atomic status/timestamp persistence.
- [x] F-03 registration revalidation uses F-05 effective deadline and current active count; re-registration creates a new ID and retains the old cancelled row.
- [x] Every AC-F06-01 through AC-F06-13 is implemented and mapped to executed TEST results. Required boundary, authorization, persistence, rollback, repeat, capacity, concurrency, and F-06/F-07 lock-order cases pass.
- [x] Participant list/detail and cancellation states are accessible by keyboard and show explicit loading, empty, success, conflict, session, and error outcomes.
- [x] Real database restart verification confirms cancelled history remains. No automatic deletion, fake counter, or browser-only persistence is used.
- [x] Sprint 1 and F-05 regression checks pass; failures/skips, test names, commands, counts, database, and tested source state are recorded in the linked evidence.
- [ ] Final Sprint 2 release identity and acceptance are recorded. Feature PR #59 and staging integration PR #61 are known; this contract does not record the individual reviewer identity/substantive review artifact or an accepted release. Add those actual records when preparing the final PDF; do not infer acceptance from the merge.

## 9. Risks and unresolved repository questions

| Item | Current observation | Required treatment |
| --- | --- | --- |
| F-05 dependency status | Q-01 to Q-03, the `registrationAvailable` / `registrationOpen` meanings, and F-05 v0.6 API/schema are accepted and integrated on the target baseline. | Preserve the accepted field meanings and backend-authoritative eligibility. |
| F-06 persistence | Migration adds cancelledAt with a status check and shared Attendance persistence with restrictive composite references. | The migration is applied and verified on isolated `eventcheck_test/public`; deploy it through the normal reviewed release process before using the feature elsewhere. |
| Deadline dependency | Event.registrationDeadline is present in the accepted F-05 schema and transaction behavior. | Re-registration uses the accepted F-05 effective deadline and rechecks it inside the transaction. |
| Publication-state representation | The current Prisma PublicationState enum contains only PUBLISHED, so a non-published Event fixture cannot be represented by the current schema. | Re-registration still reuses the F-03 publication eligibility check. Do not add an unpublished lifecycle as F-06 scope; add a negative-state test only if a later reviewed F-02 schema supports it. |
| Concurrent lifecycle work | A cancellation and check-in must not commit incompatible state. | F-06 and F-07 must use the same Event-then-Registration lock order and test at the start boundary. |
| Retention | Q-10 is Accepted — Team Reviewed for synthetic data during the project and assessment period. | No automatic deletion or retention-management interface is added for this scope; any real-user production policy requires separate review. |

## 10. Version and decision history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-24 | Draft - Review Ready; pending team review | Initial F-06 scope, workflow, API/data proposal, AC, planned STS, DoD, cross-feature transaction rules, and unresolved decision register. No implementation or test result recorded. |
| 0.2 | 2026-11-24 | Draft - Review Ready; pending team review | Synchronized the F-05 dependency status with the SRS, clarified that F-05 v0.4 API/schema acceptance remains pending, and linked cancellation/re-registration AC and STS rows to Q-04/Q-06. No policy approval, implementation, or test execution is claimed. |
| 0.3 | 2026-11-24 | Draft - Review Ready; Q-04/Q-06/Q-10 Accepted — Team Reviewed; contract acceptance pending | Recorded the PR-reviewed policies in the decision register, SRS references, and lifecycle/retention notes; aligned the F-05 dependency with v0.5 field semantics and backend-authoritative registration checks. F-05 API/schema and F-06 contract acceptance, implementation, migration, and test execution remain pending. |
| 0.4 | 2026-11-25 | Accepted — user confirmation | Recorded the user's confirmation that F-06 was accepted; the repository contains no separate reviewer identity or PR artifact. Reconciled the F-05 dependency with accepted/integrated v0.6. No implementation or test execution is claimed in this history entry. |
| 0.5 | 2026-11-25 | Accepted; implementation verified on feature branch | Implemented the cancellation API, persistence invariant, shared Attendance guard, Participant cancellation/history/re-registration flow, and AC-linked integration, restart, unit, and E2E evidence. No PR merge or release approval is claimed. |

### Review record

| Review item | Status |
| --- | --- |
| Student 1 peer review | Acceptance reported by user; reviewer identity and review artifact not supplied in the repository |
| Team policy confirmation for Q-04, Q-06, Q-10 | Accepted — Team Reviewed; PR review recorded 2026-11-24 |
| Contract acceptance | Accepted per user confirmation on 2026-11-25 |
| Implementation and verification | Implemented, tested, and staging-integrated; see [implementation evidence](f-06-implementation-evidence.md) for its dated feature-branch run and the current snapshot above for later integration |
| Feature/staging integration | PR #59 merged to `feature/sprint-2-e2e`; PR #61 merged to `sprint-2-staging` at `f08177c` |
| Formal Sprint 2 release acceptance/deployment | Pending; Issue 17 must identify and verify the exact candidate |

### Related baseline

- [SRS](../../srs.md), [Feature Inventory](../../features.md), [Traceability Matrix](../../traceability.md), [System-Level SDS](../../system-sds.md), and [Sprint Plan](../plan.md).
- [F-03 Participant Registration](../sprint-1/f-03-event-registration.md), [F-04 Organizer Registration Management](../sprint-1/f-04-organizer-registrations.md), and [F-05 Capacity and Deadline](f-05-capacity-deadline.md).
