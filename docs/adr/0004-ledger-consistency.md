# 0004 — AI pricing ledger consistency

Status: accepted
Date: 2026-11-17

## Context
Several gateway replicas spend against one budget concurrently. Pods crash mid-request.
Providers sometimes fail without saying whether they billed.

## Decision
- **One store**: the gateway's own PostgreSQL database. No Redis, no per-pod counters.
- **Reserve**: before a provider call, one statement increments `reserved` on the budget row
  only if `spent + reserved + estimate <= limit`, and inserts a reservation row with a lease
  expiry, in one transaction. Zero rows updated = `budget_exceeded`, no provider call.
- **Finalize**: after the call, one transaction moves the measured cost from `reserved` to
  `spent` and writes an immutable usage event. The usage event's primary key is the request
  ID, so a second finalize of the same request is a no-op.
- **Uncertain outcome** (timeout or dropped connection after the request was sent): the
  reservation is finalized as `uncertain` at the estimated cost, never as zero. Reconciliation
  against the provider bill can correct it with a compensating event.
- **Crash recovery**: a reconciler finds reservations past their lease and finalizes them as
  `uncertain` at the estimate. It is safe to run on every replica (row locks with `SKIP LOCKED`).
- **Money**: `numeric` in Postgres and decimal strings on the wire; no floats. Price books
  are immutable, versioned rows; each usage event records the price-book version it used.
- **Idempotency**: an `Idempotency-Key` from the caller maps to one request ID per caller,
  so a retried request reuses the original reservation and result instead of calling the
  provider twice.

## Consequences
- Budgets are never exceeded by more than the in-flight reservations' estimate error.
- Every metered request costs two short write transactions on the budget row; hot budgets
  serialize on that row. Measure before adding sharded counters.
