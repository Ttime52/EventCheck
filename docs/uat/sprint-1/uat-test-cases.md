# EventCheck Sprint 1 UAT Test Cases

**Package status:** Prepared; all cases are `NOT RUN`.
**Scope baseline:** Sprint 1 release candidate `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e` (documented in `docs/sprints/sprint-1/verification-results.md`).

## Scope

This package exercises only the delivered Sprint 1 features:

- F-01: seeded Participant and Organizer login, role identity, and logout.
- F-02: Organizer event creation, validation, publication, and owner event list/detail.
- F-03: public discovery, Participant self-registration, duplicate/full rejection, and personal registration retrieval.
- F-04: an owning Organizer's event registration list.

Cancellation, re-registration, registration deadlines, capacity changes, check-in, attendance, summaries, and reporting belong to later sprints and are excluded. Sprint 1 has no draft publishing workflow or unpublished Event state in the current schema; this package does not test those behaviors. The release report accepts unpublished-event coverage as a limitation.

This is a manual UAT package for a non-production deployment with persistent test data. Steps use the UI wherever it exposes the action. Browser DevTools is used only for direct authorization checks and the duplicate request that the UI correctly prevents after an active registration exists. Do not run these cases against production or use real personal data.

## Requirements and acceptance-criteria traceability

Requirement IDs refer to `docs/srs.md`; acceptance criteria refer to the approved Sprint 1 contracts in `docs/sprints/sprint-1/`.

| UAT case | Category | Requirement references | Acceptance criteria |
| --- | --- | --- | --- |
| UAT-01 | Normal | FR-01, FR-06, FR-08, FR-09, FR-11, FR-12, FR-13, FR-14, FR-15 | AC-F01-01; AC-F02-01, AC-F02-02, AC-F02-08, AC-F02-11, AC-F02-14; AC-F03-01, AC-F03-02, AC-F03-04, AC-F03-06, AC-F03-07, AC-F03-16; AC-F04-01, AC-F04-02, AC-F04-03, AC-F04-04, AC-F04-10 |
| UAT-02 | Business Rule | FR-13, FR-14, FR-16; BR-08 | AC-F03-06, AC-F03-07, AC-F03-08 |
| UAT-03 | Business Rule | FR-12, FR-13, FR-16; BR-09 | AC-F03-02, AC-F03-03, AC-F03-09 |
| UAT-04 | Forbidden Access | FR-05, FR-06, FR-08, FR-15; BR-01, BR-04 | AC-F01-05, AC-F01-08; AC-F02-06; AC-F04-06, AC-F04-08 |
| UAT-05 | Forbidden Access | FR-05, FR-09, FR-15; BR-02, BR-03, BR-04 | AC-F02-08; AC-F04-05, AC-F04-07, AC-F04-08 |
| UAT-06 | Business Rule | FR-07, FR-08; BR-05, BR-12 | AC-F02-01, AC-F02-02, AC-F02-03, AC-F02-04, AC-F02-05, AC-F02-14 |
| UAT-07 | Persistence | FR-03, FR-14, FR-15; BR-03, BR-04 | AC-F01-01; AC-F03-06, AC-F03-07, AC-F03-13; AC-F04-01, AC-F04-09 |
| UAT-08 | Normal | FR-01, FR-02, FR-03, FR-04 | AC-F01-01, AC-F01-02, AC-F01-12 |

The exact testable boundaries are in [F-01 Authentication](../../sprints/sprint-1/f-01-authentication.md), [F-02 Event Publishing](../../sprints/sprint-1/f-02-event-publishing.md), [F-03 Event Registration](../../sprints/sprint-1/f-03-event-registration.md), and [F-04 Organizer Registrations](../../sprints/sprint-1/f-04-organizer-registrations.md). Automated concurrency, transaction-failure, and exact session-expiry checks are recorded in the Sprint 1 verification evidence. UAT-07 additionally requests a controlled application restart to observe persistence through the UI.

## Shared execution rules and test data

