# 0005 — Index ACL strategy

Status: accepted
Date: 2026-11-17

## Context
Indexed chunks outlive the permissions that applied when they were indexed. Search must
return only what the caller may read now, without leaking rejected content, scores or
existence.

## Decision
- Each chunk row stores `organization_id`, its source ID and revision, and the source's ACL
  as a set of principal keys (`user:<id>`, `group:<id>`) captured at ingestion.
- **Candidate filter** (in SQL, before similarity ranking): same organization, and the
  chunk's principal set overlaps the caller's principals. Nothing from other tenants or
  outside the caller's principals is ever ranked.
- **Verification** (before returning): when a source has an authoritative live check
  (an `Authorizer` adapter or the source's own ACL API), each candidate source is checked
  for the caller. Rejected items are dropped silently. Search oversamples (fetches `k × 4`,
  capped) to fill the page, and never reports how many were dropped.
- **Revocation**: ACL changes from source sync replace the chunk's principal set in the same
  transaction as the sync cursor update. A source whose ACL could not be synced within its
  configured staleness bound is excluded from results (deny on stale), not served from the
  old ACL.
- **Deletion**: a deleted source tombstones its chunks immediately; they are excluded from
  search before physical deletion.

## Consequences
- Revocation is reflected at the next ACL sync, or immediately where live verification runs.
- Group expansion depends on the caller's principals being resolvable at query time; a
  source without group resolution can only use user principals.
