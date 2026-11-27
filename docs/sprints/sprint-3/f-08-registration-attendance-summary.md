# F-08 - Registration and Attendance Summaries

**Issue:** 18 - Sprint 3 F-08 Registration and Attendance Summaries<br>
**Feature ID:** F-08<br>
**Contract version:** 0.1<br>
**Status:** Draft - Review Ready; not accepted; implementation gate open<br>
**Revision date:** 2026-11-27<br>
**Author:** Issue 18 contributor (individual name not recorded)<br>
**Reviewer:** Student 1 (requested by Issue 18; review not recorded)<br>
**Feature branch:** feature/f08-registration-attendance-summary<br>
**Baseline:** origin/sprint-2-staging at 21669b9b902967219724d8a62d29574f3ff0c987
**Target completion:** 2026-12-13

## 1. Purpose, status, and review gate

F-08 specifies aggregate registration and attendance summaries for the Organizer who owns an Event. This is the only new feature allocated to Sprint 3. F-01 to F-07 remain in Sprint 3 for integration, regression, and defect correction only. This conclusion is supported by the Feature Inventory and SRS Sprint 3 allocation; the complete scope audit and cross-cutting responsibility map are in [F-08 progress and Sprint 3 remaining work](remaining-work.md).

This review-ready draft was prepared against the integrated Sprint 2 staging baseline before any F-08 implementation changes in this task. The working tree was clean at the start. The checked-out branch already existed at the baseline above. No F-08 API, component, schema, migration, or test code has been changed by this task.

The F-05, F-06, and F-07 contracts are accepted and their code is staging-integrated. The repository does not record formal Sprint 2 release acceptance or a release tag. The Sprint 3 plan lists an integrated Sprint 2 release as a prerequisite; the team must record how that prerequisite is satisfied before F-08 implementation is considered ready.

**Implementation gate:** D-10 and BR-18 remain Proposed in the SRS. This draft does not accept them. Student 1 and the team must approve or revise the decisions and the contract below, record the approval in the SRS/change history and contract history, and resolve the Sprint 3 PR target before implementation begins. No Student 1 review or approval artifact was found at this revision.

The checked-in GitHub Actions workflow runs PR checks for sprint-1-staging, sprint-2-staging, and main. No sprint-3-staging branch or CI target is present. The feature branch uses the latest integrated Sprint 2 staging code as its baseline; the PR target remains a team decision and must not be inferred from that baseline.

## 2. Scope and exclusions

### In scope

- Show the owning Organizer the Event capacity, active Registration count, historical cancelled Registration count, remaining seats, checked-in ACTIVE count, ACTIVE not-checked-in count, and attendance rate.
- Read committed PostgreSQL Event, Registration, and Attendance records using the existing Prisma layer.
- Restrict summaries to the authenticated Organizer who owns the requested Event.
- Return one internally consistent summary result and provide accessible loading, empty, error, retry, and refresh behavior.
- Preserve the existing separation between the Active Registrations list and Registration History.
- Refresh after a successful Organizer check-in, on view reload/re-entry, and on an explicit summary refresh.

### Out of scope

- Report export, platform-wide analytics, cross-Event reports, new Organizer/Participant capabilities, QR/scanner or Participant self-check-in, notifications, and Event cancellation.
- New counters, summary tables, or cached aggregate values.
- Changes to F-05 capacity/deadline policy, F-06 cancellation/re-registration behavior, or F-07 check-in behavior.
- A production retention policy for real-user data. Accepted Q-10 covers synthetic project and assessment data only.

## 3. Requirements and responsibility links

| Type | IDs | F-08 coverage |
| --- | --- | --- |
| Functional requirements | FR-22, FR-23 | Owned-Event capacity and lifecycle totals; active attendance and rate. |
| Business rules | BR-02, BR-09, BR-18 | Owner visibility; remaining seats follow the active-capacity invariant; summary reconciliation. BR-18 remains Proposed pending approval. |
| Decisions | D-10, BR-18, Q-10 | D-10/BR-18 remain Proposed. Q-10 is Accepted for retaining synthetic history during the project and assessment period. |
| Non-functional requirements | NFR-01, NFR-04, NFR-05, NFR-06, NFR-08, NFR-09, NFR-10 | Privacy, persisted data, concurrent-change integrity, safe failure, accessible states, versioned contracts, and reproducible test evidence. |
| System responsibilities | SR-01 to SR-06 | SR-01/02/03/04 extend through F-08. SR-05 remains a shared deployment responsibility. SR-06 has a separate Sprint 3 performance measurement for the F-03 operations named by NFR-07; see Section 12. |
| Dependencies | F-01 to F-07 | Session/role identity, Event ownership/capacity, Registration lifecycle, Organizer lists, cancellation history, and Attendance associations. |