1. Run only after the handoff owner confirms the deployment URL, deployed revision, a non-production test database, and private delivery of the required credentials.
2. Use a run ID such as `20261123-TEAM-A` in place of `<RUN_ID>` below. Choose a new run ID for each run. Do not reuse a title from an earlier run.
3. For each Event, enter start and end in the UI's **Asia/Bangkok (UTC+7)** timezone. Choose a future date at least seven days after execution; set the start to 09:00 ICT and end to 11:00 ICT unless a case says otherwise.
4. Do not run two testers against the same test accounts/Event at the same time. The test cases are independent when each uses its own `<RUN_ID>`-tagged records, except for their stated account prerequisites.
5. Never put passwords, session cookies, tokens, or database connection strings in this document or evidence. Obtain passwords privately from the UAT environment owner.
6. Event and Registration records are not deletable through the Sprint 1 UI. Record all generated Event IDs and Registration IDs. Use only the reset procedure approved by the non-production environment owner after execution; do not delete records directly or reset a shared/production database.

Common synthetic values (change only the run token and future date):

| Field | Value |
| --- | --- |
| Organizer test account | `organizer@example.test` / display name `Demo Organizer` in local seeded environments; deployed account label: `TODO: Confirm` |
| Participant A test account | `participant@example.test` / display name `Demo Participant` in local seeded environments; deployed account label: `TODO: Confirm` |
| Participant B test account | `TODO: Confirm` a separately provisioned synthetic Participant and private credential delivery; required for UAT-03 |
| Organizer B test account | `TODO: Confirm` a separately provisioned synthetic Organizer and private credential delivery; required for UAT-05 |
| Normal journey title | `UAT-<RUN_ID>-01 Normal Journey` |
| Duplicate case title | `UAT-<RUN_ID>-02 Duplicate Rule` |
| Full-capacity case title | `UAT-<RUN_ID>-03 One Place` |
| Role denial case title | `UAT-<RUN_ID>-04 Authorization Fixture` |
| Cross-owner case title | `UAT-<RUN_ID>-05 Owner Fixture` |
| Validation case titles | `UAT-<RUN_ID>-06 Whitespace`, `UAT-<RUN_ID>-06 Equal Time`, `UAT-<RUN_ID>-06 Reversed Time`, `UAT-<RUN_ID>-06 Zero Capacity`, `UAT-<RUN_ID>-06 Capacity One` |
| Persistence case title | `UAT-<RUN_ID>-07 Persistent Registration` |
| Generic description | `Synthetic Sprint 1 UAT event. No real attendee data.` |
| Location | `CPE Test Hall A` |

## UAT-01 — Complete Organizer-to-Participant registration journey

