# F-05 — Capacity and Registration Deadline Management

**Issue:** #47 — Contract task: Capacity & Registration Deadline Management

**Contract version:** 0.3
**Status:** Draft — Pending Final Teammate Approval; implementation is not authorized beyond the documented design until the revised contract is approved.
**Sprint:** 2

This contract extends the accepted Sprint 1 Event, Registration, session, ownership, and concurrency baseline. It does not change Sprint 1 behavior: published capacity remains fixed there, and Sprint 1 registration has no time-based closure.

## A. Feature overview and Feature SDS

### Scope and linked requirements

| Type | IDs | F-05 responsibility |
| --- | --- | --- |
| Functional requirements | FR-10; Sprint 2 extensions of FR-12, FR-13, FR-16 | Owner-scoped capacity edit; optional deadline display; server-enforced eligibility and closed-registration outcome. |
| Business rules | BR-02, BR-05, BR-09, BR-10, BR-11, BR-14, BR-15 | Ownership, positive capacity, invariant preservation, serialized races, atomic rejection, deadline, and capacity-edit policy. |
| Non-functional requirements | NFR-01, NFR-04, NFR-05, NFR-06, NFR-08 | Privacy, persistence, concurrency, time handling, and accessibility. |
| System responsibilities | SR-01, SR-02, SR-03 | Authorization/privacy, persistent atomic integrity, and usable safe outcomes. |
| Dependencies | F-01, F-02, F-03; later F-06/F-07 | Existing session/role, Event ownership/publication, Registration lifecycle, and future cancellation/check-in rules. |

### Actors and authorization

The backend derives the Organizer from the validated F-01 session and requires `event.organizerId = session.userId`. Only that owner may edit an owned published Event before its start. Visitors, Participants, expired/revoked sessions, and other Organizers receive safe denial outcomes without private-data or existence leakage. Registration continues to derive Participant identity from the session; client-supplied owner, participant, status, capacity-count, or server-time fields are ignored or rejected.

### User journeys and state behavior

1. An owning Organizer opens an owned published Event, edits capacity and optionally sets/clears a deadline, and receives a persisted result.
2. The UI displays the effective deadline and open/closed registration state in Event detail. Display/input uses labelled Asia/Bangkok (UTC+7); persistence and comparisons use UTC instants.
3. A Participant can register only while server time is strictly before the effective deadline and while all Sprint 1 publication, duplicate, capacity, and authorization rules pass. At or after the deadline, the request is rejected without consuming a place.
4. A rejected edit or registration leaves the previously committed Event, Registration rows, active count, and remaining places unchanged. No participant is automatically displaced when capacity is reduced.

Q-01, Q-02, and Q-03 have been Accepted — Team Reviewed. However, the deadline-aware extension of `registrationAvailable` remains Proposed — Pending Final API Contract Approval. If the team does not accept this API extension, F-05 must introduce a separately named field through a reviewed backward-compatible API change.

## B. UI and interaction design

| Screen/component | Role | Required behavior |
| --- | --- | --- |
| Organizer Event settings | Owning Organizer | Show current capacity/deadline, validation, saving, safe conflict/error feedback, and unchanged state after rejection. Non-owner controls are absent or denied. |
| Public Event detail | Visitor, Participant, Organizer | Show existing public fields plus optional deadline and an accurate open/closed/availability state; never show private registration data. |
| Participant registration action | Participant | Keep existing Register/Registered/full behavior; show a distinct closed-registration outcome and do not submit repeated requests while pending. The public `registrationAvailable` field remains informational. |
| Safe denial/error state | All unauthorized callers | Explain that the operation is unavailable without revealing another owner's Event or credentials. |

Focus moves to the active panel after tab/detail navigation, labels identify capacity and deadline controls, invalid fields are announced, and keyboard users can operate all controls. Existing F-01/F-02/F-03 layout and authentication behavior remain intact.

## C. API and data contract (proposed details)

The route reuse below is a design proposal; exact fields, envelopes, status codes, and error codes require teammate acceptance and must not be treated as approved API changes.

