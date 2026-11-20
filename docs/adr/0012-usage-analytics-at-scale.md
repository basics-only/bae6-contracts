# 0012 — Usage analytics at scale

Status: proposed
Date: 2026-11-20

## Context
The ledger is expected to hold tens of millions of events. The 0011 endpoints aggregate raw
`usage_events` per request. That is untested at this volume; 0011 said to measure before adding
rollups, so the rollups below are built only after a benchmark of the 0011 queries on a ledger
of at least 20 million events shows them over 2 seconds at p95. Only the ledger itself
(reserve, finalize, budgets, idempotency) needs real-time exactness. Dashboards may be
minutes behind, governance statistics a day, and an error of 1 to 3% is acceptable where
documented. Paid or non-Postgres systems are out of scope.

## Decision
- **Three freshness tiers.**
  - *Ledger*: real time and exact. Unchanged.
  - *Dashboards* (summary, series): read hourly rollups, at most a few minutes behind.
  - *Governance* (active users, distribution, concentration): read per-user daily rows, at
    most the job interval behind.
- **Rollups live in the gateway's Postgres, beside the ledger (0007).** No new datastore and
  no extension.
  - `usage_hourly`: one row per hour, organization, application, model, task type, domain and
    outcome: request count, token sums, cost sum, and two sparse histograms, one for latency
    and one for first-token latency.
  - `usage_user_day`: one row per UTC day, organization, application, subject, model, task type
    and domain: token and cost sums. Active users over 1, 7 and 30 days, grouped or filtered by
    task type, domain or model, and the distribution and concentration curves, are exact
    counts and sums over it.
  - `groupBy=run` is not rolled up. It reads `usage_events` for at most 50 run ids through a
    `run_id` index, as in 0011.
- **Percentiles are nearest-rank, on both paths.** The raw path switches from `percentile_cont`
  to `percentile_disc`. Histogram buckets are 3% wide from 1 ms to 1 hour; a larger value goes in
  the last bucket (the provider timeout is at most 300 s). Reporting a bucket's geometric
  midpoint keeps a reported p50 or p95 within 1.5% of the nearest-rank value.
- **Windows snap outward.** `from` rounds down and `to` rounds up to a UTC hour for summary and
  series, and to a UTC day for active users, distribution and concentration. The 93-day cap is
  checked on the snapped window. The response states the snapped `from` and `to`, so a request
  whose bounds are not on the hour now reports a slightly wider window than it asked for.
- **Aggregation is idempotent and atomic.** Every replica runs the job on a timer. Each tick
  opens one transaction, takes `pg_try_advisory_xact_lock`, recomputes the buckets for events
  with `time` at or after the stored watermark minus two hours, upserts them, and advances the
  watermark; a replica that does not get the lock skips the tick. Events are append-only and
  take their `time` when written at finalize, and reservations are not events, so only
  finalized calls are counted. The two hours cover transaction commit delay (bounded by the
  10 s statement timeout). A crash or retry recomputes the same buckets and cannot double count.
- **Responses say how fresh they are.** Summary, series, distribution and concentration gain an
  `asOf` timestamp, the end of the data the rollups include.
- **Raw-ledger path stays as an escape hatch.** `exact=true` runs the query over `usage_events`
  for one organization and at most 7 days of `[from, to)`; active users still look back 30
  days. It needs `ai:usage:read` for the caller's own organization, or `ai:usage:platform` to
  name another. A test compares rollup and raw results on one fixture: sums and counts must be
  equal and percentiles within 3%.
- **Personal data.** `usage_user_day` is a second copy of end-user subject identifiers. It is
  deleted with the ledger's retention, and erasing a subject's events deletes that subject's
  rows there too. 0011's retention and erasure policy applies to it unchanged. `usage_hourly`
  holds no subjects. It is kept 25 months.
- **Bounds remain.** The 93-day window, 100-group cap and the other 0011 limits apply.
- **Growth beyond this.** When a benchmark shows `usage_events` needs it, partition it by month
  and drop partitions by retention. A unique constraint on a partitioned table must include the
  partition key, so `request_id` uniqueness and the idempotency lookup would have to change;
  that is a ledger decision for its own ADR. The rollup schema is the interface: a columnar store
  could replace it behind the same endpoints.

## Consequences
- Dashboard queries read a number of rows set by hours and groups, not by events. The cost of
  governance queries is set by active users times days times the tag combinations each
  user uses.
- Money, tokens, request counts and active users are exact over the snapped window. The
  approximations are percentiles (within 1.5% of nearest-rank) and the rounding of window
  edges.
- A dashboard figure can be a few minutes old. Callers needing an exact figure for a short
  period use `exact=true`.
- Two new tables and a job per replica; a stalled job shows as an old `asOf`, so it needs an
  alert on that age.
- Migrations add tables only and roll back by dropping them. They need `db-guardian` review.
- Unverified: query latency without rollups, aggregation throughput, the size of
  `usage_user_day`, and the row size of the histograms.
