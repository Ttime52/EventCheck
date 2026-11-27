# Sprint 2 AC Verification Matrix

**Scope:** Accepted F-05 v0.6, F-06 v0.5, and F-07 v0.5 contracts
**Evidence source:** [Issue 15 integration, regression and E2E report](integration-verification.md)
**Implementation/test SHA:** `107c93eafbc5c2afb29527336665a6d38269c478`
**Current staging HEAD:** `f08177c1cf4d9820846a72ef1fc1bcff55c9b96b` (PR #61 merge)
**Verification recorded:** 2026-11-27

This table transcribes the feature-level AC-to-STS execution evidence from Issue 15 and adds implementation and release status. The test report records 12/12 automated F-05 checks, 13/13 F-06 ACs, and 12/12 F-07 ACs as passing. AC-F05-13 is a manual review criterion, not an automated test. Results below are historical evidence reported for the listed tested commit; this documentation update did not run the application tests. No Sprint 2 release tag or formal release acceptance record was found. PR #61 integrated the tested tree into `sprint-2-staging`; Issue 17 still owns final-candidate release verification.

## F-05 — Capacity and Registration Deadline

| AC ID / requirements | Implementation | STS | Actual executed test | Result and tested version | Release / remaining gap |
| --- | --- | --- | --- | --- | --- |
| AC-F05-01 — FR-10, BR-02/15 | IMPLEMENTED | TEST-F05-01 | `server/src/f05.integration.test.ts` owner update; `e2e/f05-capacity-deadline.spec.ts`; joined `e2e/f06-registration-cancellation.spec.ts` | PASS; owner update persisted; public projection and joined journey agreed. `107c93e` | No accepted Sprint 2 release recorded; repeat on Issue 17 candidate. |
| AC-F05-02 — FR-10, BR-02, NFR-01 | IMPLEMENTED | TEST-F05-02 | `server/src/f05.integration.test.ts` role/session/Origin matrix | PASS; visitor, Participant, expired session, non-owner, and invalid Origin were denied with unchanged Event state. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-03 — FR-10, BR-05/11 | IMPLEMENTED | TEST-F05-03 | `server/src/f05.integration.test.ts` partial-field validation; F-05 browser validation | PASS; malformed/invalid requests rejected atomically; valid deadline-only and clear operations persisted. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-04 — FR-10, BR-09/15 | IMPLEMENTED | TEST-F05-04 | `server/src/f05.integration.test.ts` ACTIVE/CANCELLED capacity count case | PASS; capacity increase preserved history and remaining-seat calculation. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-05 — FR-10, BR-09/11/15 | IMPLEMENTED | TEST-F05-05 | `server/src/f05.integration.test.ts` below-active reduction case | PASS; rejected reduction preserved capacity, ACTIVE IDs, and CANCELLED row. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-06 — FR-10, BR-15 | IMPLEMENTED | TEST-F05-06 | `server/src/f05.integration.test.ts` controlled start boundary | PASS; pre-start edit succeeded; exact/after-start edits conflicted without mutation. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-07 — FR-10, BR-14/11 | IMPLEMENTED | TEST-F05-07 | `server/src/f05.integration.test.ts` deadline validation/time-zone cases | PASS; accepted deadline-only/clear behavior and atomic rejection of invalid/order-violating values. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-08 — FR-12/13/16, BR-14 | IMPLEMENTED | TEST-F05-08 | `server/src/f05.integration.test.ts`, `server/src/events.test.ts`, `e2e/f05-capacity-deadline.spec.ts` | PASS; public deadline/open fields and capacity availability semantics matched; closed UI passed. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-09 — FR-13/16, BR-14 | IMPLEMENTED | TEST-F05-09 | `server/src/f05.integration.test.ts` fixed-clock registration boundary; `e2e/f05-capacity-deadline.spec.ts` | PASS; before deadline accepted; exact/after rejected with no row/place consumption. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-10 — BR-09/10/11, NFR-05 | IMPLEMENTED | TEST-F05-10 | `server/src/f05.integration.test.ts` PostgreSQL Event-row lock case; F-03 last-seat regression | PASS; PostgreSQL blocker observed and committed capacity invariant held. `107c93e` | Same release gate; concurrency evidence is limited to what `pg_blocking_pids()` observed, as detailed in Issue 15. |
| AC-F05-11 — BR-11, NFR-04/06 | IMPLEMENTED | TEST-F05-11 | `server/src/f05.integration.test.ts` rejection and injected-failure rollback cases | PASS; Event fields, registrations, and counts matched pre-request snapshots after failures. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F05-12 — FR-12, NFR-04/08 | IMPLEMENTED | TEST-F05-12 | `server/scripts/f05-restart-check.mjs`; F-05 browser/keyboard cases and joined E2E | PASS; browser checks reran on `107c93e`; restart check last ran on `b9df85c` and was not repeated in Issue 15's final rerun. | Same release gate; repeat restart check on Issue 17 candidate. |
| AC-F05-13 — BR-02/05/09/14/15, NFR-01/05/09/10 | Evidence criterion only | TEST-F05-13 (manual review) | Manual review of contract v0.6, migration, AC/STS links, test evidence, and boundaries recorded in Issue 15 | PASS as manual evidence review; not an automated test. `107c93e` evidence set | Manual review does not record feature release acceptance; Issue 17 release gate remains. |

## F-06 — Registration Cancellation and Re-registration

| AC ID / requirements | Implementation | STS | Actual executed test | Result and tested version | Release / remaining gap |
| --- | --- | --- | --- | --- | --- |
| AC-F06-01 — FR-05/17, BR-03/04, NFR-01/03 | IMPLEMENTED | TEST-F06-01 | `server/src/f06.integration.test.ts` ownership, role, session, Origin, and body checks | PASS; denied requests returned safe outcomes and left row snapshot unchanged. `107c93e` | No accepted Sprint 2 release recorded; repeat on Issue 17 candidate. |
| AC-F06-02 — FR-17, BR-13/14, D-08, Q-04/11 | IMPLEMENTED | TEST-F06-02 | `server/src/f06.integration.test.ts` cancel-after-deadline case | PASS; before-start cancellation after deadline persisted UTC `cancelledAt`. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-03 — FR-17, BR-13, D-08, Q-04/11 | IMPLEMENTED | TEST-F06-03 | `server/src/f06.integration.test.ts` exact-start boundary | PASS; before-start accepted, exact/after-start denied without state/count change. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-04 — FR-17, BR-09/13, Q-04 | IMPLEMENTED | TEST-F06-04, TEST-F06-11 | `server/src/f06.integration.test.ts` retry and repeated cancellation cases | PASS; retries returned original timestamp and released capacity once. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-05 — FR-17, BR-11/13 | IMPLEMENTED | TEST-F06-05, TEST-F06-13 | `server/src/f06.integration.test.ts`; shared-lock check in `server/src/f07.integration.test.ts` | PASS; check-in prevented cancellation and persisted state remained unchanged; race cases passed. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-06 — FR-17, BR-09 | IMPLEMENTED | TEST-F06-03/04/06/11 | `server/src/f06.integration.test.ts` capacity-release and retry assertions | PASS; exactly one place released, then remained stable. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-07 — FR-14/17, BR-11, NFR-04, Q-10 | IMPLEMENTED | TEST-F06-07 | `server/src/f06.integration.test.ts`; `server/scripts/f06-restart-check.mjs` | PASS; cancelled ID/status/times persisted after fresh reads and API restart. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-08 — FR-18, BR-08/09/14, Q-06 | IMPLEMENTED | TEST-F06-08/12/15; TEST-I15-E2E-01 | `server/src/f06.integration.test.ts`; `e2e/f06-registration-cancellation.spec.ts` | PASS; re-registration made a new ACTIVE row and retained cancelled history in DB and reload UI. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-09 — FR-16/18, BR-08/09/14/15, Q-03/06 | IMPLEMENTED | TEST-F06-09, TEST-F06-10 | `server/src/f06.integration.test.ts` deadline/full/duplicate cases | PASS; rejected attempts created no extra row or place use. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-10 — FR-17/18, BR-08/09/11, NFR-05, Q-04/06 | IMPLEMENTED | TEST-F06-11/12; TEST-I15-02 | `server/src/f06.integration.test.ts` synchronized lifecycle and last-place races | PASS; a PostgreSQL waiter was observed while launched HTTP promises remained pending; one last-seat request succeeded and one conflicted. `107c93e` | Same release gate; concurrency observation limitation is retained in Issue 15. |
| AC-F06-11 — FR-17/19, BR-11/13/16, NFR-05 | IMPLEMENTED | TEST-F06-13; TEST-F07-09 | `server/src/f06.integration.test.ts`; `server/src/f07.integration.test.ts` | PASS; lock order yielded valid before-start/exact-start final states only. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-12 — FR-17/18, BR-11, NFR-06 | IMPLEMENTED | TEST-F06-14 | `server/src/f06.integration.test.ts` injected trigger failure | PASS; safe failure left ACTIVE status, null cancellation time, attendance, and count unchanged. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F06-13 — FR-14/17/18, NFR-08 | IMPLEMENTED | TEST-F06-15; TEST-I15-E2E-01 | `client/src/App.test.tsx`; `e2e/f06-registration-cancellation.spec.ts` | PASS; component checks and joined cancellation/re-registration/check-in browser journey passed. `107c93e` | Same release gate; no AC-specific defect recorded. |

## F-07 — Organizer Check-in and Attendance Retrieval

| AC ID / requirements | Implementation | STS | Actual executed test | Result and tested version | Release / remaining gap |
| --- | --- | --- | --- | --- | --- |
| AC-F07-01 — FR-15/19/21, BR-02/17, NFR-01/08 | IMPLEMENTED | TEST-F07-01/11 | `server/src/f07.integration.test.ts`; `e2e/f07-check-in.spec.ts` | PASS; owner scope and UI loading/empty/error/retry states passed. `107c93e` | No accepted Sprint 2 release recorded; repeat on Issue 17 candidate. |
| AC-F07-02 — FR-19, BR-02/09/16, NFR-04, Q-05 | IMPLEMENTED | TEST-F07-01/11; TEST-I15-E2E-01 | `server/src/f07.integration.test.ts`; `e2e/f07-check-in.spec.ts`; joined F-06 E2E | PASS; single Attendance with matching associations/time persisted; active capacity unchanged. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-03 — FR-19/20, BR-16, D-08, Q-05/11 | IMPLEMENTED | TEST-F07-02/11 | `server/src/f07.integration.test.ts`; six browser time-boundary cases | PASS; server `[startAt,endAt)` cases and browser boundary presentation passed. `107c93e` | Same release gate; browser clock is presentation-only; server time is tested in integration. |
| AC-F07-04 — FR-20, BR-11/16 | IMPLEMENTED | TEST-F07-03 | `server/src/f07.integration.test.ts` cancelled, missing, and wrong-Event cases | PASS; safe rejection and unchanged snapshots. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-05 — FR-05/19/20, BR-02/03/04, NFR-01/03, Q-05 | IMPLEMENTED | TEST-F07-04 | `server/src/f07.integration.test.ts` auth/owner/Origin/privacy matrix | PASS; 401/403/404/CSRF outcomes, privacy, and no unauthorized writes asserted. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-06 — FR-19/20, BR-17, NFR-05 | IMPLEMENTED | TEST-F07-05 | `server/src/f07.integration.test.ts` sequential/concurrent duplicate check-in | PASS; one 201, one 409, and one Attendance row. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-07 — FR-21, BR-02, NFR-01 | IMPLEMENTED | TEST-F07-06/11 | `server/src/f07.integration.test.ts`; `e2e/f07-check-in.spec.ts` | PASS; event scoping, ordering, explicit empty state, owner concealment, and UI retries passed. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-08 — FR-21, BR-03/04, NFR-01/08 | IMPLEMENTED | TEST-F07-07/12; TEST-I15-E2E-01 | `server/src/f07.integration.test.ts`; F-07 and joined E2E | PASS; own record/null, cross-participant 404, and reload state passed. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-09 — FR-19/21, BR-11, NFR-04, Q-10 | IMPLEMENTED | TEST-F07-08 | `server/scripts/f07-restart-check.mjs` | PASS; Organizer and Participant reads returned the same attendance record after restart. Restart check last ran on `b9df85c`, not repeated in Issue 15's final rerun; same application code is stated by Issue 15. | Repeat restart check on Issue 17 candidate. |
| AC-F07-10 — FR-17/19/20, BR-11/13/16, NFR-05 | IMPLEMENTED | TEST-F07-09 | `server/src/f07.integration.test.ts`; `server/src/f06.integration.test.ts` | PASS; PostgreSQL race cases did not produce a CANCELLED registration with Attendance. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-11 — FR-19/20, BR-11, NFR-06 | IMPLEMENTED | TEST-F07-10 | `server/src/f07.integration.test.ts` failure-after-insert rollback | PASS; safe 500, no committed Attendance, unchanged ACTIVE row, and successful recovery request. `107c93e` | Same release gate; no AC-specific defect recorded. |
| AC-F07-12 — FR-19/21, NFR-08 | IMPLEMENTED | TEST-F07-11/12; TEST-I15-E2E-01 | `client/src/App.test.tsx`; `e2e/f07-check-in.spec.ts`; joined F-06 E2E | PASS; accessible Organizer/Participant states and derived counts were exercised in the full browser run. `107c93e` | Same release gate; full F-08 summary scope is tracked as partial separately. |

## Execution summary and release boundary

Issue 15 reports, on implementation SHA `107c93eafbc5c2afb29527336665a6d38269c478`:

- PostgreSQL integration: 87 passed, 0 failed, 0 skipped.
- Server unit tests: 44 passed; 87 database cases were intentionally skipped in the no-`DATABASE_URL` unit invocation and ran in the integration command.
- Client component tests: 29 passed.
- Playwright E2E: 30 passed, 0 failed, 0 skipped.
- Typecheck, build, Prisma validation, and restart checks: passed as detailed in [Issue 15 evidence](integration-verification.md). The F-05 and F-07 dedicated restart checks were last run on `b9df85c`; F-06 restart was part of the `107c93e` integration workflow.
- GitHub Actions run [45869394130](https://github.com/Ttime52/EventCheck/actions/runs/45869394130) passed on corrected documentation head `fda1a7726103997c3727a1e726a715b0d213547d`, which is based on the tested implementation.
- PR #61 merged the tested tree into `sprint-2-staging` at `f08177c`. No Sprint 2 release tag, deployment, or separate Issue 17 release acceptance record was found.
