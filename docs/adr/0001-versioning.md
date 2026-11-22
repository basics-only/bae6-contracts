# 0001 — Module and package versioning

Status: accepted
Date: 2026-11-17

## Context
Five repos, several packages and runtimes per repo, and no global release train
(master plan, non-negotiable 3).

## Decision
- Every publishable unit (SDK, library package, container image) has its own SemVer and
  its own `CHANGELOG.md` beside its manifest.
- Product repos tag per unit: `<unit>-v<semver>`, e.g. `ai-core-v0.2.0`,
  `gateway-v0.3.1`, `sdk-python-v0.2.0`. A release workflow builds only the unit its
  tag names, and only from a commit on `main`.
- `bae6-contracts` is versioned as one set (`vX.Y.Z`): its schemas reference each other and
  are consumed together.
- Before `1.0.0` a minor release may break; the changelog says how. From `1.0.0`, breaking
  changes need a new major, and consumers get an N-1 minor compatibility window.
- HTTP APIs version in the path (`/v1`). Within a major: only new endpoints, new optional
  request fields and new response fields. Clients ignore unknown response fields.
- Clients also tolerate unknown values in a response enum, and unknown kinds in a list of
  tagged entries: they treat the value as unknown and carry on. Servers may therefore add
  an enum value or an entry kind within a major, and the changelog says so. SDK types
  include an explicit fallback for unknown values. Request enums stay closed: a server
  rejects a value it does not know.
- Cross-repo dependencies pin a released version. Nothing depends on `main` or `latest`.
- Deprecations are announced in the changelog and removed no sooner than one minor release
  and six months later, and only in a new major.

## Consequences
- Each unit can ship alone; the platform compatibility matrix records which versions were
  tested together.
- More tags to manage. Release notes are per unit, so a cross-product feature appears in
  several changelogs.
