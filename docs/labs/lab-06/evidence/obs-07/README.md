# OBS-07 evidence — Issue #67

## Traceability

- GitHub issue: [#67 — Duplicate participant display names in production demo accounts](https://github.com/Ttime52/EventCheck/issues/67).
- UAT finding: `UAT-03` / `OBS-07`, reported by `Sec01-Team047`.
- Triage: accepted; Minor; **Test Data Configuration Issue**; disposition **Fix Test Data**.
- Feature context: Sprint 1 event discovery, full-capacity registration test, and Participant display names in the Organizer registration list. See [UAT-03](../../../../uat/sprint-1/uat-test-cases.md) and the issue's accepted triage.
- Organizer scope: a later user request proposed `organizer-a@example.test` and `organizer-b@example.test` for distinct labels. PR #70 review says the independent report identifies Organizer A as `organizer-demo@example.com` and Organizer B is unverified. The original report is not checked in; these mappings must be reconciled with the environment owner. Organizer accounts are excluded from the maintenance operation until that is resolved.
- Tested baseline: `origin/sprint-1-staging`, base commit `7fb3620f2288b4062ccffa88c262bee42207dab5`.
- Working branch: `fix/uat-obs07-display-names`.

## Finding and root cause

Issue #67 reports two distinct synthetic Participant accounts, `participant-demo@example.com` and `participant-b@example.test`, that both have the display name `Production Demo Participant`. The issue's triage found no evidence of an authorization or data-isolation defect. Existing account provisioning in `server/src/production-provisioning.ts` deliberately leaves matching existing accounts unchanged, so rerunning that provisioning command would not correct the labels. This is a test-data configuration update; no confirmed application defect was reproduced.

The current maintenance scope is only the two Issue #67 Participant identifiers. A prior revision also included the two user-proposed Organizer identifiers. The PR #70 reviewer identified that scope as unverified: the review cites `organizer-demo@example.com` as report-identified Organizer A and says Organizer B has not been verified. The original report is unavailable in this checkout. The current revision removes Organizer accounts from the script and handoff test prerequisites until the authoritative mappings are confirmed; no Organizer account is included in an apply manifest.

## Change and safeguards

The `db:update-uat-display-names` maintenance command now handles only `participant-demo@example.com` and `participant-b@example.test`. The case-insensitive lookup detects duplicate/case-variant login identifiers; the command then requires each canonical login, expected Participant role, expected current/target label, and distinct User ID. A missing Organizer account cannot block the Participant correction. Writes occur only for the planned exact User ID, login identifier, and role in a serializable transaction. Only `User.displayName` changes; IDs, login identifiers, roles, password hashes, sessions, registrations, foreign keys, schemas, and API contracts are preserved.

The command defaults to a read-only plan. Before constructing a database client it requires `NODE_ENV=production`, `EVENTCHECK_DEPLOYMENT_ENV=uat`, a PostgreSQL `DATABASE_URL`, and `EVENTCHECK_EXPECTED_DATABASE_TARGET` matching the credential-free host/port/database/schema parsed from that URL. Local database targets are rejected. Apply mode additionally requires both `--apply` and `--confirm-uat-database`, plus `EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL`, a JSON manifest containing the same verified database target and the exact expected User IDs for both Participant logins. The manifest is rejected if it names another database, omits/adds an account, contains duplicate IDs, or does not match the IDs read inside the transaction. The CLI prints User IDs in its dry-run plan so the environment owner can compare them with the separately approved identity record; no actual production/UAT IDs are stored in this repository.

**No deployed database was connected to or changed for this work.** The CLI was not run against any database. The tests below use an in-memory mocked Prisma client; they are not a live-UAT dry run or the independent UAT retest.

## RED/GREEN and UI evidence

RED/GREEN evidence is **not applicable** for this finding. Triage classified OBS-07 as a test-data configuration issue rather than a confirmed application defect, and the task explicitly prohibits fabricating RED/GREEN. No failing defect-reproduction test or before/after deployment screenshot is claimed. The mocked tests verify the maintenance command's safety and data invariants.

The first development run of the earlier Organizer extension exposed a missing expected-role value in the Participant A mapping (4 test failures); that implementation error was corrected and the same suite then passed. This was ordinary development feedback, not a RED reproduction of OBS-07. The Organizer extension has since been removed from the current PR scope pending mapping verification. See the preserved [initial failure output](organizer-support-targeted-failure.txt) and [passing rerun](organizer-support-targeted-fixed.log).

Browser screenshots are **Pending**: the checked-in UAT handoff has no confirmed deployed URL/revision, and this work did not access a deployed UAT environment. No screenshot evidence was fabricated.

## Automated verification

Exact PowerShell capture files are preserved unchanged as UTF-16 `.txt` files; matching UTF-8 `.log` copies are linked for direct review with only line-ending and trailing-whitespace normalization. Existing logs remain historical records of the earlier four-account implementation and review-head CI. New `review-fix-*` logs record the participant-only review response. All tests use a mocked Prisma client; they do not prove that a live UAT database is safe or that any deployed account was changed.

| Command | Result | Output |
| --- | --- | --- |
| `npm.cmd run test --workspace server -- src/uat-display-name-update.test.ts --reporter=verbose` | **18 passed, 0 failed**. Covers participant-only scope, missing Organizers, case-insensitive collisions, exact ID approval, database-target binding, rollback, and idempotence. | [UTF-8 log](review-fix-verified-targeted.log), [raw capture](review-fix-verified-targeted.txt) |
| `npm.cmd run test --workspace server -- src/production-provisioning.test.ts --reporter=verbose` | **13 passed, 0 failed**. | [UTF-8 log](review-fix-final-provisioning-rerun.log), [raw capture](review-fix-final-provisioning-rerun.txt) |
| `npm.cmd test` | Server: **56 passed, 41 skipped**; client: **28 passed, 0 skipped**; command exit code 0. The skipped server integration tests require an integration database. | [UTF-8 log](review-fix-verified-suite.log), [raw capture](review-fix-verified-suite.txt) |
| `npm.cmd run typecheck` | Server and client TypeScript checks passed; exit code 0. | [UTF-8 log](review-fix-verified-typecheck.log), [raw capture](review-fix-verified-typecheck.txt) |
| `npm.cmd run build` | Server TypeScript and client Vite production builds passed; exit code 0. | [UTF-8 log](review-fix-verified-build.log), [raw capture](review-fix-verified-build.txt) |
| `git diff --check` | Passed with exit code 0. | [UTF-8 log](review-fix-verified-diff-check-rerun.log), [raw capture](review-fix-verified-diff-check-rerun.txt) |
| `npm.cmd run typecheck --workspace server` | Server TypeScript passed, exit code 0; targeted run before the full workspace verification. | [review-fix-typecheck.txt](review-fix-typecheck.txt) |
| Historical targeted maintenance run | 10 passed on the earlier four-account Organizer extension; superseded by the participant-only review-response test above. | [organizer-support-final-targeted.log](organizer-support-final-targeted.log) |
| GitHub Actions run `46115631896` | Passed on the earlier Participant-only PR head `a0ea459aa1e94663b2db8188f78124e86b5fa487`. It does not cover the Organizer A/B follow-up extension. | [CI result record](ci-status.log), [workflow run](https://github.com/Ttime52/EventCheck/actions/runs/46115631896) |
| GitHub Actions run `46118119726` | Latest successful CI before the review-response changes; passed on the prior PR head `9976fdf739eeac899ae13dc4872dbf550bbc853a`. It does not verify the changes in this revision. | [Prior CI result](ci-status-followup.txt), [workflow run](https://github.com/Ttime52/EventCheck/actions/runs/46118119726) |

The review-response tests used the PR #70 working branch based on `7fb3620f2288b4062ccffa88c262bee42207dab5`. All tests used mocked/local test data; no test configured or connected to a UAT database.

Initial review-response runs are preserved in [review-fix-final-targeted.log](review-fix-final-targeted.log), [review-fix-full-suite.log](review-fix-full-suite.log), and [review-fix-final-suite.log](review-fix-final-suite.log), with raw UTF-16 captures in their matching `.txt` files. The new guard throws synchronously, while its first unit-test assertion expected a rejected Promise; that mismatch caused one test to fail before any transaction or write. The assertion was corrected to test the synchronous guard. No production code was changed for this test-harness correction; the exact targeted test and full suite were rerun successfully as shown above.

## Operator runbook — pending environment owner review

1. Confirm from the approved UAT deployment configuration that the service and database are the isolated, non-production UAT target. Confirm presence of the two exact Participant login identifiers. Do not infer this from a local checkout or issue text. Keep Organizer mapping separate until the independent report and environment owner resolve the `organizer-demo@example.com` versus `organizer-a@example.test` discrepancy and verify Organizer B.
2. In the approved secure operator environment, set the deployment's existing database URL without printing it, set `NODE_ENV=production` and `EVENTCHECK_DEPLOYMENT_ENV=uat`, then set `EVENTCHECK_EXPECTED_DATABASE_TARGET` to the independently verified credential-free host/database/schema identity.
3. Review the read-only plan:

   ```powershell
   npm.cmd run db:update-uat-display-names --workspace server -- --dry-run
   ```

   It must list only the two Issue #67 Participant accounts, their exact User IDs, expected roles, and intended labels. Stop if the target or account identities cannot be verified or any current name differs from the expected shared/target name. This plan makes no writes.

4. After the environment owner verifies both Participant IDs against that same database, set the exact approved manifest in the secure operator session. The values below are placeholders; do not commit real IDs or connection details:

   ```powershell
   $env:EVENTCHECK_UAT_DISPLAY_NAME_APPROVAL = '{"databaseTarget":"<verified host:port/database?schema=public>","userIds":{"participant-demo@example.com":"<Participant A User ID>","participant-b@example.test":"<Participant B User ID>"}}'
   ```

   The database target in the manifest must exactly match `EVENTCHECK_EXPECTED_DATABASE_TARGET` and the identity parsed from `DATABASE_URL`.

5. After environment-owner approval and a second review of the same target/IDs, explicitly apply:

   ```powershell
   npm.cmd run db:update-uat-display-names --workspace server -- --apply --confirm-uat-database
   ```

6. Verify through the approved UAT Participant accounts and Organizer registration UI that the names are distinct. The environment owner should verify the same User IDs and unchanged roles, password hashes, sessions, registrations, and foreign-key references through its approved, read-only method. Do not include credentials or connection strings in evidence. Organizer A/B data changes remain out of this command pending verified mapping and separate approval.

These are **manual steps only**. The current work did not run either command against UAT, did not deploy, and did not alter any database.

## Changed files

- `server/src/uat-display-name-update.ts` — validation, read-only plan, guarded transactional update, environment identity check, and CLI argument policy.
- `server/prisma/update-uat-display-names.ts` — guarded maintenance CLI.
- `server/src/uat-display-name-update.test.ts` — mocked safety and invariant tests.
- `server/package.json` — maintenance script entry.
- `docs/uat/sprint-1/uat-handoff.md` and `docs/uat/sprint-1/uat-test-cases.md` — Participant labels and the unresolved Organizer account mapping; unverified Organizer identifiers are not treated as UAT facts.
- `docs/labs/lab-06/evidence/obs-07/` — test/build logs, both CI result records, review description, and this report.

## Review and release status

- Code commits: [Participant maintenance setup `7a25ae8154ac95111521f42fdf279bd1f94ce20f`](https://github.com/Ttime52/EventCheck/commit/7a25ae8154ac95111521f42fdf279bd1f94ce20f) and [Organizer A/B extension `836cc74c13e820bd639ef2dcd390af78ae57a831`](https://github.com/Ttime52/EventCheck/commit/836cc74c13e820bd639ef2dcd390af78ae57a831).
- Draft PR targeting `sprint-1-staging`: [#70](https://github.com/Ttime52/EventCheck/pull/70).
- Latest prior successful CI: [run `46118119726`](https://github.com/Ttime52/EventCheck/actions/runs/46118119726) passed on pre-review head `9976fdf739eeac899ae13dc4872dbf550bbc853a`; it does not cover this review response. CI for the updated participant-only changes is **PENDING** until pushed and verified.
- Peer review: Changes requested by Kwanchanok Thungsuk on 28 November 2026. The four requests are recorded above: independent Participant targeting, unresolved Organizer mapping excluded pending confirmation, database/User-ID-bound approval plus case-insensitive collision detection, and corrected handoff/evidence.
- UAT database plan/apply: **Pending environment owner review and approval**; no database has been changed. No Organizer account was applied or otherwise modified.
- Deployment: **Pending**.
- Independent UAT retest: **Pending**. Sec01-Team047 must retest after the corrected test data is approved and available in the deployed UAT environment. No PASS is claimed.
