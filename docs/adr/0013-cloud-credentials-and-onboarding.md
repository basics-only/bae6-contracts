# 0013 — Cloud credentials and onboarding

Status: proposed
Date: 2026-11-20

## Context
An organization adopting bae6 hosts the console, the gateway and the databases itself, and
the gateway must call Bedrock or Vertex in that organization's cloud account. The gateway's
model catalog, price book and budgets are a file loaded at start-up (`BAE6_AI_CONFIG[_FILE]`);
no API writes them. The gateway reads AWS credentials from EKS Pod Identity, or from
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in any environment; bae6-ai PR 34 restricts
that to `NODE_ENV=development` and is not yet merged. It reads Vertex tokens from the GKE
metadata server. `bae6-platform`'s identity conventions also name IRSA, which the gateway
does not implement, and allow provider keys in Kubernetes Secrets where workload identity is
unavailable, which PR 34 refuses outside development.

## Decision
- **No cloud credential is ever stored by bae6.** Not in the model config, a ConfigMap,
  the database, or the console. The config names only regions, projects and model ids.
- **Credentials come from the workload's cloud identity.**
  - AWS: EKS Pod Identity today. Next is web-identity federation
    (`AssumeRoleWithWebIdentity` with the pod's projected service-account token), which
    covers IRSA and any Kubernetes cluster with an OIDC provider registered in IAM,
    including clusters outside AWS. Static keys outside development stay refused; the
    platform doc is corrected to match.
  - GCP: GKE Workload Identity through the metadata server. Unchanged.
  - Local development: `.env` with static AWS keys, only when `NODE_ENV=development`.
- **Who sets what.**
  - *Terraform*, in `bae6-platform`: the IAM role per runtime with `bedrock:InvokeModel*` on
    the listed model ARNs, the Pod Identity association or OIDC federation, the GCP service
    account binding, the databases, and the Helm releases. This is where an organization
    "sets its AWS credentials".
  - *Git*: the model catalog, price book and budgets, passed as `BAE6_AI_CONFIG` from the
    release's Helm values. A `check-config` command in the gateway image runs `parseConfig` so CI rejects a
    bad file before a rollout.
  - *Console*: read-only for the catalog and for credential status. It does not write model
    config, because no config store exists. A writable store, and a `managedBy` field to stop
    the console and Terraform overwriting each other, need their own ADR.
  - *CLI*: `check-config` only, for now. Anything that writes goes through the same API the
    console uses, once there is one.
- **The console shows credential status, not credentials.** The gateway reports, per
  provider, the credential source (`pod-identity`, `web-identity`, `metadata`,
  `development-static`) and the age of the last successful refresh. Neither liveness nor
  readiness depends on it, so a provider outage does not drain or restart the fleet (no
  runtime dependency on the provider's control plane). The endpoint needs a contract change with TS and Python SDK
  parity, in its own PR.
- **The console cannot grant cloud access.** It has no credentials in the organization's
  account, so it cannot create roles. It can show the identity the gateway presents and the
  Terraform that grants it access.

## Consequences
- Onboarding is Terraform plus a config file in Git; the console is for visibility until a
  config store is decided.
- Rotation is the cloud's, not ours: no secret to rotate, and nothing for the console to leak.
- No Terraform exists yet: `epic/p9-terraform` holds no `.tf` files. The module for the
  roles, associations, databases and releases is the first piece to build.
- Web-identity federation is not implemented, so until it lands a cluster outside EKS cannot
  call Bedrock from production. It needs the chart to project a service-account token with
  audience `sts.amazonaws.com` and set `AWS_ROLE_ARN` and `AWS_WEB_IDENTITY_TOKEN_FILE`, and
  the cluster's OIDC discovery endpoint to be reachable by IAM. Vertex has the same limit
  outside GKE until GCP workload identity federation is supported.
- Once PR 34 merges, a pod using IRSA or static keys in production fails at start-up with a
  message naming Pod Identity; the message should name web-identity once it exists.
- The chart has no config-file option, so the catalog travels as an inline env value. A
  ConfigMap option in `bae6-service` is platform work (ADR 0008) if catalogs outgrow that.
