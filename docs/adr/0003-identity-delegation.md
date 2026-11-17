# 0003 — Identity, delegation and trust

Status: accepted
Date: 2026-11-17

## Context
Workloads call bae6 services on behalf of end users. Credentials must not travel further
than their audience, and no service may trust identity it did not verify.

## Decision
- **Workload identity** is an OIDC access token in `Authorization: Bearer`. In Kubernetes
  it comes from projected service-account tokens or the cloud's workload identity, never a
  long-lived shared secret.
- **End-user identity**, when a workload acts for a user, is the user's own token in the
  `Bae6-End-User-Token` header. The service verifies it independently, and the workload must
  be bound to that application. The resulting `IdentityContext` has the user as subject and
  the workload in `delegation`. (`bae6-authz` also accepts `Riz-End-User-Token` until its
  next major, for riz clients.)
- **Token validation**, every service: see docs/style-guide.md#identity. The essentials:
  issuer from a configured allowlist; `aud` must equal this service's configured audience;
  `exp`/`nbf` with ≤ 60 s skew; asymmetric algorithms only; keys only from the issuer's
  configured JWKS URI, never from token headers (`jku`, `x5u`, embedded `jwk`).
- **No passthrough.** A service never forwards a token it received to another service or
  data source unless that token's audience is that destination. To call a downstream service
  it uses its own workload token. If the downstream must know the user, the caller obtains a
  user token for the downstream audience (OAuth token exchange, RFC 8693, at the IdP). bae6
  services never mint user tokens.
- **Source systems** that enforce their own ACLs (Databricks, SharePoint, S3 policies) get
  either the service's own scoped credential, labelled as service-principal access, or a user
  token issued for that source. A service principal is never presented as user-delegated
  access.

## Consequences
- Each service configures its own audience and trusted issuers; there is no shared session.
- End-user calls through two services need an IdP that supports token exchange; until one is
  configured, a chain like this is limited to workload identity, and that is documented.
