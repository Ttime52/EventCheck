# Issue #54 — Sprint 2 Release Verification

Snapshot: 2026-11-27 (Asia/Bangkok). Owner: Student 1; release reviewer: Student 2.

## Candidate and integration identity

- Remote candidate: `c5f355aad2e2a4ca719f529b07c7570ce85d035d` (`origin/sprint-2-staging`, PR #62 merge).
- Current verification checkout: `release/54-sprint-2-verification` at exact candidate `c5f355aad2e2a4ca719f529b07c7570ce85d035d`. Earlier Codex checks used tree-equivalent `0f6115ae73cdc8159d1779ac752b20e96305e692`; those results below are historical, not new execution at the candidate commit.
- Both commits have identical Git tree `1931b4c24762f85da7f940cb359c57208bf0bb82`. Historical Codex checks used the earlier checkout; the owner runs below used exact candidate `c5f355a`. This document is a subsequent uncommitted evidence change. Current status: HEAD equals candidate, with only this untracked evidence file and no tracked source/test modifications.
- Sprint 1 accepted candidate: `da3fa630be862955c973cc9e0c8cddcc5e1dcd6e`; release merge to main: `91857c25f9ab27e9c904ca3886c0d3f1a67684dc`. No release tag exists locally after fetch.
- `origin/main` is an ancestor of staging; comparison of deployment/CI paths shows only the CI workflow differs. No missing main-only deployment changes were found by this ancestry check.
- PR #61 integration at `f08177c` and PR #62 documentation integration at `c5f355a` are present. PR #62 has an APPROVED review by `KwanchanokThungsuk`, explicitly limited to Issue 16 documentation.
- F-01 through F-07 are included; F-08 remains partial client-derived metrics, not a prerequisite for the original Sprint 2 scope.

## New execution results

### Owner execution — 2026-11-27, starting 15:54 ICT

At exact candidate `c5f355a`, the owner verified both database URLs, healthy PostgreSQL and seven applied migrations/schema up to date. Prisma validation, typecheck, build and whitespace checks passed. Full server: 131 passed/0 failed/0 skipped across 16 files; split counts: 44 unit and 87 integration (F-05 13, F-06 16, F-07 17). Client: 29/29; full Playwright: 30/30. F-07 restart: PASS. These are owner-executed results, not reruns in this Codex session. TEST-F07-10's deliberately injected failure is expected output.

At this stage F-05 standalone restart failed at credential validation before verification. This historical environment issue was resolved in the separate run below.

### Owner execution — 2026-11-27, approximately 16:10 ICT

`npm run test:integration --workspace server` runs `server/scripts/integration-check.mjs`: nine suites, then `scripts/f06-restart-check.mjs` with server working directory, propagating failure. The successful 16:10 command therefore includes TEST-F06-07 real API restart persistence. Fresh-Prisma reads alone do not establish process restart.

At unchanged candidate `c5f355aad2e2a4ca719f529b07c7570ce85d035d`, using the verified isolated database and existing synthetic Organizer credentials:

| Command / check | Result |
|---|---|
| `npm run test:f05:restart --workspace server` | PASS: `F-05 restart verification passed` |
| `npm run test:integration --workspace server` | 87 passed across nine suites, 0 failed, 0 skipped |
| F-05 / F-06 / F-07 integration within that run | 13/13, 16/16, 17/17 PASS |
| TEST-F06-07 API restart (invoked by integration runner) | PASS: Participant list/detail and Organizer history retained the same cancelledAt after API restart |

This reruns the same 87 integration cases already included in the 131-case full server run; do not add them to obtain a unique-test total of 218. The 15:54 and 16:10 executions are separate owner-reported runs. F-07 restart, full server/client/browser, Prisma/migrations, typecheck and build results remain attributed to the preceding run. The controlled F07 post-INSERT error is expected rollback-test output.

### Historical Codex checks on the identical tree

| Command/check | Result |
|---|---|
| `git fetch origin` | PASS; remote candidate refreshed |
| `npm run typecheck` | PASS, both workspaces |
| `npm run build` | PASS, both workspaces |
| `npm run test --workspace client` | 29 passed, 0 failed |
| `npm run test --workspace server -- --no-file-parallelism` in sandbox | 41 passed, 3 failed (localhost EPERM), 87 skipped |
| Same server command with permitted localhost access | 44 passed, 0 failed, 87 skipped; 7 files passed, 9 skipped |
| `git diff --check` | PASS before evidence creation; repeat after editing |
| PostgreSQL integration/full 131-case execution | NOT RUN; DATABASE_URL unset |
| Playwright discovery/execution | NOT RUN; E2E_DATABASE_URL unset; do not bypass configuration guard |
| Prisma validation/migration status | NOT RUN; database environment not configured |
| F-05/F-06/F-07 restart scripts | NOT RUN; isolated database and fixture credentials unavailable |
| `docker build --no-cache -t eventcheck-release-verification:issue54 .` | PASS; manifest list `sha256:b1fb897e365932c27198e6b7bf32877c2f5ac39416d317be4afcb3b91507dd6d`; local image only, no push |

The initial HTTP test failures were environment permission failures resolved by rerun. Database skips are not passing integration cases. No database was accessed, migrated, seeded or reset.

Docker daemon reported version 29.3.1. The historical tree-equivalent build emitted npm audit warnings: 7 vulnerabilities (1 moderate, 4 high, 2 critical). The subsequent read-only assessment below inspected package identities and reachability prerequisites; the later team risk disposition is recorded under Team Security Risk Acceptance. No automatic dependency updates were performed. PR #61's subsequent APPROVED review by `KwanchanokThungsuk` was independently read and is limited to testing changes.

## Acceptance and historical evidence

All 38 accepted AC mappings are enumerated in [AC verification](ac-verification.md): AC-F05-01 through 13 (TEST-F05-01 through 13), AC-F06-01 through 13 (TEST-F06-01 through 15), and AC-F07-01 through 12 (TEST-F07-01 through 12). TEST-F05-13 is manual review. Historical records are retained separately; owner-executed candidate results are recorded above.

[Issue 15 integration evidence](integration-verification.md) records implementation `107c93e`, 44 unit cases, separate 87 PostgreSQL cases, 29 client cases and 30 browser cases. Its CI evidence uses a generated PR merge revision, not this candidate. F-05/F-07 standalone restart results are historical on `b9df85c`; F-06 restart was included in the later integration run.

Functional candidate verification is complete based on the supplied owner execution and unchanged tracked source revision: capacity/deadline versus registration, cancellation/re-registration history, cancellation/check-in exclusion, Attendance associations/duplicates/rollback, owner/self privacy and Sprint 1 regression passed in the reported suites. Six fixed-time browser checks verify presentation only; authoritative server boundary assertions use the integration clock. No claim is made that browser clocks change server time or that live boundary transitions/clock-skew rejection were independently tested.

## Release and Deliverable 2 gates

Functional verification: **COMPLETE based on owner execution**. Evidence status: **READY FOR PEER REVIEW**, with team-agreed temporary dependency risk acceptance subject to the requirements and controls below. Candidate-specific CI, Student 2 formal PR review, main integration, release acceptance, tagging and deployment remain pending. No formal release acceptance or GitHub approval of Issue #54 is claimed.

## F-05 restart setup

The script reads process environment directly and does not load `.env` or Playwright configuration. Playwright normally defaults the Organizer login to `organizer@example.test` and password to `SEED_ORGANIZER_PASSWORD`; F-07 global setup credentials are run-scoped and deleted at teardown, so must not be reused. Use the existing seeded demo Organizer and its actual seed password. Do not reseed just to repair this check: seed upsert updates existing users.

From repository root, with the ignored `.env` containing the existing test configuration, run:

```sh
node --env-file=.env --input-type=module -e '
import { spawnSync } from "node:child_process";
const u = new URL(process.env.DATABASE_URL ?? "");
if (u.protocol !== "postgresql:" || u.hostname !== "127.0.0.1" || u.port !== "5433" || u.pathname !== "/eventcheck_test" || u.searchParams.get("schema") !== "public") throw new Error("Unsafe database target");
const env = { ...process.env };
env.E2E_ORGANIZER_LOGIN ??= "organizer@example.test";
env.E2E_ORGANIZER_PASSWORD ??= env.SEED_ORGANIZER_PASSWORD;
if (!env.E2E_ORGANIZER_PASSWORD) throw new Error("Existing test Organizer password required");
const result = spawnSync("npm", ["run", "test:f05:restart", "--workspace", "server"], { env, stdio: "inherit" });
process.exit(result.status ?? 1);
'
```

This maps credentials only; it does not establish account existence. The owner resolved the configuration with the existing isolated Organizer and successfully executed the workspace command at approximately 16:10 ICT. Codex did not independently rerun it. No password value is printed.

## Read-only dependency assessment — 2026-11-27

The table preserves the technical assessment and original recommendations before the offline team decision. References to a proposed deferral or required sign-off below are superseded by the conditional team decision recorded in the next section; technical exposure and residual risks remain unchanged.

`npm ls` and a network-disabled local image inspection found all seven packages in the final image: Vitest/mocker 3.2.7, tinypool 1.1.1, Prisma/config 6.19.3, deepmerge-ts 7.1.5 and effect 3.21.0. Docker copies the complete builder node_modules; `npm audit --omit=dev` understates that image's contents. No production source imports of Vitest/tinypool/deepmerge/effect were found. Presence is confirmed; absence of a reachable application path is a source assessment, not proof against every exploit chain.

| Advisory | Dependency/exposure and prerequisites | Remediation / release decision |
|---|---|---|
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | Transitive mocker 3.2.7 via direct Vitest; dev/CI tool present in image. File read requires reachable mocker dev-server handlers. Normal Express/static runtime does not start these handlers. | Vitest/mocker 4.1.11 fixes this issue; use at least 4.1.12 for both mocker issues. Major upgrade from 3 requires test/config compatibility review. No current HTTP exploit path found; proposed non-blocking deferral needs team approval. |
| [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | Same chain; unauthenticated mocker WebSocket registration injects browser module code. No mockerPlugin/interceptorPlugin usage found in application source; Node test execution is distinct from exposed browser dev-server mode. | Mocker 4.1.12 or 5.0.3; upgrade Vitest coherently. Proposed non-blocking for deployed API, not an accepted risk decision. |
| [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) | Tinypool 1.1.1 via Vitest, CI/dev exposure and image presence. Requires upstream prototype pollution affecting worker execArgv/env and attacker code availability. | Fixed 2.1.1; 2.1.2 addresses both tinypool issues. Transitive major override is not assumed compatible; upgrade supported Vitest chain and rerun suites. Team risk decision required for deferral. |
| [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Tinypool run-options filename gadget; requires prototype pollution and a supplied run options object. No request-driven application Tinypool usage found. | Fixed 2.1.2; same major compatibility concern. CI impact must be considered even though Express does not invoke it. |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | deepmerge-ts 7.1.5 via Prisma 6.19.3/config; build/migration tooling present in runtime. Requires recursive object graphs passed to merge; plain JSON alone does not create cycles. No HTTP body-to-merge path found. | Fixed 8.0.0 (major); prefer supported Prisma/config update or reviewed override with CLI/migration/provisioning regression. Proposed non-blocking exploitability assessment requires team sign-off. |
| [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw) | effect 3.21.0 via Prisma/config. ReDoS requires affected Schema.TemplateLiteral regex processing adversarial text; no application import/input path found. | Fixed effect 3.22.1, same major; lock refresh/override must verify parent range and regression. Do not assume an automatically compatible resolved tree. |

Prisma and @prisma/config audit entries inherit the vulnerable dependency chain; they are not six additional independently assessed flaws. Scope a separate remediation task: update supported toolchain/transitives, reduce final-image dev-tool exposure while retaining migration/provisioning requirements, rebuild and inspect image, rerun audit, 131 server/29 client/30 browser cases plus migrations/restarts. No package or Dockerfile changes were made. The team's temporary deferral decision is recorded below; it does not fix the vulnerabilities.

## Team Security Risk Acceptance

- Decision date: 27 November 2026.
- Decision owners: Student 1 and Student 2.
- Approval source: owner-reported offline team discussion; no GitHub approval is claimed.
- Decision: retain current dependency versions and temporarily defer remediation, including Vitest 3.2.7 and Prisma 6.19.3.
- Known audit findings: 2 critical, 4 high and 1 moderate. Affected packages remain vulnerable and present in the Docker image.
- Rationale: avoid introducing major-version compatibility and regression risks during the remaining academic project period. Supporting evidence is the dependency exposure/reachability assessment above; it does not prove the absence of all exploit paths.
- Proposed expiry/reassessment: 13 December 2026, subject to the instructor-required grading availability period. This is not authorization to shut down the assessed deployment on that date or to extend the risk acceptance indefinitely. Confirm the actual grading end date and record any explicit extension or remediation decision.

Requirements review: SRS NFR-01/02/03/12 and the accepted F-05/F-06/F-07 security rules continue to require authorization/privacy, credential/session protection, CSRF and externalized secrets. The bundled PDF runtime subsequently extracted the Group Work Specification and Deliverable 2/Final Delivery instructions. No zero-advisory rule or prohibition of documented temporary dependency deferral was found in those materials or reviewed repository policies. No direct mandatory conflict was identified; this decision does not waive security protections. Standalone Lab 5–7 guides were not available in the inspected workspace; their detailed provisions remain unverified.

Grading availability is explicit: Deliverable 2 page 5, Final Delivery page 6 and Group Work Specification page 15 require the assessed deployment/repository to remain available through grading until the instructor announces the end of access. No fixed end date is specified. Therefore 13 December is a reassessment checkpoint only; any extension of the dependency deferral requires a recorded team decision while availability is preserved.

| Required control | Verification / responsibility |
|---|---|
| Synthetic data and test accounts only | Verified for recorded isolated test fixtures; deployed dataset/account inventory not inspected here. Team must confirm before release. |
| Do not publicly expose development/Vitest servers or test tooling | Production Docker entrypoint runs Express and static built assets; tooling packages are still installed. Actual cloud ingress/process configuration remains pending deployment review. |
| Protect credentials and restrict cloud permissions | Repository evidence describes hashed credentials, sessions, external secrets and scoped identity. Current IAM grants, deployed secret access and credential inventory not audited here; release owners must confirm. |
| Reassess if dependencies, exposure or exploitability changes | Required ongoing control owned by both students; not a completed future action. |
| Reassess at final release and deferral expiry | Required; candidate review and 13 December checkpoint remain pending. |
| Maintain assessed deployment through required grading period | Required; exact end date and operational ownership need confirmation. Do not tear down to satisfy the deferral date. |

The team accepts residual dependency risk temporarily under these controls; it does not assert vulnerability-free operation. Formal release review must confirm applicable requirements, pending deployment controls and grading availability before acceptance.

- Completed functional gates: verified isolated database URLs/container/migrations, full server/client/browser runs, all three API restart checks, typecheck/build and historical tree-equivalent clean Docker build. No repeat is required solely for this documentation update; re-evaluate if candidate source changes.
- No candidate-specific CI result was returned by the staging-branch run query in this session. Historical PR CI cannot be attributed to this candidate.
- Existing deployment workflow triggers on main and uses environment `demo`; merging a release PR can trigger deployment. Require explicit owner authorization before release actions.
- Prepare proposed PR `Release: Sprint 2 F-05/F-06/F-07 integration` from staging to main only after verification and Student 2 review. No release PR/tag/merge/deployment was created here.
- Final evidence inventory: [rubric map](../../deliverable-2-evidence-map.md), [continuity register](continuity-and-change-register.md), SRS/SDS/traceability, accepted contracts, and [Sprint 3 plan](../sprint-3/remaining-work.md). Real review chains and test excerpts exist; TDD red/green artifacts, Lab 6/7/UAT execution and current deployment identity require owner-supplied evidence. Proposed owners: Student 1 release verification; Student 2 review; team evidence collection/F-08 through 2026-12-13. These assignments are proposals, not recorded approvals.

## Final pre-push audit — 2026-11-27

### Subsequent owner-executed Cloud Shell evidence

The following supersedes the earlier access-blocked observations below. These are owner-supplied cloud metadata results; Codex did not execute cloud inspection or retrieve secret payloads. Existing deployment is distinct from the undeployed candidate `c5f355a`.

| Control | Observed result |
|---|---|
| Service | Project `cpe334-th-008`, region `asia-southeast1`, service `eventcheck`, revision `eventcheck-00010-v8q`, 100% traffic |
| Exposure/runtime | Public ingress and allUsers invoker; port 3000; NODE_ENV=production; CLIENT_ORIGIN matches service URL; no serving command/args overrides; configured image uses the reviewed production startup path. This does not inventory arbitrary processes or every other cloud service. |
| Database | Cloud SQL `eventcheck-pg`; DATABASE_URL supplied through Secret Manager; no connection value recorded |
| OCI digest reconciliation | COMPLETE: configured index `sha256:f0cf097fe141b66a606a5b38297689a25d7e37c5b17d996fbef78b948c80475c` explicitly contains serving linux/amd64 manifest `sha256:ba3e0d6d40201bb73d865b0011c1b5e1629feaebdc3b8cd0a3d48865c191b4b6`; index/manifest difference is not a mismatch |
| WIF | GitHub OIDC issuer; repository/owner, main, deploy.yml and demo subject restrictions; repository-scoped workloadIdentityUser binding on deployer verified |
| Direct IAM | Deployer has service-level run.developer and runner-level serviceAccountUser; runner has project-level cloudsql.client; each of eight inspected EventCheck secrets grants runner secretAccessor at secret level |
| Residual IAM scope | Service and both jobs share runner; runner accesses provisioning secrets as well as database secret. Project Editor grants exist for a team member and default Compute identity. Inherited/effective permissions and complete least privilege were not established. No personal addresses or unnecessary principal identifiers recorded. |
| Secret reproducibility | References use latest; pinned-version reproducibility is not established. This is a disclosed operational limitation, not proof of secret exposure. |
| Migration job | `eventcheck-migrate`: runner, Cloud SQL instance confirmed, NODE_ENV=production, `sh -c 'npx prisma migrate deploy'`; inspected args contain no reset/seed |
| Provisioning job | `eventcheck-provision-accounts`: runner, same Cloud SQL instance, NODE_ENV=production, `npm run db:provision-production-accounts`; configured image digest `sha256:2ec584dc0210b3fa2b4cdc6436701afa51e1f93531840205f75571159666c412`. Digest evidence COMPLETE; no equivalence with serving image or candidate is claimed. |

The previous Cloud SQL None observation came from an incorrect JSON annotation location; corrected owner inspection confirms the instance on both jobs. No job was executed during this audit. Synthetic deployed-data attestation is recorded below. Standalone Lab 5–7 guides remain unavailable in the inspected workspace; supplied project PDFs were reviewed. These are disclosed evidence limitations, not findings of noncompliance.

**Current verdict: READY FOR SINGLE PUSH AND PEER REVIEW.** Synthetic Data Attestation, provisioning digest and both jobs' secret-reference evidence are COMPLETE. Earlier blanket cloud-access blockers below are historical and superseded for verified controls. Inherited IAM scope, shared runner, Editor grants, latest secret selectors and unavailable Lab guides remain disclosed limitations. Candidate CI, formal teammate PR review, main integration, tagging/deployment and post-deployment checks remain subsequent gates. Dependency acceptance remains conditional on its documented controls. This verdict is not formal release acceptance or authorization to execute Git/release actions.

### Synthetic Data Attestation — owner-provided, 2026-11-27

The project owner explicitly confirms that all deployed EventCheck accounts, Events, Registrations and Attendance records are synthetic and used exclusively for academic demonstrations, testing and UAT. This closes the synthetic-only deployed-data pre-push evidence gap. The source is the owner's direct statement in this task; no database records were accessed or independently inspected to establish this attestation. It is not a GitHub review approval.

No further Cloud Shell execution is requested for digest or secret references. The currently deployed revision is not claimed to run candidate `c5f355a`.

Actual owner-observed secret mappings (metadata only):

| Job | Environment variable | Secret name | Version selector |
|---|---|---|---|
| provisioning | DATABASE_URL | eventcheck-database-url | latest |
| provisioning | PROVISION_ORGANIZER_EMAIL | eventcheck-provision-organizer-email | latest |
| provisioning | PROVISION_ORGANIZER_PASSWORD | eventcheck-provision-organizer-password | latest |
| provisioning | PROVISION_PARTICIPANT_EMAIL | eventcheck-participant-b-email | latest |
| provisioning | PROVISION_PARTICIPANT_PASSWORD | eventcheck-participant-b-password | latest |
| migration | DATABASE_URL | eventcheck-database-url | latest |
| migration | ADMIN_PASSWORD | eventcheck-admin-password | latest |

All eight inspected EventCheck secrets have direct secret-level secretAccessor grants to the runner. Secret payloads were not retrieved; resolved numeric versions were not inspected. Migration ADMIN_PASSWORD presence is configuration metadata, not proof of its use by migrate deploy.

### Earlier audit history (superseded where addressed above)

Historical verdict before the owner metadata and attestation were supplied: **BLOCKED — OWNER ACTION REQUIRED**. The table below preserves that earlier inspection state; it is superseded by the current verdict above. No functional test reruns were performed in this audit.

| Remaining work | Classification / evidence |
|---|---|
| Candidate identity/source unchanged | COMPLETE: HEAD `c5f355a`, only this untracked evidence file; 38 AC mapping source remains `ac-verification.md`, with historical versus candidate runs distinguished above. |
| Course security/availability check | COMPLETE for the four supplied project PDFs and repository SRS/contracts; standalone Lab guides unavailable, owner must supply or confirm any additional security restrictions. |
| Synthetic data policy | COMPLETE as a course requirement and isolated-test practice; BLOCKED — owner must attest deployed dataset/accounts are synthetic. Do not inspect real user records. |
| Local production entrypoint/port | COMPLETE from Dockerfile and entrypoint: exec CMD `node dist/index.js`, NODE_ENV=production, SERVE_CLIENT=true, port 3000; backend listens on 0.0.0.0 and honors PORT. These are local image/source findings, not proof of live Cloud Run overrides. |
| Actual Cloud Run revision, process, ports, ingress | BLOCKED — no gcloud binary/authorized cloud metadata connection in this environment. Verify serving revisions, overrides and exposed services with commands below. |
| Production configuration and secret protection | Source uses secret refs/external env and safe auth; BLOCKED for actual CLIENT_ORIGIN, runtime identity, secret references and IAM grants. No secret values retrieved. |
| GCP IAM/WIF and migration/provisioning jobs | BLOCKED — owner metadata inspection required; intended configuration does not establish actual least privilege. |
| Candidate-specific CI | REQUIRES PR: GitHub query for exact `c5f355a` returned no runs. Verification PR into sprint-2-staging triggers ci-docker.yml; it tests the generated merge revision. A push of this branch alone does not trigger that workflow. Main release PR also triggers CI; a main merge triggers deployment and its reusable CI. Record each actual SHA/run, never substitute older PR #61 CI. |
| GitHub demo environment metadata | Read-only query listed GCP_PROJECT_ID, GCP_REGION, WIF_PROVIDER and WIF_SERVICE_ACCOUNT names; no values verified. Secret-name query returned no entries, so optional authenticated smoke configuration is not established. Public smoke remains the configured default; paired login credentials must be verified if enabled. |
| Student 2 review/main integration/tag/deploy | REQUIRES PR / formal release authorization. No automatic release action performed. |
| Post-deployment checks | REQUIRES DEPLOYMENT: exact commit/image/revision, health/readiness/login if enabled, persistence and cloud controls must be checked again for the deployed candidate. |

### Owner Cloud Shell read-only commands

Run privately with an authorized account; return only redacted metadata and policy conclusions, never environment literal values, secret payloads, cookies or database rows. Project/region/service below are the known intended target and must be confirmed by the returned URL.

```sh
PROJECT_ID=cpe334-th-008
REGION=asia-southeast1
gcloud run services describe eventcheck --project="$PROJECT_ID" --region="$REGION" --format=json | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["spec"]["template"]; s=t["spec"]; print(json.dumps({"url":d.get("status",{}).get("url"),"traffic":d.get("status",{}).get("traffic"),"annotations":{k:v for k,v in d.get("metadata",{}).get("annotations",{}).items() if k in ["run.googleapis.com/ingress"]},"serviceAccount":s.get("serviceAccountName"),"containers":[{"image":c.get("image"),"command":c.get("command"),"args":c.get("args"),"ports":c.get("ports"),"envNames":[e["name"] for e in c.get("env",[])],"secretRefs":[{"name":e["name"],"ref":e["valueFrom"]} for e in c.get("env",[]) if "valueFrom" in e]} for c in s.get("containers",[])]},indent=2))'
gcloud run services list --project="$PROJECT_ID" --region="$REGION" --format='table(metadata.name,status.url)'
gcloud run services get-iam-policy eventcheck --project="$PROJECT_ID" --region="$REGION" --format=json
gcloud projects get-iam-policy "$PROJECT_ID" --format=json
gcloud iam service-accounts get-iam-policy "eventcheck-runner@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" --format=json
gcloud iam workload-identity-pools providers describe github-main --workload-identity-pool=github-actions --location=global --project="$PROJECT_ID" --format='yaml(name,attributeMapping,attributeCondition,oidc.issuerUri)'
gcloud secrets list --project="$PROJECT_ID" --format='value(name)'
gcloud secrets get-iam-policy eventcheck-database-url --project="$PROJECT_ID" --format=json
gcloud run jobs list --project="$PROJECT_ID" --region="$REGION" --format='table(metadata.name)'
```

For each serving revision in `traffic`, inspect its actual image, command, args, ports and environment privately using `gcloud run revisions describe REVISION --project="$PROJECT_ID" --region="$REGION"`; redact all literal env values before sharing. Confirm NODE_ENV=production, expected CLIENT_ORIGIN, static Express serving and no Vite/Vitest/watch process. Inspect migration/provisioning jobs privately with `gcloud run jobs describe JOB --project="$PROJECT_ID" --region="$REGION"`; report only command/args, runtime SA, Cloud SQL reference and secret-name/version refs. Verify migration command is migrate deploy only, no seed/reset; provisioning is separate and not automatic. Do not execute a job.

Required owner outputs: current traffic/revision/image identity; URL equals intended EventCheck service; ingress/public-invoker justification; runtime SA and least-privilege role review; secret-level bindings and fixed/rotating version policy; Cloud SQL instance/reference consistency; no service exposing testing tools; synthetic-data attestation; confirmation of instructor-announced grading access end when available. Repeat secret IAM metadata checks for each referenced secret. Project policy alone cannot prove absence of inherited organization/folder grants; owner must inspect effective permissions or disclose that limitation. No `gcloud secrets versions access` is required or authorized.
