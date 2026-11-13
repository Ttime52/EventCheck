# F-04 — Organizer Registration Management

**Issue:** I-05 — Contract: Event Registration & Organizer Management

**Contract version:** 0.1
**Status:** Draft for teammate review; not yet accepted for implementation

> This is a versioned design and verification plan. It records no implementation, test execution, review approval, or completion evidence.

## A. Feature overview

### Scope and objective

F-04 lets the owning Organizer retrieve the registration list for one owned Event. It returns only SRS-authorized event-scoped registration fields, supports explicit empty and loading states, and preserves privacy and ownership boundaries.

### Requirement and responsibility links

| Type | IDs | F-04 coverage |
| --- | --- | --- |
| Functional requirements | FR-15 | Owner-scoped registration-list retrieval |
| Business rules | BR-02, BR-03, BR-04 | Event ownership, registration privacy, and authentication |
| Non-functional requirements | NFR-01, NFR-04, NFR-08, NFR-09, NFR-10 | Privacy, persistence, accessible states, traceability, and planned verification |
| System responsibilities | SR-01, SR-03, SR-04 | Backend authorization/privacy, accessible states, and traceable verification |
| Dependencies | F-01, F-02, F-03 | Server session/role, owned Event identity, and committed Registration records |

### Actors and authorization

The backend derives Organizer identity from the validated F-01 session and proves `event.organizer_id = session.user_id` before returning registrations. A visitor receives an unauthenticated outcome; a Participant receives a safe denial; a non-owning Organizer receives a safe denial/not-found. Client-supplied owner or Event identifiers never grant access. The owner may view authorized registration information but cannot impersonate a Participant or mutate registration state through F-04.

### Sprint 1 scope and exclusions

Included: list retrieval for one owned Event, permitted registration fields, selected-event scoping, explicit empty/loading/success/error states, privacy filtering, and persistence after restart. Excluded: check-in, cancellation, attendee editing, attendance/reporting, and any registration mutation.

## B. Feature design / Feature SDS

### UI and user flow

The Organizer opens an owned Event detail and selects Registration List. The UI shows loading, then either authorized rows or an explicit empty state. Safe errors cover expired sessions, wrong role, non-owner access, missing Event, and persistence failure. Controls and row data are keyboard-accessible, labelled, and do not expose unrelated user fields.

| Screen/component | Permitted roles | Behavior |
| --- | --- | --- |
| Event Registration List | Owning Organizer | Load one selected owned Event's registrations; show authorized fields and explicit empty state. |
| Unauthorized/Not Found state | Visitor, Participant, non-owning Organizer | Show safe denial/not-found without revealing whether another user's Event exists. |

### API specification (Proposed)

| Method and candidate path | Authentication/authorization | Success | Failure and privacy |
| --- | --- | --- | --- |
| `GET /api/v1/organizer/events/{id}/registrations` | Valid Organizer session and ownership predicate | Proposed `200` with `data.registrations`; entries contain registration ID, Participant identifier/display name, state, and UTC timestamp rendered Asia/Bangkok by UI. | `401` missing/invalid session; safe `403/404` for wrong role, missing, or non-owned Event; no unrelated rows. |

The route, envelope, pagination, and error codes remain Proposed. The backend must not accept owner identity from query/body fields. F-04 is read-only: no cancellation, check-in, attendee edits, or Participant impersonation.

### Data and persistence boundary

F-04 reads committed Registration rows created by F-03 and joins only the selected Event and authorized Participant display fields. It must not return passwords, hashes, session identifiers, unrelated profile fields, or registrations for another Event. Event and Registration foreign keys provide association; the owner predicate provides authorization. A read after application restart uses the configured PostgreSQL database and does not rely on browser storage.

### Cross-feature integration

- F-01 → F-04: server-validated session and Organizer role are required; identity is server-derived.
- F-02 → F-04: the selected Event ID and owner relationship come from F-02's committed Event.
- F-03 → F-04: the list reads the same committed Registration records created by F-03.
- Future features may add attendance or cancellation views in separate contracts; F-04 does not mutate current Sprint 1 registrations.