- **Category:** Normal
- **Requirement references:** FR-01, FR-06, FR-08, FR-09, FR-11, FR-12, FR-13, FR-14, FR-15
- **Acceptance criteria:** AC-F01-01; AC-F02-01, AC-F02-02, AC-F02-08, AC-F02-11, AC-F02-14; AC-F03-01, AC-F03-02, AC-F03-04, AC-F03-06, AC-F03-07, AC-F03-16; AC-F04-01, AC-F04-02, AC-F04-03, AC-F04-04, AC-F04-10
- **Objective:** Verify the end-to-end Sprint 1 journey creates one published Event, discovers it publicly, registers one Participant, and exposes the same committed Registration to that Participant and its owning Organizer.
- **User roles:** Organizer, Participant
- **Preconditions:** Confirmed non-production application URL; valid Organizer and Participant accounts; no concurrent test using this case's `<RUN_ID>` title.
- **Test data:** Title `UAT-<RUN_ID>-01 Normal Journey`; generic description; location `CPE Test Hall A`; future date at least seven days away, 09:00–11:00 ICT; capacity `3`.
- **Test steps and expected results:**
  1. Open the confirmed application URL. Sign in as the Organizer. **Expected:** the signed-in identity shows `Demo Organizer` (or the confirmed deployed label) and role `ORGANIZER`; the Organizer event form is available.
  2. Open **Create Event**. Confirm the form labels title, description, location, start/end time and positive integer capacity, with date/time labelled Asia/Bangkok (UTC+7). Use Tab to move through the six fields to **Publish event**; each control is reachable and focus is visible. Enter the test data and select **Publish event**. **Expected:** a success status says `Event published` and supplies an Event ID; no draft step is required.
  3. Open **My Events**. Find the exact test title and open its details. **Expected:** one owned published Event is listed with the submitted fields, capacity `3`, and the returned Event ID. Select **View registrations** before any Participant registers. **Expected:** the UI displays `0 registrations` and `No registrations for this event yet.` with no unrelated rows; keyboard focus moves to the registration-list heading. Return to Event details.
  4. Select **Log out**. Sign in as Participant A, then open **Discover Events**. **Expected:** the exact published title is visible publicly; no participant identity or private registration list appears.
  5. Open **View details** for the test Event. **Expected:** title, description, location, start/end time in Bangkok time, capacity `3`, `3 remaining`, and `Available` are shown.
  6. Select **Register** once. **Expected:** a `Registration confirmed` status appears; availability decreases to `2 remaining`.
  7. Open **View My Registrations** and open the matching registration detail. **Expected:** the Event title and details, stable Registration ID, `ACTIVE` status, and registration timestamp are visible.
  8. Log out, sign in again as the owning Organizer, open **My Events**, open this Event, then select **View registrations**. **Expected:** exactly one row for the Registration from step 7 appears, with the same Registration ID, Participant ID/display name, `ACTIVE` status, and registration time. No unrelated Event registration appears.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record screenshot/observation IDs; do not capture passwords or session cookies._
- **Cleanup / reset:** Record Event ID and Registration ID. Apply the approved non-production reset procedure after the run; otherwise retain the tagged records and report their IDs to the environment owner for cleanup.

## UAT-02 — Reject a duplicate active registration

- **Category:** Business Rule
- **Requirement references:** FR-13, FR-14, FR-16; BR-08
- **Acceptance criteria:** AC-F03-06, AC-F03-07, AC-F03-08
- **Objective:** Verify that the same Participant cannot create a second active Registration for the same Event and that the original record/count remains unchanged.
- **User roles:** Organizer, Participant
- **Preconditions:** Valid Organizer and Participant A accounts; browser DevTools available; isolated non-production deployment. Use a new Event and `<RUN_ID>`.
- **Test data:** Title `UAT-<RUN_ID>-02 Duplicate Rule`; generic description; location `CPE Test Hall A`; future date; capacity `2`.
- **Test steps and expected results:**
  1. As Organizer, create and publish the Event. Record its Event ID. **Expected:** one Event is published with capacity `2`.
  2. Log out. As Participant A, discover the Event and register once. **Expected:** one confirmation; the Participant's My Registrations list has exactly one matching item with one Registration ID and `ACTIVE` status.
  3. While still signed in as Participant A, open the browser's same-origin DevTools Console. Replace `<EVENT_ID>` with the ID from step 1 and run:

     ```js
     fetch('/api/v1/events/<EVENT_ID>/registrations', {
       method: 'POST',
       credentials: 'include',
       headers: { 'Content-Type': 'application/json' },
       body: '{}'
     }).then(async r => ({ status: r.status, body: await r.json() }))
     ```

     **Expected:** HTTP `409`; response error code `REGISTRATION_DUPLICATE` and an actionable message. The request does not return a second successful Registration.
  4. Return to the UI and refresh **My Registrations**. **Expected:** the same original Registration ID/status remains and only one item for this Event is shown.
  5. Log out, sign in as the owning Organizer, and open the Event's registration list. **Expected:** exactly one registration remains; its ID matches step 2 and the Event availability remains `1`.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record the response status/error observation and UI screenshot IDs. Redact cookies and credentials._
- **Cleanup / reset:** Record Event and Registration IDs; use the approved non-production reset procedure.

