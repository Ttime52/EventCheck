# EventCheck Sprint 1 Defect Triage Register

**Lab:** CPE334 Lab 6 — Independent UAT and Defect Management<br>
**Part:** C — Defect Reporting and Triage; traceability for Part D<br>
**Triage snapshot:** 28 November 2026 (Asia/Bangkok); OBS-07 PR status refreshed after review response<br>
**Document status:** Consolidated register. Confirmed GitHub decisions are distinguished from proposals awaiting team/UAT confirmation.

## 1. Document overview

| Field | Record |
| --- | --- |
| Project / sprint | EventCheck / Sprint 1 |
| Product team | EventCheck Product Team. The official team roster is not in the repository. GitHub identifies Vera Int. (`@Ttime52`) and Kwanchanok Thungsuk (`@KwanchanokThungsuk`) as participants; see review participation below. |
| Independent UAT team | Sec01-Team047 |
| Reported tested commit | `3821443a9414950185650b029ef1a88f93e5a1d9`, as supplied with the findings. GitHub Issues #65–#67 show the abbreviated SHA `3821443`. |
| Reported tested deployment | `https://eventcheck-4otxlp3nna-as.a.run.app`, as supplied with the findings. The checked-in handoff still marks the live URL and deployed revision/image digest `TODO: Confirm`; this URL/revision relationship has not been independently verified. |
| Original execution report | Not present in the repository. [`uat-execution-results.md`](uat-execution-results.md) is an unfilled template; its UAT-01 through UAT-08 rows are `NOT RUN`. Issue bodies and the supplied finding summary provide the initial observations, but the original report and screenshot files remain outstanding. |
| Triage purpose | Record each reported observation, the evidence-backed classification and severity, the owner/action, and the remaining resolution and retest gates. |
| Triage participants | GitHub issue reviews are dated 28 November 2026 ICT. Product team role/roster confirmation and review of this document are pending. |
| Documentation branch baseline | `sprint-1-staging` at `7fb3620f2288b4062ccffa88c262bee42207dab5` (fetched 28 November 2026). This is the base for this documentation change, not the reported UAT-tested version. |

### Referenced sources

