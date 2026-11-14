# F-01 Dependency Security Risk Assessment

**Assessment date:** 2026-11-14  
**Project/branch:** EventCheck / `feature/06-auth-role-access`  
**Scope:** F-01 authentication implementation and its dependency tree

## Evidence and limitation

The previously executed audit evidence is:

- Full `npm audit`: 6 findings — 1 moderate, 3 high, 2 critical.
- `npm audit --omit=dev`: 3 high findings.

The audit endpoint was unavailable during this review (`ENOTFOUND registry.npmjs.org`), so the aggregate counts are preserved from the local report and cannot be refreshed or mapped completely to advisory IDs in this environment.

## Affected packages and advisory assessment

| Package/version | Advisory | Severity | Impact | Runtime use | Assessment |
| --- | --- | --- | --- | --- | --- |
| `@vitest/mocker@3.2.7` | GHSA-82fw-gwwq-j7x9 | Moderate | Redirect-mock path traversal/arbitrary local-file read in the Vitest mocker server; fixed in 4.1.11 or 5.0.0-rc.2. | No | Development/test tooling only; EventCheck does not expose Vitest’s mocker server in production. |
| `tinypool@1.1.1` | GHSA-85c8-ppgw-ccpr | Critical | Prototype-pollution gadget that can redirect worker loading to attacker-controlled code; fixed in 2.1.2. | No | Reached through Vitest worker tooling, not application request handling. |
| `deepmerge-ts@7.1.5` | GHSA-ggr8-5vv4-36mx / CVE-2026-40345 | High | Uncontrolled recursion/stack exhaustion below 8.0.0. | No | Used by Prisma configuration tooling; the known call site merges developer-controlled Prisma configuration. |
| `effect` under `@prisma/config@6.19.3` | GHSA-38f7-945m-qr2g | High | AsyncLocalStorage context contamination under specific concurrent RPC use. | No | Prisma configuration/CLI dependency; no application import was found. |

The exact remaining npm findings require a successful registry-backed audit before assigning additional advisory IDs. No advisory is claimed fixed.

## Dependency and production exposure review

Package declarations and `npm explain` show:

- `vitest` is a workspace development dependency.
- `prisma` is a server development dependency.
- `@prisma/config` and `deepmerge-ts` are reached through Prisma CLI/configuration tooling.
- `@prisma/client` has an optional peer relationship with `prisma`, so a production install may retain Prisma CLI/config packages depending on npm resolution and installation mode.
- Application source imports `@prisma/client`, Express, PostgreSQL, and authentication modules; it does not import Vitest, Tinypool, `@prisma/config`, or the Prisma CLI.

The repository does not currently contain a production Dockerfile or locked deployment install workflow. Consequently, `npm ci --omit=dev` exclusion of Prisma CLI/config packages has not been proven for the eventual deployment image. A production-only dependency installation must be inspected before deployment; package presence alone must not be confused with execution or reachability from untrusted HTTP requests.

## Mitigations

- Do not expose Vitest, Vite, Prisma CLI, or migration tooling as a public service.
- Build and run only the compiled application in production.
- Use a reviewed production install strategy, preferably `npm ci --omit=dev`, followed by `npm ls --omit=dev prisma @prisma/config deepmerge-ts vitest tinypool`.
- Keep Prisma migrations/seeding in a separate reviewed build/deployment step, not in the public application process.
- Re-run the full and production-filtered audits with registry access before deployment.
- Do not run `npm audit fix --force`.

## Recommended remediation

1. Evaluate upgrading Vitest to a patched newer major release; do not assume a complete fix exists within the current Vitest 3.x line. Rerun unit, build, and Playwright checks after any upgrade.
2. Upgrade `prisma` and `@prisma/client` together, then run Prisma generation, validation, migration checks, and PostgreSQL integration tests.
3. Evaluate a tested override for `deepmerge-ts >=8.0.0` only after confirming Prisma compatibility; do not silently override the exact Prisma pin.
4. Rebuild and inspect the production dependency installation before deployment.

## Team decision and acceptance

**Decision:** Conditional risk acceptance for the current F-01 branch is accepted by the teammate, subject to the conditions below.

The accepted conditions are:

- Development tooling will not be exposed as a public service.
- The production build/install strategy is reviewed and excludes unnecessary development tooling.
- Production dependency exposure is verified before deployment.
- A remediation owner and deadline are assigned.
- Open high/critical findings are re-audited before production deployment.

**Owner:** F-01 feature owner; specific reviewer-assigned identity was not provided.  
**Deadline:** Before production deployment.  
**Required verification:** Registry-backed `npm audit` and `npm audit --omit=dev`, production-only dependency inspection, Prisma compatibility checks, unit/build checks, and PostgreSQL integration tests.  
**Team acceptance:** Accepted by the teammate; reviewer identity and acceptance date were not provided. This acceptance applies only to the conditional risk decision, not to production exposure verification, feature completion, or PR merge approval.

## Merge and deployment impact

These findings should not automatically block teammate review because the identified vulnerable packages are development/configuration tooling and no runtime exploitability has been established. The teammate has accepted the conditional risk decision. Deployment must not proceed until the production exposure check and required remediation verification are complete.