## UAT-03 — Reject registration when capacity is full

- **Category:** Business Rule
- **Requirement references:** FR-12, FR-13, FR-16; BR-09
- **Acceptance criteria:** AC-F03-02, AC-F03-03, AC-F03-09
- **Objective:** Verify that a distinct Participant cannot register after all available places are consumed and that no extra Registration is created.
- **User roles:** Organizer, Participant A, Participant B
- **Preconditions:** Valid Organizer and Participant A accounts; **a second distinct Participant B account must be provisioned for the UAT environment**. Its label and private credential delivery are `TODO: Confirm`. Without Participant B, record this case as `BLOCKED`; do not substitute the Organizer or reuse Participant A because duplicate-first handling is a different rule.
- **Test data:** Title `UAT-<RUN_ID>-03 One Place`; generic description; location `CPE Test Hall A`; future date; capacity `1`.
- **Test steps and expected results:**
  1. As Organizer, create and publish the capacity-1 Event. **Expected:** the Event displays `1 remaining` and `Available`.
  2. Log out and sign in as Participant A. Register for the Event. **Expected:** registration succeeds once; remaining places become `0` and the Event is shown as `Full` / unavailable.
  3. Log out and sign in as Participant B, who has no registration for this Event. Open the Event details. **Expected:** zero remaining places and unavailable state are shown; no successful-registration confirmation is shown.
  4. If the UI still presents a Register action, select it once. If the UI correctly hides the action for a full Event, use the same-origin DevTools POST from UAT-02 with this Event ID. **Expected:** the user sees an unavailable/full outcome; if the direct request is sent, the response is HTTP `409` with code `EVENT_FULL`.
  5. Sign in as the owning Organizer and open the Event registration list. **Expected:** exactly one Registration exists (Participant A); no Participant B row exists; remaining places stay at `0`.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record the capacity display, rejection and Organizer list evidence IDs._
- **Cleanup / reset:** Record Event and Registration IDs; use the approved non-production reset procedure.

## UAT-04 — Deny Organizer-only actions to a Participant

- **Category:** Forbidden Access
- **Requirement references:** FR-05, FR-06, FR-08, FR-15; BR-01, BR-04
- **Acceptance criteria:** AC-F01-05, AC-F01-08; AC-F02-06; AC-F04-06, AC-F04-08
- **Objective:** Verify both UI role restrictions and backend denial for Organizer-only publication and registration-list access; confirm the rejected create attempt does not add protected data.
- **User roles:** Organizer, Participant
- **Preconditions:** Valid Organizer and Participant A accounts; browser DevTools available; non-production deployment. No second Organizer is needed.
- **Test data:** Organizer fixture title `UAT-<RUN_ID>-04 Authorization Fixture`; attempted Participant-created title `UAT-<RUN_ID>-04 DENIED`; generic description; location `CPE Test Hall A`; future date; capacity `2`.
- **Test steps and expected results:**
  1. As Organizer, record the current count in **My Events**, then create/publish the fixture Event. Record its Event ID and updated count. **Expected:** the Event appears in the owner's list and the count increases by one.
  2. Log out and sign in as Participant A. Register once for the fixture Event. **Expected:** one Participant Registration is saved; the app identifies role `PARTICIPANT`; Organizer event creation and **My Events** management controls are not available.
  3. In the same-origin DevTools Console, attempt to create a valid event using the following request (substitute the future date from the shared rules, formatted as `YYYY-MM-DDT09:00:00+07:00` for start and `YYYY-MM-DDT11:00:00+07:00` for end, and a unique title):

     ```js
     fetch('/api/v1/events', {
       method: 'POST',
       credentials: 'include',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         title: 'UAT-<RUN_ID>-04 DENIED',
         description: 'Synthetic forbidden-action check.',
         location: 'CPE Test Hall A',
         startAt: '<FUTURE_START_ISO_WITH_OFFSET>',
         endAt: '<FUTURE_END_ISO_WITH_OFFSET>',
         capacity: 2
       })
     }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))
     ```

     **Expected:** HTTP `403` forbidden; no Event data is returned and the response does not indicate a successful Event ID.
  4. Still as Participant A, use the console to request the fixture's protected registration list: `fetch('/api/v1/organizer/events/<EVENT_ID>/registrations', { credentials: 'include' }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))`. **Expected:** HTTP `403`; no `data.registrations`, participant identifiers, or display names are returned.
  5. Sign out and sign back in as Organizer. Check **My Events** and search the public **Discover Events** list for `UAT-<RUN_ID>-04 DENIED`. **Expected:** the denied title is absent; the Organizer's Event count is unchanged from step 1. Open the fixture's registration list. **Expected:** its single pre-existing Registration and ID remain unchanged; the denied requests added no Event or Registration and changed no protected data.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record UI role state, redacted status/error observations, and before/after list evidence._
