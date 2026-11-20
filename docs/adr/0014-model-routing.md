# 0014 — Automatic model routing

Status: proposed
Date: 2026-11-20

## Context
Callers name one concrete model per request. The price book, the budget reservation, the
usage event and the organization visibility check (`organizations`) are all keyed by that
model id, and the reservation happens before any provider call (ADR 0004). Organizations
want cheaper models for easy requests without every caller choosing, but routing must not
weaken tenant isolation, budgets or idempotency, and must not add unbounded work.

## Decision
- **Routes are config, in Git** (ADR 0013): `routes` in `BAE6_AI_CONFIG`. A route has an id
  in the same namespace as model ids (a collision is a config error), a `default` model, an
  ordered `rules` list, an optional `classifier`, and optional `organizations`.
- **A caller sends `model: "<route id>"`.** The gateway resolves it to one concrete model
  **before** the idempotency claim and the reservation. Everything after sees only the
  concrete model: price book, estimate, reservation, provider call, usage event. The
  response's `model` names the concrete model, and the usage event also records the route id
  and why that model was chosen (rule index, classifier tier, or default and its reason).
- **Hard filters come first and scoring never overrides them.** A candidate must be visible
  to the caller's organization, support the operation, accept the request's modalities,
  and fit the input and requested output tokens. If none qualifies the answer is a 4xx,
  never a model the organization may not use.
- **Rules** are deterministic and first-match-wins: conditions on estimated input tokens
  and on whether the request has images select a model. No match selects `default`, which
  should be the model the organization would use without routing.
- **Classifier (optional, later slice)**: a small model scores the request as one of a
  fixed set of tiers, and the route maps each tier to a model.
  - It is a remote call through an existing provider (Bedrock, Vertex, or Hugging Face
    per ADR 0015), chosen from models the organization may already use, so no prompt goes
    to a provider the organization has not enabled.
  - It sees only the last user message truncated to a fixed length, under a gateway-owned
    prompt, and its output must be exactly one tier name. Anything else, a timeout (hard
    cap 2 s), a provider error or a budget refusal selects `default`.
  - Its call is metered as its own usage event under the same organization budget at its
    own model's price. Injected text in a request can at worst pick a tier the organization
    is already allowed to use: a cost and quality effect, not an access one.
- **Routing applies to `chat` and `chat_stream` only.** An `embed` on a route is a 400:
  embeddings from different models are not comparable.
- **No hidden retries.** The model is fixed before the first byte, there is no mid-stream
  switch, and a provider failure is returned as it is today. The caller retries with its
  idempotency key; a replay returns the stored result.
- **Visible in `/v1/models`.** Routes are listed with the largest limits among their
  candidates. This is a contract change with TS and Python SDK parity.
- **Quality is measured, not assumed.** A classifier route is evaluated offline on a dataset
  with the `evals` package before it is enabled. No online learning, per-user stickiness or
  experiments in this ADR.

## Consequences
- Slice one is rules only: no extra provider call, fully explainable, and testable without a
  model.
- The usage event gains a nullable `route_id` and a decision column: a migration for
  `db-guardian`.
- A classifier adds latency up to its timeout and its own cost to every routed request;
  whether that pays for itself is unmeasured until a real route runs on real traffic.
- A misconfigured `default` that is cheap and weak silently lowers quality. The route's
  decision log is how to see it.
