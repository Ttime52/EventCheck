# F-01 — Authentication and Session Identity

**Issue:** I-04 — Contract: Authentication & Event Publishing

**Contract version:** 0.4

**Status:** Approved/Accepted for Implementation; completion and merge approval remain pending

**Baseline:** EventCheck SRS, Feature Inventory, Traceability Matrix, Sprint Plan, and System-Level SDS reviewed for Issue I-04.

> This is a versioned design and verification plan. The F-01 design and conditional dependency-risk decision are accepted; F-02 integration, remediation verification, and merge approval remain pending.

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

The implemented F-01 API uses the /api/v1 prefix, the route names below, JSON envelopes, and the error codes shown. F-02/F-03/F-04 may add route-specific contracts without changing this authentication boundary.

| Method and path | Authentication/authorization | Request | Success | Failure and persistence |
| --- | --- | --- | --- | --- |
| POST /api/v1/auth/login | Any visitor; HTTPS | JSON { "loginIdentifier": "...", "password": "..." } | 200; `data.user` contains only id, displayName, role; set opaque HttpOnly session cookie | Missing/invalid credentials: generic 401, no session created. Never return credentials, hashes, or session ID in JSON. |
| GET /api/v1/me | Valid server-side session | No identity fields accepted from client | 200; implemented safe user object containing only id, displayName, role | Missing/invalid/expired/revoked session: 401; no private identity fields returned |
| POST /api/v1/auth/logout | Valid server-side session; Origin protection for cookie-authenticated request | No user/session ID accepted in body | 204; invalidate server session and clear cookie | Missing/expired/revoked session: safe 401; old cookie replay is rejected. |
| Any protected F-02 route | Valid session, then route-specific server-side role/ownership check | Client IDs do not establish identity | Response defined by F-02 | 401 unauthenticated; proposed 403 or privacy-preserving 404 for forbidden access; no protected operation reaches persistence |

Implemented common format: success bodies use `{ "data": ... }`; failures use `{ "error": { "code": "...", "message": "..." } }`. Login failures use `INVALID_CREDENTIALS`, unauthenticated requests use `UNAUTHENTICATED`, forbidden role requests use `FORBIDDEN`, and rejected state-changing Origins use `CSRF_REJECTED`. Errors do not reveal passwords, hashes, session IDs, account existence, or unrelated record existence. State-changing cookie-authenticated requests require `Origin` to equal the configured `CLIENT_ORIGIN`; deployment-specific CORS policy remains a deployment concern.

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

Each criterion is an observable product outcome. The F-01 API routes, response envelopes, cookie configuration, and CSRF protection mechanism have been reviewed and accepted by the teammate. F-02-dependent authorization and cross-feature CSRF verification remain deferred until Sprint 1 integration.

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

## D. Software Test Specification

Section D defines the test specifications, fixtures, steps, and expected assertions. Section E records actual execution results and evidence; entries in Section D are not themselves execution claims.

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
| 0.2 | 2026-11-14 | Draft for teammate review | Recorded post-commit PostgreSQL integration evidence and current AC/TEST verification status. No approval or completion claim. |
| 0.3 | 2026-11-14 | Approved/Accepted for Implementation | Teammate accepted the F-01 authentication design, including implemented endpoints, server-side PostgreSQL sessions, and password hashing. Completion, security-risk acceptance, and PR merge approval remain pending. |
| 0.4 | 2026-11-14 | Approved/Accepted for Implementation | Recorded the accepted conditional dependency-risk decision, teammate review record, AC-F01-09 security verification, and current-commit verification results. F-02 integration and PR merge approval remain pending. |

### Decisions and open items

Approved baseline applied: D-02, Q-09; FR-01 to FR-05 and BR-04. The approved 30-minute idle and 8-hour absolute timeouts are preserved.

Implemented and recorded choices: `/api/v1/auth/login`, `/api/v1/me`, and `/api/v1/auth/logout`; success bodies use `{ data: { user } }`; failures use `{ error: { code, message } }`; the session cookie is `eventcheck_session`, HttpOnly, Path `/`, SameSite=Lax, and Secure when `NODE_ENV=production`; logout clears the cookie with matching attributes and `Max-Age=0`; state-changing requests require `Origin` to equal `CLIENT_ORIGIN` (default `http://localhost:5173`), otherwise they receive `403 CSRF_REJECTED`. These implementation details were accepted as part of the teammate's F-01 design review. F-02 route-specific authorization and cross-feature CSRF verification remain deferred to Sprint 1 integration.

