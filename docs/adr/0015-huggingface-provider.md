# 0015 — Hugging Face provider for open models

Status: proposed
Date: 2026-11-20

## Context
Organizations want to run open models. `AGENTS.md` allows no AWS or GCP provider in ai-core
other than Bedrock and Vertex, so SageMaker and self-hosted serving on GKE are out.
Open models are still reachable three ways: Bedrock (Custom Model Import and open models in
its catalog) and Vertex (Model Garden) need only config entries; Hugging Face serves them
itself through Inference Providers (a serverless router to third-party hosts) and through
Inference Endpoints (dedicated, deployable on AWS or GCP). Both Hugging Face products
expose an OpenAI-compatible chat API. These shapes are from Hugging Face's documentation and
must be checked against it when the provider is written.

## Decision
- **One new provider, `huggingface`, in ai-core.** It implements `ModelProvider` over the
  OpenAI-compatible chat API with `fetch`: `chat` and `chat_stream`. `embed` is
  `UnsupportedOperation` until a separate decision. No new dependency. The provider enum in
  the capability descriptor gains `huggingface`, an additive contract change.
- **It is not a cloud provider.** No AWS or GCP code is added. Open models in an
  organization's own cloud account are Bedrock or Vertex entries; Hugging Face dedicated
  endpoints can be placed in that account's cloud by the endpoint's owner.
- **Endpoints are allow-listed.** `https` only, host `router.huggingface.co` or
  `*.endpoints.huggingface.cloud`, no userinfo, redirects refused. An arbitrary
  OpenAI-compatible URL is out of scope, which keeps request forgery out of the threat
  model.
- **The token is the first stored secret, and an explicit exception to ADR 0013.**
  Hugging Face has no workload identity. The config names an environment variable per
  endpoint; the value comes from a Kubernetes Secret through `envFromSecrets` (or `.env`
  under `NODE_ENV=development`), never from config, the database or the console. It is
  never logged, never returned and never forwarded; a caller cannot supply their own.
  Use a fine-grained token limited to inference. Rotation is the secret manager plus a
  rollout restart. `bae6-platform`'s secrets doc is amended to match, and `/v1/credentials`
  reports source `token` for this provider.
- **Hosting is declared and visible.** Each model entry has `hosting: "inference-providers"`
  or `"dedicated"`. Inference Providers sends prompts to third-party hosts, so such a model
  is available only to organizations listed in its `organizations`, and `/v1/models` shows
  the hosting.
- **Bounded like the other providers.** Output tokens always sent, response size capped, the
  gateway timeout applies, and the `billed` rule is unchanged: an error answer is `no`; a
  timeout or dropped stream is `unknown`. A dedicated endpoint that is scaled to zero and
  answers 503 while starting is `no` and returned as 503 with a capped `Retry-After`; there
  is no automatic retry.
- **Pricing stays per token, imperfectly.** Dedicated endpoints bill by the hour, not the
  token. The price book holds an effective rate set by the operator, and the ledger charges
  that. The real bill varies with utilization, so it is reconciled against the invoice
  (ADR 0004), not trusted per request.
- **Out of scope**: creating or scaling endpoints, fine-tuning, serving models inside the
  cluster, SageMaker and GKE serving. Each needs its own ADR.

## Consequences
- Open models on AWS and GCP need no new provider code, but only on the clouds' own
  catalogs or through Hugging Face dedicated endpoints.
- A static token is a secret to guard. A leaked token costs inference spend on that account
  until it is revoked.
- Per-token ledger figures for dedicated endpoints are estimates. Budgets stay safe because
  they cap what the ledger charges, not what the invoice later says.
- Open small models on a dedicated endpoint are the natural classifier models for ADR 0014.
- Nothing is verified against a real Hugging Face account yet.
