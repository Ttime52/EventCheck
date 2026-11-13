# F-01 — Authentication and Session Identity

**Issue:** I-04 — Contract: Authentication & Event Publishing

**Contract version:** 0.1

**Status:** Draft for teammate review; not yet accepted for implementation

**Baseline:** EventCheck SRS, Feature Inventory, Traceability Matrix, Sprint Plan, and System-Level SDS reviewed for Issue I-04.

> This is a versioned design and verification plan. It records no implementation, test execution, review approval, or completion evidence.

## A. Feature overview

### Scope and objective

Provide seeded Participant and Organizer login, logout, and safe current-user retrieval. Establish and validate the approved server-side session for every protected request. Authentication identity and role come from the server-side session, never from browser-selected identity or role values.

### Requirement and responsibility links

| Type | IDs | F-01 coverage |
| --- | --- | --- |
| Functional requirements | FR-01 to FR-05 | Valid/invalid login, logout, current identity, and protected access |
| Business rules | BR-04 | Missing, invalid, expired, and revoked sessions do not authorize protected operations |
| Non-functional requirements | NFR-01, NFR-02, NFR-03, NFR-08, NFR-09, NFR-10 | Backend authorization/privacy, credential/session protection, lifecycle, accessible states, and traceable/reproducible verification |
| System responsibilities | SR-01, SR-03, SR-04, SR-05 | Authorization/privacy, accessible UI states, contracts/evidence, configuration and local readiness |
| Approved decisions | D-02, Q-09 | Seeded single-role synthetic accounts; server-side sessions, cookie security, 30-minute idle timeout, 8-hour absolute lifetime, logout invalidation, fixation and CSRF protections |

### Dependencies and prerequisites

- Synthetic seeded Participant and Organizer accounts with server-assigned roles; do not include real credentials in this contract, source control, screenshots, or routine logs.
- D-02 and Q-09 are approved/resolved in the SRS. Use server-side sessions; do not substitute JWT, local storage bearer tokens, or another authentication architecture.
- The System-Level SDS records React/TypeScript/Vite, Node.js/Express/TypeScript, PostgreSQL, and Prisma as team-approved core technologies. It also defines the session store as server-side and durable across application restarts; the exact physical store/schema, migration, and testing tools remain open.
- The cookie-authenticated frontend/API deployment must use HTTPS in production and an explicitly reviewed SameSite/CORS/CSRF configuration.
- F-02 depends on the current authenticated identity and role. F-03/F-04 contracts must use the same session and identity boundary for their protected operations.

### Actors and permissions

| Actor/state | Allowed | Denied |
| --- | --- | --- |
| Unauthenticated visitor | Submit login; use public event discovery defined by Q-08 | Identity retrieval and every protected operation |
| Participant | Retrieve their own current identity; use Participant operations defined by other contracts | Organizer-only event management and another Participant's private data |
| Organizer | Retrieve their own current identity; manage only their own events under F-02 | Participant-only operations and another Organizer's private event data |

The backend must authenticate the session and authorize the role on every protected request. UI route guards are navigation aids only. Client-supplied user IDs, roles, owner IDs, and participant IDs cannot grant authority.

### Sprint 1 boundaries and exclusions

Included: seeded account authentication; server-side session creation, validation and expiry; current identity; logout and replay rejection; role-aware protected access; password hashing; safe API/UI states; fixation and CSRF protections.

Excluded: account self-registration, recovery, email verification, account administration, third-party identity providers, multi-role accounts, “remember me,” JWT/local-storage authentication, and MFA requirements. Session continuity across application restarts is not an explicit SRS requirement. The System-Level SDS nevertheless defines a durable server-side session store, so the implementation must preserve valid, unexpired session records across an application restart. This is an SDS design expectation, not an additional F-01 acceptance criterion or user-visible SRS requirement. Physical session-store/schema, migration, cleanup, and CSRF library choices remain technical decisions for review.

## B. Feature design / Feature SDS

### Architecture and security boundary

The browser sends JSON requests through the frontend to the backend API. Authentication middleware resolves the opaque cookie identifier in the server-side session store, checks invalidation and expiry, then derives the user ID and role. Protected application services run only after authentication and permission checks. The database stores seeded users and password hashes; the session store holds server-side session records. The browser never receives a password hash or session ID in a response body.