Dependency audit risk remains separate from design acceptance: the full audit reported 6 vulnerabilities (1 moderate, 3 high, 2 critical), and `npm audit --omit=dev` reported 3 high findings. The affected chain is `@prisma/client@6.19.3` → optional-peer `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`; runtime exploitability has not been established. The teammate accepted the conditional risk decision documented in the linked assessment; remediation and production exposure verification remain required.

Dependency risk assessment: [F-01 Dependency Security Risk Assessment](../../security/f-01-dependency-risk-assessment.md). The teammate accepted the conditional risk decision recorded there; production exposure verification, remediation execution, feature completion, and PR merge approval remain pending.

### Teammate review and release-gate record

| Item | Record |
| --- | --- |
| Contract review decision | Teammate accepted the F-01 API routes, response envelopes, cookie/session behavior, CSRF origin-validation design, and server-side PostgreSQL session design for continued implementation. |
| Conditional dependency-risk decision | Accepted for continued development only; production exposure verification, remediation, and re-audit remain mandatory before deployment. |
| Review date | 2026-11-14 |
| Reviewer identity | Teammate reviewer; name/handle was not included in the supplied review record. |
| Completion condition | AC-F01-09 database/log verification, current-commit Playwright evidence, F-02 integration checks, and required dependency verification must be recorded before completion or merge approval. |

### Deferred Sprint 1 integration gates

| Gate | Current status | Release requirement |
| --- | --- | --- |
| AC-F01-08 / TEST-F01-08: Participant denied on an actual F-02 Organizer-only route | Pending F-02 implementation/integration | Must pass before the Sprint 1 release is accepted. |
| AC-F01-10 / TEST-F01-10: F-02-dependent cross-feature CSRF verification | Pending F-02 implementation/integration | Must pass before the Sprint 1 release is accepted. |

### Future completion evidence (placeholders)

| Evidence | Status / future link |
| --- | --- |
| Teammate contract review and decision | Accepted for implementation; decision and conditions recorded above on 2026-11-14. Reviewer name/handle remains to be added if required by the review record. Completion and merge approval remain pending. |
| Implementation Issue / branch / PR | GitHub Issue #8; branch `feature/06-auth-role-access`; PR URL pending |
| Actual test source files and names for TEST-F01-* | Recorded below; F-02-dependent checks remain pending |
| Test command, counts, failures/skips, tested commit | PostgreSQL integration: 7 passed, 0 failed, 0 skipped, 859 ms at commit `a93691bb86b2a4e0329d4427a10c66c8e83103c6`; Playwright: 9 passed, 0 failed, 0 skipped, 7.9 seconds at the same commit. Historical 4edc403 evidence retained below |
| TDD red/green revisions for applicable rule work | TBD |
| Build/integration result and accepted Sprint 1 release | TBD |

### Current verification record

The verification target revision was `a93691bb86b2a4e0329d4427a10c66c8e83103c6` (verified with `git rev-parse HEAD` before this evidence-only documentation update). The final verification used the isolated PostgreSQL database `127.0.0.1:5433/eventcheck_test`: PostgreSQL integration passed 7 tests in 859 ms and Playwright passed 9 tests in 7.9 seconds, with 0 failures and 0 skips. Historical PostgreSQL evidence at commit `4edc4034a2ce4b763f60a37e825e024de8706329` remains preserved below.

Implementation evidence: GitHub Issue #8, branch `feature/06-auth-role-access`. No pull-request URL is recorded because none was provided.

| AC ID | TEST ID | Current status | Evidence and limitation |
| --- | --- | --- | --- |
| AC-F01-01 | TEST-F01-01 | PASS | `server/src/auth.integration.test.ts`; post-commit isolated PostgreSQL run passed. |
| AC-F01-02 | TEST-F01-02 | PASS | Same passing integration test covers missing, unknown, and incorrect credentials. |
| AC-F01-03 | TEST-F01-03 | PASS | Same passing integration test covers server-derived identity and spoofing resistance. |
| AC-F01-04 | TEST-F01-04 | PASS | Same passing integration test covers logout invalidation and replay rejection. |
| AC-F01-05 | TEST-F01-05 | PASS | Same passing integration test covers malformed and revoked session rejection. |
| AC-F01-06 | TEST-F01-06 | PASS | Same passing integration test covers 29:59 validity, 30:00 rejection, and idle refresh behavior. |
| AC-F01-07 | TEST-F01-07 | PASS | Same passing integration test covers activity before the absolute limit and rejection at the 8-hour boundary. |
| AC-F01-08 | TEST-F01-08 | PENDING INTEGRATION | Isolated middleware coverage exists; actual F-02 Organizer-only routes are not available. |
| AC-F01-09 | TEST-F01-09 | PASS | `server/src/auth.integration.test.ts` now inspects the isolated database for `scrypt` hashes with unique salts, checks response bodies for password/hash/session-ID leakage, captures all routine console log levels during success/failure/current-user/logout flows, and verifies no password, hash, or session ID is logged. The current PostgreSQL run passed. |
| AC-F01-10 | TEST-F01-10 | PENDING INTEGRATION | Origin/session-rotation assertions passed in the isolated run; F-02 cross-feature CSRF execution remains pending. |
| AC-F01-11 | TEST-F01-11 | PASS | Post-commit integration run passed local and production-mode cookie creation/clearing assertions, including Secure, HttpOnly, SameSite, Path, and Max-Age behavior. |
| AC-F01-12 | TEST-F01-12 | PASS | `client/src/App.test.tsx`: 6 tests passed. Local Playwright Chromium run passed all 9 tests, including deterministic expired-session and replay rejection, login/logout, keyboard accessibility, and responsive layouts. |
| AC-F01-13 | TEST-F01-13 | PENDING | PostgreSQL and Playwright evidence are recorded against verification target `a93691bb86b2a4e0329d4427a10c66c8e83103c6`, including 7/7 integration and 9/9 browser tests. F-02 integration, remediation verification, and formal completion evidence remain outstanding. |

