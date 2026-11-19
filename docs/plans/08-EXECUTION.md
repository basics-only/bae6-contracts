# bae6 — Execution Plan and Progress
Baseline: 2026-11-17. Companion to `00-MASTER-PLAN.md`; records how the plans are being built and where work stands.

## Decisions (maintainer, 2026-11-17)
- Five public repos under `github.com/basics-only`, checked out as siblings of this folder.
- `bae6-authz` is `riz` (github.com/quentin-auster/riz) with full git history. History secret scan: 8 gitleaks hits, all dev fixture tokens (`dev-alice-token` etc.); no real secrets.
- Branches per AGENTS.md: `main` ← `dev` ← `epic/<phase>` ← `feature/*`; each epic is a GitHub milestone. Each epic is reviewed by the `reviewer` agent, then PR'd into `dev`.
- The agent merges green, reviewed PRs and pushes release tags (maintainer allow rule, 2026-11-17). GitHub Actions does not run, so CI-equivalents run locally and PRs say so.
- Cloud inference/query providers mocked; live Bedrock/Vertex/Databricks smoke tests stay **pending** until credentials exist.
- Deferred until core gates pass (already optional in the plans): SharePoint, FAISS, MCP gateway, agent-worker/eval-worker, LangChain adapter, KEDA, Terraform EKS/GKE modules.
- riz's SvelteKit console stays in history but is not released or deployed in v1 (master plan out-of-scope: admin portals).

## Stack (inherited from riz)
- Services: TypeScript on Node 22, `node:http` (no web framework), `pg`, `jose`, OpenTelemetry. pnpm workspace, biome, redocly, `tsx --test`.
- Python SDKs: uv workspace, httpx, ruff, mypy strict, pytest.
- Images: multi-stage Dockerfile, base pinned by digest, non-root; release via GHCR + cosign keyless + SBOM/provenance.

## Cross-repo mechanics (smallest workable)
- **Contracts distribution**: consumers vendor `bae6-contracts` schema files at a released tag into `contracts/vendor/` with a `contracts.lock` (tag + sha256). CI fails if vendored files differ from the lock. No package registry needed.
- **Compatibility checks**: `oasdiff breaking` against the previous tag, in contracts CI.
- **SDK transport**: each product SDK carries its own small transport (timeouts, bounded retries for idempotent calls only, `ErrorEnvelope` parsing, no redirects). Shared behavior is pinned by transport conformance cases published in contracts.
- **Helm**: one generic chart `bae6-service` in `bae6-platform`; every runtime is a separate Helm release with its own values file, image digest and chart version pin (ADR-008).
- **Package publishing** (npm `@bae6/*`, PyPI `bae6-*`): workflows written but unverified until the maintainer claims the names and adds tokens.

## Phases and status
| Phase | Repo(s) | Status |
|---|---|---|
| P0 Foundation | contracts, platform, scaffolds of all five | done: contracts v0.1.0 released; platform P0 merged to dev; all five repos have main+dev. |
| P1 Authorization | authz | done: epic merged to dev (authz #9); riz #82–#84 ported as authz #1–#3 (RIZ-052/053/051); the riz PRs remain open. Not yet on main or tagged. |
| P2 AI core | ai | done: epic merged to dev (ai #8), Bedrock/Vertex mocked, live smoke pending. Deferred scope: ai #9. |
| P3 Context data | context | done: Postgres, Databricks (mocked), S3, data-api, SDKs and chart values merged to dev (context #6). Live Databricks pending. |
| P4 Context embed | context | done: core, pgvector index, job queue, embed-api, deploy, SDKs and benchmark merged to dev (context #7–#14); p95 and storage benchmarks recorded there. |
| P5 Context MCP | context | done: core, Postgres store, registry API, SDKs and deploy merged to dev (context #15–#20). Gateway deferred. Open follow-ons: DB errors as 503, byte-bounded lists, shared identity/http package. |
| P6 AI extensions | ai | done: agents, evals and guardrails packages merged to dev (ai #11–#14). Workers and LangChain adapter deferred. Open follow-ons: agent message-history bound, receipts echo blocked input, guard-per-run budget, never run against a real model. |
| P7 Integration | platform | done: podman compose stack, 5-test demo, load, footprint, rollback drills and security review in platform `docs/p7-gate.md`; stack pinned to ai v0.1.4 and context v0.1.2 (context v0.1.3 released, not yet re-verified in the stack; platform #2–#8). Review findings F1–F3 and S1–S4 addressed; residual S2/S4 gaps and the opt-in F2 cap are listed in `docs/p7-gate.md`; ai#19, context#21 and context#22 closed. Rollback drills and memory footprint not re-run on the hardened images. Mocks only; live smoke tests, authz and OpenFGA in the stack, and a kind/Helm run pending. |
