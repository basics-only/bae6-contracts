# 0008 — Deployment configuration ownership

Status: accepted
Date: 2026-11-17

## Context
Runtimes must deploy, scale and roll back independently, but six bespoke charts would drift
in security settings.

## Decision
- **Product repos own** each runtime's Dockerfile, migrations, environment-variable
  reference (names, defaults, required) and a `deploy/values.yaml` with that runtime's
  defaults (port, probes, resources, required env).
- **`bae6-platform` owns** one generic Helm chart, `bae6-service`, with the hardened
  defaults: non-root, read-only root filesystem, dropped capabilities, probes, HPA,
  PodDisruptionBudget, NetworkPolicy, ServiceAccount. Each runtime is a **separate Helm
  release** of that chart with its own values, image digest and pinned chart version.
- `bae6-platform` also owns per-environment values (dev, preprod, prod) and the
  compatibility matrix of image digests promoted together.
- Upgrading the chart for one runtime does not force others: each release pins its chart
  version.

## Consequences
- Security defaults change in one place; each runtime opts into a new chart version.
- A runtime needing something the generic chart cannot express gets a chart option added,
  or, if that is unreasonable, its own chart with an ADR.