- **Cleanup / reset:** Record fixture Event ID and Registration ID; use the approved non-production reset procedure.

## UAT-05 — Deny a non-owning Organizer access to registrations

- **Category:** Forbidden Access
- **Requirement references:** FR-05, FR-09, FR-15; BR-02, BR-03, BR-04
- **Acceptance criteria:** AC-F02-08; AC-F04-05, AC-F04-07, AC-F04-08
- **Objective:** Verify that Organizer B cannot retrieve a Registration list for an Event owned by Organizer A and that the denial exposes no protected fields or alters records.
- **User roles:** Organizer A, Organizer B
- **Preconditions:** A valid Organizer A account and a **separate Organizer B account** must exist in the non-production environment. Organizer B's label and private credential delivery are `TODO: Confirm`. If it is unavailable, record `BLOCKED`; do not use Participant B or claim the cross-owner check passed.
- **Test data:** Title `UAT-<RUN_ID>-05 Owner Fixture`; create it as Organizer A with generic description, location `CPE Test Hall A`, future time, and capacity `2`. Register Participant A once so the protected list contains a synthetic row.
- **Test steps and expected results:**
  1. As Organizer A, create/publish the Event, then have Participant A register once. Record the Event ID, Registration ID, and the owner's visible row count. **Expected:** the owning Organizer can see the one registration.
  2. Log out and sign in as Organizer B. **Expected:** the app shows Organizer B's own identity; Organizer A's Event is not in Organizer B's **My Events** list.
  3. In the same-origin DevTools Console, run `fetch('/api/v1/organizer/events/<EVENT_ID>/registrations', { credentials: 'include' }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))`. **Expected:** HTTP `404` (privacy-preserving not-found); no registrations, Registration ID, Participant ID/display name, Event title, or owner identity appears in the response.
  4. Log out and sign in as Organizer A. Reopen the fixture Event's registration list. **Expected:** its original single row and Registration ID remain unchanged; no record was created, changed, or removed by Organizer B's request.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record Organizer B's safe status/body observation with private identifiers redacted, and before/after owner list evidence._
- **Cleanup / reset:** Record Event and Registration IDs; use the approved non-production reset procedure.

## UAT-06 — Enforce event publication fields and capacity boundaries

