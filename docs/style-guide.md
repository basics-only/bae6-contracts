# API style guide

Applies to every bae6 HTTP API. Deviations need an ADR.

## Shape
- OpenAPI 3.1, one document per runtime, in that product's repo, referencing
  `openapi/common.yaml` from its vendored copy.
- Paths versioned: `/v1/...`. Health at `/health/live` and `/health/ready`, unauthenticated.
- JSON bodies, camelCase fields, `additionalProperties: false` on request bodies.
- Every request body, array and string has a documented maximum. A service rejects larger
  input with `400 invalid_request` or `413 payload_too_large` before doing work.
- Lists are cursor-paginated: `cursor` + `limit` (1–100, default 50) in, `Page` out.
- Non-idempotent POSTs that create, spend or invoke accept `Idempotency-Key`.

## Errors
- Every non-2xx body is an `ErrorEnvelope` (`code`, `message`, `requestId`).
- `401 unauthenticated`: no or invalid credentials. `403 forbidden`: authenticated, not
  permitted, same tenant. `404 not_found`: absent, or in another tenant (ADR-0002).
- `503 unavailable` when a hard dependency is down. A protected operation never succeeds by
  default during an outage.
- Messages never contain tokens, credentials, SQL, stack traces or another tenant's data.

## Identity
Every service validates inbound OIDC JWTs the same way:
1. Header `alg` is one of `RS256`, `PS256`, `ES256`, `EdDSA`. `none` and HMAC algorithms are rejected.
2. `iss` exactly matches a configured trusted issuer.
3. The signing key comes from that issuer's configured `jwksUri` (cached; refetched on an
   unknown `kid`, at most once per 30 s). Token header `jku`, `x5u` and embedded `jwk` are ignored.
4. `aud` contains this service's configured audience.
5. `exp` is in the future and `nbf`/`iat` not in the future, with ≤ 60 s clock skew.
6. The subject (`sub`, or `azp`/`client_id` for workloads) is non-empty.
7. `organizationId` and `applicationId` come from the service's trusted mapping (ADR-0002),
   never from unconfigured claims.
8. Scopes come from `scope` (space-separated) or `scp` (array).

Then the service builds an `IdentityContext` and passes only that inward. Raw tokens are
never logged, stored, put in errors, or forwarded (ADR-0003).

## Correlation
- `X-Request-Id`: reuse if it matches `^[A-Za-z0-9._-]{1,64}$`, else mint `req_<uuid>`; always echo.
- W3C `traceparent` propagated through OpenTelemetry.
- Logs are JSON lines with `requestId`; they record method, path (no query), status and
  duration, never bodies, headers or tokens.

## Limits and timeouts
- Every outbound call has a timeout. Retries are bounded (≤ 2) and only for idempotent operations.
- Every queue, cache, batch and result set has a maximum size.
