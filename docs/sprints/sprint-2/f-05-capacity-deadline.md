# F-05 — Capacity and Registration Deadline Management

**Issue:** #47 — Contract task: Capacity & Registration Deadline Management

**Contract version:** 0.6
**Status:** Accepted — Team Reviewed implementation baseline; implemented, tested, and staging-integrated; formal Sprint 2 release acceptance pending.
**Approval evidence:** Teammate approval was explicitly supplied in the Issue #48 task context. Reviewer identity, date, and approval URL are not available in this repository and must be recorded by the project owner.
**Sprint:** 2
**Contract revision:** 2026-11-25

**Current implementation snapshot (2026-11-27):** F-05 is IMPLEMENTED and TESTED; its 12 automated AC results and manual AC-F05-13 review are recorded in the [Sprint 2 AC matrix](ac-verification.md) and [Issue 15 integration report](integration-verification.md). Feature PR #58 was merged to `feature/sprint-2-e2e`; PR #61 integrated the tested tree into `sprint-2-staging` at `f08177c`. Formal Sprint 2 release acceptance and current-candidate deployment evidence remain pending under Issue 17. The dated v0.6 review/history entries below retain the status as it stood when those records were written.

This contract extends the accepted Sprint 1 Event, Registration, session, ownership, and concurrency baseline. It does not change Sprint 1 behavior: published capacity remains fixed there, and Sprint 1 registration has no time-based closure.

## A. Feature overview and Feature SDS

### Scope and linked requirements

| Type | IDs | F-05 responsibility |
| --- | --- | --- |
| Functional requirements | FR-10; Sprint 2 extensions of FR-12, FR-13, FR-16 | Owner-scoped capacity edit; optional deadline display; server-enforced eligibility and closed-registration outcome. |
| Business rules | BR-02, BR-05, BR-09, BR-10, BR-11, BR-14, BR-15 | Ownership, positive capacity, invariant preservation, serialized races, atomic rejection, deadline, and capacity-edit policy. |
| Non-functional requirements | NFR-01, NFR-04, NFR-05, NFR-06, NFR-08, NFR-09, NFR-10 | Privacy, persistence, concurrency, time handling, accessibility, contract traceability, and reproducible verification. |
| System responsibilities | SR-01, SR-02, SR-03, SR-04 | Authorization/privacy, persistent atomic integrity, accessible outcomes, and traceable verification. |
| Dependencies | F-01, F-02, F-03; later F-06/F-07 | Existing session/role, Event ownership/publication, Registration lifecycle, and future cancellation/check-in rules. |

### Actors and authorization

The backend derives the Organizer from the validated F-01 session and requires `event.organizerId = session.userId`. Only that owner may edit an owned published Event before its start. Visitors, Participants, expired/revoked sessions, and other Organizers receive safe denial outcomes without private-data or existence leakage. Registration continues to derive Participant identity from the session; client-supplied owner, participant, status, capacity-count, or server-time fields are ignored or rejected.

### User journeys and state behavior

1. An owning Organizer opens an owned published Event, edits capacity and optionally sets/clears a deadline, and receives a persisted result.
2. The UI displays the effective deadline and open/closed registration state in Event detail. Display/input uses labelled Asia/Bangkok (UTC+7); persistence and comparisons use UTC instants.
3. A Participant can register only while server time is strictly before the effective deadline and while all Sprint 1 publication, duplicate, capacity, and authorization rules pass. At or after the deadline, the request is rejected without consuming a place.
4. A rejected edit or registration leaves the previously committed Event, Registration rows, active count, and remaining places unchanged. No participant is automatically displaced when capacity is reduced.

Q-01, Q-02, and Q-03 policy review is recorded in F-05 v0.3 and reflected in the SRS. The F-05 v0.4 changes from Issue #47 are preserved as the baseline. This v0.6 records the team-reviewed implementation baseline for the API and schema while retaining the reviewed semantics: `registrationAvailable` remains capacity-based and additive `registrationOpen` represents the deadline window. At the v0.6 review snapshot, implementation completion and release evidence were pending; the current implementation/test/integration status is recorded above.