The Group Work Specification says the feature contract must precede implementation and include Feature-Level SDS, applicable UI/API/data specifications, stable AC, STS, DoD, and evidence linking actual tests to AC (Section 8.2, page 10). Its Sprint 3 checkpoint calls for contracts, working progress, and an explicit remaining-work list by 29 November (Section 7, page 9; Deliverable 2 Part C, page 12). It also requires the feature branch/PR/review/integration/release sequence (Section 8.3, page 11). The source in this repository is identified as a draft for instructor review; no later instructor revision is available here.

## 4. Dependencies and current implementation baseline

| Dependency | Observed baseline and constraint |
| --- | --- |
| F-01 | Express middleware validates the server-side session with requireAuth. requireRole returns 403 for an authenticated wrong-role caller. Existing GET routes use cookie credentials. |
| F-02 | Event stores organizerId, capacity, and current publication state. Current PublicationState contains only PUBLISHED. |
| F-03/F-05 | ACTIVE Registrations consume capacity. F-05 and F-06 transitions preserve the BR-09 invariant and use PostgreSQL transactions/locking for writes. |
| F-04 | GET /api/v1/organizer/events/{eventId}/registrations is owner-scoped and returns ACTIVE and CANCELLED source records with selected Participant display data. Its existing list is not an aggregate snapshot API. |
| F-06 | A cancelled record remains historical; re-registration creates a separate ACTIVE Registration. Q-10 retains synthetic history for the assessment period. |
| F-07 | GET /api/v1/organizer/events/{eventId}/attendance is owner-scoped. Attendance has a unique Registration association; valid rows are tied to the Event and Participant by composite references. |
| Persistence | PostgreSQL and Prisma are already used. No F-08 schema or migration is proposed. |
| Sprint 2 release | F-05 to F-07 are integrated to sprint-2-staging. Formal release acceptance and a release tag are not recorded. |
| Sprint 3 PR target | No sprint-3-staging branch exists and the current CI workflow has no such target. Team confirmation is required before opening a PR. |

## 5. Feature-Level SDS

### 5.1 Actors, authority, and workflow

1. An authenticated Organizer opens an owned Event and the existing Organizer Registration Management view.
2. The client requests the Event summary from the backend. It does not derive F-08 metrics from separate Registration and Attendance responses.
3. The backend derives Organizer identity only from the validated session, checks the Organizer role, and selects the Event using both eventId and session userId.
4. The backend runs one parameterized PostgreSQL summary query through Prisma. Event capacity and all aggregate counts come from the same SQL statement snapshot.
5. The API returns only aggregate fields. Participant identifiers, names, credentials, registration IDs, and attendance row details are excluded.
6. The client displays returned values only after a successful response. No provisional zero values are displayed while loading or after an error.
7. A successful check-in causes a summary refresh. A manual refresh, page reload, or re-entry reads the latest committed snapshot. Participant cancellation/re-registration while the Organizer view is open is reflected by its next refresh.

### 5.2 Proposed calculation rules

The definitions below are proposals for review under D-10/BR-18. BR-09's active-only capacity invariant is already accepted; the feature-level reporting definitions remain subject to approval.

| Metric | Proposed definition |
| --- | --- |
| capacity | Current Event.capacity from PostgreSQL. |
| activeCount | Number of Registration records for the Event whose status is ACTIVE. |
| cancelledCount | Number of historical Registration records for the Event whose status is CANCELLED. Count records, not distinct Participants. If one Participant has two cancelled Registration records, both count. |
| remainingSeats | capacity - activeCount. CANCELLED records do not consume capacity. The accepted BR-09 invariant ensures activeCount does not exceed capacity; do not clamp a negative value into a misleading result. |
| checkedInCount | Number of ACTIVE Registration records with a valid associated Attendance record. Count distinct Registration IDs. The database's unique Attendance-per-Registration constraint prevents duplicates. |
| notCheckedInCount | activeCount - checkedInCount. |
| attendanceRate | If activeCount > 0, round checkedInCount / activeCount * 100 to one decimal place and return a JSON number in the 0 to 100 range. If activeCount = 0, return JSON null; the UI displays N/A. |

