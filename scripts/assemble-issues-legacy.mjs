import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = join(root, "server/src/services/issues-legacy.parts");
const out = join(root, "server/src/services/issues-legacy.ts");
const names = readdirSync(partsDir).filter((name) => name.endsWith(".b64")).sort();
if (names.length === 0) {
  throw new Error(`no issues-legacy parts in ${partsDir}`);
}
const buf = Buffer.concat(names.map((name) => Buffer.from(readFileSync(join(partsDir, name), "utf8").trim(), "base64")));
writeFileSync(out, buf);