## B. UI and interaction design

| Screen/component | Role | Required behavior |
| --- | --- | --- |
| Organizer Event settings | Owning Organizer | Show current capacity/deadline, validation, saving, safe conflict/error feedback, and unchanged state after rejection. Non-owner controls are absent or denied. |
| Public Event detail | Visitor, Participant, Organizer | Show existing public fields plus optional deadline and an accurate open/closed/availability state; never show private registration data. |
| Participant registration action | Participant | Keep existing Register/Registered/full behavior; show time-window state separately from capacity availability; show a distinct closed-registration outcome; do not submit repeated requests while pending. Show Register only when `registrationOpen` and the existing capacity-based `registrationAvailable` are both true. |
| Safe denial/error state | All unauthorized callers | Explain that the operation is unavailable without revealing another owner's Event or credentials. |

Focus moves to the active panel after tab/detail navigation, labels identify capacity and deadline controls, invalid fields are announced, and keyboard users can operate all controls. Existing F-01/F-02/F-03 layout and authentication behavior remain intact.

## C. API and data contract (v0.6 accepted implementation baseline)

The route reuse, request semantics, schema changes, and outcomes below are the team-reviewed implementation baseline, based on the existing F-01/F-03 conventions. The reviewed field meanings are preserved: F-03 `registrationAvailable` is capacity availability and additive `registrationOpen` is the deadline-window state. Implementation and feature completion evidence are recorded separately below.

| Method and route | Authentication/authorization | Implementation proposal request/response | Implementation proposal failure behavior |
| --- | --- | --- | --- |
| `PATCH /api/v1/organizer/events/{eventId}` | Owning Organizer session; server checks ownership and published/before-start policy | Partial update. `capacity` and `registrationDeadline` are independently optional. At least one recognized field is required. A capacity-only request leaves the deadline unchanged; a deadline-only request leaves capacity unchanged. `registrationDeadline: null` clears the explicit deadline; `capacity: null` is invalid. Empty `{}` and unknown-only fields are invalid. Success returns the existing Event representation with persisted values. | `400 MALFORMED_JSON`; `401 UNAUTHENTICATED`; `403 FORBIDDEN` or `CSRF_REJECTED`; privacy-preserving `404 EVENT_NOT_FOUND`; `409 EVENT_MODIFICATION_CLOSED` or `CAPACITY_BELOW_ACTIVE_COUNT`; `422 VALIDATION_ERROR` for syntactically valid but invalid fields. All failures use the existing F-03/F-04 error envelope. |
| `GET /api/v1/events/{eventId}` | Public route | Extend the existing public detail projection with `registrationDeadline` (UTC ISO 8601 string or `null`) and boolean `registrationOpen`. Preserve F-03 `registrationAvailable` as capacity availability (`remainingPlaces > 0`), along with the privacy boundary and remaining-place calculation. | Existing safe `404` missing/unpublished behavior; malformed persisted state must fail safely, not be masked. |
| `POST /api/v1/events/{eventId}/registrations` | Authenticated Participant; identity and time are server-derived | Keep the F-03 request shape; client cannot provide participant, status, active count, or time. Apply effective deadline and capacity/duplicate rules inside the transaction. | At/after deadline returns `409 REGISTRATION_CLOSED` with the existing error envelope and no row/place mutation. Existing F-03 duplicate/full and authentication outcomes remain unchanged. |

### Public registration-window semantics

F-03 defines `registrationAvailable` from remaining capacity. F-05 preserves that approved meaning and adds a separate `registrationOpen` field for the time window:

```text
remainingPlaces = event.capacity - activeRegistrationCount
registrationAvailable = remainingPlaces > 0
registrationOpen = serverTime < effectiveDeadline
effectiveDeadline = registrationDeadline ?? event.startAt
```

Where:

- The public detail response contains only published Events, so `registrationOpen` describes whether the time window is open for that published Event.
- `serverTime` is sampled from the server-authoritative UTC clock for the response. The registration write rechecks the deadline in its transaction.
- `activeRegistrationCount` includes only ACTIVE registrations.
- A full Event can have `registrationOpen: true` and `registrationAvailable: false`; after the deadline, an Event with remaining places can have `registrationOpen: false` and `registrationAvailable: true`. The UI presents these states separately.
- The Participant Register action is offered only when both fields are true; neither field guarantees that a specific Participant can register.
- The registration API independently revalidates authentication, publication, deadline, capacity, and duplicate-active constraints before accepting a request.

This additive `registrationOpen` field avoids changing F-03's approved `registrationAvailable` behavior. The complete API/schema design is the team-reviewed implementation baseline. The backend registration operation is authoritative and rechecks publication, effective deadline, capacity, and duplicate-ACTIVE rules inside the transaction, regardless of the public fields' values.

### Policy decisions

| Decision | Policy | Status |
| --- | --- | --- |
| Q-01 — edit after publication | Starting Sprint 2, the owner may edit an owned published Event only before start; Sprint 1 published capacity remains fixed. | Accepted — Team Reviewed |
| Q-02 — reduction below active count | Reject the reduction, preserve prior capacity and every Registration, and never cancel/displace Participants automatically. | Accepted — Team Reviewed |
| Q-03 — deadline/default | Deadline is optional; if absent, Event start is the effective deadline. An explicit deadline must be no later than start, and registration is allowed only when server time is strictly earlier. | Accepted — Team Reviewed |

Acceptance rationale recorded by the teammate review: Q-01 preserves owner control while preventing edits after the event starts; Q-02 preserves the BR-09 invariant and avoids silently displacing Participants; Q-03 gives organizers an optional cutoff with a deterministic start-time default and server-authoritative boundary. The field meanings and v0.6 API/schema baseline are accepted. Implementation/test evidence is now recorded in the linked AC matrix; formal release acceptance remains pending.

The proposed PATCH success returns `200` with the existing Event success representation. Syntactically malformed JSON returns `400 MALFORMED_JSON`; syntactically valid but empty, unknown-only, mistyped, or invalid field values return `422 VALIDATION_ERROR` with field details. An edit at/after start returns `409 EVENT_MODIFICATION_CLOSED`; a reduction below the committed ACTIVE count returns `409 CAPACITY_BELOW_ACTIVE_COUNT`. Authentication, role, CSRF, and inaccessible Event outcomes use `401`, `403`, and privacy-preserving `404` as shown above. No request partially applies one field when the other field fails validation.

Because PATCH is a cookie-authenticated state-changing request, it must use the existing F-01 defense: the server validates `Origin` against configured `CLIENT_ORIGIN` before authorization or database work. Missing, malformed, or disallowed Origin is rejected with the existing `403 CSRF_REJECTED` safe error envelope (and no Event or Registration mutation). The endpoint must not introduce a second CSRF mechanism or accept a client-supplied user/owner identity; deployment-specific CORS configuration remains separate.

## D. Data, persistence, and concurrency design

The existing PostgreSQL/Prisma `Event.capacity`, UTC-based `startAt`, `endAt`, publication state, ownership, and F-03 `Registration` schema are reused. F-05 adds one nullable `Event.registrationDeadline` (`DateTime?`, stored as a UTC instant) through the additive migration described below. Existing `ON DELETE RESTRICT` foreign keys and the partial active-registration uniqueness strategy remain unchanged.

Required database and application invariants:

