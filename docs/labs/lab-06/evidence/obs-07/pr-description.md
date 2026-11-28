# fix(uat): correct duplicate Participant demo names (OBS-07)

Related to #67

## UAT reference

- Finding: OBS-07
- Test case: UAT-03 — Reject registration when capacity is full
- Reporter: Sec01-Team047
- Confirmed disposition: Test Data Configuration Issue; Minor impact; Fix Test Data

## Review response

1. **Independent Participant targeting:** The maintenance command now queries and updates only the two Issue #67 Participant accounts. Missing or unverified Organizer accounts cannot block the Participant correction.
2. **Organizer mapping:** Organizer accounts are excluded from this PR's update path. The review says the independent report identifies Organizer A as `organizer-demo@example.com`, while a later request proposed `organizer-a@example.test`; Organizer B remains unverified. The original UAT report is not checked in. The UAT handoff marks the conflict and requires environment-owner confirmation before UAT-05 or a separate Organizer data update.
3. **Database and identity safeguards:** Apply mode requires the verified UAT marker, a PostgreSQL database target matching the separately confirmed host/port/database/schema, and a JSON approval manifest binding that same target to the two exact Participant User IDs. Account lookup detects case-insensitive login collisions; updates predicate on User ID, canonical login, and Participant role inside a serializable transaction.
4. **Documentation:** The UAT handoff, test-case prerequisites, evidence README, and this PR description record the verified issue accounts, unresolved Organizer mapping, and current verification status.

## Root cause

Issue #67 reports two distinct synthetic Participant accounts with the same display name, `Production Demo Participant`. Existing account provisioning intentionally leaves existing accounts unchanged, so rerunning that provisioner does not correct the labels. Triage found no evidence of an authorization or data-isolation defect.

## Changes

- Update the two Participant labels to `Production Demo Participant A` and `Production Demo Participant B` through a guarded maintenance command.
- Require the approved database target and exact Participant User IDs for apply; refuse missing, extra, duplicate, case-variant, wrong-role, wrong-ID, or unexpected-name accounts.
- Preserve IDs, logins, roles, password hashes, sessions, registrations, foreign keys, schemas, and API contracts.
- Keep the operation read-only by default. Apply still requires `--apply` and `--confirm-uat-database` plus the database/User-ID approval manifest.
- Keep Organizer A/B out of this command until their source mapping and scope are independently confirmed.

No live UAT database was accessed or changed. No deployment or independent UAT retest is claimed.

## Verification

- `npm.cmd run test --workspace server -- src/uat-display-name-update.test.ts --reporter=verbose` — **18 passed, 0 failed**. Evidence: `review-fix-verified-targeted.log` (UTF-8 copy) and `.txt` (raw capture).
- `npm.cmd run test --workspace server -- src/production-provisioning.test.ts --reporter=verbose` — **13 passed, 0 failed**. Evidence: `review-fix-final-provisioning-rerun.log` (UTF-8 copy) and `.txt` (raw capture).
- `npm.cmd test` — server **56 passed, 41 skipped** (integration database unavailable); client **28 passed, 0 skipped**; command exit code 0. Evidence: `review-fix-verified-suite.log` (UTF-8 copy) and `.txt` (raw capture).
- `npm.cmd run typecheck` — server and client checks passed. Evidence: `review-fix-verified-typecheck.log` (UTF-8 copy) and `.txt` (raw capture).
- `npm.cmd run build` — server and client production builds passed. Evidence: `review-fix-verified-build.log` (UTF-8 copy) and `.txt` (raw capture).
- `git diff --check` — passed. Evidence: `review-fix-verified-diff-check-rerun.log` (UTF-8 copy) and `.txt` (raw capture).
- GitHub Actions run [`46122204302`](https://github.com/Ttime52/EventCheck/actions/runs/46122204302) — **PASSED** on PR head `14a672f897eae16719846fa2d2f672fcf10c5c71`; backend unit/integration tests, frontend tests/typecheck/build, Playwright E2E, and Docker build all succeeded.
- The previous successful CI run `46118119726` covered pre-review PR head `9976fdf`; it does not cover these changes.

The initial review-response test attempts are preserved in UTF-8 copies `review-fix-final-targeted.log`, `review-fix-full-suite.log`, and `review-fix-final-suite.log`, with raw UTF-16 captures in their matching `.txt` files. Their assertion expected a Promise rejection from a synchronous fail-closed guard; this test matcher was corrected and the same assertions then passed on rerun. The application code was not relaxed.

## Lab 6 Part D status

Mocked maintenance verification is prepared for peer review. Environment-owner confirmation of the database target and exact Participant User IDs, any live data update, deployment, and Sec01-Team047's independent UAT-03 retest remain pending. Independent UAT retest is not marked PASS.
