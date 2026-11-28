# OBS-07 evidence — Issue #67

## Traceability

- GitHub issue: [#67 — Duplicate participant display names in production demo accounts](https://github.com/Ttime52/EventCheck/issues/67).
- UAT finding: `UAT-03` / `OBS-07`, reported by `Sec01-Team047`.
- Triage: accepted; Minor; **Test Data Configuration Issue**; disposition **Fix Test Data**.
- Feature context: Sprint 1 event discovery, full-capacity registration test, and Participant display names in the Organizer registration list. See [UAT-03](../../../../uat/sprint-1/uat-test-cases.md) and the issue's accepted triage.
- Tested baseline: `origin/sprint-1-staging`, base commit `7fb3620f2288b4062ccffa88c262bee42207dab5`.
- Working branch: `fix/uat-obs07-display-names`.

## Finding and root cause

Issue #67 reports two distinct synthetic Participant accounts, `participant-demo@example.com` and `participant-b@example.test`, that both have the display name `Production Demo Participant`. The issue's triage found no evidence of an authorization or data-isolation defect. Existing account provisioning in `server/src/production-provisioning.ts` deliberately leaves matching existing accounts unchanged, so rerunning that provisioning command would not correct the labels. This is a test-data configuration update; no confirmed application defect was reproduced.

## Change and safeguards

The new `db:update-uat-display-names` maintenance command handles only the two exact login identifiers reported in the issue. It validates that both accounts are present exactly once, have the Participant role, resolve to distinct User IDs, and have either the reported duplicate name or their respective already-correct name. It updates only `User.displayName` in a serializable transaction, is idempotent, and aborts if an account is missing or has unexpected data. It does not change IDs, login identifiers, roles, password hashes, sessions, registrations, foreign keys, schemas, or API contracts.

The command defaults to a read-only plan. Before constructing a database client it requires `NODE_ENV=production`, `EVENTCHECK_DEPLOYMENT_ENV=uat`, a PostgreSQL `DATABASE_URL`, and a separate `EVENTCHECK_EXPECTED_DATABASE_TARGET` that exactly matches the credential-free host/database/schema identity parsed from that URL. Local database targets are rejected. Applying writes additionally requires both `--apply` and `--confirm-uat-database`.

**No deployed database was connected to or changed for this work.** The CLI was not run against any database. The tests below use an in-memory mocked Prisma client; they are not a live-UAT dry run or the independent UAT retest.

## RED/GREEN and UI evidence

RED/GREEN evidence is **not applicable** for this finding. Triage classified OBS-07 as a test-data configuration issue rather than a confirmed application defect, and the task explicitly prohibits fabricating RED/GREEN. No failing defect-reproduction test or before/after deployment screenshot is claimed. The mocked tests verify the maintenance command's safety and data invariants.

Browser screenshots are **Pending**: the checked-in UAT handoff has no confirmed deployed URL/revision, and this work did not access a deployed UAT environment. No screenshot evidence was fabricated.

## Automated verification

Exact outputs are preserved in this directory. The original PowerShell captures are retained unchanged as `.txt`; UTF-8 text copies linked below are provided for direct review. Un-suffixed logs are the first verification pass; `*-final` logs are the final rerun after the database-target guard was tightened.

| Command | Result | Output |
| --- | --- | --- |
| `npm.cmd run test --workspace server -- src/uat-display-name-update.test.ts --reporter=verbose` | 10 passed, 0 failed. Covers read-only planning, exact update fields, preservation of IDs/logins/roles/password hashes/registrations, idempotence, transaction rollback, fail-safe account validation, environment target checks, and required apply flags. | [mocked-targeted-final.log](mocked-targeted-final.log) |
| `npm.cmd run test --workspace server -- src/production-provisioning.test.ts --reporter=verbose` | 13 passed, 0 failed. | [provisioning-regression-final.log](provisioning-regression-final.log) |
| `npm.cmd test` | Server: 48 passed, 41 skipped; client: 28 passed, 0 skipped; overall exit code 0. The 41 skipped server integration tests require an integration database. | [full-test-suite-final.log](full-test-suite-final.log) |
| `npm.cmd run typecheck` | Server and client TypeScript checks passed; exit code 0. | [typecheck-final.log](typecheck-final.log) |
| `npm.cmd run build` | Server TypeScript build and client Vite production build passed; exit code 0. | [build-final.log](build-final.log) |
| `git diff --check` | Passed; exit code 0. | [diff-check.log](diff-check.log) |
| GitHub Actions run `46115631896` | Passed on PR head `a0ea459aa1e94663b2db8188f78124e86b5fa487`; backend unit/integration, frontend tests/typecheck/build, Playwright E2E, and Docker build all passed. | [CI result record](ci-status.log), [workflow run](https://github.com/Ttime52/EventCheck/actions/runs/46115631896) |

All automated tests used the working tree based on `7fb3620f2288b4062ccffa88c262bee42207dab5`. No test configured a database connection.

## Operator runbook — pending environment owner review

1. Confirm from the approved UAT deployment configuration that the service and database are the isolated, non-production UAT target. Confirm account presence and the two exact login identifiers. Do not infer this from a local checkout or issue text.
2. In the approved secure operator environment, set the deployment's existing database URL without printing it, set `NODE_ENV=production` and `EVENTCHECK_DEPLOYMENT_ENV=uat`, then set `EVENTCHECK_EXPECTED_DATABASE_TARGET` to the independently verified credential-free host/database/schema identity.
3. Review the read-only plan:

   ```powershell
   npm.cmd run db:update-uat-display-names --workspace server -- --dry-run
   ```

   It must list only the two issue-reported accounts and their intended labels. Stop if the target cannot be verified or the plan differs.

4. After environment owner approval and a second review of the same target, explicitly apply:

   ```powershell
   npm.cmd run db:update-uat-display-names --workspace server -- --apply --confirm-uat-database
   ```

5. Verify through the approved UAT account and Organizer UI that the labels are distinct. The environment owner should verify the same User IDs and unchanged roles, password hashes, sessions, registrations, and foreign-key references through its approved, read-only method. Do not include credentials or connection strings in evidence.

These are **manual steps only**. The current work did not run either command against UAT, did not deploy, and did not alter any database.

## Changed files

- `server/src/uat-display-name-update.ts` — validation, read-only plan, guarded transactional update, environment identity check, and CLI argument policy.
- `server/prisma/update-uat-display-names.ts` — guarded maintenance CLI.
- `server/src/uat-display-name-update.test.ts` — mocked safety and invariant tests.
- `server/package.json` — maintenance script entry.
- `docs/uat/sprint-1/uat-handoff.md` and `docs/uat/sprint-1/uat-test-cases.md` — issue-reported Participant labels and deployment-confirmation notes.
- `docs/labs/lab-06/evidence/obs-07/` — test/build logs, verified CI result record, review description, and this report.

## Review and release status

- Fix commit: [`7a25ae8154ac95111521f42fdf279bd1f94ce20f`](https://github.com/Ttime52/EventCheck/commit/7a25ae8154ac95111521f42fdf279bd1f94ce20f).
- Draft PR targeting `sprint-1-staging`: [#70](https://github.com/Ttime52/EventCheck/pull/70).
- CI: [run `46115631896` passed](https://github.com/Ttime52/EventCheck/actions/runs/46115631896) on commit `a0ea459aa1e94663b2db8188f78124e86b5fa487`. Recheck [PR #70](https://github.com/Ttime52/EventCheck/pull/70) for the latest head before approval/merge.
- UAT database plan/apply: **Pending environment owner review and approval**; no database has been changed.
- Deployment: **Pending**.
- Independent UAT retest: **Pending**. Sec01-Team047 must retest after the corrected test data is approved and available in the deployed UAT environment. No PASS is claimed.
