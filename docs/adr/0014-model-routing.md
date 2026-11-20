# 0014 — Automatic model routing

Status: proposed (the classifier slice builds on 0015 and 0013, which must merge first)
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
- **A caller sends `model: "<route id>"`.** The gateway checks the route is visible to the
  caller's organization, then claims the idempotency key, and only after a **new** claim
  resolves the route to one concrete model, before the reservation. A replay or an
  in-progress answer therefore never pays for a classifier call.
  Everything after resolution sees only the concrete model: price book, estimate,
  reservation, provider call, usage event. The response's `model` names the concrete model.
- **The claim records the concrete model, and a replay re-checks it.** The idempotency hash
  covers the request body, so it covers the route id and not the model chosen. The claim
  stores the chosen model id, and a replay is served only if the caller's organization may
  still use that model; otherwise it is refused (409), because a model lost since the first
  call must not still answer. The model id is not put into the hash: a genuine retry of a
  classifier route could choose differently and would be reported as a mismatch.
- **The decision is recorded where the money is.** The route id and why the model was chosen
  (rule index, classifier tier, or default with its reason) are stored on the reservation
  and copied to the usage event, so a request settled by the lease reconciler keeps them.
- **Hard filters come first and scoring never overrides them.** A candidate must be visible
  to the caller's organization, support the operation, accept the request's modalities,
  and fit the input and requested output tokens. If none qualifies the answer is a 4xx,
  never a model the organization may not use.
- **Rules** are deterministic and first-match-wins: conditions on estimated input tokens
  and on whether the request has images select a model. A rule whose model fails a hard
  filter is skipped and evaluation continues with the next rule, then `default`; if
  `default` fails too, the answer is a 4xx. No match selects `default`, which should be the
  model the organization would use without routing.
- **Classifier (optional, later slice)**: a small model scores the request as one of a
  fixed set of tiers, and the route maps each tier to a model.
  - It is a remote call through an existing provider (Bedrock, Vertex, or Hugging Face
    per ADR 0015). The classifier model is checked against **each request's** organization:
    a route can serve many organizations, so if this one may not use the classifier model
    the request goes to `default` without a classifier call. At config load, a route's
    `organizations` must be a subset of its classifier model's. No prompt reaches a provider
    the organization has not enabled.
  - It sees only the last user message truncated to a fixed length, under a gateway-owned
    prompt, with an output cap of a few tokens, and its output must be exactly one tier
    name. Anything else, a timeout (hard cap 2 s), a provider error or a budget refusal
    selects `default`.
  - Its call is metered as its own usage event under the same organization budget at its
    own model's price. Injected text in a request can at worst pick a tier the organization
    is already allowed to use: a cost and quality effect, not an access one.
- **Routing applies to `chat` and `chat_stream` only.** An `embed` on a route is a 400:
  embeddings from different models are not comparable.
- **No hidden retries.** The model is fixed before the first byte, there is no mid-stream
  switch, and a provider failure is returned as it is today. The caller retries with its
  idempotency key; a replay returns the stored result.
- **Visible in `/v1/models`.** A route is listed only to organizations that may use it, as
  its own kind of entry with no single provider, and with the largest limits among the
  candidates **that organization may use**, so it neither reveals nor promises what a model
  it cannot see offers. This is a contract change with TS and Python SDK parity. A new entry
  kind is not a compatible change under ADR 0001 for a strict client, so it ships as a
  contracts minor version with a changelog note, and the SDKs ignore entry kinds they do
  not know.
- **Quality is measured, not assumed.** A classifier route is evaluated offline on a dataset
  with the `evals` package before it is enabled. No online learning, per-user stickiness or
  experiments in this ADR.

## Consequences
- Slice one is rules only: no extra provider call, fully explainable, and testable without a
  model.
- Reservations, idempotency claims and usage events gain nullable route, decision and chosen
  model columns: one migration for `db-guardian`.
- A classifier adds latency up to its timeout and its own cost to every routed request;
  whether that pays for itself is unmeasured until a real route runs on real traffic.
- A misconfigured `default` that is cheap and weak silently lowers quality. The route's
  decision log is how to see it.
