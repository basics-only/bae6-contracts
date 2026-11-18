# Consuming a contracts release

Consumers vendor a tagged release; nothing reads `main`.

```sh
TAG=v0.1.0
mkdir -p contracts/vendor
curl -fsSL "https://github.com/basics-only/bae6-contracts/archive/refs/tags/$TAG.tar.gz" \
  | tar -xz --strip-components=1 -C contracts/vendor \
      "bae6-contracts-${TAG#v}/schemas" "bae6-contracts-${TAG#v}/openapi" \
      "bae6-contracts-${TAG#v}/fixtures/transport" "bae6-contracts-${TAG#v}/SHA256SUMS"
echo "$TAG" > contracts/vendor/VERSION
```

Commit `contracts/vendor/`. In CI, verify it is an unmodified release:

```sh
(cd contracts/vendor && shasum -a 256 -c SHA256SUMS)
```

To upgrade, rerun with the new tag, read the release notes, and fix what the compatibility
notes list. Product OpenAPI documents reference `contracts/vendor/openapi/common.yaml`.

## Proposing a change
1. Open a PR here changing the schema, with fixtures for the new behavior, and an ADR if
   cross-product behavior changes.
2. CI checks fixtures and runs `oasdiff breaking` against the previous tag. A breaking change
   fails unless the PR is for a new major.
3. After release, consumers upgrade at their own pace within the compatibility window (ADR-0001).
