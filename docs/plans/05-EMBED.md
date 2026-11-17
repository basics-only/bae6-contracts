# bae6-context/embed — Embedding and Retrieval Plan

## MVP
Separate model embedding from indexing; model calls via `EmbeddingModel` (optional ai-core adapter). PostgreSQL + pgvector as persistent index; optional FAISS local adapter later. S3 documents first; other data connectors may provide source content.

## Public interface
`createCollection`, `ingest`, `upsert`, `search`, `delete`, `sync`, `getJob`. Query supports tenant, metadata filters, limit, source IDs and authorization subject; subject derived from verified service identity.

## Pipeline
1. Discover/list source keys with version/ETag and authorized scope.
2. Parse allowed file types with bounded sizes; preserve structured provenance and source URI/version.
3. Deterministic chunking with stable chunk IDs and content hashes.
4. Generate embeddings from pinned model/version and dimension; track billable usage through adapter when available.
5. Batch upsert vectors + metadata + source ACL references transactionally where practical.
6. Incremental sync, deleted source tombstones, revocation processing and reindex on model/chunker changes.
7. Search via pgvector indexes with tenant-filtered candidates; enforce source ACLs before return; include cited source spans. For strict ACL needs, authorization-aware candidate filtering or oversampling then verification without leaking rejected content.

## Workers/scaling
Durable PostgreSQL-backed jobs with leases, idempotent retry, bounded batch and per-tenant concurrency; independent worker replicas. Separate indexing pressure from query latency. Tune pgvector HNSW only after baseline exact-search measurements.

## Risks/tests
- Changing permissions must make stale indexed material undiscoverable (fail closed, deny-on-revocation).
- Prompt injection from retrieved text cannot grant tool privileges.
- Prevent unauthorized metadata, similarity score, and existence leakage.
- Test deletion, duplicate ingestion, interruption mid-batch, model dimension change, cross-tenant nearest-neighbor neighbors and 3-replica ingestion contention.

## Done
S3 -> chunk -> embed -> pgvector -> authorized cited search works; reindex/delete/ACL update validated; p95 and storage footprint benchmarks recorded.
