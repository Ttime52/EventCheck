# EventCheck Sprint 1 — Independent UAT Retest Handoff

## 1. Project and retest overview

| Field | Value |
| --- | --- |
| Project / course / sprint | EventCheck / CPE334 Lab 6 Part D / Sprint 1 |
| Product team / independent team | EventCheck / Sec01-Team047 |
| Purpose | Independently verify OBS-03, OBS-04, and OBS-07 on the corrected UAT deployment; complete pending UAT-05 and UAT-07 when prerequisites are available. |
| Repository | https://github.com/Ttime52/EventCheck |
| Deployed application URL | `TODO: Confirm` with the environment owner. The earlier finding cites `https://eventcheck-4otxlp3nna-as.a.run.app`, but its current UAT identity and revision are unverified. |
| Tested release commit SHA / container image digest | `TODO: Confirm` from the deployment record before execution. |
| Cloud Run revision / deployment date and time | `TODO: Confirm` from Cloud Run and the release record before execution. |
| Scope | Sprint 1 F-01 through F-04 behavior relevant to the cases below. |
| Exclusions | Sprint 2 cancellation, check-in, capacity editing, deadlines, waitlists, and changes to production data. |

PRs [#68](https://github.com/Ttime52/EventCheck/pull/68), [#69](https://github.com/Ttime52/EventCheck/pull/69), and [#70](https://github.com/Ttime52/EventCheck/pull/70) are merged. Issues [#65](https://github.com/Ttime52/EventCheck/issues/65), [#66](https://github.com/Ttime52/EventCheck/issues/66), and [#67](https://github.com/Ttime52/EventCheck/issues/67) are closed in GitHub. [PR #70 CI](https://github.com/Ttime52/EventCheck/actions/runs/46123256028) passed at `58634dc573decc9027661c38a986cb4683a8ca9d`. These repository results do not establish which code is deployed or whether the OBS-07 database correction was applied. Obtain the deployment and database-change evidence before retesting. The checked-in [execution results](../uat-execution-results.md) still mark UAT-05 and UAT-07 `NOT RUN`; the external execution report is unavailable, so their actual status must be confirmed with Sec01-Team047.

## 2. Required test accounts

| Role in retest | Login identifier | Role | Verification required |
| --- | --- | --- | --- |
| Organizer A | `organizer-demo@example.com` is cited by PR #70 review; `TODO: Confirm` actual UAT identifier | `ORGANIZER` | Resolve conflict with later proposed `organizer-a@example.test`; confirm deployed identity and ownership. |
| Organizer B | `TODO: Confirm` | `ORGANIZER` | Confirm distinct User ID and deployed presence. `organizer-b@example.test` is only a proposal. |
| Participant A | `participant-demo@example.com` reported in Issue #67; `TODO: Confirm` deployed presence | `PARTICIPANT` | Confirm exact User ID and approved target name. |
| Participant B | `participant-b@example.test` reported in Issue #67; `TODO: Confirm` deployed presence | `PARTICIPANT` | Confirm distinct User ID and approved target name. |

The environment owner supplies credentials privately. Never place passwords, cookies, connection strings, or private credentials in results or screenshots. If an account cannot be verified, mark its dependent case `BLOCKED`. Use separate browser sessions or log out fully between accounts.

## 3. OBS-03 / UAT-06 — Clear corrected Event Creation errors

**Traceability:** [Issue #65](https://github.com/Ttime52/EventCheck/issues/65), F-02 Event Creation and Publishing, `AC-F02-04`, `AC-F02-05`, `AC-F02-14`.

**Preconditions:** Confirm the corrected deployed revision; sign in as verified Organizer A; open **Create Event**. Choose a unique title `UAT-<RUN_ID>-OBS03`, a future date at least seven days away, and valid description/location.

1. Set Start Time and End Time to the same valid instant, Capacity `2`, then submit. Record the displayed time error. No Event should be created.
2. Correct End Time so it is later than Start Time. Set Capacity to `0` and submit again.
3. Verify the earlier time error and time-field invalid state clear. Capacity `0` remains rejected, feedback describes the current values, and no Event with the unique title appears in **My Events**.

**Evidence:** Screenshots of the initial time error, the corrected times with Capacity `0` and current validation feedback, and **My Events** showing no invalid Event; record the unique title, times with timezone, and observed text. Report a failure with reproduction steps and before/after state. Do not submit a valid Event merely to prove error clearing.

## 4. OBS-04 / UAT-01 — Remaining-place pluralization

**Traceability:** [Issue #66](https://github.com/Ttime52/EventCheck/issues/66), F-03 Event Discovery, `AC-F03-02` and `AC-F03-03`.

**Setup:** As verified Organizer A, publish two uniquely titled future Events: `UAT-<RUN_ID>-OBS04-ONE` with Capacity `2`, and `UAT-<RUN_ID>-OBS04-MANY` with Capacity `5`. As Participant A, register once for the first Event, leaving exactly one place. Leave the second Event unregistered, leaving five places. Record both Event IDs and the Registration ID. If setup cannot be completed, mark `BLOCKED` and explain why.

1. Open **Discover Events**, locate both exact titles, and open each Event's details if needed.
2. Verify the first Event shows `1 PLACE`; the second shows `5 PLACES`. Check that the displayed remaining counts match the setup and that neither Event is shown as full.
3. As a distinct Participant B, register for the one-place Event once. Verify registration succeeds, remaining places become `0`, and the Event is full/unavailable under the existing Sprint 1 wording. A further registration attempt must not succeed.

**Evidence:** Screenshots of both availability labels, Event IDs/titles and capacity setup, successful last-place registration, and final full state; record both Registration IDs and the actual displayed text. Never include credentials.

## 5. OBS-07 / UAT-03 — Distinct synthetic Participant names

**Traceability:** [Issue #67](https://github.com/Ttime52/EventCheck/issues/67), UAT-03 account setup. This is a **test-data configuration verification**, not a confirmed application defect.

**Preconditions:** The environment owner confirms the approved UAT database target, both exact Participant User IDs, the approved one-time display-name correction, and post-change verification. If this evidence is unavailable, mark `BLOCKED`; merged PR #70 and its mocked tests do not prove the live update occurred. Use `Production Demo Participant A` and `Production Demo Participant B` as expected names only when the approved correction confirms them.

1. Sign in as Participant A. Record the displayed name and role; confirm login succeeds and the original account identity matches the owner-provided User ID.
2. Log out fully. Sign in as Participant B in a separate session. Record its displayed name and role; confirm its User ID differs from Participant A's.
3. Sign in as the owning Organizer. Open existing registrations for a fixture Event containing both Participants, if available. Compare Registration IDs, status, timestamps, and Participant IDs with the owner-provided pre-change record. If no such fixture exists, ask the environment owner for a safe read-only before/after comparison; do not claim registration preservation from a new empty fixture.

**Expected after approved correction:** Participant A displays `Production Demo Participant A`; Participant B displays `Production Demo Participant B`. Both retain their original IDs, roles, login ability, and registrations. If the approved target labels differ, obtain a corrected written handoff before execution.

**Evidence:** Redacted screenshots of each authenticated name, a record of distinct User IDs supplied through the approved channel, and redacted before/after registration evidence. Record any mismatch as a new or remaining defect.

## 6. Pending original UAT cases

The checked-in execution template lists both cases as `NOT RUN`, not confirmed `BLOCKED`. Ask Sec01-Team047 for its latest execution report; include these rows in the results until their actual outcome is known.

**UAT-05 — Non-owning Organizer restriction:** Once Organizer A and B are verified as distinct, follow [the original UAT-05 steps](../uat-test-cases.md#uat-05--deny-a-non-owning-organizer-access-to-registrations). Organizer A publishes a unique future Event and Participant A registers. Record Event and Registration IDs. Organizer B must not see that Event in **My Events** and a same-origin request to `/api/v1/organizer/events/<EVENT_ID>/registrations` must return privacy-preserving `404` without protected data. Organizer A then confirms its one Registration remains unchanged. If Organizer B or the mapping is unavailable, record `BLOCKED`.

**UAT-07 — Registration persistence after restart:** Follow [the original UAT-07 steps](../uat-test-cases.md) once the environment owner provides a safe application-only restart procedure. Record a Registration ID, Event ID, `ACTIVE` status, and timestamp before logout and restart. Coordinate the restart with the Product Team; record old and new Cloud Run revisions and confirmation that the UAT database was not reset. Log back in and verify the same ID, status, timestamp, and Event after restart, then confirm the Organizer list. If a safe restart is unavailable, record `BLOCKED`. The external tester must not run deployment or database commands.

## 7. Evidence and result recording

Use [uat-retest-results.md](uat-retest-results.md) for each execution. Record Finding/Case ID, tester and team, execution date/time with timezone, application URL, release SHA and Cloud Run revision, input data and record IDs, actual result, `PASS`/`FAIL`/`BLOCKED`, screenshot IDs, and reproduction steps for failures. Capture before/after state and exact error text when a test fails. Redact credentials, cookies, private identifiers, and unrelated personal data. Use `PASS` only after all expected results are observed on the confirmed corrected deployment.

## 8. Setup, order, and cleanup

1. Environment owner confirms isolated UAT URL, release SHA, image digest if available, Cloud Run revision, deployment time, corrected features, and the OBS-07 approved database correction. Record these in the results before execution.
2. Confirm accounts and private credential delivery. Choose a unique `<RUN_ID>` and future Bangkok-time test date. Record every new Event and Registration ID.
3. Run OBS-03, then OBS-04, then OBS-07. Complete UAT-05 when Organizer B is verified and UAT-07 when restart support is available. Cases may be run independently if their prerequisites are met.
4. Log out between roles or use isolated browser profiles. Avoid concurrent testers using the same accounts or fixture titles.
5. Leave persistent records tagged with `<RUN_ID>` and report their IDs to the UAT environment owner for the approved non-production cleanup process. External testers must not edit a production database or run destructive scripts.

Known limits: The original independent execution report and screenshots are not checked in; deployed revision and account mappings need owner confirmation. A merged PR, green CI, and a closed GitHub issue do not establish a deployed fix or independent UAT acceptance.