- `capacity` is a positive integer; an edit cannot be below the committed ACTIVE registration count.
- Only ACTIVE registrations consume capacity. CANCELLED rows do not; future F-06 cancellation releases exactly one place. Attendance does not release capacity under F-07.
- If present, `registrationDeadline <= startAt`; absent means effective deadline equals `startAt` under accepted Q-03. The comparison is server-authoritative UTC time, never a client-provided clock.
- Capacity edits and F-03 registration acquire the same target Event row lock (`SELECT ... FOR UPDATE`) as the first database operation inside a Prisma interactive `$transaction`, then validate the current committed state and write atomically. A capacity edit locks, counts ACTIVE registrations, validates the proposed capacity, and updates Event; a registration locks, checks publication/deadline/duplicate/capacity, then inserts Registration. Because both protocols lock the same Event row before their decision, they serialize and cannot both consume an invalid last place. Rejected validation, authorization, conflict, or persistence failure rolls back completely.
- Concurrent capacity-edit/registration operations serialize on the Event lock. The final committed state always satisfies `activeRegistrations <= capacity`; no automatic displacement occurs.
- Public projections calculate remaining places from the committed active count and must reject/flag an impossible persisted state rather than silently presenting a healthy value.

The additive migration adds nullable Prisma `Event.registrationDeadline DateTime?` using the repository's existing PostgreSQL `TIMESTAMP(3)` UTC-value convention; existing rows become `NULL` without rewriting event data. It adds `CHECK ("registrationDeadline" IS NULL OR "registrationDeadline" <= "startAt")`, matching the existing Event column names and timestamp precision. Deploy the additive migration before code that reads or writes the field. For rollback, revert application code while retaining the nullable column and check; do not drop populated deadline data or rewrite applied migration history. Removing the field later requires a separate reviewed forward migration and explicit data-disposition decision.

## E. Acceptance criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F05-01 | FR-10, BR-02, BR-15 | The owning Organizer can update capacity on an owned published Event before start; the accepted value persists and no other Event is changed. |
| AC-F05-02 | FR-10, BR-02, NFR-01 | Visitor, Participant, expired session, and non-owning Organizer edits, plus missing/invalid/disallowed Origin requests, are denied safely with no mutation or private-data leak. |
| AC-F05-03 | FR-10, BR-05, BR-11 | Malformed JSON is rejected with `400`; syntactically valid empty/unknown-only requests, explicit null capacity, zero, negative, fractional, malformed field values, and non-integer capacity values are rejected with `422`. All failures are atomic. A valid deadline-only update does not require capacity. |
| AC-F05-04 | FR-10, BR-09, BR-15 | Capacity increase or valid unchanged/increased capacity preserves all registrations and the correct remaining-place calculation. |
| AC-F05-05 | FR-10, BR-09, BR-11, BR-15 | A reduction below ACTIVE count is rejected, preserving capacity, registrations, and history; no Participant is displaced. |
| AC-F05-06 | FR-10, BR-15 | Edits at or after Event start are rejected and the prior committed capacity remains unchanged. |
| AC-F05-07 | FR-10, BR-14, BR-11 | Optional deadline input accepts a valid instant no later than start, supports clearing when allowed, and rejects invalid/order-violating values atomically, under the team-reviewed Q-03 policy. |
| AC-F05-08 | FR-12, FR-13, FR-16, BR-14 | Public detail displays the optional deadline and accurate `registrationOpen` state while preserving F-03's capacity-based `registrationAvailable` meaning; no private data is exposed. |
| AC-F05-09 | FR-13, FR-16, BR-14 | Registration immediately before the effective deadline is eligible; at and after it is rejected safely with no Registration or place consumption. |
| AC-F05-10 | BR-09, BR-10, BR-11, NFR-05 | Concurrent capacity edit and registration requests serialize; no over-capacity state, duplicate ACTIVE row, or false success occurs. |
| AC-F05-11 | BR-11, NFR-04, NFR-06 | Controlled failure and rejected authorization/validation paths roll back all partial Event, Registration, count, and deadline changes. |
| AC-F05-12 | NFR-04, NFR-08, FR-12 | Accepted capacity/deadline state and public closed/open projection remain correct after a real application restart and are keyboard-accessible. |
| AC-F05-13 | BR-02, BR-05, BR-09, BR-14, BR-15, NFR-01, NFR-05, NFR-09, NFR-10 | Contract history, requirement links, planned tests, migration evidence, automated-test results, and release identity map all F-05 decisions and preserve Sprint 1/F-06/F-07 boundaries before Done. |

