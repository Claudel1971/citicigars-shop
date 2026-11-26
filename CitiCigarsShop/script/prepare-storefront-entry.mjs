import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const [legacyFile, buildDirectory, output] = process.argv.slice(2);
const legacy = await readFile(legacyFile, "utf8");
const build = await readFile(join(buildDirectory, "vitrine-test.html"), "utf8");
const { storefront } = JSON.parse(await readFile(join(buildDirectory, "storefront-routes.json"), "utf8"));
const legacyTag = '<script defer src="./bundle-whatsapp-5be64c973cc2.js"></script>';
assert.equal(legacy.split(legacyTag).length, 2, "Expected exactly one legacy storefront script");
const schema = /\/_vitrine-release\/assets\/[A-Za-z0-9._-]+/;
const moduleSrc = build.match(/<script type="module"[^>]* src="([^"]+)"/)?.[1];
const styleHref = build.match(/<link rel="stylesheet"[^>]* href="([^"]+)"/)?.[1];
assert.match(moduleSrc, schema);
assert.match(styleHref, schema);

const router = [
  "(function loadCitiCigarsStorefront() {",
  "  var current = new RegExp(" + JSON.stringify(storefront) + ").test(location.pathname);",
  "  var script = document.createElement('script');",
  "  if (current) {",
  "    var css = document.createElement('link');",
  "    css.rel = 'stylesheet';",
  "    css.href = " + JSON.stringify(styleHref) + ";",
  "    document.head.appendChild(css);",
  "    script.type = 'module';",
  "    script.src = " + JSON.stringify(moduleSrc) + ";",
  "  } else {",
  "    script.src = '/bundle-whatsapp-5be64c973cc2.js';",
  "  }",
  "  document.addEventListener('DOMContentLoaded', function () { document.head.appendChild(script); }, { once: true });",
  "})();",
].join("\n");

function assetsFor(pathname) {
  const assets = [];
  const document = {
    createElement: (tag) => ({ tag }),
    head: { appendChild: (asset) => assets.push(asset) },
    addEventListener: (name, ready) => { assert.equal(name, "DOMContentLoaded"); ready(); },
  };
  runInNewContext(router, { document, location: { pathname } });
  return assets;
}
for (const pathname of ["/", "/catalogue", "/produit/CTGNI0013", "/p/CTGNI0013", "/panier", "/wishlist", "/checkout", "/coffrets", "/entreprises", "/evenements", "/devis"]) {
  assert.equal(assetsFor(pathname).find(({ tag }) => tag === "script").src, moduleSrc);
}
for (const pathname of ["/admin", "/admin/login", "/cgv", "/privacy", "/mentions", "/promotions", "/assortiments", "/dna/"]) {
  assert.equal(assetsFor(pathname).find(({ tag }) => tag === "script").src, "/bundle-whatsapp-5be64c973cc2.js");
}
await writeFile(output, legacy.replace(legacyTag, () => "<script>\n" + router + "\n</script>"));
