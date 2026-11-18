# 0006 — MCP discovery versus execution

Status: accepted
Date: 2026-11-17

## Context
A registry that every tool call must pass through becomes a single point of failure and a
blanket privilege.

## Decision
- The **registry** is a control plane: register, version, approve, revoke, discover. It is
  never on the tool-call path.
- **Publish**, **approve** and **discover** are separate scopes. Being listed or approved
  grants no right to invoke a tool.
- **Execution authorization** happens at the MCP server (or the optional gateway), against
  the caller's own token issued for that server's audience (MCP HTTP authorization).
- Clients cache the approved entries they discovered, with a bounded TTL. During a registry
  outage, an already-approved entry keeps working until its TTL ends. A revocation reaches
  clients within one TTL, so the TTL is the revocation bound and is configured per
  organization.
- Registry records never store access tokens or client secrets; only references to how to
  obtain them.

## Consequences
- A registry outage stops new discovery and approvals, not running agents.
- Revocation is eventually consistent within the TTL; servers that need instant cut-off
  revoke at their own authorization server.
