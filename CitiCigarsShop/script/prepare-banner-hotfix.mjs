import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
const originalAsset = "vitrine-test-Bw_oJKWn.js";
const original = await readFile(join(dir, originalAsset));
const index = await readFile(join(dir, "index.original"), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const text = original.toString("utf8");
assert.ok(Buffer.from(text).equals(original));
const oldSpan = 'p.jsxs("span",{className:"brand-text",children:["CitiCigars",p.jsx("small",{children:"CAMEROUN"})]})';
const newSpan = 'p.jsx("span",{className:"brand-text",style:{color:"var(--bronze)"},children:"CitiCigars"})';
const logo = 'p.jsx("img",{src:lE,width:"52",height:"50",alt:""})';

function replaceOnce(value, before, after) {
  const parts = value.split(before);
  assert.equal(parts.length, 2, "The approved change must have exactly one target");
  return parts[0] + after + parts[1];
}

assert.ok(text.includes(logo + "," + oldSpan), "The original logo and wordmark must be present together");
const patched = replaceOnce(text, oldSpan, newSpan);
assert.ok(patched.includes(logo + "," + newSpan));
assert.ok(Buffer.from(replaceOnce(patched, newSpan, oldSpan)).equals(original));
const asset = "vitrine-bandeau-" + hash(patched).slice(0, 12) + ".js";
const nextIndex = replaceOnce(index, originalAsset, asset);
assert.equal(replaceOnce(nextIndex, asset, originalAsset), index);
assert.ok(index.includes("/_vitrine-release/assets/vitrine-test-DU5M1xfG.css"));
assert.ok(index.includes("/bundle-whatsapp-5be64c973cc2.js"));

await writeFile(join(dir, asset), patched);
await writeFile(join(dir, "index.active"), nextIndex);
console.log(asset);