## F. Software Test Specification (planned; execution recorded separately)

TEST-F05-01 through TEST-F05-12 are intended to be executable unit, API, database, controlled-clock, or browser tests when implementation exists. TEST-F05-13 is a manual review/evidence checklist only; it is not an automated test and cannot substitute for execution evidence from TEST-F05-01 through TEST-F05-12.

| TEST ID | AC | Level | Planned procedure | Expected result |
| --- | --- | --- | --- | --- |
| TEST-F05-01 | AC-F05-01 | API/database | Preconditions: isolated `eventcheck_test/public`; published Event owned by Organizer A, capacity 2, zero ACTIVE rows; valid Organizer A session. Input: `capacity: 5`. Action: send PATCH and read the Event and an unrelated Event. | `200` proposed success; capacity is 5 after a fresh read; deadline and unrelated Event are unchanged. |
| TEST-F05-02 | AC-F05-02 | API/security | Preconditions: Event owned by Organizer A; sessions for visitor, Participant, expired user, and Organizer B; valid configured `CLIENT_ORIGIN`. Actions: each calls PATCH, then repeat with missing, malformed, and disallowed `Origin`; snapshot Event before/after every request. | Proposed `401`/`403`/privacy-safe `404`; CSRF cases return `403 CSRF_REJECTED`; no private fields or mutation for any caller. |
| TEST-F05-03 | AC-F05-03 | API/unit | Preconditions: owned published Event with capacity 5. Inputs: `{}`, unknown-only object, `capacity:null`, `capacity:0`, `-1`, `1.5`, whitespace/string values, invalid deadline values, and malformed JSON; repeat with valid deadline-only request. | Malformed JSON returns `400 MALFORMED_JSON`; syntactically valid empty/unknown/invalid fields return `422 VALIDATION_ERROR`; all failures leave Event unchanged. A valid deadline-only request does not require or alter capacity. |
| TEST-F05-04 | AC-F05-04 | Database | Preconditions: Event capacity 2 with one ACTIVE and one CANCELLED Registration. Action: capacity-only update to 4, then read Event and public projection. | ACTIVE count remains 1, CANCELLED history remains, remaining places is 3, and deadline is unchanged. |
| TEST-F05-05 | AC-F05-05 | API/database | Preconditions: Event capacity 3 with two ACTIVE and one CANCELLED rows. Input: capacity-only update to 1. Action: PATCH, then inspect Event and all rows. | Proposed `409` conflict; capacity stays 3; no ACTIVE row is displaced and history is intact. |
| TEST-F05-06 | AC-F05-06 | Controlled-time integration | Preconditions: owned published Event with fixed UTC start and valid session; controlled server clock at start-1s, exact start, and start+1s. Action: send capacity-only PATCH at each instant. | start-1s returns `200`; exact start and start+1s return `409 EVENT_MODIFICATION_CLOSED`; rejected requests leave Event unchanged. |
| TEST-F05-07 | AC-F05-07 | Unit/API | Preconditions: owned Event with fixed UTC start. Inputs: deadline-only valid-before-start, `null`, equal-to-start, after-start, malformed, and timezone-offset values. Action: PATCH each independently and read back after each case. | Valid/null behavior follows team-reviewed Q-03; invalid/order-violating inputs use proposed validation outcome and leave capacity/deadline unchanged. |
| TEST-F05-08 | AC-F05-08 | API/UI | Preconditions: published Events with an explicit deadline and no deadline; fixtures include one full Event before deadline and one Event with remaining places at/after deadline. Control server time before, at, and after each effective deadline. GET public details anonymously and inspect JSON/UI. | `registrationDeadline` is the explicit UTC instant or `null`; `registrationOpen` is true only before the effective deadline and false at/after it; existing `registrationAvailable` equals `remainingPlaces > 0` regardless of deadline. UI distinguishes open/full/closed and shows the labelled start-time default when deadline is null. No private fields appear. |
| TEST-F05-09 | AC-F05-09 | Fixed-clock API | Preconditions: three fresh eligible Participant/Event pairs with capacity; same published Event policy and controlled server clock. Actions: POST at `deadline-1s`, exact deadline, and `deadline+1s`; inspect rows/count after each. | Before succeeds when other rules pass; exact/after return proposed `409 REGISTRATION_CLOSED`; no rejected row or place is persisted. |
| TEST-F05-10 | AC-F05-10 | PostgreSQL concurrency | Preconditions: five run-scoped published Events, each with one remaining place, fresh owner/Participant fixtures, and verified `eventcheck_test/public`; synchronize one PATCH reduction/increase and one POST registration per race. | Shared Event lock serializes each race; responses and committed rows show no over-capacity state, duplicate ACTIVE row, or false success. |
| TEST-F05-11 | AC-F05-11 | Transaction integration | Preconditions: fresh Event/Registration fixtures and test-only dependency injection; snapshot Event, deadline, capacity, active count. Action: force failure after the write inside the transaction and exercise authorization/validation rejection. | No `201`/success is returned; transaction rolls back Event and Registration state exactly to the snapshot, without database-detail leakage. |
| TEST-F05-12 | AC-F05-12 | Restart/UI E2E | Preconditions: persisted accepted edit in isolated DB; record Event ID and values. Actions: stop/start the actual API, reload public detail, and keyboard-navigate the settings/detail controls. | Same committed values and accurate open/closed presentation remain available; focus and labels are usable. |
| TEST-F05-13 | AC-F05-13 | Review/evidence | Inspect AC/STS map, version history, migration, automated test counts/results, tested commit, and Sprint 2 integration evidence. | Every AC has evidence or an explicit limitation; automated execution evidence is recorded separately from this manual review; no proposed API/schema detail is misreported as approved. |

