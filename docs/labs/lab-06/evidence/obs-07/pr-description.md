# fix(uat): correct duplicate participant demo names (OBS-07)

Fixes #67

## UAT reference

- Finding: OBS-07
- Test case: UAT-03 — Reject registration when capacity is full
- Reporter: Sec01-Team047
- Classification: Accepted test-data configuration issue; Minor; disposition Fix Test Data

## Root cause

Issue #67 reports two distinct synthetic Participant accounts with the same display name, `Production Demo Participant`. Existing account provisioning intentionally leaves matching accounts unchanged, so rerunning that provisioner would not correct the labels. Triage found no evidence of an authorization or data-isolation defect.

## Changes

- Add a guarded, idempotent maintenance command that targets only `participant-demo@example.com` and `participant-b@example.test`.
- Validate both records exist exactly once, have the Participant role, resolve to distinct User IDs, and have either the reported original name or the correct target name.
- Update only `displayName` inside a serializable transaction. The default is read-only; database writes require a verified UAT target plus both `--apply` and `--confirm-uat-database`.
- Update the Sprint 1 UAT handoff labels and add Lab 6 Part D evidence/runbook.

The change does not modify application behavior, account IDs, login identifiers, roles, password hashes, sessions, registrations, foreign keys, schemas, or API contracts. No live UAT database was accessed or changed.

## RED/GREEN status

RED/GREEN is not applicable and is not claimed: accepted triage classifies OBS-07 as a test-data configuration issue, not a confirmed application defect. The task explicitly says not to fabricate RED/GREEN. Mocked automated tests verify the maintenance operation's safety and data invariants.

## Verification

- `npm.cmd run test --workspace server -- src/uat-display-name-update.test.ts --reporter=verbose` — 10 passed, 0 failed.
- `npm.cmd run test --workspace server -- src/production-provisioning.test.ts --reporter=verbose` — 13 passed, 0 failed.
- `npm.cmd test` — server: 48 passed, 41 skipped; client: 28 passed, 0 skipped; exit code 0. The skipped server tests require an integration database.
- `npm.cmd run typecheck` — server and client passed.
- `npm.cmd run build` — server and client builds passed.
- No DB command was run. No deployed before/after screenshot is available because the UAT URL/revision is unconfirmed.

Full logs and the manual operator runbook are in `docs/labs/lab-06/evidence/obs-07/README.md`.

## Lab 6 Part D status

The maintenance path and mocked verification are prepared for peer review. The UAT owner must verify the target and approve any manual dry-run/apply. Deployment and the independent UAT-03 retest by Sec01-Team047 remain pending. Independent UAT retest is not marked PASS.