| Method and route | Authentication/authorization | Proposed request/response | Proposed failure behavior |
| --- | --- | --- | --- |
| `PATCH /api/v1/organizer/events/{eventId}` | Owning Organizer session; server checks ownership and published/before-start policy | Partial update. `capacity` and `registrationDeadline` are independently optional. At least one recognized field is required. A capacity-only request changes capacity and leaves the deadline unchanged; a deadline-only request changes the deadline and leaves capacity unchanged. `registrationDeadline: null` explicitly clears the deadline; `capacity: null` is invalid. An empty `{}` request and unknown-only fields are invalid. Success returns the existing Event representation with persisted values. | Proposed `400` validation outcomes use the existing `{ "error": { "code", "message", "details": [...] } }` envelope; exact codes remain Proposed. |
| `GET /api/v1/events/{eventId}` | Public route | Extend the existing public projection with `registrationDeadline` (ISO string or `null`) and the approved F-03 `registrationAvailable` (boolean) field; retain privacy boundary and remaining-place calculation. | Existing safe `404` missing/unpublished behavior; malformed state must fail safely, not be masked. Deadline-specific semantics are Proposed. |
| `POST /api/v1/events/{eventId}/registrations` | Authenticated Participant; identity and time are server-derived | Keep the F-03 request shape; client cannot provide participant, status, active count, or time. Apply effective deadline and capacity/duplicate rules inside the transaction. | At/after deadline returns proposed `409` `REGISTRATION_CLOSED` with the existing error envelope and no row/place mutation; exact code/status remains Proposed. |

### Proposed deadline semantics for `registrationAvailable`

F-03 already approves `registrationAvailable` as the public availability field. F-05 keeps that name for backward compatibility and proposes extending its meaning to include the effective deadline, while preserving the existing capacity/publication semantics:

```text
registrationAvailable =
    event.publicationState == PUBLISHED
    AND serverTime < effectiveDeadline
    AND activeRegistrationCount < event.capacity
```

Where:

- `effectiveDeadline = registrationDeadline ?? event.startAt`
- `serverTime` is the server-authoritative current UTC instant.
- `activeRegistrationCount` includes only ACTIVE registrations.
- `registrationAvailable` is informational and does not guarantee that a specific Participant can register.
- The registration API must independently revalidate authentication, event publication, deadline, capacity, and duplicate-active registration constraints before accepting a request.

Q-03 has been Accepted — Team Reviewed. However, the deadline-aware extension of `registrationAvailable` remains Proposed — Pending Final API Contract Approval. If the team does not accept deadline-aware semantics for this approved field, F-05 must add a separately named field through a reviewed backward-compatible API change; it must not silently change F-03 behavior.

### Proposed policy decisions

| Decision | Current proposal | Status |
| --- | --- | --- |
| Q-01 — edit after publication | Starting Sprint 2, the owner may edit an owned published Event only before start; Sprint 1 published capacity remains fixed. | Accepted — Team Reviewed |
| Q-02 — reduction below active count | Reject the reduction, preserve prior capacity and every Registration, and never cancel/displace Participants automatically. | Accepted — Team Reviewed |
| Q-03 — deadline/default | Deadline is optional; if absent, Event start is the effective deadline. An explicit deadline must be no later than start, and registration is allowed only when server time is strictly earlier. | Accepted — Team Reviewed |

Acceptance rationale recorded by the teammate review: Q-01 preserves owner control while preventing edits after the event starts; Q-02 preserves the BR-09 invariant and avoids silently displacing Participants; Q-03 gives organizers an optional cutoff with a deterministic start-time default and server-authoritative boundary. These policy decisions are accepted, but the endpoint extension, exact status/error codes, migration form, and this contract's final approval remain pending.

For the proposed PATCH contract, a successful request returns `200` with the existing Event success representation. Authentication/role failures use the existing `401`/`403` conventions, an inaccessible or unknown Event uses the privacy-preserving `404`, and a concurrent/late/unsafe edit uses a proposed `409` conflict. All failure responses use the existing safe error envelope; exact error-code names and whether an empty request is `400` or another validation status require teammate acceptance. No request may partially apply one field when the other field fails validation.

Because PATCH is a cookie-authenticated state-changing request, it must use the existing F-01 defense: the server validates `Origin` against configured `CLIENT_ORIGIN` before authorization or database work. Missing, malformed, or disallowed Origin is rejected with the existing `403 CSRF_REJECTED` safe error envelope (and no Event or Registration mutation). The endpoint must not introduce a second CSRF mechanism or accept a client-supplied user/owner identity; deployment-specific CORS configuration remains separate.

