# bae6-context/data — Connector Implementation Plan

## MVP
TS `DataSource` interface, minimal TS/Python clients, optional hosted data-api. Adapters: PostgreSQL, Databricks SQL, S3. SharePoint adapter is a deferred opt-in.

## Contracts
`query({statement, parameters, maxRows, timeoutMs})` for SQL connectors; `list({prefix,cursor,limit})`, `read({key,version,byteRange})`, `stat` for object/document stores; `capabilities()` for introspection. Each connector may have its own query parameter dialect; never imply SQL portability.

## Tasks
1. Define query result, source identity, ACL metadata, pagination, cancellation and error schemas.
2. Postgres driver connection pooling, parameterized SQL, least-privilege read-only roles, timeout/row/byte caps.
3. Databricks SQL connector, warehouse resource governance, service-principal vs delegated identity modes explicitly documented, Unity Catalog source permissions.
4. S3 List/Get/Head/stream, version and ETag tracking, prefix restrictions, AWS workload identity.
5. Optional service API that binds authenticated user/tenant to connector configuration. No caller-supplied raw connection string.
6. Optional SharePoint Graph document connector with delta-sync and changing ACL handling.
7. Tests: forbidden SQL/write attempts, SSRF on source definitions, cross-tenant references, secret leaks, huge result truncation, connection exhaustion.

## Kubernetes
No sticky state. Connection pools bounded by maximum replica count. HPA with concurrency metrics. Separate secret references and egress rules per connector.

## Done
Read-only operations work for all three MVP connectors; cancellation and timeouts tested, permissions fail closed; SDK parity and example jobs ship.
