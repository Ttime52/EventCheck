# fix(uat): correct event availability pluralization (OBS-04)

Fixes #66

## UAT reference

- Finding: OBS-04
- Test case: UAT-01 — Organizer-to-Participant Registration Journey
- Reporter: Sec01-Team047
- Feature: Sprint 1 F-03 Event Discovery / Availability Display
- Contract criteria: AC-F03-02 and AC-F03-03

## Root cause

Event Discovery always appended `places` to the remaining-place count. The existing badge styling displays uppercase text, so an event with one place remaining showed `1 PLACES`.

## Changes

- Render `place` when exactly one place remains and `places` otherwise.
- Add a rendered UI regression test for 1, 2, and 5 remaining places, plus the existing full/zero-place behavior.
- Add Lab 6 Part D RED/GREEN logs, browser screenshots, and traceability evidence under `docs/labs/lab-06/evidence/obs-04/`.

Capacity calculations, API contracts, registration behavior, and full-event wording are unchanged.

## RED → GREEN evidence

- RED on baseline `1d03b52c5a5bedb92af257133b447b87b565a9db`: `npm.cmd run test --workspace client -- src/obs04-pluralization.test.tsx` failed specifically with `Expected /^1 PLACE$/i; Received: 1 places` (1 failed, 3 passed).
- GREEN on the same test file and unchanged assertions: the same command passed (4 passed, 0 failed).
- Logs and source snapshots: `red.txt`, `green.txt`, and `red-test-source.txt` in `docs/labs/lab-06/evidence/obs-04/`.

## Verification

- `npm.cmd run typecheck` — passed.
- `npm.cmd run build` — passed.
- `npm.cmd run test --workspace client -- src/obs03-validation.test.tsx` — 4 passed.
- `npm.cmd test` — server 38 passed / 41 skipped; client 27 passed / 1 failed. The remaining failure is the F-02 test `TEST-F02-03/04/05: maps API validation details to the event form`; the 41 skipped server integration tests require a configured test database. See `regression.txt` for the full output.
- Local Chromium evidence shows the badge before and after; screenshots are synthetic fixture renders and are not deployment evidence.

## Lab 6 Part D status

RED and GREEN evidence are captured, and this branch is ready for peer review. Hosted CI, deployment, and the external team's independent UAT retest are pending. Independent UAT retest is not marked PASS.