## D. Data, persistence, and concurrency design

The existing PostgreSQL/Prisma `Event.capacity`, UTC-based `startAt`, `endAt`, publication state, ownership, and F-03 `Registration` schema are reused. F-05 proposes one nullable `Event.registrationDeadline` (`DateTime?`, stored as a UTC instant), requiring a new additive migration; no migration is created or executed by this documentation task. Existing `ON DELETE RESTRICT` foreign keys and the partial active-registration uniqueness strategy remain unchanged.

Required database and application invariants:

- `capacity` is a positive integer; an edit cannot be below the committed ACTIVE registration count.
- Only ACTIVE registrations consume capacity. CANCELLED rows do not; future F-06 cancellation releases exactly one place. Attendance does not release capacity under F-07.
- If present, `registrationDeadline <= startAt`; absent means effective deadline equals `startAt` under accepted Q-03. The comparison is server-authoritative UTC time, never a client-provided clock.
- Capacity edits and F-03 registration acquire the same target Event row lock (`SELECT ... FOR UPDATE`) as the first database operation inside a Prisma interactive `$transaction`, then validate the current committed state and write atomically. A capacity edit locks, counts ACTIVE registrations, validates the proposed capacity, and updates Event; a registration locks, checks publication/deadline/duplicate/capacity, then inserts Registration. Because both protocols lock the same Event row before their decision, they serialize and cannot both consume an invalid last place. Rejected validation, authorization, conflict, or persistence failure rolls back completely.
- Concurrent capacity-edit/registration operations serialize on the Event lock. The final committed state always satisfies `activeRegistrations <= capacity`; no automatic displacement occurs.
- Public projections calculate remaining places from the committed active count and must reject/flag an impossible persisted state rather than silently presenting a healthy value.

Migration planning (Proposed): add the nullable deadline column, add a database check or equivalent transaction validation for deadline ordering where supported by the reviewed Prisma migration, deploy additively, backfill `NULL` for existing Events, and provide a reviewed rollback plan that does not rewrite applied migration history. Exact constraint form remains a technical review item.

## E. Acceptance criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F05-01 | FR-10, BR-02, BR-15 | The owning Organizer can update capacity on an owned published Event before start; the accepted value persists and no other Event is changed. |
| AC-F05-02 | FR-10, BR-02, NFR-01 | Visitor, Participant, expired session, and non-owning Organizer edits, plus missing/invalid/disallowed Origin requests, are denied safely with no mutation or private-data leak. |
| AC-F05-03 | FR-10, BR-05, BR-11 | Empty requests, unknown-only fields, explicit null capacity, zero, negative, fractional, malformed, and non-integer capacity values are rejected atomically. A valid deadline-only update does not require capacity. |
| AC-F05-04 | FR-10, BR-09, BR-15 | Capacity increase or valid unchanged/increased capacity preserves all registrations and the correct remaining-place calculation. |
| AC-F05-05 | FR-10, BR-09, BR-11, BR-15 | A reduction below ACTIVE count is rejected, preserving capacity, registrations, and history; no Participant is displaced. |
| AC-F05-06 | FR-10, BR-15 | Edits at or after Event start are rejected and the prior committed capacity remains unchanged. |
| AC-F05-07 | FR-10, BR-14, BR-11 | Optional deadline input accepts a valid instant no later than start, supports clearing when allowed, and rejects invalid/order-violating values atomically, under the team-reviewed Q-03 policy. |
| AC-F05-08 | FR-12, FR-13, FR-16, BR-14 | Public detail displays the optional/effective deadline and accurate `registrationAvailable` state without exposing private data. *(Deadline-aware extension remains Proposed.)* |
| AC-F05-09 | FR-13, FR-16, BR-14 | Registration immediately before the effective deadline is eligible; at and after it is rejected safely with no Registration or place consumption. |
| AC-F05-10 | BR-09, BR-10, BR-11, NFR-05 | Concurrent capacity edit and registration requests serialize; no over-capacity state, duplicate ACTIVE row, or false success occurs. |
| AC-F05-11 | BR-11, NFR-04, NFR-06 | Controlled failure and rejected authorization/validation paths roll back all partial Event, Registration, count, and deadline changes. |
| AC-F05-12 | NFR-04, NFR-08, FR-12 | Accepted capacity/deadline state and public closed/open projection remain correct after a real application restart and are keyboard-accessible. |
| AC-F05-13 | BR-02, BR-05, BR-09, BR-14, BR-15, NFR-01, NFR-05 | Contract, tests, migration evidence, and release identity map all F-05 decisions and preserve Sprint 1/F-06/F-07 boundaries before Done. |

