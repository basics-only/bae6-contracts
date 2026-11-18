# 0002 — Tenant boundaries

Status: accepted
Date: 2026-11-17

## Context
Every product serves several organizations. A leak between them is the worst failure the
suite can have.

## Decision
- **The tenant is the organization.** An application belongs to exactly one organization.
  Users and workloads act within one organization per request.
- `organizationId` is never read from a request body, query or caller-chosen header. A
  service maps it from configuration: the verified token's issuer, plus (when one issuer
  serves several organizations) a claim the operator names for that issuer. An unmapped
  issuer or claim value is rejected with 401.
- Every persisted row a tenant owns carries `organization_id`, and every query that reads
  or writes it filters on the caller's organization in the same statement. There is no
  "global admin" read path that skips the filter; cross-tenant operator tasks run as
  separate tooling with their own audit.
- A resource in another tenant is indistinguishable from one that does not exist: `404
  not_found`, same body, no timing-dependent extra work.
- Resource IDs in authorization checks are scoped by the service
  (`<org>/<app>/<type>:<id>`); a caller-supplied ID that names another tenant is rejected
  before it reaches the policy engine.
- Shared state that enforces limits (budgets, rate limits, job leases) is keyed by
  organization first.

## Consequences
- Each service needs a trusted issuer→organization mapping in config.
- Tests in every repo include a two-tenant fixture and assert 404, not 403, across the boundary.
