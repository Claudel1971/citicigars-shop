import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { generateWhatsAppLink } from "../client/src/utils/whatsappGenerator.js";

const directory = process.argv[2];
assert.ok(directory, "Pass the directory with the live index.html and bundle.js");
const originalHash = "db36833cfd069b2c957f985f6e7c78bdd9f3bf2b63f4d7b02290fd74f42e526b";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const bundle = await readFile(join(directory, "bundle.js"));
const index = await readFile(join(directory, "index.html"), "utf8");
assert.equal(hash(bundle), originalHash, "The deployed bundle must match the audited revision");

function replaceOnce(source, original, replacement) {
  const start = source.indexOf(original);
  assert.notEqual(start, -1, "Expected production fragment is missing");
  assert.equal(source.indexOf(original, start + original.length), -1, "Ambiguous production fragment");
  return source.slice(0, start) + replacement + source.slice(start + original.length);
}

const source = bundle.toString("utf8");
assert.ok(Buffer.from(source).equals(bundle), "The public bundle must round-trip as UTF-8");
const generatorStart = source.indexOf("const NU=(e,t,r)=>{const a=e.map(c=>");
const generatorEnd = source.indexOf(";var TU=", generatorStart);
assert.ok(generatorStart >= 0 && generatorEnd > generatorStart, "WhatsApp generator delimiters");
const generator = "const NU=" + generateWhatsAppLink.toString();
const oldHandoff = 'o=l=>{const c=NU(e,t,l);window.open(c,"_blank"),r(),a("/")}';
const handoff = 'o=l=>{const c=NU(e,t,l);window.open(c,"_blank","noopener")}';
const patchedBundle = replaceOnce(
  replaceOnce(source, source.slice(generatorStart, generatorEnd), generator),
  oldHandoff,
  handoff,
);
const asset = "bundle-whatsapp-" + hash(patchedBundle).slice(0, 12) + ".js";
const patchedIndex = replaceOnce(index, "./bundle.js?v=1767441426628", "./" + asset);

const items = [
  { marque: "Bolívar", ligne: "Cofradia", modele: null, format: "pack", quantite: 1, prixTotal: 60000, sku: "CTGHO0001" },
  { marque: "My Father", ligne: "Le Bijou 1922", modele: "null", format: "pack", quantite: 1, prixTotal: 73750, sku: "CTGNI0013" },
  { marque: "My Father", ligne: "Le Bijou 1922", format: "boite", quantite: 1, prixTotal: 339250, sku: "CTGNI0013" },
  { marque: "Casa Carrillo", ligne: "New Wave Connecticut", format: "pack", quantite: 1, prixTotal: 40000, sku: "CTGRD0011" },
];
const attempts = [];
const context = {
  e: items,
  t: 513000,
  window: { open: (...args) => { attempts.push(args); return null; } },
  r: () => assert.fail("The cart was cleared when the window failed to open"),
  a: () => assert.fail("Checkout was left when the window failed to open"),
  customer: { nom: "Test", telephone: "0000000000", ville: "Test" },
};
runInNewContext(generator + ";" + handoff.replace("o=", "const o=") + ";o(customer);o(customer);", context);
assert.equal(attempts.length, 2, "The existing checkout can be retried");
assert.equal(items.length, 4);
for (const [target, blank, security] of attempts) {
  const url = new URL(target);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(blank, "_blank");
  assert.equal(security, "noopener");
  const draft = url.searchParams.get("text").replace(/[\u00a0\u202f]/g, " ");
  assert.match(draft, /Bolívar Cofradia - pack x1 = 60 000 FCFA/);
  assert.match(draft, /Le Bijou 1922 - pack x1 = 73 750 FCFA/);
  assert.match(draft, /Le Bijou 1922 - boite x1 = 339 250 FCFA/);
  assert.match(draft, /New Wave Connecticut - pack x1 = 40 000 FCFA/);
  assert.match(draft, /TOTAL: 513 000 FCFA/);
  assert.doesNotMatch(draft, /\$|\bnull\b|\bundefined\b/i);
}

await writeFile(join(directory, asset), patchedBundle);
await writeFile(join(directory, "index.patched.html"), patchedIndex);
console.log(asset);
