# bae6 — Master Engineering Plan
Version: 0.1 | Baseline: 2026-11-17 | Status: proposed for implementation

## Mission
Build a minimal, open-source, enterprise-ready suite of independently usable primitives for **authorization**, **AI execution**, and **model context**. Replace a monolith without creating a distributed monolith. Support multiple teams, Kubernetes horizontal scaling, and Python + TypeScript clients.

## Non-negotiables
1. **Five repos**: `bae6-authz`, `bae6-ai`, `bae6-context`, `bae6-contracts`, `bae6-platform`.
2. **Independent deployment**: Each service has separate image, chart, config, lifecycle, storage ownership, scaling and rollback; libraries require no deployment.
3. **Independent publishing**: Per-module semantic versions and changelogs even inside a multi-package repository; no global lockstep release.
4. **Optional cross-product integrations**: No mandatory network hop through an unrelated bae6 component. Explicit adapter interfaces and injected dependencies.
5. **Small footprint**: Runtime dependencies and image sizes measured and reviewed; omit Redis/Kafka/service mesh/central orchestration unless justified.
6. **Strict security**: Tenant identity from verified credentials; default deny; credentials not forwarded across trust boundaries; service-to-service workload identity; enforce source ACLs.
7. **Supported systems**: Bedrock + Vertex AI inference; PostgreSQL + Databricks query; S3 first, SharePoint optional; OpenFGA authz; pgvector default, FAISS optional.
8. **Both SDKs**: TypeScript and Python, feature-parity contract tests, minimal transitive dependencies.

## Product-to-workload map
| Repo | Package/module | Runtime workload | Dependencies |
|---|---|---|---|
| authz | policy SDK / API | authz-api | OpenFGA, metadata store |
| ai | core | ai-gateway | AWS Bedrock or Vertex, Postgres metering |
| ai | agents/evals/guardrails | optional agent-worker, eval-worker | model interface only; ai-gateway optional |
| context | data | optional data-api | postgres/databricks/S3 adapters selected |
| context | embed | embed-api, ingestion-worker | pgvector, embedding adapter |
| context | mcp | mcp-registry; gateway optional | metadata DB, optional authz adapter |
| contracts | schemas/specs | none | no application code |
| platform | helm/terraform/tests | none | deploys independently versioned images |

## High-level runtime flows
- User -> application -> `ai-gateway` -> Bedrock/Vertex; gateway attributes usage to verified org/app/user, reserves spend, records finalized usage.
- Agent -> optional `ai-gateway` interface and `context` tools; authorization at the tool and source boundaries; tools cannot inherit blanket agent privilege.
- Document ingestion -> data connector -> parser/chunker -> embeddings -> vector index -> authorized retrieval. Indexer handles updates/deletes/ACL changes.
- MCP client -> registry discovery/approval; runtime client may connect directly to server or through separately enabled gateway; registry is **not** a mandatory hot-path dependency.

## Cross-product contracts
Publish versioned OpenAPI 3.1 + JSON Schema for `IdentityContext`, `RequestContext`, `ErrorEnvelope`, `Page`, `AuditEvent`, `Authorizer`, `ModelClient`, `Tool`, `DataSource`, `VectorIndex`, `UsageEvent`, and `RegistryEntry`. Interfaces are behavioral contracts, not shared runtime ORM/business models. Consumer-facing SDKs are published in their owning product repository. `contracts` never requires a service implementation.

### Required context keys
- verified `subject_id`, `organization_id`, `application_id`, auth issuer/audience/scopes
- request/trace IDs and optional authorization delegation references
- never trust org/user IDs from request body, caller-supplied pricing, or unverified forwarding headers
- explicit resource ownership and permission checks at each service boundary

## Release and governance model
- Per-package semantic versioning; pin cross-repo dependencies to released versions; support an N-1 minor compatibility window initially (define exceptions in ADRs).
- API changes: propose ADR + schema PR in contracts -> compatibility checks -> additive server change -> SDK updates -> consumer integration -> removal only in next major.
- Each repo has CODEOWNERS, automated dependency updates, protected main, mandatory CI and signed/attested release artifacts where supported.
- `bae6-platform` tests a pinned **compatibility matrix** of released versions and promotes immutable image digests, not mutable tags.
- No direct reads/writes of another product's tables; no shared release train; no startup dependency on the registry or central control plane for data-plane calls.