## G. Issue #47 Contract Completion Criteria

Issue #47 contract work is complete for review when Sections A–F are internally consistent, every AC has a stable TEST mapping, Q-01/Q-02/Q-03 are explicitly marked Proposed or accepted through change control, API/data/UI impacts and F-06/F-07 boundaries are documented, and links/Markdown validate. This is a documentation gate only; it does not claim implementation, test execution, migration, or release evidence.

| Contract item | Status |
| --- | --- |
| Requirements and dependency links | Documented |
| AC/TEST mapping and draft API/schema details | Documented; final contract review required |
| Q-01, Q-02, Q-03 | Team-reviewed policy recorded in F-05 v0.3 and synchronized to the SRS |
| `registrationAvailable` / `registrationOpen` meanings | Accepted — Team Reviewed; verified locally |
| Issue #47 coordination | F-05 v0.4 carried forward without rewriting its reviewed history; v0.6 records the accepted implementation baseline |
| Contract completion/review | Accepted baseline; implementation and AC verification recorded; PR #58 and staging integration PR #61 merged; formal Sprint 2 release acceptance pending |

## H. F-05 Implementation and Release Status

The implementation and tests have been completed and integrated as described in the current snapshot above. The following table separates that evidence from the remaining formal release gate; it is not an assertion that a Sprint 2 release has been accepted.

| Item | Status |
| --- | --- |
| Q-01, Q-02, Q-03 policy acceptance | Team Reviewed; recorded in F-05 v0.3 and synchronized to the SRS |
| `registrationAvailable` / `registrationOpen` field semantics | Accepted — Team Reviewed; verified locally |
| v0.6 API/data contract approval | Accepted — Team Reviewed; implementation verified locally |
| Implementation, migration, and executable tests | Implemented and tested; Issue 15 verification recorded on `107c93e` |
| Test evidence and implementation SHA | Feature verification recorded before `f88f451`; integrated regression recorded on `107c93e`; see AC matrix for each AC and limitations |
| Feature PR / staging integration | PR #58 merged to `feature/sprint-2-e2e`; PR #61 merged to `sprint-2-staging` at `f08177c` |
| Formal Sprint 2 release acceptance / deployment | Pending; Issue 17 must verify and identify the exact release candidate |

