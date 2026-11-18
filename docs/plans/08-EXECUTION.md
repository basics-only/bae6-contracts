# bae6 — Execution Plan and Progress
Baseline: 2026-11-17. Companion to `00-MASTER-PLAN.md`; records how the plans are being built and where work stands.

## Decisions (maintainer, 2026-11-17)
- Five public repos under `github.com/basics-only`, checked out as siblings of this folder.
- `bae6-authz` is `riz` (github.com/quentin-auster/riz) with full git history. History secret scan: 8 gitleaks hits, all dev fixture tokens (`dev-alice-token` etc.); no real secrets.
- Each phase lands on a feature branch, reviewed by the `reviewer` agent, then a PR into `main`, merged when CI is green. `main` protected (PR + required checks).
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
| P1 Authorization | authz | done: epic merged to dev (authz #9); riz #82–#84 finished as RIZ-051/052/053. Not yet on main or tagged. |
| P2 AI core | ai | done: epic merged to dev (ai #8), Bedrock/Vertex mocked, live smoke pending. Deferred scope: ai #9. |
| P3 Context data | context | done: Postgres, Databricks (mocked), S3, data-api, SDKs and chart values merged to dev (context #6). Live Databricks pending. |
| P4 Context embed | context | not started |
| P5 Context MCP | context | not started |
| P6 AI extensions | ai | not started |
| P7 Integration | platform | not started |
