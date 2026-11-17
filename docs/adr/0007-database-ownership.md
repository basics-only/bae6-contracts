# 0007 — Shared database instance versus separate instances

Status: accepted
Date: 2026-11-17

## Context
Several runtimes need PostgreSQL. Separate instances cost money and operations; shared
schemas invite cross-service reads.

## Decision
- Each runtime owns **its own logical database and role**: `authz`, `ai_gateway`,
  `context_data`, `context_embed`, `context_mcp`. A role has no grants on another runtime's
  database. OpenFGA keeps its own database too.
- Those databases may live on one PostgreSQL instance (dev, small deployments) or on
  separate instances (production at scale). Moving one is a connection-string change.
- A runtime runs its own migrations under an advisory lock at start-up. No migration touches
  another runtime's database.
- No service reads or writes another service's tables. Cross-service data moves through
  public APIs or exported events.
- Connection pools are sized for the maximum replica count: `pool_max × max_replicas ≤
  the database's share of max_connections`.

## Consequences
- One instance is a shared failure and capacity domain; the platform's per-runtime dashboards
  must show whose load it is.
- pgvector is enabled only in the `context_embed` database.
