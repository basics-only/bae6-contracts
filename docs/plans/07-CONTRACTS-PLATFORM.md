# bae6-contracts + bae6-platform — Shared Infrastructure Plan

## Contracts repository
Publish versioned OpenAPI 3.1 / JSON Schemas, lint/compatibility tooling, API style guide, trace/identity/error conventions and reference test fixtures. Do not ship service-domain implementation logic or ORM entities.

### Contract change process
- New/changed API begins as schema PR with ADR if cross-product behavior changes.
- Contract CI tests backward compatibility, schema correctness and language client generation.
- Additive changes first; consumer integration before breaking API removals; document deprecation versions.
- Each consumer pins version; no default `latest` dependency; compatibility matrix maintained by platform.

### Minimum schemas
IdentityContext, AuditEvent, ErrorEnvelope, Pagination, CapabilityDescriptor, Authorizer, ModelClient, ToolDefinition, DataSource, Document, VectorIndex, UsageEvent, Budget, MCPRegistryEntry. Clear ownership of each schema and schema evolution process.

## Platform repository
- Helm: independently parameterized charts per *runtime*, with image digests, config/secret refs, network policies, RBAC, ServiceAccounts, readiness/liveness/startup probes, securityContext, resource requests, HPA/KEDA optional.
- Terraform: cloud-agnostic composition with GKE/EKS example modules and managed PostgreSQL, container registries, ingress networking, workload identity, cloud secrets. Do not require both clouds to deploy a single service.
- Developer experience: Docker Compose for local and kind/k3d Kubernetes smoke; test fixtures for OpenFGA, Postgres/pgvector and mock Bedrock/Vertex APIs.
- Delivery: independent image and SDK release workflows per product, deployment promotion using pinned image digest/Helm chart; staged environments dev -> preprod -> prod, rollback and migration discipline.
- Observability: structured logs, OpenTelemetry, service-level dashboards for error rates, p95 latency, saturation, spend ledger lag, background queue depths, ACL sync backlog.

## Kubernetes validation gate per runtime
1. Deploy with one replica and no privileged container.
2. Increase to three replicas; HPA or scaling manual test.
3. Restart one pod during in-flight operation; predictable retry/idempotent behavior.
4. Roll out previous and next compatible versions concurrently; contract tests continue to pass.
5. Simulate dependency timeout and DB unavailability; no security-policy bypass.
6. Check readiness fails if hard dependencies prevent safe serving, liveness independent of transient upstream outage.
7. Confirm resource usage, egress policy, secret handling, and audit/trace correlation.

## Team collaboration
Repo-specific CODEOWNERS + lightweight architecture council for only shared contracts and trust boundary changes. A team may independently change internals without cross-team approval if public contracts remain compatible. Weekly compatibility suite against pinned released versions, not continuously changing main branches.

## Deliverables
Release pipeline template, chart template, Terraform samples for EKS/GKE, CI contract workflow, integration matrix, promotion/rollback runbook, secrets and incident response runbook.
