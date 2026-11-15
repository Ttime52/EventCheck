# Sprint 1 Product Definition of Done

**Applies to:** F-01 through F-04 and Sprint 1 cross-cutting responsibilities

**Document version:** 0.1

**Status:** Approved/Pass for Sprint 1; final project decision recorded

**Source:** Part E, Section 3.5, and Part F, Section 3.6 of docs/project_deliverable_1_v1.pdf; Sprint Plan and NFRs in docs/srs.md.

> This Definition of Done is the approved Sprint 1 completion record. The final decision is based on the evidence set, PR #20 committed-HEAD verification, and the project owner's approval recorded on 2026-11-15.

## 1. Shared Product Definition of Done

A Sprint 1 feature is Done only when every applicable item below is satisfied and supported by reviewable evidence tied to the accepted release.

### Requirements and contract

- [x] The feature ID and scope match the current SRS and Feature Inventory. No FR/BR/NFR or approved decision is silently weakened or renumbered.
- [x] A versioned, teammate-reviewed feature contract exists before implementation and defines feature design, UI/API/data behavior, permissions, AC, STS, TDD expectations, and exclusions.
- [x] Every applicable AC maps to one or more stable TEST IDs. Every implemented TEST result maps back to its AC and requirement.
- [x] Any proposed API, schema, or implementation choices used by the feature have been reviewed and recorded before they are treated as accepted design.
- [x] F-01/F-02 integration assumptions are reconciled with the separate F-03/F-04 contracts, especially the session cookie/current identity, public event projection, event ID, owner predicate, and registration list boundary.

### Implemented behavior and integration

- [x] The behavior matches the accepted contract and approved SRS decisions, including all agreed Sprint 1 boundaries.
- [x] The relevant UI, API/application, and real database path is integrated. Browser memory or mock-only behavior is not the system of record.
- [x] Required business rules, validation, transaction/consistency behavior, role checks, and record ownership checks are enforced in the backend. A hidden UI control does not count as authorization.
- [x] Authentication, session lifecycle, safe responses, password handling, and event-owner boundaries satisfy applicable NFRs and contract ACs.
- [x] Accepted data persists after application restart where required. Failed/rejected writes leave no partial or misleading success state.
- [x] Applicable loading, success, empty, validation, authentication, permission, and error states are present and accessible.
- [x] No excluded Sprint 2/3 workflow is introduced as Sprint 1 behavior without an approved change.

### Verification and TDD

- [x] All planned required tests are implemented and executed at suitable levels: unit tests for important logic; API/database integration tests for persistence and authorization; selected UI/E2E checks for critical journeys.
- [x] Required tests pass on the release candidate. Any failures, skips, exclusions, or environment limitations are listed with impact and disposition; a feature is not marked Done while a required check is silently omitted or failing.
- [x] Meaningful domain-rule changes use TDD where applicable. Evidence shows the intended behavior test failing before the correction and passing afterward, with the relevant test/revision and commit identifiers.
- [x] Negative, boundary, unauthenticated, wrong-role, cross-owner, privacy, persistence, and unchanged-state cases are covered as applicable to the feature.
- [x] AC-to-test results include actual test file/name, command, outcome, counts, failure/skip status, and tested commit. Planned tests are clearly separated from executed results.
- [x] Required build, automated test, database integration, and selected acceptance checks complete successfully on the tested release candidate.

### Review, integration, release, and documentation

- [x] Work is linked through the Issue, feature contract, branch, PR, review, and final release candidate.
- [x] A teammate (not the author) reviews each PR into sprint staging and records a substantive check, question, finding, or reason for approval.
- [x] The integrated Sprint 1 increment is tested in sprint staging, and the reviewed release candidate is accepted with commit identity `da3fa630` recorded.
- [x] Both students contribute meaningfully across requirements, design, testing, implementation, integration, and review; pair work is identified where applicable.
- [x] README/setup instructions document dependencies, safe environment-variable examples, database setup/migrations, synthetic seed procedure, build/test commands, and restart/retrieval steps.
- [x] Engineering documentation, traceability, actual verification evidence, known defects, incomplete work, and accepted limitations are current. Failed/skipped tests and residual work are not hidden.
- [x] Secret review finds no real passwords, tokens, database credentials, or production secrets in tracked files, client bundles, submitted evidence, or routine logs.

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

Issue I-04 created the F-01 and F-02 contract records and this shared DoD. The AC and STS entries are now mapped to executable source files and recorded results. The Sprint 1 final decision is Approved/Pass for the documented release candidate:

- The three documentation artifacts are approved as Issue I-04 output.
- F-01, F-02, F-03, F-04, and the integrated Sprint 1 increment are PASS under this Product DoD.
- Accepted limitations, including no quantitative benchmark and no unpublished Event state in the Sprint 1 schema, remain documented and do not block this Sprint 1 decision.

## 4. DoD document history

| Version | Date | Status | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | Draft for teammate review | Initial shared Sprint 1 Product Definition of Done derived from Part E/Part F and the approved SRS baseline. |
| 0.2 | 2026-11-15 | Approved/Pass for Sprint 1 | Marked the integrated Sprint 1 evidence, PR #20 release candidate, feature contracts, verification matrix, accepted limitations, and completion checklist as approved/pass. |