Browser verification for TEST-F01-12 was executed with Playwright Chromium against the latest configuration at commit `a93691bb86b2a4e0329d4427a10c66c8e83103c6`: 9 tests total, 9 passed, 0 failed, 0 skipped, duration 7.9 seconds. Passed coverage includes Participant and Organizer login, server-derived identity/role, invalid and missing credentials, logout/session refresh, password visibility, keyboard interaction, focus, responsive unauthenticated/authenticated layouts at 375px, 390px, 768px, and 1440px, and deterministic expired-session/replay rejection.

Suggested macOS execution for the isolated E2E database:

```sh
export E2E_DATABASE_URL="postgresql://eventcheck:change-me@127.0.0.1:5433/eventcheck_test?schema=public"
export DATABASE_URL="$E2E_DATABASE_URL"
export SEED_PARTICIPANT_PASSWORD='use-your-local-secret'
export SEED_ORGANIZER_PASSWORD='use-your-local-secret'
export E2E_PARTICIPANT_LOGIN='participant@example.test'
export E2E_PARTICIPANT_PASSWORD="$SEED_PARTICIPANT_PASSWORD"
export E2E_ORGANIZER_LOGIN='organizer@example.test'
export E2E_ORGANIZER_PASSWORD="$SEED_ORGANIZER_PASSWORD"
export NODE_ENV=development
docker compose up -d postgres
npm run db:migrate --workspace server
npm run db:seed --workspace server
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration now passes `E2E_DATABASE_URL` to the backend and fails closed when it is absent. Keep the isolated `eventcheck_test` database reserved for integration/E2E tests and do not use destructive reset commands against the development database `eventcheck`.

Executed commands for this record:

- Historical pre-commit frontend run: `npm run test --workspace client`: 1 file, 6 tests passed; this result is not attributed to commit `4edc4034a2ce4b763f60a37e825e024de8706329`.
- `DATABASE_URL="$TEST_DATABASE_URL" npm run test:integration --workspace=server`: 1 file passed; 7 tests passed, 0 failed, 0 skipped, 859 ms, against `127.0.0.1:5433/eventcheck_test` at commit `a93691bb86b2a4e0329d4427a10c66c8e83103c6`.
- Historical PostgreSQL run: the same command against `127.0.0.1:5433/eventcheck_test` at commit `4edc4034a2ce4b763f60a37e825e024de8706329` passed 1 file, 6 tests, 0 failed, 0 skipped in 698 ms.
- `npx playwright test --list`: 1 file, 9 browser tests discovered in `e2e/f01-auth.spec.ts`.
- `npm run test:e2e`: Playwright Chromium, 9 tests total, 9 passed, 0 failed, 0 skipped, duration 7.9 seconds, at commit `a93691bb86b2a4e0329d4427a10c66c8e83103c6` with `E2E_DATABASE_URL` pointing to `127.0.0.1:5433/eventcheck_test`.
- Historical pre-commit server run: security unit test passed; health test was blocked by `listen EPERM`; this is retained only as historical context and is not used as post-commit integration evidence.
- Historical pre-commit workspace checks: `npm run typecheck`, `npm run build`, Prisma validation, and `git diff --check` passed; these results are not attributed to the tested commit without supporting logs.
- `git diff --check` for this documentation correction: passed.
- Invalid `eventcheck_test_backup` integration configuration: rejected with exit code 2.
