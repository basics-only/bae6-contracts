# bae6-context — Context Product Implementation Plan

## Product scope
Three separately publishable modules and independent runtimes: `data` (connectors), `embed` (ingestion/vector retrieval), `mcp` (server registry and optional execution gateway). All three must operate standalone. MCP is a **tool capability and execution governance** surface, not merely retrieval context.

## Recommended layout
```
packages/data/        # core DataSource abstraction
packages/data-postgres/; data-databricks/; data-s3/; data-sharepoint/
packages/embed/; embed-pgvector/; embed-faiss/
packages/mcp-client/; mcp-registry-client/; mcp-gateway/
services/data-api/       # optional
services/embed-api/; services/ingestion-worker/
services/mcp-registry/; services/mcp-gateway/ # gateway optional
sdk/typescript/; sdk/python/
```

## Cross-module contracts
`DataSource.query/read/list/metadata`, `Document` with source ID/revision/ACL/provenance, `VectorIndex.upsert/query/delete`, `EmbeddingModel` and `MCPRegistryEntry`. Common tenant identity and optional `Authorizer` injection, never mandatory `bae6-authz` dependency.

## Security assumptions
- S3 is the default document source; SharePoint optional. PostgreSQL and Databricks are supported query connections, not implicit universal document stores.
- Never interpret a service principal as user-delegated access; scope credentials, verify source ACLs, prevent cross-tenant indexing and leakage. Treat retrieved text and tool descriptions as untrusted.
- MCP registry publication is not runtime authorization; enforce permissions at tool execution and source access. Validate OAuth audience/resource binding for HTTP MCP.

## Delivery order
1. Data contracts + Postgres/Databricks/S3 adapters with read-only defaults.
2. Embedding ingestion from S3 + pgvector; incremental reindex and ACL enforcement.
3. MCP registry: register/version/approve/discover/revoke, tenant isolation, health checks.
4. Optional SharePoint and FAISS adapters; optional MCP execution gateway after core registry hardened.

## Scaling
- Data API stateless with bounded connection pools and query concurrency.
- Embed API stateless; independent at-least-once ingestion workers with job leases, retry/DLQ strategy and tenant quotas.
- MCP registry stateless with DB metadata; gateway optional with its own traffic HPA and isolated execution policies.
- No synchronous registry lookup on every inference/tool-call hot path; safe bounded caches where appropriate.

## End-to-end acceptance
- Source ingestion/search returns only authorized content including after ACL revocation.
- MCP discovery and invocation are separately governed; unavailable registry does not force all already-authorized direct clients offline.
- Data, embed and mcp can each build, install, test and roll out independently and SDK optional installations exclude other connectors.