Example: capacity 10, activeCount 3, cancelledCount 2, checkedInCount 1 produces remainingSeats 7, notCheckedInCount 2, and attendanceRate 33.3. Two cancelled rows from the same Participant still produce cancelledCount 2.

## 6. Database query and consistency design

The proposed read path uses one parameterized PostgreSQL SELECT through Prisma $queryRaw. It filters the Event by both id and organizerId, returns capacity, and uses scalar aggregate subqueries for ACTIVE Registrations, CANCELLED Registrations, and ACTIVE Registrations joined to valid Attendance. The Attendance join uses the Registration association; COUNT DISTINCT over Registration IDs protects the checked-in metric from join multiplication. The existing unique Attendance constraint remains the primary duplicate guard. PostgreSQL COUNT values must be normalized to safe JSON integers before response serialization; an unsafe conversion fails the request rather than rounding or emitting a BigInt serialization error.

One SQL statement gives every selected Event and aggregate value the same PostgreSQL statement snapshot, avoiding a mixed-time result from separate Event, Registration, and Attendance requests. It reads only Event capacity and counts; it does not fetch Participant records or write to the database. It uses no stored counters, new models, migration, or row lock. A query failure returns an error; the API must not return a partial summary or substitute zeros.

If review chooses multiple Prisma queries instead, the contract must be revised to specify a PostgreSQL REPEATABLE READ transaction and tests that demonstrate a consistent snapshot. Do not silently weaken the consistency guarantee.

## 7. API specification

### Request

| Method and path | Authentication and scope | Request |
| --- | --- | --- |
| GET /api/v1/organizer/events/{eventId}/summary | Valid session; Organizer role; eventId must resolve to an Event whose organizerId is the session user ID. | No body or query-controlled owner/Participant fields. Cookie credentials follow existing API conventions. |

### Success response

HTTP 200 uses the existing success envelope:

| Field | JSON type | Meaning |
| --- | --- | --- |
| data.summary.eventId | string | Requested owned Event ID. |
| data.summary.capacity | integer | Current Event capacity. |
| data.summary.activeCount | integer | ACTIVE Registration records. |
| data.summary.cancelledCount | integer | Historical CANCELLED Registration records, not distinct people. |
| data.summary.remainingSeats | integer | capacity minus activeCount. |
| data.summary.checkedInCount | integer | ACTIVE Registration records with valid Attendance. |
| data.summary.notCheckedInCount | integer | activeCount minus checkedInCount. |
| data.summary.attendanceRate | number or null | One-decimal percentage when activeCount is positive; null when there are no ACTIVE Registrations. |

No participant-level or row-level private fields are returned.

### Error response

Use the existing { error: { code, message } } envelope. Proposed outcomes:

| Condition | HTTP | Error code / privacy behavior |
| --- | --- | --- |
| Missing, expired, or revoked session | 401 | UNAUTHENTICATED; no summary data. |
| Participant or other authenticated non-Organizer role | 403 | FORBIDDEN; no summary data. |
| Malformed, nonexistent, or non-owned Event ID | 404 | EVENT_NOT_FOUND; same public shape for all cases so Event existence/ownership is not disclosed. |
| PostgreSQL/query failure | 500 | INTERNAL_SERVER_ERROR; generic message, no partial counts or SQL details. |

The current global error middleware uses HTTP 500 for unexpected failures. GET is read-only and does not require a CSRF Origin check under existing middleware behavior.

## 8. UI specification

Extend OrganizerRegistrationsView in client/src/App.tsx, using the existing Event Management/Registration Management patterns.