## F. Software Test Specification (planned; execution recorded separately)

TEST-F05-01 through TEST-F05-12 are intended to be executable unit, API, database, controlled-clock, or browser tests when implementation exists. TEST-F05-13 is a manual review/evidence checklist only; it is not an automated test and cannot substitute for execution evidence from TEST-F05-01 through TEST-F05-12.

| TEST ID | AC | Level | Planned procedure | Expected result |
| --- | --- | --- | --- | --- |
| TEST-F05-01 | AC-F05-01 | API/database | Preconditions: isolated `eventcheck_test/public`; published Event owned by Organizer A, capacity 2, zero ACTIVE rows; valid Organizer A session. Input: `capacity: 5`. Action: send PATCH and read the Event and an unrelated Event. | `200` proposed success; capacity is 5 after a fresh read; deadline and unrelated Event are unchanged. |
| TEST-F05-02 | AC-F05-02 | API/security | Preconditions: Event owned by Organizer A; sessions for visitor, Participant, expired user, and Organizer B; valid configured `CLIENT_ORIGIN`. Actions: each calls PATCH, then repeat with missing, malformed, and disallowed `Origin`; snapshot Event before/after every request. | Proposed `401`/`403`/privacy-safe `404`; CSRF cases return `403 CSRF_REJECTED`; no private fields or mutation for any caller. |
| TEST-F05-03 | AC-F05-03 | API/unit | Preconditions: owned published Event with capacity 5. Inputs: `{}`, unknown-only object, `capacity:null`, `capacity:0`, `-1`, `1.5`, whitespace/string values, and malformed JSON; repeat with valid deadline-only request. | Invalid capacity/empty requests produce proposed `400` validation envelope and unchanged Event; deadline-only request does not require or alter capacity. |
| TEST-F05-04 | AC-F05-04 | Database | Preconditions: Event capacity 2 with one ACTIVE and one CANCELLED Registration. Action: capacity-only update to 4, then read Event and public projection. | ACTIVE count remains 1, CANCELLED history remains, remaining places is 3, and deadline is unchanged. |
| TEST-F05-05 | AC-F05-05 | API/database | Preconditions: Event capacity 3 with two ACTIVE and one CANCELLED rows. Input: capacity-only update to 1. Action: PATCH, then inspect Event and all rows. | Proposed `409` conflict; capacity stays 3; no ACTIVE row is displaced and history is intact. |
| TEST-F05-06 | AC-F05-06 | Controlled-time integration | Preconditions: owned published Event with fixed UTC start and valid session; controlled server clock at start-1s, exact start, and start+1s. Action: send capacity-only PATCH at each instant. | Only the boundary permitted by accepted Q-01 succeeds; other responses are proposed conflict outcomes and state is unchanged. |
| TEST-F05-07 | AC-F05-07 | Unit/API | Preconditions: owned Event with fixed UTC start. Inputs: deadline-only valid-before-start, `null`, equal-to-start, after-start, malformed, and timezone-offset values. Action: PATCH each independently and read back after each case. | Valid/null behavior follows team-reviewed Q-03; invalid/order-violating inputs use proposed validation outcome and leave capacity/deadline unchanged. |
| TEST-F05-08 | AC-F05-08 | API/UI | Preconditions: published public Event with one explicit deadline and a separate no-deadline Event; controlled server time before and after each effective deadline. Include a published Event with zero remaining capacity while still before its effective deadline. Action: GET public details anonymously and inspect JSON/UI for all cases. | Proposed `registrationDeadline` and `registrationAvailable` fields reflect the effective deadline and capacity availability. `registrationAvailable` is `false` at or after the effective deadline or when remaining capacity is zero, and `true` when the Event is published, before the effective deadline, and has remaining capacity. Existing public fields remain; no session/private fields appear. |
| TEST-F05-09 | AC-F05-09 | Fixed-clock API | Preconditions: three fresh eligible Participant/Event pairs with capacity; same published Event policy and controlled server clock. Actions: POST at `deadline-1s`, exact deadline, and `deadline+1s`; inspect rows/count after each. | Before succeeds when other rules pass; exact/after return proposed `409 REGISTRATION_CLOSED`; no rejected row or place is persisted. |
| TEST-F05-10 | AC-F05-10 | PostgreSQL concurrency | Preconditions: five run-scoped published Events, each with one remaining place, fresh owner/Participant fixtures, and verified `eventcheck_test/public`; synchronize one PATCH reduction/increase and one POST registration per race. | Shared Event lock serializes each race; responses and committed rows show no over-capacity state, duplicate ACTIVE row, or false success. |
| TEST-F05-11 | AC-F05-11 | Transaction integration | Preconditions: fresh Event/Registration fixtures and test-only dependency injection; snapshot Event, deadline, capacity, active count. Action: force failure after the write inside the transaction and exercise authorization/validation rejection. | No `201`/success is returned; transaction rolls back Event and Registration state exactly to the snapshot, without database-detail leakage. |
| TEST-F05-12 | AC-F05-12 | Restart/UI E2E | Preconditions: persisted accepted edit in isolated DB; record Event ID and values. Actions: stop/start the actual API, reload public detail, and keyboard-navigate the settings/detail controls. | Same committed values and accurate open/closed presentation remain available; focus and labels are usable. |
| TEST-F05-13 | AC-F05-13 | Review/evidence | Inspect AC/STS map, migration, test counts, tested commit, and Sprint 2 integration evidence. | Every AC has evidence or an explicit limitation; no proposed decision is misreported as approved. |

