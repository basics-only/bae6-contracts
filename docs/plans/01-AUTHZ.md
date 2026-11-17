# bae6-authz — Service Implementation Plan

## Objective
Independent authorization API and TS/Python SDK built on **OpenFGA**. Preserve and rename existing riz work rather than rebuilding. OIDC verification is authentication integration, not a home-grown IdP.

## Modules and API
- `authz-api`: `POST /v1/check`, `POST /v1/batch-check`, `POST /v1/list-objects` (bounded and paginated), admin model/relationship management endpoints under privileged scopes, `GET /health/ready`.
- `sdk/typescript`, `sdk/python`; shared provider-neutral `Authorizer` interface.
- OpenFGA adapter with organization/app store policy, pinned immutable model IDs, resource relationships, bounded cache and consistency controls.
- OIDC/JWKS verifier with issuer/audience checking and trusted application/organization mapping; server-side access policies for administrators.

## Key behaviors
- Default deny, fail closed for protected reads/writes. No blanket grants on OpenFGA outage.
- Explicit org/app/resource scope in resource IDs and policy checks; reject cross-tenant references.
- Batch checks bounded; authorization decisions audited without logging sensitive tuples/tokens.
- Policy promotion workflow using immutable model versions; rollback is explicit model pin change with audit.
- For Databricks/SharePoint, expose a provider authorization interface; do **not** confuse application-level authorization with source's own user-delegated ACL enforcement.

## Implementation tasks
1. Audit existing riz code/tests/SDKs; map existing paths to `bae6-authz` and create migration compatibility guide.
2. Define identity and authorization schemas in contracts; implement OIDC issuer/audience validation.
3. Wrap OpenFGA client, model pinning, per-tenant store strategy, connection/timeouts and bounded batching.
4. Add check/batch/list APIs, input limits, audit events, TS/Python SDKs.
5. Add policy-administration scopes, idempotent writes, immutable model references and safe cache invalidation.
6. Containerize; Helm chart, HPA, probes, resource caps, graceful shutdown, metrics.
7. Integration tests with OpenFGA and adversarial tenant/security fixtures.

## Acceptance criteria
- Three API replicas return equivalent decisions for pinned model ID; deployment rolling upgrade works.
- Allow/deny/unknown resource/cross-tenant conditions tested; source ACL checks remain authoritative.
- Latency/p95 and resource footprint measured; requests time out predictably under upstream failure.
- TS/Python parity tested against same OpenAPI spec; admin audit complete.
