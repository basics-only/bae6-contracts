# 0009 — Feedback and harness versioning

Status: proposed
Date: 2026-11-18

## Context
Operators want to know which models, MCP servers and agent harnesses work well, and to
roll a harness back when it does not. Neither feedback nor a harness registry is in the
master plan. The agent runner and eval harness (P6) are not built, so a harness schema
today would be a guess.

## Decision
**Feedback**
- Feedback is a verdict on one interaction, never on a subject in the abstract. It names a
  subject (`model`, `mcp_server` or `harness`, with id and version) and a `requestId` that
  the owning runtime recorded for the caller's organization. An unknown request, or one of
  another organization, is `404 not_found` (0002).
- The runtime that owns the subject stores its feedback in its own database (0007): the
  gateway for models, the MCP registry for MCP servers, the agent runtime for harnesses.
  There is no central feedback service or shared feedback table. Aggregation reads public
  APIs or exported events.
- The organization and submitter come from the verified token, never the body (0002, 0003).
  `feedback:write` submits; `feedback:read` lists. A submitter may not read others' entries
  without `feedback:read`.
- A verdict is `positive` or `negative`, plus an optional label from a fixed set per subject
  kind and an optional comment of at most 1,000 bytes. There is one entry per (organization,
  subject, request, submitter); resubmitting replaces it.
- A comment is untrusted text. It is stored and returned to `feedback:read` holders only. It
  is never placed in a prompt, a routing or approval decision, or a log line.
- Feedback never changes behavior by itself: no automatic rerouting, revocation or
  promotion. People or evals read it.
- Feedback is off the request path. A feedback outage or limit never fails inference or tool
  calls. Writes are rate-limited per organization, and listings are paged with a maximum
  page size. Retention is bounded per organization.

**Harness registry** (design constraints only; no code until the agent runtime exists)
- It belongs to `bae6-ai` with the agent runtime (P6), in that product's own database.
- A harness version is immutable. Its identity is the sha256 of the canonical manifest: model
  references, tools as MCP server id and version, prompt, policy hooks and limits. A manifest
  holds references to credentials, never secrets or tokens (0006).
- Names such as `stable` are movable pointers per application, scoped by organization.
  Rollback is moving a pointer. Pointer moves are append-only history recording who moved it
  and why.
- Publish, promote and read are separate scopes. Like the MCP registry (0006) it is a control
  plane, never on the run path: a run pins a digest at start, caches by a bounded TTL, and
  keeps running when the registry is down.

## Consequences
- No new service. Each product gains a small feedback table and two endpoints, built one
  product at a time, starting with the gateway because it already records a request ID per
  organization.
- Cross-product views of feedback need an exported event or a read API; that is left to a
  later decision.
- The gateway's `usage_events` already keys each call by `request_id` with its organization,
  application, subject and model, so model feedback can validate against it. Unverified: who
  mints that ID (server or caller) and whether the MCP registry and a future agent runtime
  have an equivalent record. Lookups filter on organization in the same statement (0002), so
  a guessed ID never confirms another tenant's request.
- The harness manifest schema, canonical form and pointer-move authorization are open until
  P6 has a runner to load one.
