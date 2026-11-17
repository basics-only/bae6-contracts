// Prints `sha256  path` for every released contract file, sorted, in `shasum -a 256 -c` format.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

export const RELEASED = ["schemas", "openapi", "fixtures/transport"];

export function sums() {
  return RELEASED.flatMap((dir) =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => `${e.parentPath}/${e.name}`),
  )
    .sort()
    .map((p) => `${createHash("sha256").update(readFileSync(p)).digest("hex")}  ${p}\n`)
    .join("");
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(sums());
