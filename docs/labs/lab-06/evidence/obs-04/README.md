# OBS-04 evidence — Issue #66

## Identity and traceability

- GitHub issue: [#66 — Incorrect pluralization of remaining places](https://github.com/Ttime52/EventCheck/issues/66).
- UAT: `UAT-01` / `OBS-04`, reported by `Sec01-Team047`; accepted cosmetic defect, Minor severity, disposition Fix.
- Feature and contract: Sprint 1 F-03 Event Discovery / Availability Display; `AC-F03-02` (capacity, remaining places, availability) and `AC-F03-03` (full/unavailable states).
- Reported UAT version: `3821443` (from Issue #66).
- Tested code baseline: `origin/sprint-1-staging` at `1d03b52c5a5bedb92af257133b447b87b565a9db`, including merged PR #68 / OBS-03.
- Working branch: `fix/uat-obs04-pluralization-staging`, created cleanly from that baseline.
- The suggested local branch name `fix/uat-obs04-pluralization` already pointed to `71296da` and included 42 commits beyond staging. It was left unchanged; this fix uses the clean branch above to keep unrelated work out of the PR.

## Root cause and fix

The Event Discovery badge always appended `places` to the remaining count. Its CSS transforms the label to uppercase, so a count of one appeared as `1 PLACES`. The badge now uses `place` only when `remainingPlaces === 1` and retains `places` for all other available counts. The capacity calculation, API, full-event label, zero-place detail, and registration behavior are unchanged.

## RED — original implementation

- Regression test: `client/src/obs04-pluralization.test.tsx`.
- Failing test name: `UAT-01 OBS-04 event availability pluralization > renders the correct badge for 1 remaining place(s)`.
- Command: `npm.cmd run test --workspace client -- src/obs04-pluralization.test.tsx`.
- Baseline commit: `1d03b52c5a5bedb92af257133b447b87b565a9db`.
- Result: **1 failed, 3 passed; exit code 1**. The exact failure was `Expected /^1 PLACE$/i; Received: 1 places`. The 2-place, 5-place, and full/zero-place cases passed. Production source was unchanged for this run.
- Preserved original output: [red.txt](red.txt). The exact test source and defective JSX excerpt are [red-test-source.txt](red-test-source.txt) and [red-source-fragment.txt](red-source-fragment.txt); baseline and source hashes are in [red-metadata.txt](red-metadata.txt).

## GREEN — fixed implementation

- The same regression file, test names, and assertions were run unchanged; its SHA-256 matches the RED snapshot.
- Command: `npm.cmd run test --workspace client -- src/obs04-pluralization.test.tsx`.
- Result: **4 passed, 0 failed; exit code 0**. The final post-screenshot-restoration run is in [final-regression.txt](final-regression.txt); the first GREEN run is in [green.txt](green.txt), with hash comparison in [green-metadata.txt](green-metadata.txt).
- Coverage includes `1 PLACE`, `2 PLACES`, `5 PLACES`, and preserved full-event behavior (`Full`, `0 remaining`, and no Register action).

## Additional verification

| Command | Result | Evidence |
| --- | --- | --- |
| `npm.cmd test` | Server: 38 passed, 41 skipped; client: 27 passed, 1 failed. The one failure is the existing F-02 test `TEST-F02-03/04/05: maps API validation details to the event form`, which could not find `capacity must be a positive integer.` The full run executed the F-03 cases; all five passed. Overall exit code 1. | [regression.txt](regression.txt) |
| `npm.cmd run test --workspace client -- src/obs03-validation.test.tsx` | 4 passed, 0 failed; exit code 0. | [obs03-regression.txt](obs03-regression.txt) |
| `npm.cmd run typecheck` | Server and client TypeScript checks passed; exit code 0. | [final-typecheck.txt](final-typecheck.txt) |
| `npm.cmd run build` | Server and client production builds passed; exit code 0. | [final-build.txt](final-build.txt) |
| `git diff --check` | Passed; exit code 0. | [diff-check.txt](diff-check.txt) |

The full run skipped 41 server integration tests because this environment had no integration database configured. A separate name-filtered attempt, `npm.cmd run test --workspace client -- src/App.test.tsx -t F-03`, is preserved in [f03-regression.txt](f03-regression.txt); those legacy tests rely on a fetch mock initialized by an earlier test in the same file, so filtering them out caused setup errors before their assertions. Their unfiltered executions are included in `regression.txt` and passed. The unrelated F-02 failure remains for separate investigation.

## Browser evidence

Real headless Chromium screenshots were captured from the local Vite app with synthetic API fixtures routed by Playwright. They show the actual page and existing uppercase badge styling; they do not represent a deployed environment.

- Before: [ui-before.png](ui-before.png) shows `1 PLACES`, `2 PLACES`, and `5 PLACES`.
- After: [ui-after.png](ui-after.png) shows `1 PLACE`, `2 PLACES`, and `5 PLACES`.
- Capture script and observed labels: [capture-ui.mjs](capture-ui.mjs), [ui-before.txt](ui-before.txt), and [ui-after-restored.txt](ui-after-restored.txt).

## Changed files

- `client/src/App.tsx` — conditional singular/plural badge text.
- `client/src/obs04-pluralization.test.tsx` — rendered UI regression scenarios.
- [pr-description.md](pr-description.md) — prepared draft PR description.
- `docs/labs/lab-06/evidence/obs-04/` — RED/GREEN logs and snapshots, verification logs, browser capture script, screenshots, and this report.

## Review and release status

- Fix commit: [`e734e950cc39fbd1f30d914a5e1ed569e1b9bc4a`](https://github.com/Ttime52/EventCheck/commit/e734e950cc39fbd1f30d914a5e1ed569e1b9bc4a).
- Draft pull request targeting `sprint-1-staging`: [#69](https://github.com/Ttime52/EventCheck/pull/69).
- CI status: workflow run [46110248329](https://github.com/Ttime52/EventCheck/actions/runs/46110248329) **passed** for PR head `01cdda794fc3b17c4274586e44dd77848faea56c`. Backend unit and PostgreSQL integration tests, frontend tests (28/28), typecheck, build, Playwright E2E (16/16), and Docker image build all passed. See [ci-status-success.txt](ci-status-success.txt); the evidence update now triggers a docs-only rerun, so use [PR #69](https://github.com/Ttime52/EventCheck/pull/69) for the latest check.
- Deployment: **Pending**.
- Independent UAT retest: **Pending**; Sec01-Team047 must retest the corrected release after deployment. No PASS is claimed.
