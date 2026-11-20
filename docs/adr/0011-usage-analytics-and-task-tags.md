# 0011 — Usage analytics and task tags

Status: proposed
Date: 2026-11-20

## Context
Operators want one view of usage (daily, weekly and monthly active users), token and dollar
spend, and latency, broken down by organization and by what the calls were for. Today the
gateway ledger (0004) records tokens and cost per call and `GET /v1/usage` groups them by model
and outcome for one application. It records no latency, no task type or domain, and exposes no
history by day or active-user counts. Agent runs report tokens but not cost, and eval runs report
neither.

## Decision
- **The gateway ledger is the only source.** Usage events gain `task_type`, `domain`,
  `run_id`, `latency_ms` (request to last byte) and `first_token_ms` (null when not streamed).
  The verified end-user subject is already attributed to each event; it is the basis for active
  users. No product reads another product's database (0007); the console reads the gateway's
  public API.
- **Tagging is per call and optional.** Callers send `Bae6-Task-Type`, `Bae6-Domain` and
  `Bae6-Run-Id` headers. The OpenAI-style request body is unchanged. An absent tag is stored as
  null and reported as `untagged`.
- **Tags are a managed list per organization, not free text.** Task types (for example
  `information-extraction`, `summarization`, `analysis-synthesis`, `proofreading`) and domains
  of use are rows owned by the organization: an id (`^[a-z0-9][a-z0-9-]{0,47}$`), a display
  name of at most 64 characters, and at most 50 of each kind. A header naming an id the
  organization has not defined is rejected with `400 unknown_tag` before any provider call;
  it is never stored or silently dropped. Deleting a tag keeps it on past events.
- **Endpoints**, all additive (no existing field or route changes):
  - `GET/PUT/DELETE /v1/task-types[/{id}]` and `/v1/domains[/{id}]`: read needs
    `ai:usage:read`, write needs `ai:usage:admin`.
  - `GET /v1/usage/summary`: per group over `[from, to)`: requests, input and output tokens,
    cost (decimal string), latency and first-token p50 and p95, and active users over the
    trailing 1, 7 and 30 days ending at `to`. `groupBy` is one of `organization`, `taskType`,
    `domain`, `model`, `run`.
  - `GET /v1/usage/series`: the same measures per UTC day for one optional group filter.
  - `GET /v1/usage/distribution`: for each top percent of end users, the share of tokens or cost they used (a Lorenz curve), plus the user count; same filters and scope as the series, and no user ids.
  - Both accept at most 93 days, return at most 100 groups with an explicit `truncated` flag,
    and `groupBy=run` takes at most 50 `runId` values. Cost is `numeric`, never a float.
- **Scope.** Without a platform scope, every query is confined to the caller's own organization
  (0002) and `groupBy=organization` is refused. `ai:usage:platform` allows cross-organization
  queries and is meant for operators. The console forwards the operator's token (0010); it
  holds no wider credential.
- **Run spend.** Agent and eval workers already call the gateway. They send `Bae6-Run-Id` on
  each call, so a run's cost is the sum of its ledger events. The console asks
  `groupBy=run` for the runs on the page it is showing. Workers store no cost.
- **Active users** are distinct end-user subjects. Calls made with only a service token have no
  end user and count toward spend but not toward active users.

## Consequences
- Dashboard and run spend need the gateway migration and endpoints before the console can show
  them; until then those views stay hidden rather than showing zeros.
- `percentile_cont` and `count(distinct)` over up to 93 days of events can be slow on a large
  ledger. Measure before adding a daily rollup table; the window and group limits bound the
  worst case meanwhile.
- Subject identifiers in the ledger are personal data. Retention and erasure follow the
  ledger's existing policy; this ADR adds no new copy of them.
- Task-type quality depends on callers tagging honestly; the gateway checks the tag is
  defined, not that it is true.
- The migration adds nullable columns and new tables only, so it can roll back by ignoring
  them. It needs `db-guardian` review before merge.
- Unverified: query latency at production ledger volumes, and how many callers will adopt the
  headers.
