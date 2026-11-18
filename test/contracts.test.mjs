import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { sums } from "../scripts/sums.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
addFormats(ajv);
const schemaFiles = readdirSync("schemas").filter((f) => f.endsWith(".json"));
for (const f of schemaFiles) ajv.addSchema(json(`schemas/${f}`));
const byFile = (f) => ajv.getSchema(json(`schemas/${f}`).$id);

test("every schema has valid and invalid examples", () => {
  for (const f of schemaFiles) {
    const name = f.replace(/\.json$/, "");
    assert.ok(readdirSync(`fixtures/schemas/${name}/valid`).length > 0, name);
    assert.ok(readdirSync(`fixtures/schemas/${name}/invalid`).length > 0, name);
  }
});

for (const f of schemaFiles) {
  const name = f.replace(/\.json$/, "");
  for (const kind of ["valid", "invalid"]) {
    for (const ex of readdirSync(`fixtures/schemas/${name}/${kind}`)) {
      test(`${name} ${kind === "valid" ? "accepts" : "rejects"} ${ex}`, () => {
        const validate = byFile(f);
        const ok = validate(json(`fixtures/schemas/${name}/${kind}/${ex}`));
        assert.equal(ok, kind === "valid", JSON.stringify(validate.errors));
      });
    }
  }
}

test("every schema is on the compatibility surface oasdiff checks", () => {
  const surface = readFileSync("test/compat-surface.yaml", "utf8");
  for (const f of schemaFiles) assert.ok(surface.includes(`"../schemas/${f}"`), f);
});

test("transport cases match the case schema", () => {
  const validate = ajv.compile(json("fixtures/transport/case.schema.json"));
  for (const c of readdirSync("fixtures/transport/cases")) {
    assert.ok(validate(json(`fixtures/transport/cases/${c}`)), `${c}: ${JSON.stringify(validate.errors)}`);
  }
});

test("SHA256SUMS matches the released files (run `pnpm sums` after editing them)", () => {
  assert.equal(readFileSync("SHA256SUMS", "utf8"), sums());
});