### Workflow and state transitions

| Current state | Event | Required behavior | Next state |
| --- | --- | --- | --- |
| Unauthenticated | Valid seeded Participant or Organizer credentials | Verify the stored password hash, create a fresh unpredictable server-side session, rotate any pre-authentication session identifier, set the session cookie, return only safe identity fields | Authenticated as the seeded account's server-assigned role |
| Unauthenticated | Missing, invalid, or mismatched credentials | Return the same generic authentication failure; create no authenticated session and reveal no account-existence detail | Unauthenticated |
| Authenticated | Protected request before either timeout and not revoked | Validate session server-side; derive identity/role; refresh idle activity without extending absolute expiry | Authenticated |
| Authenticated | No activity for 30 minutes | Invalidate/reject the session server-side and clear client state when next observed | Expired |
| Authenticated | 8 hours since authentication, regardless of activity | Invalidate/reject the session server-side and clear client state when next observed | Expired |
| Authenticated | Logout | Invalidate the current session on the server and clear the cookie | Revoked |
| Expired or revoked | Reuse old cookie/session ID | Reject as unauthenticated; never restore the former identity | Expired or revoked |

At the exact idle or absolute expiry boundary, the session is expired. Activity can move the idle deadline but cannot move the 8-hour absolute deadline. Login rotates the identifier so a pre-authentication identifier cannot become the authenticated identifier.

### Normal, alternative, failure, and boundary scenarios

1. Seeded Participant and Organizer each log in with valid credentials and receive the corresponding role derived from their User record.
2. Wrong, absent, or mismatched credentials produce the same safe failure body/status and no session.
3. A valid session retrieves only ID, display name, and role from the backend. Missing, malformed, expired, invalidated, or revoked sessions cannot call protected services.
4. A Participant directly calls an Organizer-only F-02 operation. The backend denies it even if the UI would normally hide that action.
5. Two Organizers attempt to use the same event management route. F-02 applies the owner predicate; F-01 supplies the server-derived identity and does not authorize client owner overrides.
6. Login/logout and cookie-authenticated state changes follow the approved session lifecycle, rotate identifiers after login, and apply a reviewed CSRF defense.
7. A request at 29 minutes 59 seconds after last activity may remain valid; one at 30 minutes since last activity is rejected. A request at 7 hours 59 minutes may remain valid; one at 8 hours since authentication is rejected even after recent activity.
8. A deployment-specific SameSite/CORS choice may be finalized in the SDS/feature review, but it must retain HttpOnly, Secure in HTTPS, and effective CSRF protection.

### User interface specifications

| Screen/component | Fields and behavior |
| --- | --- |
| Login | Login identifier and password fields; password is masked. Submit uses the seeded account flow. Do not expose account existence, stored role selection, or password rules that disclose internal credentials. |
| Authenticated navigation | Display the safe current identity and role; expose a visible logout action to Participant and Organizer. Role-aware links do not replace backend checks. |
| Session expiry/unauthenticated protected route | Clear local authenticated-user state after a server 401, redirect to Login, and show a neutral “session expired; sign in again” notice without sensitive details. |

UI state requirements:

- Loading: disable repeat login/logout submits and show progress without echoing the password.
- Success: navigate according to the returned server role; identity shown comes from the server response.
- Empty: not applicable to login; state this explicitly rather than showing a misleading empty list.
- Validation: mark missing login fields and preserve safe, actionable field feedback without distinguishing an unknown account from a wrong password.
- Authentication error: show one generic credential failure for missing/invalid credentials.
- Permission error: show a safe denial for a forbidden role or owner; never rely on hidden controls.
- Accessibility: labelled fields, keyboard operation, visible focus, and an announced status/error message under NFR-08.

### API specifications

The System-Level SDS calls /api/v1, the listed route names, JSON envelopes, and error codes proposals. Paths below are candidate contract endpoints to confirm with F-03/F-04 before implementation. They are not evidence of an implemented API. The example envelope is also proposed.

