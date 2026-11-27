# Issue 18 - PR Description Draft

**Purpose:** Review-ready local PR description for the checkpoint-limited F-08 API slice. It is not a submitted GitHub PR and has not received peer review.

## Proposed title

F-08: add owner-scoped Event Summary API

## Base branch and submission status

The base branch is **pending team decision**. No `sprint-3-staging` branch or matching CI target exists; the current pull request workflow targets `sprint-1-staging`, `sprint-2-staging`, and `main`. The Sprint 2 release acceptance dependency also remains unresolved. Do not infer the integration target from the feature branch's Sprint 2 staging ancestor.

No GitHub PR was created in this work session: the available `gh` credential is invalid and GitHub access is blocked by the current network environment. Peer review, approval, merge, and release-candidate integration are therefore not claimed. The tested implementation commit is `25664f864a5b70a2d6fc1675c0c663a61a0d80bd` on the local feature branch; it has not been pushed.

## Summary

- Adds `GET /api/v1/organizer/events/:eventId/summary`, protected by the existing session and Organizer role middleware.
- Filters the Event using both the route ID and authenticated Organizer ID. Malformed, nonexistent, and non-owned Event IDs return the same `404 EVENT_NOT_FOUND` response.
- Uses one parameterized PostgreSQL statement for capacity, ACTIVE/CANCELLED record totals, and checked-in ACTIVE count. It returns aggregate fields only and does not write or expose Participant/Registration/Attendance rows.
- Adds a pure calculation helper for remaining seats, not-checked-in count, rate rounding, zero-active null rate, and safe-integer/invariant checks.
- Adds unit and isolated PostgreSQL API tests and includes the F-08 suite in the guarded server integration runner.
- Does not add a migration or wire the API into the existing UI. F-08 remains partial.

## Contract and policy status

- Feature contract v0.4 is a draft; its v0.1 SDS/AC/STS/DoD was committed before source/test implementation at `5c8ca563fea5b9a9f87a785de7dde875990838dd`.
- D-10 and BR-18 remain **Proposed**. This slice implements the documented provisional calculations under the user's direct checkpoint instruction; it does not approve those rules or accept the feature.
- Student 1 is the requested reviewer; no independent review record exists. Review the contract and implementation before any merge or acceptance.
- The Feature Inventory and SRS allocate F-08 as the only new Sprint 3 feature. F-01 to F-07 remain integration/regression scope. SR-01 to SR-06 are addressed in the contract without adding scope.

## AC-to-test status

| Draft AC | Evidence | Status |
| --- | --- | --- |
| AC-F08-01 | `TEST-F08-02`: committed ACTIVE/CANCELLED records, including two cancelled rows for one Participant | Verified against draft wording; D-10/BR-18 acceptance remains pending |
| AC-F08-02 | `TEST-F08-01/02`: capacity minus ACTIVE count | Verified against draft wording; policy acceptance remains pending |
| AC-F08-03 | `TEST-F08-01/02`: active checked-in and not-checked-in arithmetic | Partial API verification; lifecycle E2E remains open |
| AC-F08-04 | `TEST-F08-01/02` and zero-active API test: one-decimal rate and null API rate | API verified; UI N/A behavior not implemented |
| AC-F08-05 | `TEST-F08-05`: anonymous, wrong role, non-owner, malformed/nonexistent ID, expired/revoked session | Verified for tested API behavior; peer review and UI path remain open |
| AC-F08-06 | `TEST-F08-02`: meaningful summary derived from committed PostgreSQL rows | Verified against draft wording at source commit `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`; draft AC remains unaccepted |

ACs remain draft and are not accepted. `TEST-F08-03`, concurrent-writer portion of `TEST-F08-04`, `TEST-F08-06` UI, `TEST-F08-07` Playwright, and `TEST-SR06-01` were not run.

## Verification performed

PostgreSQL tests used a temporary PostgreSQL 18 cluster bound to `127.0.0.1:5433` and a newly created `eventcheck_test` database, with the seven existing migrations applied. The project `eventcheck` database and the service on port 5432 were not used.

- `npm.cmd run test --workspace server -- src/event-summary.test.ts` - 2/2 unit tests passed.
- `npm.cmd run test --workspace server -- src/f08.integration.test.ts` - 3/3 isolated PostgreSQL tests passed.
- `npm.cmd run test:integration --workspace server` - 90/90 PostgreSQL integration tests passed; F-06 built-API restart verification passed.
- `npm.cmd run typecheck` - server and client passed.
- `npm.cmd run build` - server and client passed.
- `npm.cmd run prisma:validate` - passed.

The initial F-08 database fixture attempt violated the existing one-ACTIVE-registration-per-Participant/Event index. The fixture was corrected to use a third Participant; the F-08 rerun and full integration suite passed. This was a test-fixture correction, not an application failure. The tested implementation commit is `25664f864a5b70a2d6fc1675c0c663a61a0d80bd`; source was unchanged between test execution and commit.

## Reviewer checklist

- Review the contract's proposed formulas, authorization boundary, one-statement snapshot, response shape, and safe integer handling.
- Confirm D-10/BR-18 definitions with the team; preserve their Proposed status until an actual decision is recorded.
- Review F-08 AC/STS against F-01/F-04/F-06/F-07 behaviors and verify the tests remain isolated to `eventcheck_test/public`.
- Confirm the branch base, Sprint 2 release dependency, CI behavior, and reviewer/author split.
- Review remaining UI, lifecycle, concurrent-writer and Playwright work before full-feature acceptance.

## Remaining work to 2026-12-13

- By 2026-11-29: Student 1/team review; decide or explicitly keep D-10/BR-18 open; confirm the PR target and Sprint 2 dependency disposition.
- By 2026-12-06: implement the Organizer UI loading/error/retry/refresh and N/A states, keeping active rows and cancelled history separate.
- By 2026-12-09: run lifecycle-transition, concurrent snapshot, UI/accessibility, and Playwright cases; update AC/STS evidence and exact tested SHA.
- By 2026-12-10: decide D-12/NFR-07 threshold and run its existing F-03 workload, or report it open.
- By 2026-12-12: complete peer-reviewed PR, CI, candidate regression, release/deployment evidence, or report any unavailable gate.
- By 2026-12-13: assemble and verify the Deliverable 2 PDF and record final F-08 status/residual debt.

## Approval state

**Ready for peer review locally; not peer reviewed, not submitted, not merged, and not integrated into the Deliverable 2 release candidate.**