## C. Acceptance Criteria

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F04-01 | FR-15, BR-02, BR-04 | An authenticated owning Organizer retrieves registrations for one owned Event using server-derived identity. |
| AC-F04-02 | FR-15, BR-03 | Each entry contains only Registration ID, Participant identifier/display name, registration state, and registration timestamp; timestamps follow the approved UTC/Asia-Bangkok convention. |
| AC-F04-03 | FR-15 | An Event with no registrations returns an explicit empty result rather than an error or unrelated data. |
| AC-F04-04 | FR-15, BR-02 | Results are scoped only to the selected Event; registrations from other Events never appear. |
| AC-F04-05 | FR-15, BR-02, BR-04, NFR-01 | A non-owning Organizer cannot retrieve another Organizer's registrations and receives a safe denial/not-found. |
| AC-F04-06 | FR-15, BR-04, NFR-01 | An unauthenticated visitor and a Participant cannot retrieve Organizer-only registration data. |
| AC-F04-07 | FR-15, BR-02, NFR-01 | Spoofed Event or owner identifiers cannot widen scope or expose unrelated records. |
| AC-F04-08 | FR-15, BR-03, NFR-01 | Responses contain no passwords, hashes, sessions, unrelated user fields, or unrelated Event data. |
| AC-F04-09 | FR-15, NFR-04 | Authorized registration data remains retrievable after application restart from the configured database. |
| AC-F04-10 | FR-15, NFR-08 | Loading, empty, success, authentication, permission, and error states are explicit, labelled, keyboard-accessible, and privacy-safe. |
| AC-F04-11 | FR-15, NFR-09, NFR-10 | The reviewed contract retains stable IDs and every AC maps to a planned test and later actual evidence before Done. |

## D. Software Test Specification (planned; not executed)

| Test ID | AC | Level | Preconditions and steps | Expected result and assertions |
| --- | --- | --- | --- | --- |
| TEST-F04-01 | AC-F04-01 | API/Database Integration | Organizer owns Event with registrations; call candidate route with valid session. | `200`; only selected Event rows return; owner is derived from session. |
| TEST-F04-02 | AC-F04-02 | API/UI | Seed authorized registration fields with UTC timestamp; retrieve and render list. | Only permitted fields appear; UI labels timestamp in Asia/Bangkok. |
| TEST-F04-03 | AC-F04-03 | API/UI | Owned Event has zero registrations. | `200` empty collection and explicit empty state; no unrelated rows. |
| TEST-F04-04 | AC-F04-04 | Database Integration | Selected Event and another Event both have registrations. | Response contains only selected Event registrations; database query scope is event-bound. |
| TEST-F04-05 | AC-F04-05 | API Integration | Organizer A owns Event; Organizer B requests it. | Safe `403/404`; no registration fields or owner data leak. |
| TEST-F04-06 | AC-F04-06 | API Integration | Visitor and Participant call Organizer route. | Safe unauthenticated/forbidden outcomes; no protected response or mutation. |
| TEST-F04-07 | AC-F04-07 | API Integration | Tamper Event/owner query or path identifiers. | Server ignores/rejects spoofing; response remains limited to session-owned Event. |
| TEST-F04-08 | AC-F04-08 | API/Privacy Integration | Inspect JSON, logs, and UI with registrations present. | No password, hash, session ID, unrelated field, Event, or Participant record appears. |
| TEST-F04-09 | AC-F04-09 | Database Integration | Retrieve list, restart application, create fresh valid session, retrieve again. | Same committed authorized records remain available; no browser-only dependency. |
| TEST-F04-10 | AC-F04-10 | UI/E2E | Exercise loading, empty, success, expired, forbidden, error, keyboard, and focus states. | States are visible, labelled, accessible, and privacy-safe. |
| TEST-F04-11 | AC-F04-11 | E2E/Review | Inspect contract history, AC/TEST map, implementation result table, and tested commit at completion review. | Stable IDs and actual evidence exist before Done; planned tests are not treated as executed. |

## E. Contract history and completion evidence

### Version history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial F-04 design, AC, planned STS, privacy boundaries, and restart retrieval behavior. |

### Baseline and open decisions

- Approved baseline: F-01 server sessions, F-02 ownership/Event identity, F-03 committed Registration data, approved UTC/Asia/Bangkok convention, and team-approved React/TypeScript/Vite, Node.js/Express/TypeScript, PostgreSQL, and Prisma stack.
- Proposed/open: exact route, envelope, error codes, pagination, CSRF transport, testing tools, and deployment configuration.

### Future completion evidence placeholders

- Teammate review: **TBD** — review decision and findings.
- Implementation Issue/PR: **TBD** — link, branch, and merged commit.
- Actual test source/results: **TBD** — files, commands, counts, failures/skips, and results.
- Tested commit/release evidence: **TBD** — tested SHA, release reference, and restart/privacy evidence.

No implementation or test execution is claimed. The contract must be accepted and reconciled with F-01, F-02, and F-03 before implementation.