| Method and candidate path | Authentication/authorization | Request | Success | Failure and persistence |
| --- | --- | --- | --- | --- |
| POST /api/v1/auth/login | Any visitor; HTTPS | JSON { "loginIdentifier": "...", "password": "..." } | 200; proposed data.user = { id, displayName, role }; set opaque HttpOnly session cookie with reviewed flags | Missing/invalid credentials: generic 401, no session created. Malformed JSON: proposed 400. Never return credentials, hashes, or session ID in JSON. |
| GET /api/v1/me | Valid server-side session | No identity fields accepted from client | 200; proposed safe user object containing only id, displayName, role | Missing/invalid/expired/revoked session: 401; no private identity fields returned |
| POST /api/v1/auth/logout | Valid server-side session; CSRF protection for cookie-authenticated request | No user/session ID accepted in body | 204; invalidate server session and clear cookie | Missing/expired/revoked session: safe 401; old cookie replay is rejected. Candidate cookie-clearing syntax is a deployment detail. |
| Any protected F-02 route | Valid session, then route-specific server-side role/ownership check | Client IDs do not establish identity | Response defined by F-02 | 401 unauthenticated; proposed 403 or privacy-preserving 404 for forbidden access; no protected operation reaches persistence |

Proposed common format: success bodies use { "data": ... }; failures use { "error": { "code": "...", "message": "...", "details": [...] } }. Stable codes, exact response envelope, URL prefix, CSRF transport/header, cookie name, and deployment-specific CORS behavior require teammate review before implementation. Errors must not reveal passwords, hashes, session IDs, account existence, or unrelated record existence. State-changing cookie-authenticated requests require a CSRF token or an equivalent reviewed origin-validation mechanism.

### Data specifications

| Entity | Logical fields and constraints | F-01 persistence/security requirement |
| --- | --- | --- |
| User | Stable user ID, unique login identifier, display name, role, password hash | Seed synthetic Participant and Organizer accounts; one role per account. Store salted password hashes using a maintained password-hashing library. Never persist or return plaintext passwords. |
| Session | Opaque session identifier, user ID foreign key, created time, last-activity time, expiry time, invalidation time/state | Cookie carries only the opaque identifier. Store session-to-user linkage server-side. Idle expiry is derived from last activity plus 30 minutes; absolute expiry is 8 hours from authentication and never refreshed by activity. Reject invalidated and expired rows. |

Physical session table/store implementation and whether the logical expiry time is stored or derived are open technical decisions. The selected store must remain server-side and durable across application restarts as specified by the System-Level SDS. Align the store and migration with that design; do not create duplicate User or Session models in the feature layer. Restart continuity is an SDS design expectation, not a new SRS requirement or separate F-01 acceptance criterion.

- Seed-data expectation: reproducibly seed synthetic accounts for both roles. Keep actual passwords outside tracked documents and source code; document safe local seed access in the README/private course handoff.
- Migration expectation: version the User credential/role fields and server-side Session persistence needed by the approved architecture. Do not claim a migration exists or has run.
- Transactions/consistency: successful login creates a session only after credential verification; failed login creates none. Logout invalidation must complete server-side before returning success. Concurrent stale requests must not resurrect revoked sessions.
- Retention and cleanup policy for expired session records is not specified by the SRS; choose and document one during technical review without changing the user-visible expiry behavior.

## C. Acceptance Criteria

Each criterion is an observable product outcome. API routes/envelopes noted as candidates remain proposed until team confirmation.

