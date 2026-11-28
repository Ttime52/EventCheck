# EventCheck Sprint 1 UAT Handoff

## Project and release

| Item | Handoff value |
| --- | --- |
| Project | EventCheck |
| Course | CPE334 — Event Registration and Attendance System |
| Sprint | Sprint 1 |
| Repository | https://github.com/Ttime52/EventCheck |
| Sprint 1 baseline release candidate | `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e` — identified as the approved candidate in `docs/sprints/sprint-1/verification-results.md` and `docs/sprints/sprint-1/release-report-part-f.md` |
| Baseline tag | `TODO: Confirm`. The repository's release report says a Git tag was not supplied; no tag is present in the inspected repository. |
| Inspected repository HEAD | `91857c25f9ab27e9c904ca3886c0d3f1a67684dc` (`main` at handoff preparation); this is later than the approved Sprint 1 release-candidate SHA. |
| Deployed application URL | `TODO: Confirm` — the checked-in deployment documentation describes deployment procedures but does not establish a live service URL. |
| Deployed revision/image digest | `TODO: Confirm` — obtain the exact deployed commit SHA (and image digest if available) from the deployment record before testing. Do not assume repository HEAD or the Sprint 1 candidate is deployed. |
| Version to record in UAT results | `TODO: Confirm` exact deployed revision and that it implements the Sprint 1 scope in the test cases. |

Repository URL was read from the configured `origin` remote. The Sprint 1 verification report separately records the release-candidate SHA and independent test report. The current checkout has later deployment/configuration work; compare the actual deployed revision with the approved Sprint 1 candidate and record any changed behavior before execution.

## Sprint 1 scope and exclusions

In scope: seeded role-based login/logout; Organizer event create, validate, publish, and retrieve; public discovery and details; Participant self-registration and personal retrieval; duplicate/full capacity rejection; owner-only Organizer registration lists; role/ownership protection; database-backed persistence.

Out of scope: account self-registration, event drafts/unpublished lifecycle, registration cancellation, re-registration, event capacity edits, deadlines, check-in, attendance, event reports/summaries, notifications, and waitlists. Do not add these as acceptance expectations for this UAT.

See [UAT test cases](uat-test-cases.md) and the approved F-01 through F-04 contracts linked there.

## Test accounts and credentials

The checked-in local seed defines the local Organizer and Participant rows below. Issue #67 reports the two demo Participant accounts; the Organizer A/B test accounts were supplied in a follow-up request. Their presence in deployed UAT still requires confirmation.

| Login identifier / display name | Role | Usage |
| --- | --- | --- |
| `organizer@example.test` / `Demo Organizer` | Organizer | Local development/test seed; create/publish Events and view owned registrations |
| `participant@example.test` / `Demo Participant` | Participant | Local development/test seed only; not the OBS-07 deployed demo account |
| `participant-demo@example.com` / `Production Demo Participant A` | Participant | OBS-07-reported synthetic account; discover/register and view personal registrations. Confirm it exists in the isolated deployed UAT environment. |
| `participant-b@example.test` / `Production Demo Participant B` | Participant | OBS-07-reported synthetic account; required as the distinct second participant for full-capacity UAT-03. Confirm it exists in the isolated deployed UAT environment. |
| `organizer-a@example.test` / `Production Demo Organizer A` | Organizer | Follow-up-requested synthetic account; verify it exists in isolated UAT before use. |
| `organizer-b@example.test` / `Production Demo Organizer B` | Organizer | Follow-up-requested synthetic account; required as the distinct second owner for UAT-05. Verify it exists in isolated UAT before use. |

The first two rows are local synthetic seed accounts; Issue #67 reports the Participant identifiers, while the Organizer A/B identifiers were supplied in a follow-up request. Neither this handoff nor the issue proves that any of these accounts exists in the currently deployed environment. Before execution, the environment owner must verify the isolated UAT deployment and privately share the confirmed account labels, roles, and credentials with the independent UAT team. Never store passwords, tokens, session cookies, connection strings, or production secrets in this handoff or execution evidence. If a required account is unavailable, mark the dependent UAT case `BLOCKED` and document the reason; do not substitute a different role or identity.

## Deployment and setup

