# PR: [Docs] Update SRS, SDS & Requirements Traceability

**Base:** `sprint-2-staging`
**Head:** `docs/sprint-2-requirements`
**Reviewer:** Student 1

## Summary

Update EventCheck's engineering documentation to distinguish accepted Sprint 1 and Sprint 2 behavior from implementation, test execution, feature acceptance, release status, and partial Sprint 3 F-08 progress. Preserve existing FR/BR/NFR IDs and expose missing evidence instead of inferring completion.

## Files changed

- Updated `docs/srs.md`, `docs/features.md`, `docs/system-sds.md`, `docs/traceability.md`, and `docs/sprints/plan.md`.
- Added the full 38-row F-05/F-06/F-07 AC verification matrix at `docs/sprints/sprint-2/ac-verification.md`.
- Added Sprint 1 continuity/change/defect evidence at `docs/sprints/sprint-2/continuity-and-change-register.md`.
- Added F-08 progress and remaining-work plan at `docs/sprints/sprint-3/remaining-work.md`.
- Added rubric navigation at `docs/deliverable-2-evidence-map.md`.
- Updated Issue 15's status wording for the later PR #61 merge and recorded this PR description in this file.

## Requirements coverage

The traceability matrix maps all 23 baseline FRs, 18 BRs, and 12 important NFRs to feature/responsibility, sprint, AC/STS, actual tests/results/tested version, and gaps. Existing IDs and sprint allocation are preserved. D-10/BR-18 remain proposed; F-08 progress is marked partial.

## Sprint 2 AC verification

The matrix covers all 38 accepted ACs: F-05 (12 automated plus one manual evidence-review AC), F-06 (13), and F-07 (12). Issue 15 reports passing outcomes on implementation SHA `107c93eafbc5c2afb29527336665a6d38269c478`; F-05/F-07 restart checks were last run on `b9df85c`, and F-06 restart was part of the 107c93e run. GitHub Actions run 45869394130 passed on corrected head `fda1a77`. PR #61 merged the tested source/test tree into `sprint-2-staging` at `f08177c`; Sprint 2 release acceptance and Issue 17 exact-candidate verification remain pending.

## Sprint 1 continuity and change register

The register records accepted Sprint 1 candidate `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e`, PR #20, no release tag, PR #45 merge to main, current-candidate regression evidence, historical Lab 5 deployment, unexecuted Sprint 1 UAT templates, and missing Lab 6/7 reports. It distinguishes resolved Issue 15 test/setup corrections from application defects; Issue 15 found no application defect in its tested scope.

## Sprint 3 F-08 progress

F-08 is PARTIAL. The Organizer view derives six lifecycle/capacity counts and component/E2E tests exercise cancellation-history and active-attendance counting on `107c93e`. No F-08 contract, accepted AC/STS, dedicated summary API, attendance rate, zero-active N/A behavior, or formal acceptance record was found in inspected refs. The remaining-work table gives proposed owners and target dates through 13 December 2026.

## Remaining evidence gaps

- Issue 17 must repeat required checks on the exact release candidate and record release acceptance.
- No Sprint 2 GCP deployment/revision/image digest evidence is recorded; Lab 5 evidence is historical.
- Sprint 1 UAT execution remains `NOT RUN`; Lab 6/7 reports were not found in the inspected refs.
- NFR-07 quantitative measurements and complete final keyboard/viewport walkthrough remain outstanding.
- F-08 policy, contract, full implementation and verification remain open.
- Final PDF page numbers remain blank until Issue 17 assembles and inspects the single self-contained PDF.

## Deliverable 2 rubric coverage

The evidence map covers Parts A–E, identifies the source artifact and actual issue/PR/test/commit references, and marks completion status plus intended PDF section. The PDF page column deliberately remains unassigned until assembly. Repository links are navigation aids; Issue 17 must embed the complete required content/evidence in one PDF.

## Reviewer checklist

- [ ] FR/BR/NFR IDs and the approved Sprint 1/Sprint 2 allocation are preserved.
- [ ] Accepted Sprint 2 policy and F-05/F-06/F-07 contract status match the linked contracts.
- [ ] Every AC result is tied to the actual test file/function and tested version; AC-F05-13 is clearly labeled manual.
- [ ] Sprint 2 implementation/test results are not described as release acceptance or deployment.
- [ ] F-08 is marked partial; D-10/BR-18 remain proposed.
- [ ] UAT/Lab 6/7/release/performance gaps are visible and no defects or results are invented.
- [ ] Local document links and referenced AC/STS/test/PR/commit IDs resolve.
- [ ] No secrets are included.