| AC ID | Linked requirements | Acceptance criterion |
| --- | --- | --- |
| AC-F01-01 | FR-01, D-02, Q-09 | A seeded Participant and a seeded Organizer can each submit valid credentials and receive an authenticated session whose server-derived identity has the seeded account's ID, display name, and role. |
| AC-F01-02 | FR-02, NFR-02 | Missing credentials, an unknown login identifier, and an incorrect password produce the same generic authentication failure; none establishes an authenticated session or exposes account existence. |
| AC-F01-03 | FR-04, NFR-01 | With a valid session, current-user retrieval returns only the authenticated account's ID, display name, and role; it ignores/rejects client-supplied identity or role. |
| AC-F01-04 | FR-03, Q-09 | Logout invalidates the session on the server and clears the browser cookie; replaying the old session identifier cannot authenticate or reach a protected operation. |
| AC-F01-05 | FR-04, FR-05, BR-04, NFR-01 | Missing, malformed, revoked, and otherwise invalid sessions receive an unauthenticated outcome on protected routes with no protected response fields or mutation. |
| AC-F01-06 | FR-04, BR-04, NFR-03, Q-09 | A session with no activity is accepted before 30 minutes idle and rejected at or after 30 minutes idle; activity refreshes the idle timer only while the absolute lifetime remains valid. |
| AC-F01-07 | FR-04, BR-04, NFR-03, Q-09 | A session is rejected at or after 8 hours from authentication even if requests have kept its idle timer active; reauthentication creates a new session. |
| AC-F01-08 | FR-05, BR-01, BR-04, NFR-01 | Backend role checks deny a Participant's direct request to an Organizer-only F-02 operation and deny unauthenticated protected requests; authorized public discovery remains available as defined by Q-08. |
| AC-F01-09 | NFR-02, NFR-12 | Seeded and accepted credentials are stored only as salted password hashes; responses, browser-visible artifacts, and routine logs contain no password, password hash, or session ID. |
| AC-F01-10 | NFR-03, Q-09 | Login replaces any pre-authentication session identifier, and cookie-authenticated state changes reject missing/invalid CSRF proof under the reviewed token or equivalent origin-validation design. |
| AC-F01-11 | NFR-02, Q-09 | Session cookies are HttpOnly, Secure in HTTPS environments, and use the reviewed SameSite policy (initial proposal: Lax); any local HTTP exception is documented and does not weaken production behavior. |
| AC-F01-12 | FR-01 to FR-05, NFR-08 | Login, logout, and expired-session UI states provide labelled keyboard-accessible controls, explicit loading/success/error feedback, a generic credential failure, and a safe expired-session return to Login. |
| AC-F01-13 | NFR-09, NFR-10 | The accepted F-01 contract retains version history and stable IDs; every AC maps to an actual test result and tested commit before the feature is declared Done, with failures/skips disclosed and required checks passing. |

## D. Software Test Specification (planned; not executed)

The implementation team should choose approved harnesses before coding. Unit tests cover credential and expiry policy; API/database integration tests cover the real session/authorization boundary; selected UI/E2E checks cover user-visible states. All checks below are plans and expected assertions, not evidence that executable tests exist.

Unless a test explicitly expects a session-state change, it asserts no domain-data mutation. Tests that create, refresh, or revoke sessions assert those session-store effects explicitly.