## G. Issue #47 Contract Completion Criteria

Issue #47 contract work is complete for review when Sections A–F are internally consistent, every AC has a stable TEST mapping, Q-01/Q-02/Q-03 are explicitly marked Proposed or accepted through change control, API/data/UI impacts and F-06/F-07 boundaries are documented, and links/Markdown validate. This is a documentation gate only; it does not claim implementation, test execution, migration, or release evidence.

| Contract item | Status |
| --- | --- |
| Requirements and dependency links | Documented |
| AC/TEST mapping and proposed API semantics | Documented; teammate review required |
| Q-01, Q-02, Q-03 | Accepted — Team Reviewed; API details and final contract approval remain pending |
| Contract completion/review | Pending teammate acceptance |

## H. Future F-05 Feature Implementation Definition of Done

F-05 implementation is not Done until the accepted Q-01, Q-02, and Q-03 policies are implemented, the additive migration and API/UI design are reviewed, all required tests pass against isolated `eventcheck_test/public`, and evidence identifies the tested commit.

| Item | Status |
| --- | --- |
| Q-01, Q-02, Q-03 policy acceptance | Accepted — Team Reviewed |
| Final API/data contract approval | Pending teammate approval |
| Implementation, migration, and executable tests | Not started in this contract task |
| Test evidence and release identity | Pending implementation |
| PR/release approval | Pending |

### Review record

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-23 | Draft — pending teammate review | Initial Sprint 2 F-05 scope, proposed capacity/deadline policy, API/data design, stable AC/STS IDs, concurrency strategy, and F-06/F-07 boundaries. |
| 0.2 | 2026-11-23 | Draft — pending teammate review | Clarified PATCH field presence/null semantics, proposed API envelopes/status/error conventions, explicit STS fixtures and actions, shared Event-lock protocol with F-03, separate Issue #47 contract completion criteria, and manual-review versus executable-test evidence boundaries. |
| 0.3 | 2026-11-24 | Draft — Pending Final Teammate Approval | Recorded teammate acceptance of Q-01, Q-02, and Q-03; aligned the public field with F-03 `registrationAvailable`, added F-01 Origin/CSRF requirements, corrected Prisma `startAt`/`endAt` naming, and clarified compatibility and STS coverage. |

### Related baseline

- [SRS](../../srs.md), [Feature Inventory](../../features.md), [Traceability Matrix](../../traceability.md), and [Sprint Plan](../plan.md).
- Existing Sprint 1 contracts: [F-01](../sprint-1/f-01-authentication.md), [F-02](../sprint-1/f-02-event-publishing.md), [F-03](../sprint-1/f-03-event-registration.md), and [F-04](../sprint-1/f-04-organizer-registrations.md).