- **Category:** Business Rule
- **Requirement references:** FR-07, FR-08; BR-05, BR-12
- **Acceptance criteria:** AC-F02-01, AC-F02-02, AC-F02-03, AC-F02-04, AC-F02-05, AC-F02-14
- **Objective:** Verify that invalid event details do not publish or persist a partial Event, and that capacity `1` is accepted.
- **User roles:** Organizer
- **Preconditions:** Valid Organizer account; a non-production deployment; no concurrent changes to the Organizer event list during the case.
- **Test data:** Use unique `<RUN_ID>` titles from the shared table. Keep all otherwise-valid fields populated. For date tests choose a future date at least seven days away.
- **Test steps and expected results:**
  1. Sign in as Organizer and open **Create Event**. Confirm all six fields are labelled, required, and the time fields specify Asia/Bangkok (UTC+7). Focus the Title field and use Tab through the remaining controls to **Publish event**. **Expected:** all fields are available, keyboard reachable, and show visible focus; no separate draft step is required.
  2. Enter title `UAT-<RUN_ID>-06 Whitespace`, a description containing only spaces, valid location and future start/end, and capacity `2`; select **Publish event**. **Expected:** a field-level description validation error appears; no success message/Event ID is shown; after opening **My Events**, no Event with this title exists.
  3. Return to **Create Event**. Enter title `UAT-<RUN_ID>-06 Equal Time`, valid nonblank description/location, identical future start and end times, capacity `2`; submit. **Expected:** date validation explains or marks the invalid time. Open **My Events** and **Discover Events**; no Event with this title is listed or discoverable.
  4. Return to **Create Event**. Enter title `UAT-<RUN_ID>-06 Reversed Time`, valid nonblank description/location, future start at 11:00 and end at 09:00 on the same date, capacity `2`; submit. **Expected:** date validation rejects the submission. Open **My Events** and **Discover Events**; no Event with this title is listed or discoverable.
  5. Return to **Create Event**. Enter title `UAT-<RUN_ID>-06 Zero Capacity`, valid text and future times, capacity `0`; submit. **Expected:** the browser prevents submission and flags capacity as invalid; no success message/Event ID appears. Open **My Events** and **Discover Events**; no Event with this title is listed or discoverable.
  6. Return to **Create Event**. Enter title `UAT-<RUN_ID>-06 Capacity One`, valid text and future times, capacity `1`; submit. **Expected:** publication succeeds once with an Event ID; **My Events** shows capacity `1`; public discovery shows the same capacity and `1 remaining` before any Participant registers.
  7. If the Event detail exposes capacity as read-only, confirm it cannot be changed in the UI. **Expected:** no Sprint 1 capacity-edit control is available.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record each validation message and list/discovery result; no passwords in screenshots._
- **Cleanup / reset:** Record the valid capacity-1 Event ID. Rejected attempts should have no Event IDs. Use the approved non-production reset procedure for the accepted Event.

## UAT-07 — Retrieve a registration after logout and a new login

- **Category:** Persistence
- **Requirement references:** FR-03, FR-14, FR-15; BR-03, BR-04
- **Acceptance criteria:** AC-F01-01; AC-F03-06, AC-F03-07, AC-F03-13; AC-F04-01, AC-F04-09
- **Objective:** Verify that the Participant's Registration remains available after logout and a fresh login and is still visible to the owning Organizer.
- **User roles:** Organizer, Participant
- **Preconditions:** Valid Organizer and Participant A accounts; isolated non-production environment; the environment owner can restart the application without resetting the UAT database, or can perform the restart while preserving that database. The approved restart procedure is `TODO: Confirm`.
- **Test data:** Title `UAT-<RUN_ID>-07 Persistent Registration`; generic description; location `CPE Test Hall A`; future date; capacity `2`.
- **Test steps and expected results:**
  1. As Organizer, create/publish the Event and record its Event ID. Log out, sign in as Participant A, discover the Event, register once, and record the Registration ID from **My Registrations** details. **Expected:** one active Registration is shown.
  2. Select **Log out**. **Expected:** the Login form is shown and the Participant identity is no longer displayed.
  3. Sign in again as Participant A, open **My Registrations**, and find the test Event. **Expected:** the Registration remains present with the same Registration ID, Event ID/title, `ACTIVE` status, and registration timestamp as step 1.
  4. Refresh the page and reopen the Registration details. **Expected:** the same values remain visible after refresh; no second Registration appears.
  5. Ask the UAT environment owner to restart only the application service using the confirmed non-destructive procedure; wait for the service to report ready, then open/reload the application URL. **Expected:** the URL is available and the UAT database has not been reset.
  6. Sign in as Participant A again and open **My Registrations**. **Expected:** the same Registration ID, Event ID/title, `ACTIVE` status, and timestamp remain visible in the new application process.
  7. Log out and sign in as the owning Organizer. Open the Event registration list. **Expected:** the same single Registration ID and Participant display name/status/time appear.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record redacted before/after-login and Organizer list evidence IDs._