- [Sprint 1 SRS](../../srs.md), [System SDS](../../system-sds.md), [feature index](../../features.md), and [traceability matrix](../../traceability.md).
- [F-02 Event Publishing contract](../../sprints/sprint-1/f-02-event-publishing.md), [F-03 Event Discovery and Registration contract](../../sprints/sprint-1/f-03-event-registration.md), and [F-04 Organizer Registrations contract](../../sprints/sprint-1/f-04-organizer-registrations.md).
- [UAT test cases](uat-test-cases.md), [UAT handoff](uat-handoff.md), and [UAT execution-results template](uat-execution-results.md).
- Lab 6 evidence: [OBS-03](../../labs/lab-06/evidence/obs-03/README.md), [OBS-04](../../labs/lab-06/evidence/obs-04/README.md), and the [OBS-07 evidence on PR #70](https://github.com/Ttime52/EventCheck/blob/58634dc573decc9027661c38a986cb4683a8ca9d/docs/labs/lab-06/evidence/obs-07/README.md). OBS-07 files are on the unmerged PR branch, not this documentation branch.
- GitHub findings: [Issue #65 / OBS-03](https://github.com/Ttime52/EventCheck/issues/65), [Issue #66 / OBS-04](https://github.com/Ttime52/EventCheck/issues/66), and [Issue #67 / OBS-07](https://github.com/Ttime52/EventCheck/issues/67).

The repository does not contain a separate Sec01-Team047 execution report or the original screenshot attachments. Evidence IDs below are references reported in the issue/source material; they do not mean the referenced original images are checked in. The local OBS-04 browser images are synthetic-fixture screenshots and are not evidence of the independent deployed UAT session.

## 2. Triage classification policy

### Classification

- **Accepted Defect:** Evidence shows the product violates an approved Sprint 1 requirement or acceptance criterion, and the team accepts it for correction or an explicitly approved limitation.
- **Duplicate:** The behavior is already tracked by a canonical finding; link the duplicate to that finding and avoid counting it twice.
- **Not Defect:** The behavior meets the Sprint 1 contract, or the concern is attributable to test data, documentation, configuration, or release verification rather than a demonstrated application-contract violation. Record any follow-up separately.
- **Enhancement:** A useful behavior that is outside the approved Sprint 1 scope. Defer it to a future backlog unless scope is formally changed.

### Severity and acceptance effect

- **Critical / Major:** Must be corrected and independently retested by the UAT Team before acceptance.
- **Minor:** Must be corrected, or the UAT Team must explicitly accept it as a known limitation. A product-team decision alone does not establish UAT acceptance.
- **N/A:** No application defect severity is assigned while a finding is a proposed enhancement, a configuration/documentation item, or awaiting classification.

Only a GitHub triage review or other recorded team decision is treated as confirmed here. The supplied OBS-01, OBS-02, OBS-05, and OBS-06 classifications are initial suggestions, not confirmed decisions. Their proposed classifications and actions remain pending team/UAT confirmation. No final Sprint 1 acceptance is declared by this register.

## 3. Findings summary

| Finding ID | Related UAT case | Summary | Classification | Severity | Contract / AC reference | Rationale | Disposition | Owner | Issue / PR | Resolution status | Evidence | Retest status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OBS-01 | Info — account naming | Synthetic accounts use “Production Demo …” labels that may confuse UAT users. | **Proposed Enhancement** — pending confirmation | N/A | No application AC requires these exact test-account labels. | Label convention is configuration/test data; original report and formal decision are unavailable. | Confirm labels; retain as a known limitation or update synthetic labels and handoff. | Product/UAT handoff owner — assign | No issue/PR verified | Pending triage and account-label confirmation. | `ss_737441msz` is cited in supplied findings; original image not local. | PENDING |
| OBS-02 | Info — handoff labels | Deployed identifiers/display names reportedly differ from labels in the UAT handoff. | **Proposed Not Defect** — documentation/configuration; pending confirmation | N/A | UAT handoff and account setup; no application AC identified. | A documentation mismatch is not an application defect; actual deployed account mapping still needs verification. | Verify deployed labels privately, then update the handoff; never record passwords. | Release/UAT handoff owner — assign | No issue/PR verified | Pending account verification and documentation update. | Supplied observation only; original report/image not local. | PENDING |
| OBS-03 | UAT-06 | Correcting invalid event times leaves stale validation feedback visible. | **Accepted Defect** — confirmed | Minor | F-02 `AC-F02-14`; related `AC-F02-04`, `AC-F02-05`. | The form correctly blocks invalid capacity, but stale time/form errors mislead the Organizer. | Fix; PR #68. | `@KwanchanokThungsuk` (Issue #65 assignee) | [#65](https://github.com/Ttime52/EventCheck/issues/65) / [#68](https://github.com/Ttime52/EventCheck/pull/68) | Fix merged, approved, CI passed; deployment and independent retest pending. GitHub issue is closed; see closure note below. | `ss_7021uro9j` cited by issue; local [RED](../../labs/lab-06/evidence/obs-03/red.txt) / [GREEN](../../labs/lab-06/evidence/obs-03/green.txt). Original screenshot not local. | PENDING |
| OBS-04 | UAT-01 | One remaining place is displayed as `1 PLACES`. | **Accepted Defect (Cosmetic)** — confirmed | Minor | F-03 `AC-F03-02` (capacity/remaining places/availability), `AC-F03-03` (full/unavailable states). | Quantity is correct, but singular wording is wrong; discovery and registration continue to work. | Fix pluralization; PR #69. | `@Ttime52` (Issue #66 assignee) | [#66](https://github.com/Ttime52/EventCheck/issues/66) / [#69](https://github.com/Ttime52/EventCheck/pull/69) | Fix merged, approved, CI passed; deployment and independent retest pending. GitHub issue is closed; see closure note below. | Local [RED](../../labs/lab-06/evidence/obs-04/red.txt), [GREEN](../../labs/lab-06/evidence/obs-04/final-regression.txt), and synthetic UI screenshots. Original UAT screenshot was not provided in Issue #66. | PENDING |
| OBS-05 | Info — past event in discovery | An event that has ended remains visible in discovery. | **Proposed Enhancement / Out of Scope** — pending confirmation | N/A | F-03 Sprint 1 scope/exclusions; Q-11; no AC requires hiding a published event after its end time. | The approved F-03 contract specifies no Sprint 1 time cutoff and excludes time-based closure. | Defer to a future backlog if desired; do not change Sprint 1 behavior without an approved scope change. | Product/backlog owner — assign | No issue/PR verified | Initial classification only; formal decision pending. | Supplied observation summary; original report/image not local. | PENDING classification; no defect retest assigned |
| OBS-06 | Info — release identity | Tested deployment reportedly differs from documented baseline; UAT could not identify its deployed SHA through app endpoints. | **Pending classification** — initial proposal: release-traceability / Not Defect | N/A pending verification | SR-04 and NFR-09/NFR-10 concern traceability and reproducible verification. No specific AC requiring a runtime SHA endpoint was found; `AC-F03-14` is feature/test evidence traceability, not proof of deployed identity. | This is an unresolved release-verification concern; the Cloud Run revision/image and tested commit relationship are not evidenced. | Verify the tested commit, Cloud Run revision and image; document the relationship and scope. Do not close on assumption. | Release owner — assign | No issue/PR verified | **Open verification item.** | Supplied tested SHA/URL; original UAT report and deployment attestation not local. | PENDING |
| OBS-07 | UAT-03 | Participant A/B have distinct IDs but duplicate display name `Production Demo Participant`. | **Not Defect — Test Data Configuration Issue** — confirmed | Minor impact; not an application-defect severity | UAT account setup/handoff; Issue #67 states no specific application AC violation was confirmed. | Triage found no evidence of authorization or data-isolation failure; the synthetic account labels are ambiguous. | Fix Participant test data and handoff, preserving IDs, credentials, roles, registrations, and ownership. Organizer changes await verified mapping and separate approval. | `@Ttime52` (Issue #67 assignee); peer re-review pending | [#67](https://github.com/Ttime52/EventCheck/issues/67) / [#70](https://github.com/Ttime52/EventCheck/pull/70) | Issue #67 open. PR #70 review response pushed; latest CI passed on head `58634dc`. GitHub still shows `CHANGES_REQUESTED` pending re-review. No UAT database change or deployment is evidenced. | `ss_0511n4z9t` cited in Issue #67; [PR #70 evidence](https://github.com/Ttime52/EventCheck/blob/58634dc573decc9027661c38a986cb4683a8ca9d/docs/labs/lab-06/evidence/obs-07/README.md) includes mocked maintenance tests; original screenshot not local. | PENDING |

## 4. Detailed triage records

### OBS-01 — Production demo account names

- **Finding / case:** OBS-01; Info (no UAT case ID is supplied).
- **Reported actual result:** Seeded accounts display labels such as “Production Demo Organizer” and “Production Demo Participant”; the labels may confuse a UAT environment.
- **Expected behavior:** No contractual application behavior or exact account-label convention is identified in the available sources.
- **Sprint 1 reference:** No application AC requires a particular synthetic test-account name.
- **Classification:** **Proposed Enhancement / cosmetic configuration; pending confirmation.** This is the source suggestion, not a recorded team decision.
- **Severity / impact:** N/A as an application defect. Potentially minor UAT clarity impact.
- **Rationale:** The concern is about synthetic test data and naming, not a demonstrated feature-contract violation. The underlying independent report is unavailable locally.
- **Disposition / owner:** Confirm a naming convention; retain and document the labels as a known limitation or update synthetic labels. Product/UAT handoff owner is unassigned.
- **Evidence / links:** Evidence ID `ss_737441msz` is listed in the supplied findings; original screenshot not found in the repository. No GitHub issue or PR was verified for OBS-01.
- **Status / retest:** Triage pending; account-label verification pending. Do not record UAT acceptance unless Sec01-Team047 explicitly accepts a known limitation.
- **Closure criteria:** Record the team/UAT classification and either document explicit UAT acceptance or verify any agreed label correction in the intended UAT environment.

### OBS-02 — Deployed labels differ from the UAT handoff

- **Finding / case:** OBS-02; Info (no UAT case ID is supplied).
- **Reported actual result:** Deployed account identifiers and display names reportedly differ from the labels in the local UAT handoff.
- **Expected behavior:** Handoff labels should match verified deployed test accounts. Credentials must remain private and absent from documentation.
- **Sprint 1 reference:** UAT handoff/account setup; no application AC identified.
- **Classification:** **Proposed Not Defect — documentation/configuration; pending confirmation.**
- **Severity / impact:** N/A as an application defect; inaccurate labels can impede UAT setup.
- **Rationale:** A mismatch between handoff text and deployed configuration is a documentation/release setup issue unless testing demonstrates a separate application-contract violation. The deployed account mapping has not been independently verified.
- **Disposition / owner:** Have the environment owner confirm the account identifiers, roles, and display names through the approved private channel; then update the handoff without passwords. Release/UAT handoff owner is unassigned.
- **Evidence / links:** Supplied observation only; no source screenshot or dedicated issue/PR was located.
- **Status / retest:** Verification and handoff update pending.
- **Closure criteria:** Verified account labels match the revised handoff; any remaining application behavior is separately triaged with supporting evidence.

### OBS-03 — Stale validation errors

- **Finding / case:** OBS-03 / UAT-06, reported by Sec01-Team047.
- **Reported actual result:** After invalid equal start/end times are corrected, `endAt must be later than startAt` and `Event details are invalid` remain visible. Capacity `0` is still rejected and no event is created.
- **Expected behavior:** Validation feedback reflects current values; corrected time errors clear, while invalid capacity remains blocked.
- **Sprint 1 reference:** F-02 `AC-F02-14` (validation UI states), `AC-F02-04` (date/time validation), and `AC-F02-05` (capacity validation), as recorded in the GitHub triage review.
- **Classification:** **Accepted Defect; confirmed.**
- **Severity / user impact:** Minor. Misleading feedback may confuse the Organizer, but event publication remains protected from invalid data.
- **Triage rationale:** The stale messages contradict corrected input despite existing server/native validation preventing invalid publication.
- **Disposition / owner:** Fix through reviewed PR #68; Issue #65 is assigned to `@KwanchanokThungsuk`.
- **Supporting evidence:** Issue references `ss_7021uro9j`; original screenshot is not checked in. RED/GREEN logs and exact commands are in [OBS-03 evidence](../../labs/lab-06/evidence/obs-03/README.md).
- **GitHub references:** [Issue #65](https://github.com/Ttime52/EventCheck/issues/65); [PR #68](https://github.com/Ttime52/EventCheck/pull/68).
- **Fix / documentation status:** Fix commit `6a8d10431161d5a92c749a7937f5afaa85099991` merged to `sprint-1-staging` as merge commit `1d03b52c5a5bedb92af257133b447b87b565a9db`. PR approved by `@Ttime52`; CI run `46044895856` succeeded. The reviewer also requested an OBS-03 evidence-README refresh; the current README still contains pre-PR status wording, so that documentation follow-up remains open. GitHub Issue #65 is `CLOSED` (28 Nov 2026). No deployment revision or independent retest is evidenced.
- **Independent retest:** **PENDING**; do not mark PASS.
- **Closure criteria:** Deploy the reviewed fix to the confirmed non-production UAT release, record its revision, and obtain Sec01-Team047 retest evidence. Issue #65's text requires corrected-release independent retesting for final closure; the current GitHub closed state does not supply that evidence.

### OBS-04 — Incorrect remaining-place pluralization

- **Finding / case:** OBS-04 / UAT-01, reported by Sec01-Team047.
- **Reported actual result:** An Event with one remaining place displays `1 PLACES`. Multiple-place labels display correctly.
- **Expected behavior:** `1 PLACE` for one remaining place; `N PLACES` for more than one; capacity calculations and full/zero-place behavior remain unchanged.
- **Sprint 1 reference:** F-03 `AC-F03-02` (capacity, remaining places, availability) and `AC-F03-03` (explicit full/unavailable state).
- **Classification:** **Accepted Defect (Cosmetic); confirmed.**
- **Severity / user impact:** Minor. The quantity is correct and registration remains available; the grammar is incorrect.
- **Triage rationale:** The display is part of the agreed availability presentation and can be corrected without changing capacity or registration rules.
- **Disposition / owner:** Fix pluralization through PR #69; Issue #66 is assigned to `@Ttime52`.
- **Supporting evidence:** Issue #66 says the original UAT screenshot was not provided. [RED](../../labs/lab-06/evidence/obs-04/red.txt), [GREEN](../../labs/lab-06/evidence/obs-04/final-regression.txt), and the local synthetic-fixture UI screenshots are preserved in OBS-04 evidence.
- **GitHub references:** [Issue #66](https://github.com/Ttime52/EventCheck/issues/66); [PR #69](https://github.com/Ttime52/EventCheck/pull/69).
- **Fix / documentation status:** Fix commit `e734e950cc39fbd1f30d914a5e1ed569e1b9bc4a`; PR #69 was approved by `@KwanchanokThungsuk`, CI run `46110592948` succeeded, and it merged to `sprint-1-staging` as `7fb3620f2288b4062ccffa88c262bee42207dab5`. GitHub Issue #66 is `CLOSED` (28 Nov 2026). Deployment and independent retest are not evidenced.
- **Independent retest:** **PENDING**; do not mark PASS.
- **Closure criteria:** Deploy the reviewed fix to the confirmed non-production UAT release, record its revision, and obtain Sec01-Team047 retest evidence. Issue #66's text requires independent retesting; the current GitHub closed state does not supply that evidence.

### OBS-05 — Past event appears in discovery

- **Finding / case:** OBS-05; Info (no UAT case ID is supplied).
- **Reported actual result:** An event whose end time has passed remains visible in Event Discovery.
- **Expected behavior:** Hiding events after their end time is not established as a Sprint 1 expectation in the available observation or approved F-03 contract.
- **Sprint 1 reference:** F-03 §A explicitly excludes deadlines/time-based closure and any requirement to register before event start; SRS decision Q-11 says Sprint 1 has no time-based cutoff. F-03 `AC-F03-01` covers discovery of published events, not a past-event filter.
- **Classification:** **Proposed Enhancement / out of Sprint 1 scope; pending formal confirmation.**
- **Severity / user impact:** N/A as a Sprint 1 defect. Potential usability preference only.
- **Triage rationale:** The proposed past-event filter is not required by the current Sprint 1 contract. The supplied summary says the independent team also identified the behavior as outside delivered Sprint 1 scope.
- **Disposition / owner:** Defer a filter to a future backlog if the team/UAT Team wants it; do not change Sprint 1 behavior without a reviewed scope change. Product/backlog owner is unassigned.
- **Supporting evidence / links:** Supplied observation summary; original report/image and dedicated GitHub issue/PR were not found.
- **Status / retest:** Formal classification pending; no Sprint 1 defect retest is assigned unless the decision changes.
- **Closure criteria:** Record the agreed out-of-scope/enhancement disposition and any future backlog reference. Do not count this as a Sprint 1 defect without contractual evidence.

### OBS-06 — Tested version and baseline mismatch

- **Finding / case:** OBS-06; Info (release identity/verification).
- **Reported actual result:** The tested deployment reportedly differs from the documented Sprint 1 baseline, and the UAT team could not identify the deployed SHA through application endpoints.
- **Expected behavior:** The release under test must be traceable to its deployed revision/image and checked against the agreed Sprint 1 scope. No requirement for a user-facing runtime-SHA endpoint has been verified.
- **Sprint 1 reference:** System responsibility `SR-04` and `NFR-09`/`NFR-10` address traceable contracts and reproducible verification. F-03 `AC-F03-14` maps feature acceptance criteria to tests/evidence; it does not by itself assert that an app endpoint exposes a deployed SHA.
- **Classification:** **Pending team decision.** Initial proposal is a release-traceability/documentation issue rather than a confirmed application defect.
- **Severity / user impact:** N/A pending release verification; inability to identify the tested version undermines confidence in UAT evidence.
- **Triage rationale:** The tested SHA, service revision, image digest, and scope relationship have not been independently established. This finding cannot be closed merely because application endpoints do not expose a SHA.
- **Disposition / owner:** Verify the exact tested Git SHA, Cloud Run revision and image digest from deployment records; compare it with the agreed Sprint 1 baseline and document the release relationship. Release owner is unassigned.
- **Supporting evidence / links:** Full SHA and URL are supplied with the observation summary; original execution report and deployment attestation are not local. No dedicated Issue/PR was found.
- **Status / retest:** **Verification open / pending.**
- **Closure criteria:** Attach verifiable deployment-to-commit/image evidence and document whether the release preserved the agreed Sprint 1 acceptance scope. Keep open if identity or scope remains uncertain.

### OBS-07 — Duplicate Participant display names

- **Finding / case:** OBS-07 / UAT-03, reported by Sec01-Team047.
- **Reported actual result:** Participant A (`participant-demo@example.com`) and Participant B (`participant-b@example.test`) both display `Production Demo Participant`, although the issue reports distinct User IDs. The Organizer registration list identifies participants by ID.
- **Expected behavior:** Synthetic test participants should have distinct labels to aid UAT and review; existing User IDs, credentials, roles, registrations, and ownership must be preserved.
- **Sprint 1 reference:** UAT account setup/handoff. Issue #67's triage records that no specific application AC violation or authorization/data-isolation defect was confirmed.
- **Classification:** **Not Defect — Test Data Configuration Issue; confirmed** by the Issue #67 triage review.
- **Severity / user impact:** Minor usability impact during UAT; not an application-defect severity because unique IDs and authorization remain intact in the reported observation.
- **Triage rationale:** The observed duplication is in synthetic account configuration, not the account identity or registration rules.
- **Disposition / owner:** Correct test data and handoff while preserving account/data identity. Issue #67 is assigned to `@Ttime52`; PR #70 requires further work after peer review.
- **Supporting evidence:** Issue cites `ss_0511n4z9t`; original image is not checked in. Mocked maintenance tests do not prove a live UAT update. The [OBS-07 evidence on PR #70](https://github.com/Ttime52/EventCheck/blob/58634dc573decc9027661c38a986cb4683a8ca9d/docs/labs/lab-06/evidence/obs-07/README.md) is on the unmerged PR branch, not this staging baseline.
- **GitHub references:** [Issue #67](https://github.com/Ttime52/EventCheck/issues/67); [PR #70](https://github.com/Ttime52/EventCheck/pull/70).
- **Fix / documentation status:** Issue #67 is `OPEN`. PR #70 is open and ready for re-review at head `58634dc573decc9027661c38a986cb4683a8ca9d`; `@KwanchanokThungsuk` previously requested changes, and GitHub still shows `CHANGES_REQUESTED`. [CI run `46123256028`](https://github.com/Ttime52/EventCheck/actions/runs/46123256028) succeeded on that head. The command now targets only the two Participant accounts, rejects case-insensitive login collisions, and requires an approved database target plus exact Participant User IDs before apply. No deployed database was changed and no deployment is evidenced. The review cites Organizer A as `organizer-demo@example.com`, while the later requested mapping is `organizer-a@example.test`; Organizer B remains unverified. Organizer updates are excluded pending authoritative mapping and separate approval.
- **Independent retest:** **PENDING** until the approved test data is changed in isolated UAT and available in the deployed release.
- **Closure criteria:** Resolve the PR review, verify exact accounts against the original UAT/deployment source, apply only the approved data change, verify preservation of IDs/roles/registrations, then obtain independent UAT-03 retest evidence. Do not close based on mocked tests or CI alone.

## 5. Accepted-defect resolution tracking (OBS-03 and OBS-04)

Both findings have passing local RED/GREEN evidence and merged fixes. Neither has verified deployment or independent UAT retest evidence. Issue state and acceptance state are shown separately because the issue bodies make retesting part of final closure.

| Tracking field | OBS-03 / Issue #65 | OBS-04 / Issue #66 |
| --- | --- | --- |
| Fix branch | `fix/uat-obs03-validation` | `fix/uat-obs04-pluralization-staging` |
| RED baseline | `9e764cd9ccad54e4f694e7581f7e6d702ae064c6` | `1d03b52c5a5bedb92af257133b447b87b565a9db` |
| Regression test file / test | `client/src/obs03-validation.test.tsx` — `Issue #65 / UAT-06 / OBS-03 > clears corrected time errors even when capacity 0 blocks the next native submission` | `client/src/obs04-pluralization.test.tsx` — `UAT-01 OBS-04 event availability pluralization > renders the correct badge for 1 remaining place(s)` |
| RED command / result | `npm run test --workspace client -- src/obs03-validation.test.tsx` — **1 failed, 0 passed; exit 1**. The corrected End Time still showed the stale time error/form summary and `aria-invalid="true"`. [Original log](../../labs/lab-06/evidence/obs-03/red.txt). | `npm.cmd run test --workspace client -- src/obs04-pluralization.test.tsx` — **1 failed, 3 passed; exit 1**. Expected `1 PLACE`; received `1 places`. [Original log](../../labs/lab-06/evidence/obs-04/red.txt). |
| GREEN command / result | Same command, unchanged OBS-03 assertions — **4 passed, 0 failed; exit 0**. [Log](../../labs/lab-06/evidence/obs-03/green.txt). | Same command and assertions — **4 passed, 0 failed; exit 0**. [Final log](../../labs/lab-06/evidence/obs-04/final-regression.txt). |
| Related regression results | Frontend suite **24 passed**; F-02-filtered tests **4 passed** (16 excluded by filter); server event validation **5 passed**. Typecheck/build/whitespace checks passed. Exact outputs in [local-checks.txt](../../labs/lab-06/evidence/obs-03/local-checks.txt). | Local full suite: server **38 passed / 41 skipped**, client **27 passed / 1 failed**; the failure was the existing F-02 `TEST-F02-03/04/05` form-validation test. F-03 tests in the full run passed. OBS-03 regression **4 passed**, typecheck/build/diff-check passed. See [OBS-04 README](../../labs/lab-06/evidence/obs-04/README.md). |
| Fix commit | `6a8d10431161d5a92c749a7937f5afaa85099991` | `e734e950cc39fbd1f30d914a5e1ed569e1b9bc4a` |
| Pull request | [#68](https://github.com/Ttime52/EventCheck/pull/68), merged to `sprint-1-staging`; merge commit `1d03b52c5a5bedb92af257133b447b87b565a9db`. | [#69](https://github.com/Ttime52/EventCheck/pull/69), merged to `sprint-1-staging`; merge commit `7fb3620f2288b4062ccffa88c262bee42207dab5`. |
| Peer review | Approved by `@Ttime52`; reviewer requested an evidence-README refresh. The current README still says PR/CI are pending, so that documentation follow-up remains open. | Approved by `@KwanchanokThungsuk`; review noted nonblocking follow-ups to refresh the CI evidence reference and correct a broken evidence link. Local link checking confirms `diff-check.txt` is missing from the OBS-04 evidence directory; follow-up remains open. |
| CI | Workflow run `46044895856`: **SUCCESS** on PR #68. | Workflow run `46110592948`: **SUCCESS** on PR #69. The reviewer noted the unrelated F-02 failure was intermittent and also present on baseline; local failure remains recorded above. |
| Merge status | **MERGED**; GitHub Issue #65 currently **CLOSED**. | **MERGED**; GitHub Issue #66 currently **CLOSED**. |
| Deployment revision | **PENDING** — no verified corrected UAT revision/image recorded. | **PENDING** — no verified corrected UAT revision/image recorded. |
| Independent retest | **PENDING** — Sec01-Team047 must retest the deployed fix. | **PENDING** — Sec01-Team047 must retest the deployed fix. |
| Closure / acceptance status | GitHub issue is closed, but independent retest required by its acceptance text is still pending; do not record final UAT acceptance. | GitHub issue is closed, but independent retest required by its acceptance text is still pending; do not record final UAT acceptance. |

## 6. Non-defect, configuration, and release-verification findings

| Finding | Current conclusion | Required follow-up |
| --- | --- | --- |
| OBS-01 | Only a proposed cosmetic account-label enhancement; exact labels are not an application AC. | Confirm the agreed naming convention and whether Sec01-Team047 accepts the labels as a limitation. |
| OBS-02 | Proposed documentation/configuration issue, not a confirmed application defect. | Verify deployed identifiers, names, and roles; update the handoff without credentials. |
| OBS-05 | Proposed out-of-scope enhancement. F-03 and Q-11 exclude a Sprint 1 time cutoff. | Defer a past-event filter to the backlog only if desired; no Sprint 1 fix without approved scope change. |
| OBS-06 | Release traceability concern; classification remains pending. | Verify Cloud Run revision, image digest, tested SHA, and scope relationship. Do not close before this evidence exists. |
| OBS-07 | Confirmed test-data configuration issue, not an application authorization defect. | Resolve PR #70 review and account mapping, safely update the approved isolated UAT data, then request independent retest. |

No passwords, tokens, session cookies, or database credentials belong in the handoff or this register.

## 7. Outstanding UAT dependencies

- **Independent execution record:** The checked-in results file still marks UAT-01 through UAT-08 `NOT RUN`. Obtain the Sec01-Team047 report and original evidence files before recording actual results. The reported URL/SHA do not establish a Cloud Run revision or image digest.
- **UAT-01 / OBS-04:** Deploy the merged pluralization fix to the confirmed isolated UAT environment, then have Sec01-Team047 retest. The local screenshots use synthetic API fixtures and are not deployed-UAT evidence.
- **UAT-03 / OBS-07:** Verify Participant A/B accounts in isolated UAT, resolve PR #70 review, confirm the source account mapping, and complete the approved data correction before retest. CI and mocked tests do not establish that live accounts were changed.
- **UAT-05:** The UAT case requires two verified Organizer accounts. The handoff still says Organizer B is unconfirmed; PR #70 review reports Organizer A as `organizer-demo@example.com`, while the later request uses `organizer-a@example.test`. Resolve the mapping with the UAT/environment owner and obtain credentials privately. Do not make a live change until scope and target are verified.
- **UAT-06 / OBS-03:** Deploy the merged validation fix to the confirmed UAT revision, then obtain independent retest evidence.
- **UAT-07:** Confirm a safe application-restart procedure that preserves the UAT database. The test-case document still marks the procedure `TODO: Confirm`; run and record the restart persistence case only after the environment owner confirms it.
- **OBS-06:** Verify which commit/image/revision the independent team tested and whether it preserves the accepted Sprint 1 scope. Keep this finding open until deployment evidence is recorded.
- **Acceptance:** Do not mark any independent retest PASS or declare final Sprint 1 acceptance until Sec01-Team047 supplies the corresponding execution evidence and decision.

## 8. Review participation record

This table records observable GitHub activity, not approval of this triage document or independent UAT acceptance.

| Participant | Verified participation | Not established |
| --- | --- | --- |
| Vera Int. (`@Ttime52`) | Opened Issues #65–#67; assigned to #66 and #67; approved PR #68; authored PR #70. | Official team role/roster and approval of this triage document are not recorded. |
| Kwanchanok Thungsuk (`@KwanchanokThungsuk`) | Authored the recorded triage reviews on Issues #65–#67; assigned to #65; approved PR #69; requested changes on draft PR #70. | Official team role/roster and approval of this triage document are not recorded. |
| Sec01-Team047 | Independent UAT reporter for OBS-01–OBS-07 according to the supplied finding material and issue records for OBS-03/04/07. | No current independent retest or final acceptance evidence is in the repository. |

## 9. Final triage summary

| Measure | Verified count / status |
| --- | --- |
| Total reported findings | 7 |
| Confirmed Accepted Defects | 2 — OBS-03, OBS-04 |
| Confirmed Not Defect | 1 — OBS-07, Test Data Configuration Issue |
| Confirmed Duplicates | 0 |
| Confirmed Enhancements | 0 |
| Pending formal classification/decision | 4 — OBS-01, OBS-02, OBS-05, OBS-06 |
| Initial proposals among pending findings | OBS-01 enhancement; OBS-02 documentation/configuration; OBS-05 enhancement/out of scope; OBS-06 release-traceability verification |
| Accepted-defect code fixes merged | 2 — PRs #68 and #69 |
| Accepted defects awaiting deployment/retest | 2 — OBS-03, OBS-04 |
| Open test-data issue | OBS-07 / Issue #67; PR #70 updated with passing CI, pending peer re-review and UAT data correction |
| Final Sprint 1 UAT acceptance | **Not established** |

### Lab 6 Part C coverage check

- OBS-01 through OBS-07 are included, with facts separated from confirmed and proposed decisions.
- Classification, severity/user impact, contract references, rationale, disposition, ownership, evidence, issue/PR links, and retest/closure criteria are recorded.
- Unsupported contract IDs, owners, account mappings, deployment details, and team decisions are marked pending rather than inferred.
- Accepted defects have RED/GREEN, review, CI, merge, deployment, and independent-retest tracking; issue tracker closure is not represented as UAT acceptance.
- Review participation by both identified product contributors is recorded only to the extent shown by GitHub; document approval and Sec01-Team047 retest remain pending.
- No test result, deployment, independent PASS, or final acceptance has been fabricated.