| Test ID | AC | Level | Preconditions and inputs | Planned steps | Expected result and persistence/privacy assertions |
| --- | --- | --- | --- | --- | --- |
| TEST-F01-01 | AC-F01-01 | API Integration | Seeded Participant and Organizer fixtures with maintained-library salted hashes; valid credentials | Submit login once per role, retain cookie, call current-user route | Both logins succeed; returned role/ID match seed; session rows bind the correct user; no password/hash/session ID appears in body |
| TEST-F01-02 | AC-F01-02 | API Integration | Existing account fixture; cases: missing identifier, missing password, unknown identifier, wrong password | Submit each case and compare status/body/cookie behavior | Same generic failure for credential cases; no authenticated session row/cookie; response does not expose account existence |
| TEST-F01-03 | AC-F01-03 | API Integration | Valid Participant cookie; request includes bogus userId and role query parameters | Call current-user route with and without tampering parameters | Server returns the same session user and only safe identity fields; credentials/session data are absent |
| TEST-F01-04 | AC-F01-04 | API Integration | Valid session and protected test resource; retained cookie identifier | Logout, then replay original cookie against current-user and protected operation | Logout succeeds and clears cookie; server record is invalidated; both replay requests are unauthenticated; protected resource/database state is unchanged |
| TEST-F01-05 | AC-F01-05 | API Integration | Cases: no cookie, malformed/random ID, invalidated ID | Call current-user and one protected F-02 route for each case | Safe unauthenticated response; no protected fields or service mutation; no unrelated-record existence leakage |
| TEST-F01-06 | AC-F01-06 | API Integration | Controlled clock; new valid session; two isolated cases at 29:59 and 30:00 idle | Advance clock without activity for boundary case; separately issue activity before 30 minutes and verify a refreshed idle window | 29:59 session is valid; at 30:00 it is rejected; activity refreshes idle only when before absolute expiry; rejected request does not revive old session |
| TEST-F01-07 | AC-F01-07 | API Integration | Controlled clock; valid session with periodic activity | Call protected route before 8 hours while advancing activity; then call at 8:00:00; perform fresh login | Session works before absolute bound and is rejected at bound; fresh login creates a distinct valid session; old ID remains invalid |
| TEST-F01-08 | AC-F01-08 | API Integration | Anonymous caller, Participant, Organizer; F-02 organizer-only create fixture; public discovery route | Directly call create as anonymous and Participant, then public list without a session | Protected attempts deny with no Event row; public query succeeds with public projection only; no private/session fields are returned |
| TEST-F01-09 | AC-F01-09 | Database Integration | Synthetic seeded account and test logger capture; known fixture password | Inspect stored credential representation; exercise login failure/success; inspect API bodies, browser-visible output, and captured routine logs | Stored value is a maintained password hash with per-password salt, not plaintext/reversible value; secrets and session IDs absent from checked outputs |
| TEST-F01-10 | AC-F01-10 | API Integration | Pre-auth session identifier; valid credentials; F-02 create-and-publish route; valid/invalid CSRF test helper consistent with selected policy | Log in from pre-auth state and compare identifiers; call create-and-publish without/bad proof, then with valid proof | Login uses a new identifier; stale pre-auth ID fails; missing/invalid proof is rejected with no Event row; valid proof proceeds through F-02 authorization and creates one correctly owned Event |
| TEST-F01-11 | AC-F01-11 | API Integration | HTTPS test configuration and documented local configuration | Inspect login/logout Set-Cookie headers under each config; verify cookie deletion flags | HTTPS cookie is HttpOnly/Secure with reviewed SameSite; local exception is documented; logout expires/clears cookie using matching attributes |
| TEST-F01-12 | AC-F01-12 | UI / E2E | Seeded synthetic accounts; login, logout, and expired-session fixtures; keyboard-only pass | Submit valid and invalid credentials; navigate by keyboard; expire a session and call protected view; logout | Loading and success states are perceivable; invalid accounts get generic feedback; expired state returns to Login; no role selector or secret is shown; focus and labels remain usable |
| TEST-F01-13 | AC-F01-13 | E2E (contract/evidence review) | Accepted F-01 contract; completed implementation, test result table, and release candidate when feature completion is reviewed | Trace each F-01 requirement to AC, each AC to a TEST ID and actual result, then inspect history, teammate PR review, command, counts, and tested commit | IDs are stable and unique; every AC has evidence tied to the tested release; required checks pass; failure/skip status and review findings are visible. This review is planned and has not been performed. |

Important TDD candidates: TEST-F01-06 and TEST-F01-07 for exact idle/absolute expiry; TEST-F01-04 and TEST-F01-10 for revocation/replay and fixation/CSRF; TEST-F01-08 for backend role enforcement. For meaningful rule work, preserve evidence of the test failing before the correction and passing after it, tied to the relevant revisions/commit IDs.

## E. Contract history and completion evidence

### Version history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial F-01 feature design, UI/API/data proposals, AC, and planned STS from the approved SRS and System-Level SDS. No implementation or verification claimed. |

### Decisions and open items

Approved baseline applied: D-02, Q-09; FR-01 to FR-05 and BR-04. The approved 30-minute idle and 8-hour absolute timeouts are preserved.

Confirm before implementation: route prefix and exact paths; response envelope and stable error codes; cookie name and SameSite/CORS deployment configuration; CSRF mechanism/token transport; physical session store/schema and cleanup policy; local seeded-account access and the maintained password-hashing library. These details are proposals or technical choices in the SDS.

### Future completion evidence (placeholders)

| Evidence | Status / future link |
| --- | --- |
| Teammate contract review and decision | Pending — record reviewer, review date, substantive findings, and accepted contract revision |
| Implementation Issue / branch / PR | TBD |
| Actual test source files and names for TEST-F01-* | TBD; planned tests only |
| Test command, counts, failures/skips, tested commit | TBD; not executed |
| TDD red/green revisions for applicable rule work | TBD |
| Build/integration result and accepted Sprint 1 release | TBD |
