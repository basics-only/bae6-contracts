# SDK transport conformance cases

Every bae6 SDK (TypeScript and Python, in each product repo) carries its own small HTTP
transport. These cases pin its shared behavior, so all SDKs time out, retry and report
errors the same way. Product SDKs vendor this folder and run each case with a local HTTP
server that answers `responses` in order.

## Rules the cases encode
- Timeout per attempt, default 10 000 ms (`client.timeoutMs` overrides).
- Never follow redirects; a 3xx is an `api` error.
- Retry only idempotent requests: `GET`, or a request sent with `Idempotency-Key`.
  At most 2 retries, only after a connection error, timeout, 502, 503 or 504. A retried request sends the same key.
  A response whose envelope has `retryAfterSeconds` greater than 1 is not retried; the error surfaces it.
- Never retry 429; surface `retryAfterSeconds` from the envelope.
- A 2xx body that is not JSON is `invalid_response`.
- A non-2xx body that is not an `ErrorEnvelope` gives `code: null`.

## Serving a case
A response `body` that is a JSON string is sent as raw bytes (that is how cases serve non-JSON
bodies); any other value is JSON-encoded with `content-type: application/json`.

## What every loader also asserts
- Each request carries `Authorization: Bearer svc-token` and `content-type: application/json` when it has a body.
- No error message or string form contains `svc-token`.
- Exactly `expectRequestCount` requests arrive.

Retry backoff is not asserted; SDKs use short jittered backoff (≤ 250 ms in total for tests).

`case.schema.json` validates the cases; `npm test` in this repo runs that check.
