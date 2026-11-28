# Issue #65 — OBS-03 RED/GREEN evidence

## Identity and scope

- UAT: Sec01-Team047, UAT-06 / OBS-03; Accepted Minor Defect — Fix.
- Contract: F-02 AC-F02-14 (validation feedback), AC-F02-04 (date ordering), AC-F02-05 (positive integer capacity).
- Branch: `fix/uat-obs03-validation`.
- Baseline and unchanged HEAD: `9e764cd9ccad54e4f694e7581f7e6d702ae064c6`, matching `origin/sprint-1-staging` at inspection.
- Working tree was clean before this work. GREEN results cover uncommitted source/test changes on that baseline, not a new committed revision.
- Executed locally in Codex on macOS, 28 November 2026, Asia/Bangkok (UTC+7). Individual timestamps are in the logs.

## Root cause and correction

`publishEvent()` cleared stored API field errors and the form summary only when another submission began. The uncontrolled Create Event inputs had no change handler to reconcile those errors. After correcting End Time, native validation of Capacity 0 prevented a new submit event, leaving the old time error and summary displayed.

The form now uses one scoped `onChange` handler. It clears an existing error only when the corresponding control satisfies native constraints and has a nonblank value. For End Time, it also verifies valid Bangkok-converted instants and strict ordering. Changing Start Time rechecks the dependent End Time error. Unrelated errors remain; the obsolete form summary is cleared when the last stored field error is resolved. This is feedback reconciliation, not a replacement for authoritative API validation. The submission payload, backend rules, native constraints and timezone conversion implementation are unchanged.

## RED — original production implementation

- Test: `client/src/obs03-validation.test.tsx`.
- Scenario: `clears corrected time errors even when capacity 0 blocks the next native submission`.
- Command: `npm run test --workspace client -- src/obs03-validation.test.tsx`.
- Result: **1 failed, 0 passed; exit code 1**.
- Execution recorded: `2026-11-28T00:31:31.979972+07:00` (log capture completion).
- Original output: [red.txt](red.txt); original test snapshot: [red-test-source.txt](red-test-source.txt).
- Original test-source SHA-256: `8070004aaa5d4f3e6939e3e7a7a5ae90bfd1c8bc38aa9f4ae94c49425c6da3b9`.

The initial equal-time POST returned the mocked contract-shaped 422. The test observed both original errors, corrected End Time, set Capacity 0, and verified native range-underflow rejection, an `invalid` event, no second submit event and no second POST. It then failed specifically because:

1. `expect.soft(...queryByText(timeError)).not.toBeInTheDocument()` still found `endAt must be later than startAt`.
2. The status still contained `Event details are invalid`.
3. End Time still had `aria-invalid="true"` instead of `false`.

This was a genuine stale-state failure, not a test setup or dependency failure. Production code was unchanged during RED. The original regression scenario and its assertions were preserved for GREEN; three additional safeguards were appended afterward.

## GREEN and local regression verification

The same targeted command exited **0**, with **4 passed, 0 failed**, after the fix. See [green.txt](green.txt). The four cases verify:

1. OBS-03 correction plus native Capacity 0 rejection and no additional POST.
2. Correcting Start Time resolves the dependent End Time error.
3. Unresolved date ordering and unrelated title errors remain until corrected; the summary remains while an error remains.
4. Native rejection of capacity 0, -1, 1.5 and blank, without POST; capacity 1 satisfies native constraints with valid fields.

Additional executed checks are preserved in [local-checks.txt](local-checks.txt):

| Command | Result | Exit |
| --- | --- | --- |
| `npm run test --workspace client` | 24 passed, 0 failed, 0 skipped across 2 files: 20 existing + 4 new | 0 |
| `npm run test --workspace client -- src/App.test.tsx -t F-02` | 4 passed, 16 intentionally excluded by name filter, 0 failed | 0 |
| `npm run test --workspace server -- src/events.test.ts` | 5 passed, 0 failed | 0 |
| `npm run typecheck` | Server and client PASS | 0 |
| `npm run build` | Server and client PASS | 0 |
| `git diff --check` | PASS | 0 |

The filtered F-02 run repeats existing cases; it does not add unique tests. No lint script is configured in the root/client package scripts.

## Before/after and limitations

- Before: corrected End Time remained an alert and `aria-invalid=true`, with the stale form summary.
- After: the obsolete error, ARIA invalid state and summary clear; unrelated errors and native capacity rejection remain.
- These are React Testing Library/jsdom tests with mocked authentication/list/422 API responses. Invalid requests produce no extra publishing POST and no frontend success. They do **not** independently prove database persistence behavior. No database operation was executed; server validation code was not modified.
- No browser screenshots, Playwright execution, CI run, deployment or independent UAT retest are claimed. Those remain follow-up gates, including deployed-browser native validation and independent OBS-03 retest.
- No OBS-04/OBS-07, Sprint 2 features, contracts, schemas, authorization, existing UAT evidence or seed data were changed.

## Changed files and readiness

- `client/src/App.tsx`: scoped Create Event validation-feedback reconciliation.
- `client/src/obs03-validation.test.tsx`: four focused component tests.
- This directory: new report, separate original RED output/source snapshot, GREEN output and local-check output.

Ready for peer review of the local uncommitted change. Commit, PR creation, CI, deployment and independent UAT acceptance are pending owner instructions and the normal team review process.