- Show Capacity, Active Registrations, Cancelled Registrations, Remaining Seats, Checked In, Not Checked In, and Attendance Rate.
- Keep Active Registrations and Registration History as separate lists. Do not merge cancelled history into current attendee rows.
- Show Loading summary while the first request is pending. Show numeric zero only after a successful response with zero records. An empty Event is a successful summary with zero counts and N/A rate.
- On failure, show an accessible error message and Retry control. Do not render misleading zero counts. Explicit refresh reloads the summary.
- After a successful Organizer check-in, retrieve the summary again from the API; do not adjust counts locally as the authoritative result.
- On reload or re-entry, fetch fresh persisted values. Session expiry returns to the existing sign-in state.
- Display a null attendanceRate as N/A. Display a numeric rate with one decimal place and a percent sign.
- Preserve existing check-in controls and messages from F-07. Do not add Participant self-check-in.
- Use labelled metrics, keyboard-operable refresh/retry, visible focus, role=status for loading/success updates, role=alert for failure, and responsive layout. Review at 1280-pixel and 390-pixel widths with no horizontal page scrolling.

## 9. Security and ownership

- Require the current F-01 session and Organizer role on the API; visible UI controls are not an authorization boundary.
- Derive organizerId only from the authenticated server session. Ignore/reject client-supplied organizerId, participantId, ownerId, count, capacity, status, and attendance values.
- Filter Event lookup by id and organizerId before accessing the aggregates.
- Return indistinguishable 404 responses for malformed, nonexistent, and another Organizer's Event. Do not include private fields in any denial response.
- Test anonymous, expired/revoked, Participant, owning Organizer, non-owning Organizer, invalid ID, and nonexistent ID cases directly against the API.
- Rejected/unauthorized requests must not change Event, Registration, Attendance, or Session domain data (session middleware's normal lastActivityAt update is not a domain-data write).

## 10. Proposed Acceptance Criteria

These IDs and wordings are new draft proposals because no accepted F-08 AC set exists. Student 1/team review must accept or revise them before they are treated as binding.

| ID | Proposed observable outcome | Requirements |
| --- | --- | --- |
| AC-F08-01 | The owning Organizer retrieves active and historical cancelled counts that equal committed Registration records for the selected Event; each CANCELLED record counts once, including multiple records for one Participant. | FR-22, BR-02, BR-18, Q-10 |
| AC-F08-02 | Remaining seats equal current Event capacity minus ACTIVE Registration count; cancelled records do not occupy capacity. | FR-22, BR-09, BR-18 |
| AC-F08-03 | Checked In counts only ACTIVE Registrations with valid Attendance; duplicate Attendance rows and historical CANCELLED rows do not increase it. Not Checked In equals activeCount minus checkedInCount. | FR-23, BR-02, BR-18 |
| AC-F08-04 | For a positive activeCount, attendanceRate equals checkedInCount divided by activeCount times 100, rounded to one decimal place. For zero ACTIVE Registrations the API returns null and the UI displays N/A. | FR-23, BR-18 |
| AC-F08-05 | Anonymous, expired/revoked, Participant, and non-owning Organizer requests are denied with the specified safe outcomes; no summary or private registration/attendance data is disclosed. | FR-05, FR-22, FR-23, BR-02, BR-04, NFR-01 |
| AC-F08-06 | At least one meaningful F-08 summary rule is implemented against committed PostgreSQL records and an executed test passes on the recorded tested commit. Existing partial F-07-labelled evidence is progress evidence only and is not treated as execution of a new TEST-F08 case. | FR-22/23, BR-18, NFR-04, NFR-09, NFR-10 |

## 11. Software Test Specification (planned; NOT RUN)

The following are stable draft test IDs for review. Test execution, counts, and tested commit are blank until implementation is approved and executed. All PostgreSQL tests must use the isolated eventcheck_test/public database; the test guard refuses other database targets.

### TEST-F08-01 - Summary calculation unit matrix

- **Level:** Unit.
- **Preconditions:** Pure summary calculation function receives validated integer counts; no database or network.
- **Inputs:** (a) capacity 10, active 0, cancelled 2, checked-in 0; (b) capacity 10, active 1, cancelled 0, checked-in 0; (c) capacity 10, active 3, cancelled 2, checked-in 1; (d) capacity 10, active 3, cancelled 2, checked-in 3; (e) capacity 10, active 3, cancelled 2, checked-in 2.
- **Expected:** (a) remaining 10, not checked in 0, rate null; (b) remaining 9, not checked in 1, rate 0.0; (c) remaining 7, not checked in 2, rate 33.3; (d) remaining 7, not checked in 0, rate 100.0; (e) rate 66.7. Reject an impossible checked-in count greater than activeCount rather than emit contradictory totals.
- **AC mapping:** AC-F08-02, AC-F08-03, AC-F08-04.

### TEST-F08-02 - Owner summary matches committed PostgreSQL records

- **Level:** PostgreSQL API integration.
- **Preconditions:** Isolated database; Organizer O1 owns Event E1 with capacity 10; Participant P1 has two historical CANCELLED rows and one ACTIVE row; P2 and P3 have ACTIVE rows; one valid Attendance is linked to an ACTIVE row.
- **Input:** GET E1 summary with O1 session.
- **Expected:** HTTP 200; exact aggregate response is capacity 10, active 3, cancelled 2, remaining 7, checked in 1, not checked in 2, rate 33.3. The two cancelled records count twice although they belong to P1. Expected values are independently read from committed rows. Response has no participant or row-level fields.
- **AC mapping:** AC-F08-01 through AC-F08-04 and AC-F08-06.

### TEST-F08-03 - Cancellation, re-registration, and check-in refresh

- **Level:** PostgreSQL API integration.
- **Preconditions:** Isolated PostgreSQL fixture with Event E1, capacity 10, and a Participant with one ACTIVE Registration.
- **Inputs:** Retrieve summary; perform the existing F-06 cancellation and eligible F-03 re-registration; record one existing F-07 Organizer check-in for an ACTIVE row; retrieve summary after each committed transition.
- **Expected:** Cancellation adds one historical cancelled row and releases exactly one active place; re-registration creates a new ACTIVE row without removing the cancelled history; check-in increases checkedInCount and decreases notCheckedInCount by one without changing activeCount or remainingSeats; repeated summary reads do not create or mutate records.
- **AC mapping:** AC-F08-01, AC-F08-02, AC-F08-03, AC-F08-06.

### TEST-F08-04 - One-snapshot query and read-only retrieval

- **Level:** PostgreSQL integration.
- **Preconditions:** Isolated PostgreSQL database; known Event/Registration/Attendance snapshot and a coordinated concurrent lifecycle writer.
- **Inputs:** Arrange a committed registration/cancellation or check-in transition concurrent with the summary request; repeat the read after the writer commits. Capture domain rows before and after each read.
- **Expected:** Each response corresponds to one consistent committed statement snapshot and reconciles internally; it never mixes Event capacity/count values from separate snapshots. The next request sees the new committed state. Summary retrieval itself changes no Event, Registration, or Attendance row. If the implementation uses more than one SQL statement, exercise and assert the accepted REPEATABLE READ behavior.
- **AC mapping:** AC-F08-01 through AC-F08-04.

### TEST-F08-05 - Authorization, owner concealment, and invalid Event IDs

- **Level:** PostgreSQL API integration.
- **Preconditions:** Isolated database with O1-owned E1, O2-owned E2, a Participant session, an expired/revoked session, and a nonexistent UUID.
- **Inputs:** Request E1 without a session; with Participant, expired, and revoked sessions; with O1; with O2 against E1; and with malformed/nonexistent IDs.
- **Expected:** Missing/expired/revoked session is 401; Participant is 403; O1 receives 200; O2, malformed, and nonexistent IDs receive the same 404 EVENT_NOT_FOUND envelope. Denials contain no data object, capacity, counts, owner identity, or private fields. Domain records remain unchanged.
- **AC mapping:** AC-F08-05.

### TEST-F08-06 - Organizer summary UI states and accessible controls

- **Level:** Client component/unit.
- **Preconditions:** Existing UI test setup with Organizer session and mock summary API.
- **Inputs:** Deferred success; empty summary with zero active registrations/null rate; one summary with rate 33.3; HTTP failure followed by successful Retry; keyboard-only activation of Refresh and Retry.
- **Expected:** Loading is announced before data; successful values match the API; zero-active displays N/A; failed initial retrieval displays no fake zero values; Retry recovers; controls have accessible names and keyboard focus; Active Registrations and Registration History remain separate.
- **AC mapping:** AC-F08-01 through AC-F08-05.

### TEST-F08-07 - Organizer lifecycle end-to-end workflow

- **Level:** Playwright E2E with real API and isolated PostgreSQL.
- **Preconditions:** Isolated E2E database; seeded synthetic Organizer O1, Organizer O2, Participant P1 and P2; available capacity and event times that permit existing F-07 check-in.
- **Inputs:** O1 opens owned E1; P1 cancels and re-registers using existing F-06/F-03 workflows; O1 refreshes summary and checks in the eligible ACTIVE registration; O1 reloads; O2 directly requests E1 summary.
- **Expected:** UI values match persisted counts after each refresh and reload; cancelled history is retained and counted by row; check-in changes only attendance metrics; O2 is denied without disclosure. No mocked data is used for the measured summary.
- **AC mapping:** AC-F08-01 through AC-F08-06.

### TEST-SR06-01 - Sprint 3 quantitative API performance measurement

- **Level:** System/performance against the real API and PostgreSQL; cross-cutting SR-06, not an additional feature.
- **Preconditions:** Integrated candidate; isolated reproducible environment; 100 Events and 1,000 synthetic Registrations; 10 concurrent clients. D-12/NFR-07 numeric target is approved before a pass/fail decision.
- **Inputs:** 20 sequential requests per operation, then the documented 60-second workload for published-event listing, Event detail, and eligible registration. Registration requests use fresh eligible Participant/Event pairs and sufficient capacity; each result is reconciled against persisted records.
- **Expected:** Record p95 latency, request counts, unexpected server errors, environment, tested commit, and committed registration outcomes. Proposed target is p95 at most 2 seconds with zero unexpected server errors only if team review accepts that D-12 target. If not accepted, record measurements as exploratory and do not claim the proposed threshold passed. This test does not add a new summary-endpoint performance target.
- **AC mapping:** Sprint 3 system verification, NFR-07, SR-06; not an AC-F08 criterion.

## 12. Sprint 3 feature and system-responsibility coverage

The Feature Inventory lists F-08 as the only Sprint 3 feature. The SRS Sprint 3 allocation lists FR-22, FR-23, BR-18, cross-product NFR verification, and NFR-07 measurement. The Sprint Plan explicitly places F-01 to F-07 in Sprint 3 only for integration/regression, not new feature scope. No additional product feature is proposed by this contract.

| Item | Remaining Sprint 3 work | Contract/evidence treatment |
| --- | --- | --- |
| F-08 | Registration and Attendance Summaries | This complete draft contract supplies SDS, UI/API/data proposals, AC, STS, and DoD. D-10/BR-18 and peer acceptance remain pending. |
| SR-01 | Backend Authorization and Data Privacy | Applied to F-08 summary route; TEST-F08-05 tests authenticated role/ownership and privacy. |
| SR-02 | Persistent Integrity, Atomicity, and Concurrency | Single PostgreSQL statement snapshot, aggregate reconciliation, no writes; TEST-F08-02 through 04. Whole-product concurrency regression remains Sprint 3 integration work. |
| SR-03 | Accessible Workflow State and Error Communication | F-08 loading, empty, failure, retry, refresh, keyboard, and responsive behavior; TEST-F08-06/07 plus final manual viewport walkthrough. |
| SR-04 | Traceable Contracts and Reproducible Verification | Maintain approved contract version, AC/STS-to-executed-result links, tested SHA, substantive peer review, and release record. Approval is not yet evidenced. |
| SR-05 | Deployment Readiness, Configuration, and Secret Safety | Existing shared responsibility from Lab 5; no new F-08 configuration or secret is proposed. Exact release/deployment evidence remains in the integrated release work, not a new feature contract. |
| SR-06 | Reproducible Performance Engineering | NFR-07 keeps its existing F-03 operation set and proposed workload. D-12 target approval and TEST-SR06-01 remain outstanding; F-08 adds no performance target. |

## 13. Definition of Done

- D-10 and BR-18 are approved or revised with rationale; applicable Q-10 scope remains explicit. SRS, Feature Inventory, traceability, contract history, and review record agree.
- Student 1 completes a substantive review before implementation; the review artifact records findings/questions and disposition. Student 1's assignment in the Issue is not itself evidence of review.
- The final accepted F-08 contract, AC, STS, permission rules, query design, and API/UI behavior precede implementation.
- The owning Organizer can retrieve all required aggregates from real committed PostgreSQL records. Calculations satisfy the approved definitions and use a consistent snapshot.
- Authorization and non-disclosure outcomes pass direct API integration tests. Summary reads are read-only and do not return Participant-level data.
- UI loading/empty/error/retry/refresh/N/A states are keyboard accessible and responsive. Existing F-04 active/history separation and F-07 controls remain intact.
- Every accepted AC maps to actual unit/integration/E2E results. At least the meaningful checkpoint rule passes on the recorded tested SHA; no planned/unexecuted test is reported as passed.
- Where practical, write the meaningful calculation/security test before its implementation, record the failing RED and passing GREEN executions with commands and commit SHAs, and preserve the test assertion unchanged. If the team determines TDD is not practical for a specific item, record the reason before implementation.
- Relevant unit, isolated PostgreSQL integration, Playwright, typecheck, Prisma validation, build, and F-01 to F-07 regression checks run on the candidate; failures/skips and environment limits are reported.
- SR-06 measurement and final NFR/release checks are recorded under their approved thresholds, or accurately marked open.
- A reviewer-approved feature PR is integrated only after the team confirms the Sprint 3 PR base and the Sprint 2 release dependency. No author self-approval or merge is claimed.
- Evidence includes test commands/results, tested commit SHA, API response or actual screenshot when available, unresolved gaps, owners, and dates no later than 2026-12-13.

## 14. Risks, open dependencies, and approval checklist

| ID | Status | Required next action | Owner / target |
| --- | --- | --- | --- |
| DEC-F08-01 / D-10 | Proposed | Approve or revise event-level lifecycle/attendance reporting scope and no-export boundary; record the decision. | Team; 2026-11-28 |
| DEC-F08-02 / BR-18 | Proposed | Approve or revise record-count definitions, active-only attendance numerator/denominator, one-decimal rounding, zero-active API null/UI N/A, one-snapshot rule, and ownership visibility. | Team; 2026-11-28 |
| REVIEW-F08-01 | Pending | Student 1 reviews the full contract and test design; record reviewer findings and dispositions. | Student 1; 2026-11-28 |
| DEP-F08-01 | Pending | Record formal Sprint 2 release acceptance or a team-approved decision on the Sprint 3 dependency. | Release owners; 2026-11-29 |
| DEP-F08-02 | Pending | Identify the Sprint 3 staging/PR target and CI coverage. No sprint-3-staging branch exists in the inspected refs. | Team; 2026-11-29 |
| DEC-SR06-01 / D-12 | Proposed | Confirm or revise the NFR-07 target before using it as a pass/fail threshold. | Team; before measurement, target 2026-12-08 |
| RISK-F08-01 | Open | Separate F-08 data correctness from data-retention duration: Q-10 applies only to synthetic project/assessment data; production policy remains separate. | Team; before any production use |

Implementation remains gated until DEC-F08-01, DEC-F08-02, REVIEW-F08-01, DEP-F08-01, and DEP-F08-02 have recorded dispositions.

## 15. Version and decision history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-27 | Draft - Review Ready; pending team policy decisions and Student 1 review | Prepared the pre-implementation Feature-Level SDS, proposed API/UI/data behavior, AC-F08-01 through 06, TEST-F08-01 through 07, cross-cutting TEST-SR06-01, DoD, Sprint 3 scope audit, and dependency/approval register. No policy was accepted and no F-08 runtime code or test was implemented. |

## References

- [SRS](../../srs.md), especially FR-22/23, BR-02/09/18, D-10/D-12, Q-10, and the Sprint 3 allocation.
- [Feature Inventory](../../features.md), [Requirements Traceability Matrix](../../traceability.md), and [Sprint Plan](../plan.md).
- [System-Level SDS](../../system-sds.md) and [Sprint 3 progress/evidence](remaining-work.md).
- [Group Work Specification](../../group_work_specs_v1.pdf), Section 8.2 page 10, Section 8.3 page 11, Section 7 page 9, and Deliverable 2 Part C page 12. This repository copy is labelled a draft for instructor review.
- Accepted [F-05](../sprint-2/f-05-capacity-deadline.md), [F-06](../sprint-2/f-06-registration-cancellation.md), and [F-07](../sprint-2/f-07-organizer-check-in.md) contracts.
