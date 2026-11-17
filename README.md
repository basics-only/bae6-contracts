# bae6-contracts

Versioned OpenAPI 3.1 and JSON Schema contracts shared by the bae6 products
(`bae6-authz`, `bae6-ai`, `bae6-context`), plus the cross-product ADRs and the
reference fixtures SDKs test against. No service code lives here.

## Layout
| Path | Purpose |
|---|---|
| `schemas/` | JSON Schema (2020-12) for each shared type |
| `openapi/common.yaml` | OpenAPI 3.1 components that reference the schemas |
| `fixtures/` | Example documents and SDK transport conformance cases |
| `docs/adr/` | Cross-product architecture decisions |
| `docs/style-guide.md` | API, identity, trace and error conventions |

## Consuming a release
Consumers pin a tag and vendor the files; nothing tracks `main`. See
[docs/consuming.md](docs/consuming.md).

## License
Apache-2.0.
