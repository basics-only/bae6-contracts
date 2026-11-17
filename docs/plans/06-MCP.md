# bae6-context/mcp — Enterprise MCP Registry Plan

## Intent
Tenant-aware private registry cataloging independently owned Model Context Protocol servers, their tools/resources/prompts, versions, owners, approvals and trust metadata. Distinguish **registry control plane** from optional runtime **MCP gateway/data plane**. Follow current MCP specification, particularly HTTP authorization and token audience binding.

## MVP registry APIs
`POST /v1/servers`, `GET /v1/servers`, `GET /v1/servers/{id}`, `POST /v1/servers/{id}/versions`, `POST /v1/servers/{id}/approve`, `POST /v1/servers/{id}/revoke`, `GET /v1/servers/{id}/health`. Support versioned server metadata format where possible; document any private extensions.

## Metadata
Organization, owning team, server ID/version, endpoint URI, protocol/spec version, transport, declared tools/resources/prompts, authentication method, approval state, required scopes, trust/scan status, timestamps, and allowed network zones. Never store plaintext access tokens in registry records.

## Security
- Publishing, approval and discovery scopes independent. Approval does not grant invocation.
- Validate remote URLs against SSRF/private-network policies; approved egress classes, TLS and trusted redirects. Do not connect to arbitrary endpoints at registration without policy.
- OAuth 2.0 protected-resource discovery and resource/audience-bound access tokens for HTTP transport. No downstream token passthrough to unrelated services.
- Runtime MCP tool execution requires authorization near the action, separate from listing. Audit privileged calls and approvals.
- Registry outage must not require blocking already verified direct server communication where policy permits.

## Phases
1. Schemas, DB records, API and SDK; ownership and tenant scope.
2. Registration/discovery/version/approve/revoke and audit.
3. Metadata verification, bounded health validation, lifecycle state machine.
4. Optional MCP gateway with per-tool policy, request size/timeouts/rate limits and auditable invocation.
5. Optional public registry import and private publication workflows (not MVP).

## Kubernetes
Stateless registry pods + separate PostgreSQL-backed metadata; HPA + probes and no sticky session. Optional gateway deploys independently and scales on concurrent tool connections and RPS.

## Done
Two tenants cannot discover each other's private servers; revoked server inaccessible to new authorized discovery; gateway if enabled denies unauthorized calls; manifests and TS/Python SDK tests pass.