- **Cleanup / reset:** Record Event and Registration IDs; use the approved non-production reset procedure.

This case requires a controlled application restart while preserving the UAT database so the independent tester can observe the restart-persistence criteria through the UI. If the environment owner cannot provide a safe restart procedure, mark this case `BLOCKED`; do not claim AC-F03-13/AC-F04-09 were manually verified.

## UAT-08 — Reject invalid credentials and end a valid session

- **Category:** Normal
- **Requirement references:** FR-01, FR-02, FR-03, FR-04
- **Acceptance criteria:** AC-F01-01, AC-F01-02, AC-F01-12
- **Objective:** Verify safe invalid-login feedback, server-derived role identity after valid login, and return to the signed-out UI after logout.
- **User roles:** Organizer (login requester)
- **Preconditions:** Confirmed application URL and valid Organizer account; tester has the correct password privately. Do not record either password.
- **Test data:** Organizer login label from the handoff; an intentionally incorrect synthetic password entered only in the UI for the negative attempt; then the valid credential provided privately.
- **Test steps and expected results:**
  1. Open the Login form and use Tab to reach the login identifier, password, and **Log in** controls. **Expected:** each control has a visible label, is keyboard reachable, and shows visible focus.
  2. Enter the Organizer login identifier with an intentionally incorrect password and select **Log in**. **Expected:** a generic `Invalid credentials` message appears; the app remains signed out and shows no authenticated identity or Organizer controls.
  3. Replace the password with the privately supplied valid password and select **Log in**. **Expected:** login succeeds; the displayed name and role match the seeded/provisioned Organizer account; no password/session identifier is shown.
  4. Select **Log out**. **Expected:** the Login form returns and the authenticated identity is no longer shown.
  5. Refresh the browser. **Expected:** the user remains signed out; protected Organizer controls are not displayed until signing in again.
- **Actual results:**
- **Status:** NOT RUN
- **Evidence:** _Record generic error and signed-in/signed-out UI evidence IDs. Never capture credentials or session cookies._
- **Cleanup / reset:** No Event/Registration data is created. Close the test browser session after recording observations.

## Coverage notes and known limits

- UAT-03 requires Participant B and UAT-05 requires Organizer B. The repository's development seed documents only one Participant and one Organizer; these additional deployed test accounts are not confirmed. Confirm their provisioning and private credential delivery before scheduling those cases.
- The Event schema supports only published Events in the accepted Sprint 1 implementation, so a UI UAT of unpublished-event discovery/registration is not applicable to the shipped state model.
- Manual UAT does not reproduce synchronized last-place races, database failure injection, or exact 30-minute/8-hour expiry boundaries. Those remain covered by the repository's recorded automated verification and are not claimed as manual UAT results.
- Fixed published capacity and absence of capacity editing are in scope. Sprint 2 capacity modification and deadlines are excluded.

## Documentation discrepancies to reconcile before formal handoff

- `docs/traceability.md` Section 1 says the Sprint 1 F-01 through F-04 contracts remain drafts and are not accepted for implementation. The feature contracts and `docs/sprints/sprint-1/verification-results.md` instead record approved/pass status and an approved Sprint 1 candidate.
- `README.md` says the Sprint 1 release still requires teammate review, integration checks, and the Product Definition of Done; the Sprint 1 verification report records the final decision as Approved/Pass.
- This UAT package follows the individual F-01 through F-04 contracts and final Sprint 1 verification record for scope and baseline. Reconcile the stale status statements before presenting the repository as a single handoff source of truth.

## Per-case execution record

Use [uat-execution-results.md](uat-execution-results.md) for the independent team's run-by-run results. Do not change a case to PASS until it has actually been executed against the confirmed deployed version with evidence recorded.