1. The UAT lead confirms the application URL, deployed commit/revision, and non-production environment. Enter them in the execution results before testing. If URL/revision is unknown, pause execution and request confirmation from the environment owner.
2. Confirm the deployed build corresponds to the Sprint 1 F-01 through F-04 contracts. The documented Sprint 1 baseline is `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e`; the current repository HEAD at package preparation is `91857c25f9ab27e9c904ca3886c0d3f1a67684dc`. Do not silently treat either value as the deployed version.
3. Confirm the target database is isolated for UAT, contains no real user data, and is not shared with production or another test run. Event and Registration writes are persistent.
4. Obtain credentials privately from the environment owner and verify each account's displayed name and role by signing in. Never include credentials in screenshots, browser console history sent as evidence, or defect reports.
5. Confirm the Issue #67 Participant A/B accounts and follow-up Organizer A/B accounts are present in isolated UAT before UAT-03/UAT-05. UAT-03 and UAT-05 each require two distinct users of the indicated role; do not substitute accounts from another role or the local seed.
6. Choose a unique `<RUN_ID>` and future event date per the shared rules in `uat-test-cases.md`. Record each created Event/Registration ID in the execution record.
7. Keep one tester per account set at a time. The application has no Sprint 1 UI for deleting Events or Registrations, so plan cleanup with the non-production environment owner before generating records.

## Execution order and dependencies

Recommended order:

1. UAT-08 — login, generic credential failure, role identity, logout.
2. UAT-06 — publication field rules and valid capacity-one Event.
3. UAT-01 — normal Organizer-to-Participant journey.
4. UAT-02 — duplicate registration.
5. UAT-03 — full capacity; requires Participant B.
6. UAT-04 — Participant denied Organizer-only requests.
7. UAT-05 — cross-owner registration denial; requires Organizer B.
8. UAT-07 — logout/login and application-restart persistence; requires the confirmed restart procedure.

Each case uses its own unique test title and can otherwise run independently. UAT-01 through UAT-07 create persistent Event and/or Registration records. Preserve their IDs for cleanup and evidence. Where cases are blocked by a missing account or deployment detail, record `BLOCKED` in the results and continue with independent cases only if the URL, revision, and non-production environment have already been confirmed.

## Cleanup and reset

- The Sprint 1 UI has no Event or Registration deletion/reset feature. Do not attempt to delete data through an unsupported API or direct database edits.
- After execution, provide the environment owner the `<RUN_ID>` plus the Event IDs and Registration IDs recorded by the test team. Ask the owner to reset those tagged synthetic records using the deployment's approved non-production reset process.
- If that process is not known, enter `TODO: Confirm` and leave the records intact until the environment owner confirms a safe reset. Never run a destructive reset against a shared or production database.
- Record the cleanup date, person/team performing it, and the affected IDs in the execution results.

## Instructions for the independent UAT team

1. Read [uat-test-cases.md](uat-test-cases.md) and this handoff before signing in.
2. Use the exact deployed URL and version entered in the execution template. If either is missing or does not match the environment owner's confirmation, do not start execution.
3. Execute each numbered step in order. Record actual observations, exact visible error/status, Event/Registration IDs, evidence IDs, and defect references in [uat-execution-results.md](uat-execution-results.md).
4. Use browser DevTools only for the direct authorization and duplicate checks called out in the test steps. Same-origin requests use the logged-in browser session; never copy or share the HttpOnly session cookie.
5. Set a result to PASS only when every expected result for the case is observed. Use FAIL for a reproducible mismatch and BLOCKED for a missing prerequisite or unavailable environment. Tests begin as NOT RUN.
6. Do not interpret repository automation results as execution of these independent manual UAT cases. The Sprint 1 report records automation evidence separately.

## Known limitations and confirmations required

- `TODO: Confirm` deployed app URL, deployed revision/SHA, and test environment isolation.
- `TODO: Confirm` whether a release tag exists outside the inspected repository; none is recorded in the checked-in Sprint 1 report or local tag list.
- `TODO: Confirm` the Issue #67 Participant A/B accounts and follow-up Organizer A/B accounts exist in the isolated deployed environment and privately deliver their credentials.
- `TODO: Confirm` a safe application restart procedure that preserves the UAT database for UAT-07.
- `TODO: Confirm` approved non-production data reset owner/procedure for tagged Event and Registration records.
- Reconcile the stale Sprint 1 status text in `README.md` and `docs/traceability.md` with the Approved/Pass release decision before treating those docs as aligned handoff evidence.
- Current Sprint 1 schema contains only published Events; unpublished-event rejection cannot be independently exercised as a state transition in this package.
- Manual UAT checks user-visible behavior. Race/concurrency, failure-injection, and exact session-expiry boundaries rely on the separate automated Sprint 1 verification evidence; UAT-07 additionally requires a controlled application restart while preserving its database.
