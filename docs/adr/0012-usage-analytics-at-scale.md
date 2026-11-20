# 0012 — Usage analytics at scale

Status: proposed
Date: 2026-11-20

## Context
The ledger is expected to hold tens of millions of events. The 0011 endpoints aggregate raw
`usage_events` per request, which stays fast for months of small tenants and not for a platform
with that volume. Only the ledger itself (reserve, finalize, budgets, idempotency) needs
real-time exactness. Dashboards may be minutes behind, governance statistics a day, and an
approximation error of 1 to 3% is acceptable where it is documented. Paid or non-Postgres
systems are out of scope.

## Decision
- **Three freshness tiers.**
  - *Ledger*: real time and exact. Unchanged.
  - *Dashboards* (summary, series, active users): read hourly rollups, at most a few minutes
    behind.
  - *Governance* (distribution, concentration): read per-user daily totals and a nightly
    batch, at most a day behind.
- **Rollups live in the gateway's Postgres, beside the ledger (0007).** No new datastore and no
  extension.
  - `usage_hourly`: one row per hour, organization, application, model, task type, domain and
    outcome, with request count, token sums and cost sum. Sums are exact.
  - `usage_user_day`: one row per UTC day and end user (organization, application, subject)
    with token and cost sums. Active users over 1, 7 and 30 days and the concentration curves
    come from it exactly, so no HyperLogLog is needed.
  - Latency percentiles come from a fixed log-spaced histogram per `usage_hourly` row, with
    buckets 3% wide, so a reported p50 or p95 is within 3% of the true value. This is the only
    approximation.
- **Aggregation is idempotent.** Every replica runs the job on a timer. A non-blocking
  advisory try-lock lets one replica aggregate per tick; the others skip. Each tick recomputes
  the hour and day buckets touched since a stored watermark minus two hours, and upserts them,
  so a crash, a retry or a late-finalized event cannot double count. The watermark advances
  only after the upsert commits. Events are never deleted by the job.
- **Responses say how fresh they are.** Summary, series, distribution and concentration gain an
  `asOf` timestamp, the end of the data the rollups include. Rollup-backed windows snap to
  UTC hours, and the response states the snapped `from` and `to`. All additions are optional
  fields, so existing clients keep working.
- **Raw-ledger path stays as an escape hatch.** `exact=true` runs the 0011 query over
  `usage_events`, limited to one organization and at most 7 days, and needs
  `ai:usage:platform`. A test compares rollup and exact results on the same fixture and fails
  when sums differ or percentiles are off by more than 3%.
- **Bounds remain.** The 93-day window, 100-group cap and the rest of 0011's limits apply
  unchanged. Rollups are kept 25 months; raw events follow the ledger's retention.
- **Growth beyond this.** When `usage_events` passes about 100 million rows, partition it by
  month and drop partitions by retention. The rollup schema is the interface: if Postgres
  stops being enough, a columnar store can replace it behind the same endpoints.

## Consequences
- Dashboard queries read a number of rows set by hours and groups, not by events, so their
  cost no longer grows with traffic. `usage_user_day` grows with active users times days and
  is the table to watch.
- A dashboard can show a number up to a few minutes old, and the first and last hour of a
  window are rounded. Callers needing an exact figure for one day use `exact=true`.
- Percentiles are approximate within 3%; money, tokens, request counts and active users are
  exact.
- Two new tables and a background job per replica; a stalled job is visible as an old
  `asOf`, so it needs an alert on that age.
- Migrations add tables only and roll back by dropping them. They need `db-guardian` review
  before merge.
- Unverified: aggregation throughput at tens of millions of events per month, the size of
  `usage_user_day`, and whether 3% buckets keep the histogram rows small enough.
