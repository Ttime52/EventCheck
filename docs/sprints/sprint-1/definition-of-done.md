# Sprint 1 Product Definition of Done

**Applies to:** F-01 through F-04 and Sprint 1 cross-cutting responsibilities

**Document version:** 0.1

**Status:** Shared completion standard for teammate review

**Source:** Part E, Section 3.5, and Part F, Section 3.6 of docs/project_deliverable_1_v1.pdf; Sprint Plan and NFRs in docs/srs.md.

> This Definition of Done states the future evidence required to call Sprint 1 complete. Issue I-04 provides only documentation. It does not implement a feature, execute tests, produce release evidence, or satisfy this DoD.

## 1. Shared Product Definition of Done

A Sprint 1 feature is Done only when every applicable item below is satisfied and supported by reviewable evidence tied to the accepted release.

### Requirements and contract

- [ ] The feature ID and scope match the current SRS and Feature Inventory. No FR/BR/NFR or approved decision is silently weakened or renumbered.
- [ ] A versioned, teammate-reviewed feature contract exists before implementation and defines feature design, UI/API/data behavior, permissions, AC, STS, TDD expectations, and exclusions.
- [ ] Every applicable AC maps to one or more stable TEST IDs. Every implemented TEST result maps back to its AC and requirement.
- [ ] Any proposed API, schema, or implementation choices used by the feature have been reviewed and recorded before they are treated as accepted design.
- [ ] F-01/F-02 integration assumptions are reconciled with the separate F-03/F-04 contracts, especially the session cookie/current identity, public event projection, event ID, owner predicate, and registration list boundary.

### Implemented behavior and integration

- [ ] The behavior matches the accepted contract and approved SRS decisions, including all agreed Sprint 1 boundaries.
- [ ] The relevant UI, API/application, and real database path is integrated. Browser memory or mock-only behavior is not the system of record.
- [ ] Required business rules, validation, transaction/consistency behavior, role checks, and record ownership checks are enforced in the backend. A hidden UI control does not count as authorization.
- [ ] Authentication, session lifecycle, safe responses, password handling, and event-owner boundaries satisfy applicable NFRs and contract ACs.
- [ ] Accepted data persists after application restart where required. Failed/rejected writes leave no partial or misleading success state.
- [ ] Applicable loading, success, empty, validation, authentication, permission, and error states are present and accessible.
- [ ] No excluded Sprint 2/3 workflow is introduced as Sprint 1 behavior without an approved change.

### Verification and TDD

- [ ] All planned required tests are implemented and executed at suitable levels: unit tests for important logic; API/database integration tests for persistence and authorization; selected UI/E2E checks for critical journeys.
- [ ] Required tests pass on the release candidate. Any failures, skips, exclusions, or environment limitations are listed with impact and disposition; a feature is not marked Done while a required check is silently omitted or failing.
- [ ] Meaningful domain-rule changes use TDD where applicable. Evidence shows the intended behavior test failing before the correction and passing afterward, with the relevant test/revision and commit identifiers.
- [ ] Negative, boundary, unauthenticated, wrong-role, cross-owner, privacy, persistence, and unchanged-state cases are covered as applicable to the feature.
- [ ] AC-to-test results include actual test file/name, command, outcome, counts, failure/skip status, and tested commit. Planned tests are clearly separated from executed results.
- [ ] Required build, automated test, database integration, and selected acceptance checks complete successfully on the tested release candidate.

### Review, integration, release, and documentation

- [ ] Work is linked through the Issue, feature contract, branch, PR, review, and final release.
- [ ] A teammate (not the author) reviews each PR into sprint staging and records a substantive check, question, finding, or reason for approval.
- [ ] The integrated Sprint 1 increment is tested in sprint staging, and the reviewed release is accepted into main with tag/commit identity recorded.
- [ ] Both students contribute meaningfully across requirements, design, testing, implementation, integration, and review; pair work is identified where applicable.
- [ ] README/setup instructions document dependencies, safe environment-variable examples, database setup/migrations, synthetic seed procedure, build/test commands, and restart/retrieval steps.
- [ ] Engineering documentation, traceability, actual verification evidence, known defects, incomplete work, and accepted limitations are current. Failed/skipped tests and residual work are not hidden.
- [ ] Secret review finds no real passwords, tokens, database credentials, or production secrets in tracked files, client bundles, submitted evidence, or routine logs.

## 2. Sprint-wide release evidence

Before declaring Sprint 1 complete, the integrated evidence set must also show:

1. The seven-step SRS journey: Organizer login; valid event publication; Participant login; public discovery; registration; participant retrieval; Organizer retrieval of that event's registrations.
2. A meaningful business-rule rejection and at least one forbidden role/ownership operation, each with backend/API evidence and unchanged protected state.
3. Accepted Event and Registration records retrieved after application restart using the real database.
4. Actual build/test commands, passing/failing/skipped counts, test names/files, and the release commit.
5. The final AC-to-test-results table, including all feature contracts and manually checked items distinguished from automated tests.
6. Two completed Issue/PR examples with branch, author, reviewer, substantive review, and integration evidence; final board status, release reference, both contributions, and a brief AI-use declaration.
7. Any incomplete requirements, accepted defects, failed/skipped tests, or known limitations clearly disclosed.

These items implement the assessment evidence requirements in Part F. A plan or contract does not substitute for executed verification or release evidence.

## 3. Issue I-04 documentation-only status

Issue I-04 creates the F-01 and F-02 contract drafts and this shared DoD. The AC and STS entries in the contracts are stable planned IDs; their tests do not yet have executable source files or results. No application behavior, build, integration, review, staging merge, or accepted release is claimed. Therefore:

- The three documentation artifacts may be reviewed as Issue I-04 output.
- F-01, F-02, and Sprint 1 are not Done under this Product DoD until their implementation and required verification/release evidence exist.
- F-03 and F-04 contracts remain separate Sprint 1 obligations and must be completed before the integrated Sprint 1 DoD can be met.

## 4. DoD document history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial shared Sprint 1 Product Definition of Done derived from Part E/Part F and the approved SRS baseline. |