### Review record

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-23 | Draft — pending teammate review | Initial Sprint 2 F-05 scope, proposed capacity/deadline policy, API/data design, stable AC/STS IDs, concurrency strategy, and F-06/F-07 boundaries. |
| 0.2 | 2026-11-23 | Draft — pending teammate review | Clarified PATCH field presence/null semantics, proposed API envelopes/status/error conventions, explicit STS fixtures and actions, shared Event-lock protocol with F-03, separate Issue #47 contract completion criteria, and manual-review versus executable-test evidence boundaries. |
| 0.3 | 2026-11-24 | Draft — Pending Final Teammate Approval | Recorded teammate acceptance of Q-01, Q-02, and Q-03; aligned the public field with F-03 `registrationAvailable`, added F-01 Origin/CSRF requirements, corrected Prisma `startAt`/`endAt` naming, and clarified compatibility and STS coverage. |
| 0.4 | 2026-11-24 | Draft — API/contract review pending | Reconciled Q-01 to Q-03 policy status with the SRS; preserved F-03 capacity-based `registrationAvailable` and proposed additive `registrationOpen`; fixed validation status semantics; specified the additive deadline check/rollback plan; clarified AC/STS and NFR-09/NFR-10 traceability. |
| 0.5 | 2026-11-24 | Draft — field semantics Accepted — Team Reviewed; remaining contract acceptance pending | Carried forward the Issue #47 F-05 v0.4 content and history without overwriting it; recorded that `registrationAvailable` means remaining capacity and `registrationOpen` means the effective-deadline window; clarified backend-authoritative eligibility and aligned dependent F-06/F-07 contracts with the reviewed decisions. No route/schema acceptance, implementation, migration, or test execution is claimed. |
| 0.6 | 2026-11-24 | Accepted — Team Reviewed implementation baseline | Recorded the team-reviewed PATCH API, response/error conventions, nullable `registrationDeadline` migration and constraint, rollback strategy, shared Event-row locking protocol, and backend-authoritative F-03 deadline enforcement. |
| 0.7 | 2026-11-25 | Accepted — verification evidence recorded | Recorded the feature owner's macOS verification immediately before implementation commit `f88f451387faca606658c176a99a7d6a0b92a3fd`; preserved the distinction between working-tree execution and a separate post-commit rerun. |

### Related baseline

### Verification evidence

The following results were supplied as verified macOS executions by the feature owner on 2026-11-25 against the final implementation working-tree content immediately before commit `f88f451387faca606658c176a99a7d6a0b92a3fd`. They are recorded evidence for that content; this documentation update does not claim a separate post-commit rerun.

| Check | Result | Environment/limitation |
| --- | --- | --- |
| PostgreSQL migrations | 6 applied; schema up to date | macOS; isolated `127.0.0.1:5433/eventcheck_test?schema=public` |
| Full backend suite (`--no-file-parallelism`) | 92/92 passed; 13/13 files | `npm run test --workspace server -- --no-file-parallelism`; macOS; isolated database |
| F-05 PostgreSQL integration | 12/12 passed (within the full server suite) | `npm run test --workspace server -- --no-file-parallelism`; macOS; guarded isolated database |
| Frontend Vitest | 23/23 passed | `npm run test --workspace client`; macOS |
| Full Playwright E2E | 19/19 passed | `npm run test:e2e`; macOS; isolated database |
| F-05 Playwright E2E | 3/3 passed (within the full suite) | `npm run test:e2e` (19/19 passed); macOS; isolated database |
| F-05 restart verification | PASS | `npm run test:f05:restart --workspace=server`; macOS; isolated database |
| TypeScript and production build | PASS | `npm run typecheck` and `npm run build`; macOS |
| Markdown diff check | PASS | `git diff --check`; macOS |

