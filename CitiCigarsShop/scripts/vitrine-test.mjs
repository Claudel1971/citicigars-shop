import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const base = new URL(process.env.CITICIGARS_TEST_URL || "http://127.0.0.1:5176");
assert(["127.0.0.1", "localhost"].includes(base.hostname), "Copie locale requise");
const output = resolve(process.argv[2] || "preuves-vitrine");
await mkdir(output, { recursive: true });

async function until(check, label) {
  for (let i = 0; i < 140; i++) {
    try { if (await check()) return; } catch (error) { if (i === 139) throw error; }
    await pause(100);
  }
  assert.fail(`Délai dépassé pour ${label}`);
}

const profile = await mkdtemp(join(tmpdir(), "citicigars-vitrine-test-"));
const browser = spawn(process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "chromium"), [
  "--headless", "--hide-scrollbars", "--disable-background-networking", "--no-first-run",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
], { stdio: "ignore", windowsHide: true });
let browserError;
browser.on("error", (error) => { browserError = error; });

let socket;
try {
  let port;
  await until(async () => {
    if (browserError) throw browserError;
    port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/)[0];
    return port;
  }, "démarrage de Chrome");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(({ type }) => type === "page").webSocketDebuggerUrl);
  await new Promise((success, failure) => {
    socket.addEventListener("open", success, { once: true });
    socket.addEventListener("error", failure, { once: true });
  });

  let nextMessage = 0;
  let simulate = null;
  let intercepted = 0;
  const pending = new Map();
  const apiRequests = [];
  function send(method, params = {}) {
    return new Promise((success, failure) => {
      pending.set(++nextMessage, { success, failure });
      socket.send(JSON.stringify({ id: nextMessage, method, params }));
    });
  }
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Network.requestWillBeSent" && msg.params.request.url.includes("/api/")) {
      apiRequests.push(msg.params.request);
    }
    if (msg.method === "Fetch.requestPaused") {
      const { requestId, request } = msg.params;
      const response = simulate?.(new URL(request.url));
      if (response) intercepted++;
      void send(response ? "Fetch.fulfillRequest" : "Fetch.continueRequest", response
        ? { requestId, responseCode: response.status, responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(response.body)).toString("base64") }
        : { requestId });
    }
    const handler = pending.get(msg.id);
    if (handler) {
      pending.delete(msg.id);
      if (msg.error) handler.failure(msg.error);
      else handler.success(msg.result);
    }
  });

  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  const find = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
  const present = (selector) => evaluate(`Boolean(${find(selector)})`);
  let touch = false;
  async function click(selector) {
    await until(() => present(selector), selector);
    if (!touch) return evaluate(`${find(selector)}.click()`);
    const point = await evaluate(`(() => {
      const control = ${find(selector)};
      control.scrollIntoView({ block: "center" });
      const box = control.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  const read = (selector) => evaluate(`${find(selector)}?.textContent?.trim() || ''`);
  const hasText = (selector, text) => until(async () => (await read(selector)).includes(text), text);
  async function navigateDocument(method, args) {
    const previous = await evaluate("performance.timeOrigin");
    await send(method, args);
    await until(() => evaluate(`performance.timeOrigin !== ${previous} && document.readyState !== 'loading'`), "nouveau document");
  }
  const goto = (url) => navigateDocument("Page.navigate", { url: new URL(url, base).href });
  async function select(name, value) {
    await evaluate(`(() => {
      const select = ${find(`select[name="${name}"]`)};
      select.value = ${JSON.stringify(value)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
  }
  async function capture(name) {
    await evaluate("document.fonts.ready.then(() => true)");
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
  }
  const amount = (text) => text.replace(/[^\d]/g, "");
  const cartLine = '[data-cart-line="CTGNI0006-boite"]';
  const skuCard = '[data-product-sku="CTGNI0006"]';
  const report = [];

  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: `${base.origin}/api/products*` }] });

  for (const [name, width, height, mobile] of [["mobile", 390, 844, true], ["ordinateur", 1440, 1000, false]]) {
    touch = mobile;
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 1 });
    await goto("/catalogue");
    await hasText(".results-count", "54 références");
    await evaluate("localStorage.removeItem('citicigars-cart');localStorage.removeItem('citicigars-wishlist')");
    await navigateDocument("Page.reload");
    await hasText(".results-count", "54 références");
    await click(".catalogue-filters summary");
    await select("format", "Toro");
    await until(() => evaluate("location.search.includes('format=Toro')"), "filtre Toro");
    await select("calibre", "M");
    await hasText(".results-count", "10 références");
    assert(await present(skuCard));
    assert(!(await present('[data-product-sku="CTGNI0001"]')));
    assert(await evaluate("document.documentElement.scrollWidth === innerWidth"));
    await until(() => evaluate(`Array.from(document.querySelectorAll(".card-photo img")).slice(0, ${mobile ? 2 : 4})
      .every(img => img.complete && img.naturalWidth > 0)`), "photos de la première rangée");
    await capture(`01-filtres-${name}`);

    await click(skuCard + " .card-price");
    await hasText(".product-heading", "CTGNI0006");
    await until(() => present('input[name=conditionnement][value=boite]'), "choix boîte");
    assert(await evaluate('location.pathname === "/produit/CTGNI0006"'));
    assert(await evaluate('new URL(document.querySelector(".product-page .back-link").href).searchParams.get("calibre") === "M"'));
    assert(!(await present('input[value=unitaire]')));
    await click('input[name=conditionnement][value=boite]');
    assert.equal(await evaluate('document.querySelector("input[name=conditionnement]:checked").value'), "boite");
    await click(".detail-utilities .product-favorite");
    assert.equal(await evaluate(find(".detail-utilities .product-favorite") + '.getAttribute("aria-pressed")'), "true");
    await evaluate(find(".product-order") + '.scrollIntoView({ block: "center" })');
    await capture(`02-conditionnement-${name}`);
    await click(".buy-bar button");
    await until(() => evaluate('location.pathname === "/panier"'), "ouverture du panier");
    await hasText(`${cartLine} .cart-format`, "Boîte · 20 cigares");
    assert.equal(amount(await read(`${cartLine} .line-price`)), "240000");
    assert.equal(await read(`${cartLine} .quantity output`), "1");
    assert.equal(amount(await read(".summary-total strong")), "240000");
    assert(!(await present('a[href^="/checkout"], a[href*="wa.me"]')));
    await capture(`03-panier-${name}`);
    await click(".favorites-link");
    await hasText("h1", "Mes favoris");
    await until(() => present(skuCard), "favori réutilisé");
    assert(await evaluate("JSON.parse(localStorage.getItem('citicigars-wishlist')).some(x=>x.sku==='CTGNI0006')"));
    report.push({ screen: `${name} ${width}×${height}`, filter: "Toro + M (50–52), 10 résultats", sku: "CTGNI0006",
      conditionnement: "Boîte de 20", quantity: 1, totalFCFA: 240000, favorite: true });
    console.log(JSON.stringify(report.at(-1)));
  }

  await goto("/p/CTGRD0008");
  await hasText(".product-heading", "CTGRD0008");
  await until(() => present('input[value=pack]'), "promotion Pledge");
  assert.equal(amount(await read('label:has(input[value=pack]) .format-price del')), "65000");
  assert((await read('label:has(input[value=pack]) .format-price')).replace(/\s/g, "").includes("62500"));
  await goto("/produit/CTGNI0001?membre=1");
  await hasText(".product-heading", "CTGNI0001");
  await hasText("#sheet-panel-0", "120 à 140 minutes");
  await click("#sheet-tab-2");
  await hasText("#sheet-panel-2", "Réservé aux membres");
  assert(!(await present(".product-terroir")));
  assert(!(await read(".product-sheet")).includes("Accords suggérés"));
  await evaluate(find("#sheet-heading") + '.scrollIntoView({ block: "center" })');
  await capture("04-contenu-membre-visiteur");

  await goto("/produit/CTGNI0004");
  await hasText(".product-order", "Rupture de stock");
  assert(await evaluate(find(".buy-bar button") + ".disabled"));
  assert(!(await present(".format-price")));
  await capture("05-rupture-reelle");

  await evaluate(`(() => {
    const key = "citicigars-cart";
    const lines = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(lines.map(line => ({ ...line, prixUnitaire: 1, prixTotal: 1 }))));
  })()`);
  await goto("/panier");
  await until(async () => amount(await read(`${cartLine} .line-price`)) === "240000", "prix enregistré ignoré");

  // Les changements d’offre et la panne sont rejoués dans le navigateur de test uniquement.
  const rawResponse = await fetch(new URL("/api/products/CTGNI0006", base), { cache: "no-store" });
  assert(rawResponse.ok);
  const raw = await rawResponse.json();
  const offer = raw.product ?? raw;
  simulate = (url) => url.pathname.endsWith("/CTGNI0006")
    ? { status: 200, body: { ...offer, prixPack: 0 } } : null;
  await goto("/produit/CTGNI0006");
  await until(() => present('input[value=boite]'), "boîte proposée sans pack");
  assert(!(await present('input[value=pack]')));

  simulate = null;
  await goto("/produit/CTGNI0006?section=achat");
  await until(() => present('input[value=pack]'), "offre avant changement de prix");
  simulate = (url) => url.pathname.endsWith("/CTGNI0006")
    ? { status: 200, body: { ...offer, prixUnitaire: offer.prixUnitaire + 500 } } : null;
  await click(".buy-bar button");
  await hasText(".product-order", "Le prix ou le conditionnement a changé");
  assert.equal(await evaluate('location.pathname'), "/produit/CTGNI0006");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('citicigars-cart')).length"), 1);

  simulate = null;
  await goto("/produit/CTGNI0006");
  await until(() => present('input[value=boite]'), "offre initialement achetable");
  simulate = (url) => url.pathname.endsWith("/CTGNI0006")
    ? { status: 200, body: { ...offer, availabilityStatus: "SOLD_OUT" } } : null;
  await click(".buy-bar button");
  await hasText(".product-order", "désormais indisponible");
  assert(await evaluate(find(".buy-bar button") + ".disabled"));
  assert(!(await present(".format-price")));
  assert(await evaluate('location.pathname === "/produit/CTGNI0006"'));
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('citicigars-cart')).length"), 1);

  simulate = () => ({ status: 503, body: { error: "Indisponibilité simulée" } });
  await goto("/panier");
  await hasText("main", "Vérification indisponible");
  await hasText(cartLine, "Prix et disponibilité à vérifier");
  assert(!(await present(".summary-total")));
  assert(!(await read("main")).includes("FCFA"));
  await capture("06-panier-api-503");
  await goto("/produit/CTGNI0006");
  await hasText("main", "Vérification indisponible");
  assert(!(await present(".format-price, .buy-bar button")));
  await goto("/catalogue");
  await hasText("main", "Vérification indisponible");
  assert(!(await present(".card-price")));
  await capture("07-catalogue-api-503");

  simulate = null;
  await click(".empty-state button");
  await hasText(".results-count", "54 références");
  assert(intercepted >= 4);
  assert(apiRequests.every(({ method, url }) => method === "GET" && new URL(url).origin === base.origin));
  const blocked = await fetch(new URL("/checkout", base), { headers: { Accept: "text/html" } });
  assert.equal(blocked.status, 404);
  await writeFile(join(output, "resultats.json"), JSON.stringify({
    parcours: report, promotion: "CTGRD0008 · Pack 5 · 65 000 → 62 500 FCFA",
    routes: ["/produit/:sku", "/p/:sku"], contenuMembreVisiteur: "masqué",
    ruptureReelle: "CTGNI0004", ruptureAuClic: "injection locale",
    conditionnement: "Pack absent et boîte disponible testés séparément",
    cachePanier: "Prix enregistré remplacé à l’affichage par le prix relu",
    changementDuPrixAuClic: "Nouvelle offre affichée, panier inchangé",
    panne: "HTTP 503 local sur catalogue, fiche et panier, puis récupération",
    ecrituresApi: 0, checkout: blocked.status,
  }, null, 2));
  console.log("OK · promotion, liens directs, droits visiteur, rupture, panne et récupération");
  await Promise.race([send("Browser.close").catch(() => {}), pause(300)]);
} finally {
  socket?.close();
  if (browser.exitCode === null) browser.kill();
  await pause(250);
  const verified = resolve(profile);
  if (dirname(verified) === resolve(tmpdir()) && basename(verified).startsWith("citicigars-vitrine-test-")) {
    await rm(verified, { recursive: true, force: true, maxRetries: 1 }).catch(() => {});
  }
}