## Kubernetes standard
- Stateless API Deployments with configurable replicas; readiness/liveness/startup probes; termination draining and request cancellation; graceful SIGTERM; disruption budget where warranted.
- HPA `autoscaling/v2` for service replicas; custom concurrency/RPS when available, CPU as fallback. Queue-driven autoscaling for ingestion/eval workers where justified. Never scale databases with HPA.
- Resource requests/limits, non-root/read-only filesystem, drop capabilities, namespace isolation, restricted egress, NetworkPolicy, secret/workload-identity integration, TLS ingress, service account least privilege.
- Database pools sized for total possible replicas. Rate limits and budget reservations must use atomically coordinated shared state (not per-pod memory). Idempotent jobs, leases and dedupe for at-least-once execution.
- Required operational tests: 1->3 replica scale test, simultaneous requests, rolling upgrade and rollback, killed-pod recovery, rate-limit correctness, DB outage and provider timeout.

## Implementation sequence and gates
### P0 Foundation (contracts + platform)
Deliver repo templates, CI, OpenAPI patterns, sample SDKs, Helm chart template, dev Docker Compose/kind environment, secrets/workload identity conventions. Gate: simple hello-world service on 3 pods, contract-generated clients and negative auth tests.

### P1 Authorization
Migrate existing `riz` code into `bae6-authz` preserving commits/history where practical; no duplicate policy engine. Gate: check/batch check, model pinning, audit, isolated tenants, 3-replica load test.

### P2 AI core
Model registry + Bedrock/Vertex basic text/multimodal and streaming; usage and atomic budget reservations; OpenAI-style subset. Gate: both providers mocked and at least one live smoke test each, cost ledger idempotence, 3-replica budgets race test.

### P3 Context data
Postgres, Databricks SQL, S3 with optional SharePoint later. Gate: read-only defaults, permission isolation, timeout/row limits, connector tests against realistic test fixtures.

### P4 Context embed
Indexing worker + pgvector search and ACL enforcement. Gate: index/update/delete works, no cross-tenant retrieval, authorization changes reflected safely.

### P5 Context MCP
Registry approvals/discovery and health; optional gateway later. Gate: registration/approval lifecycle, server metadata versioning, unauthorized discovery and invocation denied, resilient registry outage behavior.

### P6 AI extensions
Agent runner, tools, checkpointing, policy hooks, eval harness, optional LangChain adapter. Gate: bounded deterministic execution, tool approval enforcement, reproducible eval report and interruption recovery.

### P7 Integration and public release
Demonstration: authenticated research agent retrieving approved S3/Databricks content, indexed in embed, MCP-discovered tools, model gateway invokes Bedrock/Vertex, org/user usage ledger, full telemetry. Gate: security review, package footprint report, load test and rollback drills, docs and version matrix.

## Tests required in every repo
- Unit and schema/contract tests, SDK parity (TS + Python), authn/authz negative cases, tenancy isolation, malformed payloads, integration tests, load/failure tests, dependency/SBOM scan.
- Benchmarks recorded per release: SDK compressed size, image compressed size, idle memory, cold start, p50/p95 latency, max safe concurrency, provider cost accounting error.
- Do not promise arbitrary performance numbers until baseline measurements exist.

## First eight concrete issues for coding agent
1. Create five repo scaffolds, common CODEOWNERS/ADR template/AGENTS.md; enforce independent build pipelines.
2. Define and version `IdentityContext`, `ErrorEnvelope`, request IDs and standard OAuth/JWT validation rules.
3. Establish contract publishing and backward compatibility checks.
4. Establish minimal TS/Python SDK HTTP transport with retries/timeouts/errors, no heavy dependencies.
5. Build container/Helm example with HPA, probes, workload identity and NetworkPolicy.
6. Inventory existing riz source and write migration ADR; migrate under `bae6-authz`.
7. Implement authz compatibility tests using OpenFGA test fixtures.
8. Produce a pinned integrated smoke-test deployment in `bae6-platform`.

## Out-of-scope v1
Web administration portals, locally served models, new authorization engine, novel vector database, bespoke distributed scheduler, generic SQL query language, always-on Kafka, service mesh mandate, arbitrary third-party LLM providers, full OpenAI API fidelity.

## ADRs required before implementation
ADR-001 module/package versioning; ADR-002 tenant boundaries; ADR-003 identity delegation and trust; ADR-004 ai-core pricing ledger consistency; ADR-005 index ACL strategy; ADR-006 MCP discovery vs execution; ADR-007 shared DB instance with separate schemas vs separate DB instances; ADR-008 deployment configuration ownership.
