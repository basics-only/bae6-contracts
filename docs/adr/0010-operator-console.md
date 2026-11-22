# 0010 — Operator console

Status: proposed
Date: 2026-11-19

## Context
The master plan lists web administration portals as out of scope for v1. Operators now need
one place to see tenants, evals, feedback, MCP servers and agent runs, and the riz console
already exists in `bae6-authz` history. Without a decision, a console tends to grow its own
database, a service credential that can read every tenant, or privileged back doors.

## Decision
- The console is its own repo, `bae6-console` (SvelteKit), released and deployed on its own.
  It is an optional client: no product depends on it at runtime (0008).
- It uses **public APIs only**: the same endpoints and SDK-visible contracts any client uses.
  It has no database of its own beyond a server-side session store, and never reads another
  product's database (0007).
- It acts **as the signed-in operator**. Login is OIDC; the console forwards the operator's own
  access token to each service (0003). It holds no service credential and grants nothing a
  service would not grant that operator. Services remain the only place authorization is
  decided and audited (0002).
- Scope of views, each hidden when its service base URL is not configured:
  - authz: applications, relationships (grant, revoke), models, access explorer, audit
    (carried over from the riz console);
  - ai: model feedback (`GET /v1/feedback`), eval runs (`/v1/eval-runs`), agent runs
    (`/v1/agent-runs`);
  - context: MCP servers, versions, approve and revoke (`/v1/servers`).
- Writes are limited to operations those services already expose to admins. The console adds
  no new write path and no bulk or cross-tenant operation.
- All text that came from a model, a tool, an agent or a feedback author is untrusted. It is
  rendered as text, never as HTML or markdown with raw HTML, and never placed in a log line
  (0009).
- Lists are paged with the services' own cursors and maximum page sizes. The console does not
  fetch "all" of anything and does not aggregate across services beyond showing each page.
- Sessions are server-side, `HttpOnly`, `SameSite=Lax`, with an absolute lifetime. State-changing
  requests carry an anti-forgery check. Sign-out ends the session and does not silently log
  back in.
- A "harness registry" view is not built: no such API exists (0009). Agent runs stand in until
  it does.

## Consequences
- A console outage affects no tenant traffic, and a service outage degrades only that
  service's views.
- An operator sees exactly what their token allows; a missing scope shows as forbidden, not as
  an empty list.
- Views for a service wait for that service's list endpoints, so the agent and eval views
  depend on the worker PRs being merged first.
- This amends the master plan's v1 exclusion of admin portals and needs the owner's
  acceptance before release. Until then the console is built but not deployed.
- Unverified: behavior against live identity providers and real tenant volumes.