The database target was verified as `127.0.0.1:5433/eventcheck_test?schema=public`; no development database was used. The evidence was supplied by the feature owner and is not being represented as a separate post-commit execution.

TEST-F05-10 uses a dedicated PostgreSQL Event-row lock holder, captures the holder backend PID, and uses `pg_blocking_pids()` to establish that at least one relevant PostgreSQL query is blocked by the controlled holder. It does not claim that both HTTP requests were separately observed blocked simultaneously. After release, the race outcomes preserve `ACTIVE count <= capacity` and the public `remainingPlaces`/`registrationAvailable` projection.

TEST-F05-02 covers wrong role, missing/invalid Origin, non-owner access, expired/revoked session rejection, and confirms rejected requests do not mutate the Event. TEST-F05-04 confirms that both ACTIVE and CANCELLED Registration history is preserved during capacity updates. The Event Settings accessibility/duplicate-status Playwright failures were corrected; the final F-05 browser suite passed 3/3.

For actual process-restart verification, `npm run test:f05:restart --workspace=server` builds the API, starts it on an isolated localhost port, creates and updates a run-owned Event through HTTP, stops only that child process, starts a fresh API process against the same isolated database, verifies the persisted public/Organizer values, and removes only the created Event. The 2026-11-25 owner-supplied run passed.

The results above are owner-supplied macOS evidence; no claim is made that Codex reran the database, restart, or browser suites in this documentation-only pass.

The tested implementation identity is the working-tree content immediately before commit `f88f451387faca606658c176a99a7d6a0b92a3fd`; this documentation revision itself has not been separately tested or committed.

### TEST-F05-13 manual evidence checklist

| Evidence item | Status | Basis/remaining action |
| --- | --- | --- |
| Requirements and AC/TEST traceability | Complete | Sections E–F map the accepted IDs. |
| Prisma schema and additive migration | Complete | Schema/migration files are present; owner confirmed six migrations applied. |
| API authorization, Origin/CSRF, and validation | Complete | Covered by TEST-F05-02/03; latest owner rerun evidence remains historical. |
| Capacity invariant and PostgreSQL concurrency | PASS | TEST-F05-10 lock-holder/`pg_blocking_pids()` evidence and 12/12 F-05 integration result. |
| Deadline boundaries | PASS | Controlled-clock TEST-F05-06/09 covered by the 12/12 integration result. |
| Controlled transaction rollback | PASS | Post-write callback rollback test covered by the 12/12 integration result. |
| Public response semantics | PASS | `registrationAvailable`/`registrationOpen` assertions covered by integration and browser results. |
| Frontend and keyboard accessibility | PASS | Final F-05 Playwright result 3/3 after Event Settings status/label corrections. |
| Actual API process restart | PASS | `test:f05:restart` passed against isolated database. |
| Sprint 1 regression | PASS | Backend 92/92 and full Playwright 19/19. |
| Tested implementation identity | Recorded | Evidence corresponds to final working-tree content immediately before `f88f451387faca606658c176a99a7d6a0b92a3fd`; no separate post-commit rerun is claimed. |
| Feature PR / merge | PR #58 merged to `feature/sprint-2-e2e`; PR #61 merged the tested tree to staging. | This contract does not include the reviewer identity or a substantive review summary; cite the actual PR review record in the final PDF if available. Do not infer review quality from merge alone. |

- [SRS](../../srs.md), [Feature Inventory](../../features.md), [Traceability Matrix](../../traceability.md), and [Sprint Plan](../plan.md).
- Existing Sprint 1 contracts: [F-01](../sprint-1/f-01-authentication.md), [F-02](../sprint-1/f-02-event-publishing.md), [F-03](../sprint-1/f-03-event-registration.md), and [F-04](../sprint-1/f-04-organizer-registrations.md).
