// Test fonctionnel RÉEL du fichier HTML final (JSDOM, exécute vraiment les <script>).
// Vérifie : pool résolu une seule fois (pas de second appel recommend), aucun
// prix/Pack-Box dans les cartes, bouton "voir les autres" cohérent, cas zéro
// ouvre directement le formulaire avec le texte BRAVO exact.

import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const HTML_PATH = new URL("../client/public/CitiCigars_DNA_Curator_v2_10_3_RC.html", import.meta.url);
const ENGINE_PATH = new URL("../shared/dna-engine.cjs", import.meta.url);
const DIMENSION_FORMATTER_PATH = new URL("../client/public/dimension-formatter.js", import.meta.url);

let html = readFileSync(HTML_PATH, "utf-8");
html = html.replace(
  '<script src="dna-runtime-config.js"></script>',
  '<script>window.CITICIGARS_RUNTIME_CONFIG={API_BASE:"https://dna-test-api.example/api"};</script>',
);
const dimensionFormatterSrc = readFileSync(DIMENSION_FORMATTER_PATH, "utf-8");
html = html.replace('<script src="dimension-formatter.js"></script>', `<script>${dimensionFormatterSrc}</script>`);
// Le <script src="dna-engine.cjs"> ne se charge pas via file:// dans JSDOM sans
// resourceLoader complexe -> on l'inline directement pour ce test, contenu strictement identique.
const engineSrc = readFileSync(ENGINE_PATH, "utf-8");
html = html.replace('<script src="dna-engine.js"></script>', `<script>${engineSrc}</script>`);

function fail(msg) { console.error("FAIL: " + msg); process.exitCode = 1; }
function ok(msg) { console.log("OK: " + msg); }

function installLiveAvailabilityFetch(window) {
  window.fetch = async (url, options = {}) => {
    if (String(url).includes("/api/dna/availability")) {
      const requested = JSON.parse(options.body).cigarIds;
      const catalog = window.CitiCigarsDNAEngine.CATALOG;
      const byId = new Map(catalog.map((item) => [item.cigarId, item]));
      const availability = Object.fromEntries(requested.map((cigarId) => {
        const item = byId.get(cigarId);
        const available = Boolean(item?.stock?.available && Number(item?.stock?.heldUnits) > 0);
        return [cigarId, { packAvailable: available, boxAvailable: false }];
      }));
      return { ok: true, status: 200, json: async () => ({ availability }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

async function run(family, power, intensity, label) {
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "https://example.com/dna.html" });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = () => {}; // non implémenté par JSDOM, sans rapport avec l'app
  await new Promise((r) => setTimeout(r, 50));
  const doc = window.document;
  installLiveAvailabilityFetch(window);

  // Etape 0 : prénom/nom + start
  doc.getElementById("firstName").value = "Test";
  doc.getElementById("lastName").value = "User";
  doc.getElementById("startBtn").dispatchEvent(new window.Event("click"));

  // Etape 1 : puissance + intensité
  doc.querySelector(`[data-axis="power"] [data-val="${power}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-axis="intensity"] [data-val="${intensity}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[0].dispatchEvent(new window.Event("click"));

  // Etape 2 : famille
  doc.querySelector(`[data-group="family"] [data-val="${family}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[1].dispatchEvent(new window.Event("click"));

  // Etape 3 : spice/sweetness/signatures -> "pas de préférence" partout
  doc.querySelector('[data-axis="spice"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-axis="sweetness"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#signatureChips [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[2].dispatchEvent(new window.Event("click"));

  // Etape 4 : duree + moment -> reveal
  doc.querySelector('[data-group="duration"] [data-val="around_60"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#ritualMoments [data-val="evening"]').dispatchEvent(new window.Event("click"));

  // Instrumente recommend() pour compter les appels reels (pool unique, jamais recalcule)
  let recommendCalls = 0;
  const engine = window.CitiCigarsDNAEngine;
  const originalRecommend = engine.recommend.bind(engine);
  engine.recommend = (...args) => { recommendCalls++; return originalRecommend(...args); };

  doc.getElementById("revealBtn").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 20));

  console.log(`\n--- ${label} (${family}/power${power}/intensity${intensity}) ---`);
  console.log(`Appels recommend() après reveal(): ${recommendCalls}`);
  if (recommendCalls !== 1) fail(`${label}: recommend() appelé ${recommendCalls} fois après reveal (attendu 1)`);
  else ok(`${label}: recommend() appelé exactement 1 fois au reveal`);

  const interestBoxHidden = doc.getElementById("interestBox").hidden;
  const zeroCaseHidden = doc.getElementById("zeroCase").hidden;
  console.log(`interestBox.hidden=${interestBoxHidden} zeroCase.hidden=${zeroCaseHidden}`);

  if (label === "N>0") {
    if (interestBoxHidden) fail("N>0: interestBox devrait être visible");
    else ok("N>0: interestBox visible (teaser)");
    if (!zeroCaseHidden) fail("N>0: zeroCase ne devrait pas être visible");

    // Vérifie le texte du teaser exact
    const teaserP = doc.getElementById("availabilityCopy").textContent;
    if (teaserP !== "Il se trouve que nous avons des cigares qui correspondent à ton profil.") {
      fail("Texte teaser inattendu: " + teaserP);
    } else ok("Texte teaser conforme au texte validé");

    // Clic "Oui, montrez-moi"
    doc.getElementById("wantReco").dispatchEvent(new window.Event("click"));
    const gateHidden = doc.getElementById("contactGate").hidden;
    if (gateHidden) fail("wantReco: contactGate devrait s'ouvrir");
    else ok("wantReco ouvre le formulaire de coordonnées");

    // Remplit le formulaire
    doc.getElementById("country").value = "CM";
    doc.getElementById("country").dispatchEvent(new window.Event("change"));
    await new Promise((r) => setTimeout(r, 10));
    const citySel = doc.getElementById("city");
    citySel.value = citySel.options[1].value;
    doc.getElementById("phone").value = "690123456";

    doc.getElementById("loadReco").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    doc.getElementById("consentContinue").dispatchEvent(new window.Event("click")); // modale de consentement : Continuer
    await new Promise((r) => setTimeout(r, 300));

    console.log(`Appels recommend() après loadReco: ${recommendCalls}`);
    if (recommendCalls !== 1) fail(`N>0: recommend() a été rappelé après loadReco (total=${recommendCalls}, attendu 1) — pool recalculé !`);
    else ok("N>0: pool résolu réutilisé tel quel, aucun second calcul au clic loadReco");

    const cards = doc.querySelectorAll(".reco-card");
    console.log(`Cartes affichées: ${cards.length}`);
    if (cards.length === 0) fail("N>0: aucune carte affichée après loadReco");
    else ok(`N>0: ${cards.length} carte(s) affichée(s)`);

    const metaValues = [...doc.querySelectorAll(".reco-meta")].map((node) => node.textContent);
    if (metaValues.some((value) => /\d\s+x\s+\d/i.test(value))) {
      fail("N>0: une dimension utilise encore le caractère ASCII x");
    } else if (!metaValues.every((value) => value.includes("×"))) {
      fail("N>0: le signe typographique × est absent d'une carte");
    } else {
      ok("N>0: toutes les dimensions utilisent le signe typographique ×");
    }

    const formatter = window.CitiCigarsDimensionFormatter.formatCigarDimensions;
    const fractionCases = {
      "6 1/2 x 54": "6½ × 54",
      "6 1/4 x 54": "6¼ × 54",
      "5 3/4 x 60": "5¾ × 60",
      "5 1/8 x 55": "5⅛ × 55",
      "5 3/8 x 52": "5⅜ × 52",
      "6 5/8 x 54": "6⅝ × 54",
      "6 7/8 x 54": "6⅞ × 54",
    };
    const invalidFraction = Object.entries(fractionCases).find(
      ([source, expected]) => formatter(source) !== expected,
    );
    if (invalidFraction) {
      fail(`Formatter dimensions: ${invalidFraction[0]} n'a pas produit ${invalidFraction[1]}`);
    } else {
      ok("Formatter dimensions: × et les sept fractions usuelles sont normalisés");
    }

    // Aucun prix / mention Pack / Boîte dans les cartes
    let priceOrFormLeak = false;
    cards.forEach((c) => {
      const t = c.textContent;
      if (/FCFA|\d{4,}\s*(F|€|\$)|Pack \(|Boîte \(|Box \(/.test(t)) priceOrFormLeak = true;
    });
    if (priceOrFormLeak) fail("N>0: une carte contient un prix ou une mention de forme Pack/Boîte");
    else ok("N>0: aucune carte n'affiche de prix ni de forme Pack/Boîte");

    const productExit = [...cards].find((card) =>
      card.matches("a,button,[role='link'],[tabindex],[onclick]")
      || card.querySelector("a,button,[role='link'],[tabindex],[onclick]"),
    );
    if (productExit || doc.querySelector('a[href*="/p/"]') || doc.body.textContent.includes("Découvrir ce cigare")) {
      fail("Pilote DNA: une carte permet encore de quitter le Curator vers une fiche produit");
    } else {
      ok("Pilote DNA: image, nom et carte sont non interactifs; aucun lien /p/:sku ni CTA produit");
    }

    const resultScreen = doc.querySelector('.screen[data-step="5"]');
    const visibleResultText = [...resultScreen.querySelectorAll("*")]
      .filter((node) => !node.closest("[hidden]") && node.children.length === 0)
      .map((node) => node.textContent)
      .join(" ");
    if (/\?\?|�|Ã|Â/.test(visibleResultText)) {
      fail("Pilote DNA: corruption legacy visible dans le profil ou les recommandations");
    } else {
      ok("Pilote DNA: aucun marqueur de corruption legacy visible dans le résultat");
    }

    const resultBack = doc.getElementById("resultBack");
    const seeMore = doc.getElementById("seeMoreBtn");
    if (!resultBack || !seeMore) {
      fail("Pilote DNA: les actions Modifier mes réponses / Voir les autres ont disparu");
    } else {
      ok("Pilote DNA: Modifier mes réponses et Voir les autres restent présents");

      const initialCardCount = doc.querySelectorAll(".reco-card").length;
      window.__pilotTestPool = { mode: "EXACT", fullPool: engine.CATALOG.slice(0, 5) };
      window.eval("resolvedPool=window.__pilotTestPool");
      seeMore.hidden = false;
      seeMore.dispatchEvent(new window.Event("click"));
      await new Promise((r) => setTimeout(r, 20));
      if (doc.querySelectorAll(".reco-card").length <= initialCardCount || recommendCalls !== 1) {
        fail("Pilote DNA: Voir les autres n'ajoute pas le même pool sans recalcul");
      } else {
        ok("Pilote DNA: Voir les autres ajoute le même pool sans recalcul");
      }

      resultBack.dispatchEvent(new window.Event("click"));
      const step4 = doc.querySelector('.screen[data-step="4"]');
      if (!step4?.classList.contains("active") || resultScreen.classList.contains("active")) {
        fail("Pilote DNA: Modifier mes réponses ne revient pas au questionnaire");
      } else {
        ok("Pilote DNA: Modifier mes réponses revient au questionnaire");
      }
    }

    const seeMoreHidden = doc.getElementById("seeMoreBtn").hidden;
    const engineFullPoolSize = (() => {
      const cc = window.answersDebug; // non défini, juste pour lisibilité
      return null;
    })();
    console.log(`seeMoreBtn.hidden=${seeMoreHidden}`);
  } else {
    // Cas zéro
    if (!interestBoxHidden) fail("N=0: interestBox ne devrait pas être visible");
    if (zeroCaseHidden) fail("N=0: zeroCase devrait être visible");
    else ok("N=0: écran BRAVO visible directement, pas de teaser");

    const bravoText = doc.querySelector("#zeroCase h3").textContent;
    if (!bravoText.includes("BRAVO")) fail("N=0: texte BRAVO manquant");
    else ok("N=0: texte BRAVO présent");

    const gateHidden = doc.getElementById("contactGate").hidden;
    if (gateHidden) fail("N=0: le formulaire devrait être ouvert directement (sans clic wantReco)");
    else ok("N=0: formulaire ouvert directement, sans CTA produit");

    const btnLabel = doc.getElementById("loadReco").textContent;
    if (btnLabel !== "Enregistrer mon profil") fail("N=0: libellé du bouton incorrect: " + btnLabel);
    else ok('N=0: bouton "Enregistrer mon profil" conforme');
  }
  dom.window.close();
}

await run("veloute", 3, 3, "N>0");
await run("gourmand", 1, 1, "N=0");

// --- RESOLUTION_ERROR puis retry réussi (point 4, audit) ---
// Force resolveDnaPool() en échec (engine.recommend jette) pour le reveal() initial,
// vérifie l'état d'erreur distinct (jamais confondu avec un vrai N=0, aucun
// contactGate/watch), puis restaure le moteur et vérifie que le bouton "Réessayer"
// aboutit bien au flow normal (N>0 ou N=0 selon le profil), avec le même clientRequestId.
async function runResolutionErrorThenRetry(family, power, intensity, expectedLabel) {
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "https://example.com/dna.html" });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = () => {};
  await new Promise((r) => setTimeout(r, 50));
  const doc = window.document;
  installLiveAvailabilityFetch(window);

  doc.getElementById("firstName").value = "Test";
  doc.getElementById("lastName").value = "User";
  doc.getElementById("startBtn").dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-axis="power"] [data-val="${power}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-axis="intensity"] [data-val="${intensity}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[0].dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-group="family"] [data-val="${family}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[1].dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-axis="spice"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-axis="sweetness"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#signatureChips [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[2].dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-group="duration"] [data-val="around_60"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#ritualMoments [data-val="evening"]').dispatchEvent(new window.Event("click"));

  const engine = window.CitiCigarsDNAEngine;
  const originalRecommend = engine.recommend.bind(engine);
  engine.recommend = () => { throw new Error("simulated_resolution_failure"); };

  // Compte les générations d'ID (point 5b, audit) : un seul uuid() attendu pour toute
  // la session (reveal initial), ni au retry, ni au clic loadReco.
  let uuidCallCount = 0;
  const originalUuid = window.uuid;
  window.uuid = (...args) => { uuidCallCount++; return originalUuid(...args); };

  let fetchCallsDuringError = 0;
  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = (...args) => { fetchCallsDuringError++; return originalFetch(...args); };
  }

  doc.getElementById("revealBtn").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 20));

  console.log(`\n--- RESOLUTION_ERROR puis retry (${family}/power${power}/intensity${intensity} -> ${expectedLabel}) ---`);

  const zeroCaseHiddenOnError = doc.getElementById("zeroCase").hidden;
  if (!zeroCaseHiddenOnError) fail("RESOLUTION_ERROR: zeroCase (texte N=0) ne doit jamais s'afficher");
  else ok("RESOLUTION_ERROR: texte N=0 absent (zeroCase reste masqué)");

  const errorBox = doc.getElementById("resolutionError");
  if (errorBox.hidden) fail("RESOLUTION_ERROR: le message technique devrait être visible");
  else ok("RESOLUTION_ERROR: message technique visible");
  const errorText = errorBox.textContent;
  if (!errorText.includes("Nous n'avons pas pu vérifier la disponibilité")) {
    fail("RESOLUTION_ERROR: texte du message technique inattendu: " + errorText);
  } else ok("RESOLUTION_ERROR: texte du message technique conforme");

  const retryBtn = doc.getElementById("retryResolution");
  if (!retryBtn || errorBox.contains(retryBtn) === false) fail("RESOLUTION_ERROR: bouton Réessayer absent de l'état d'erreur");
  else ok("RESOLUTION_ERROR: bouton Réessayer visible dans l'état d'erreur");

  const gateHiddenOnError = doc.getElementById("contactGate").hidden;
  if (!gateHiddenOnError) fail("RESOLUTION_ERROR: aucun contactGate/formulaire ne doit s'ouvrir");
  else ok("RESOLUTION_ERROR: aucun contactGate ouvert (donc aucun saveLead/saveWatch possible)");
  const expectedAvailabilityCalls = expectedLabel === "N=0" ? 0 : 1;
  if (fetchCallsDuringError !== expectedAvailabilityCalls) fail(`RESOLUTION_ERROR: ${fetchCallsDuringError} appel(s) réseau détecté(s), attendu=${expectedAvailabilityCalls}`);
  else ok("RESOLUTION_ERROR: aucun appel contact/watch n'a été effectué");

  if (uuidCallCount !== 1) fail(`RESOLUTION_ERROR: uuid() appelé ${uuidCallCount} fois au reveal initial (attendu 1)`);
  else ok("RESOLUTION_ERROR: un seul clientRequestId généré au reveal initial");

  // Restaure le moteur avant de cliquer "Réessayer".
  engine.recommend = originalRecommend;

  retryBtn.dispatchEvent(new window.Event("click"));
  const disabledDuringRetry = retryBtn.disabled;
  if (!disabledDuringRetry) fail("Réessayer: le bouton devrait être désactivé pendant la résolution en cours");
  else ok("Réessayer: bouton désactivé pendant la résolution (anti rafale de clics)");

  await new Promise((r) => setTimeout(r, 50));

  if (retryBtn.disabled) fail("Réessayer: le bouton devrait être réactivé une fois la résolution terminée");
  else ok("Réessayer: bouton réactivé après résolution");

  if (!errorBox.hidden) fail("Réessayer réussi: l'état d'erreur devrait être masqué");
  else ok("Réessayer réussi: état d'erreur masqué");

  // Capture le clientRequestId réellement envoyé par loadReco, sans dépendre de fetch/réseau.
  let capturedClientRequestId = null;
  const originalSaveLead = window.saveLead;
  const originalSaveWatch = window.saveWatch;
  window.saveLead = (payload) => { capturedClientRequestId = payload.clientRequestId; return Promise.resolve(true); };
  window.saveWatch = (payload) => { return Promise.resolve(true); };

  if (expectedLabel === "N>0") {
    if (doc.getElementById("interestBox").hidden) fail("Réessayer réussi N>0: interestBox devrait être visible");
    else ok("Réessayer réussi N>0: flow normal interestBox affiché");
    if (!doc.getElementById("zeroCase").hidden) fail("Réessayer réussi N>0: zeroCase ne devrait pas être visible");

    doc.getElementById("wantReco").dispatchEvent(new window.Event("click"));
    doc.getElementById("country").value = "CM";
    doc.getElementById("country").dispatchEvent(new window.Event("change"));
    await new Promise((r) => setTimeout(r, 10));
    const citySel = doc.getElementById("city");
    citySel.value = citySel.options[1].value;
    doc.getElementById("phone").value = "690123456";
    doc.getElementById("loadReco").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    doc.getElementById("consentContinue").dispatchEvent(new window.Event("click")); // modale de consentement : Continuer
    await new Promise((r) => setTimeout(r, 50));
  } else {
    if (!doc.getElementById("interestBox").hidden) fail("Réessayer réussi N=0: interestBox ne devrait pas être visible");
    if (doc.getElementById("zeroCase").hidden) fail("Réessayer réussi N=0: zeroCase devrait être visible");
    else ok("Réessayer réussi N=0: écran BRAVO affiché");
    if (doc.getElementById("contactGate").hidden) fail("Réessayer réussi N=0: le formulaire devrait s'ouvrir directement");
    else ok("Réessayer réussi N=0: formulaire ouvert directement (openContactGateForZeroCase)");

    doc.getElementById("country").value = "CM";
    doc.getElementById("country").dispatchEvent(new window.Event("change"));
    await new Promise((r) => setTimeout(r, 10));
    const citySel = doc.getElementById("city");
    citySel.value = citySel.options[1].value;
    doc.getElementById("phone").value = "690123456";
    doc.getElementById("loadReco").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    doc.getElementById("consentContinue").dispatchEvent(new window.Event("click")); // modale de consentement : Continuer
    await new Promise((r) => setTimeout(r, 50));
  }

  if (uuidCallCount !== 1) fail(`Réessayer: uuid() appelé ${uuidCallCount} fois au total (attendu 1, jamais régénéré au retry ni au loadReco)`);
  else ok("Réessayer: aucun nouveau clientRequestId généré, ni au retry ni au clic loadReco");
  if (!capturedClientRequestId) fail("Réessayer: loadReco n'a pas envoyé de clientRequestId");
  else ok("Réessayer: loadReco a bien envoyé un clientRequestId (celui généré à l'origine au reveal initial)");

  window.saveLead = originalSaveLead;
  window.saveWatch = originalSaveWatch;

  dom.window.close();
}

await runResolutionErrorThenRetry("veloute", 3, 3, "N>0");
await runResolutionErrorThenRetry("gourmand", 1, 1, "N=0");

// --- Modale de consentement (décision figée de Claudel) ---
// Vérifie : ouverture après validation des champs et AVANT tout appel réseau ;
// texte correct selon le mode (normal/zero) ; Annuler = zéro appel réseau +
// champs préservés ; Continuer = envoie consentGiven:true, débloque saveLead/saveWatch.
const CONSENT_TEXT_NORMAL =
  "En continuant, vous acceptez que CitiCigars enregistre votre profil Cigar DNA et vos coordonnées afin de personnaliser vos recommandations et de vous accompagner concernant cette demande. Vos informations ne seront pas utilisées pour des communications marketing sans votre accord.";
const CONSENT_TEXT_ZERO =
  "En continuant, vous acceptez que CitiCigars enregistre votre profil Cigar DNA et vos coordonnées afin de vous contacter sur WhatsApp lorsqu'un cigare correspondant à votre profil sera disponible. Vos informations ne seront pas utilisées pour des communications marketing sans votre accord.";

async function runConsentModal(family, power, intensity, expectedLabel) {
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "https://example.com/dna.html" });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = () => {};
  await new Promise((r) => setTimeout(r, 50));
  const doc = window.document;
  installLiveAvailabilityFetch(window);

  doc.getElementById("firstName").value = "Test";
  doc.getElementById("lastName").value = "User";
  doc.getElementById("startBtn").dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-axis="power"] [data-val="${power}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-axis="intensity"] [data-val="${intensity}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[0].dispatchEvent(new window.Event("click"));
  doc.querySelector(`[data-group="family"] [data-val="${family}"]`).dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[1].dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-axis="spice"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-axis="sweetness"] [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#signatureChips [data-val="none"]').dispatchEvent(new window.Event("click"));
  doc.querySelectorAll(".next")[2].dispatchEvent(new window.Event("click"));
  doc.querySelector('[data-group="duration"] [data-val="around_60"]').dispatchEvent(new window.Event("click"));
  doc.querySelector('#ritualMoments [data-val="evening"]').dispatchEvent(new window.Event("click"));

  doc.getElementById("revealBtn").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 20));

  console.log(`\n--- Modale de consentement (${family}/power${power}/intensity${intensity} -> ${expectedLabel}) ---`);

  if (expectedLabel === "N>0") {
    doc.getElementById("wantReco").dispatchEvent(new window.Event("click"));
  }
  // Sinon (N=0) : contactGate déjà ouvert directement par reveal().

  let saveLeadCalls = 0;
  let saveWatchCalls = 0;
  let capturedPayload = null;
  const originalSaveLead = window.saveLead;
  const originalSaveWatch = window.saveWatch;
  window.saveLead = (payload) => { saveLeadCalls++; capturedPayload = payload; return Promise.resolve(true); };
  window.saveWatch = (payload) => { saveWatchCalls++; return Promise.resolve(true); };

  doc.getElementById("country").value = "CM";
  doc.getElementById("country").dispatchEvent(new window.Event("change"));
  await new Promise((r) => setTimeout(r, 10));
  const citySel = doc.getElementById("city");
  citySel.value = citySel.options[1].value;
  doc.getElementById("phone").value = "690123456";

  doc.getElementById("loadReco").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 10));

  const overlay = doc.getElementById("consentModalOverlay");
  if (overlay.hidden) fail(`${expectedLabel}: la modale de consentement devrait s'ouvrir après validation des champs`);
  else ok(`${expectedLabel}: modale de consentement ouverte après validation des champs, avant tout appel réseau`);

  const expectedText = expectedLabel === "N>0" ? CONSENT_TEXT_NORMAL : CONSENT_TEXT_ZERO;
  const actualText = doc.getElementById("consentModalBody").textContent;
  if (actualText === expectedText) ok(`${expectedLabel}: texte de la modale conforme au mode (${expectedLabel === "N>0" ? "normal" : "zero"})`);
  else fail(`${expectedLabel}: texte de la modale inattendu.\nAttendu: ${expectedText}\nObtenu:  ${actualText}`);

  if (saveLeadCalls !== 0 || saveWatchCalls !== 0) {
    fail(`${expectedLabel}: saveLead/saveWatch appelé(s) avant le clic sur Continuer (saveLead=${saveLeadCalls}, saveWatch=${saveWatchCalls})`);
  } else {
    ok(`${expectedLabel}: aucun appel saveLead/saveWatch avant le clic sur Continuer`);
  }

  // Annuler : ferme la modale, conserve les champs, zéro appel réseau.
  doc.getElementById("consentCancel").dispatchEvent(new window.Event("click"));
  const overlayAfterCancel = doc.getElementById("consentModalOverlay").hidden;
  if (!overlayAfterCancel) fail(`${expectedLabel}: Annuler devrait fermer la modale`);
  else ok(`${expectedLabel}: Annuler ferme la modale`);
  if (doc.getElementById("country").value !== "CM" || doc.getElementById("phone").value !== "690123456") {
    fail(`${expectedLabel}: Annuler a effacé des champs déjà saisis`);
  } else {
    ok(`${expectedLabel}: Annuler conserve les champs déjà saisis (pays/téléphone)`);
  }
  if (saveLeadCalls !== 0 || saveWatchCalls !== 0) {
    fail(`${expectedLabel}: Annuler a déclenché un appel réseau (saveLead=${saveLeadCalls}, saveWatch=${saveWatchCalls})`);
  } else {
    ok(`${expectedLabel}: Annuler = zéro appel réseau`);
  }

  // Ré-ouvre et clique Continuer cette fois.
  doc.getElementById("loadReco").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 10));
  if (doc.getElementById("consentModalOverlay").hidden) fail(`${expectedLabel}: la modale devrait pouvoir se rouvrir après Annuler`);
  else ok(`${expectedLabel}: la modale se rouvre normalement après un Annuler précédent`);

  doc.getElementById("consentContinue").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 300));

  if (doc.getElementById("consentModalOverlay").hidden) ok(`${expectedLabel}: Continuer ferme la modale`);
  else fail(`${expectedLabel}: la modale devrait être fermée après Continuer`);

  if (saveLeadCalls !== 1) fail(`${expectedLabel}: saveLead appelé ${saveLeadCalls} fois après Continuer (attendu 1)`);
  else ok(`${expectedLabel}: saveLead appelé exactement 1 fois après Continuer`);

  if (!capturedPayload || capturedPayload.consentGiven !== true) {
    fail(`${expectedLabel}: le payload envoyé à /contact ne contient pas consentGiven:true (obtenu: ${JSON.stringify(capturedPayload && capturedPayload.consentGiven)})`);
  } else {
    ok(`${expectedLabel}: le payload envoyé à /contact contient bien consentGiven:true`);
  }
  if (capturedPayload && "consentTimestamp" in capturedPayload) {
    fail(`${expectedLabel}: le frontend ne devrait envoyer aucun timestamp de consentement`);
  } else {
    ok(`${expectedLabel}: aucun consentTimestamp envoyé par le frontend (généré côté serveur)`);
  }
  const expectedCaptureMode = expectedLabel === "N=0" ? "zero" : "normal";
  if (!capturedPayload || capturedPayload.captureMode !== expectedCaptureMode) {
    fail(`${expectedLabel}: captureMode attendu=${expectedCaptureMode}, obtenu=${JSON.stringify(capturedPayload && capturedPayload.captureMode)}`);
  } else {
    ok(`${expectedLabel}: captureMode=${expectedCaptureMode} envoyé directement à /contact`);
  }

  if (expectedLabel === "N=0") {
    if (saveWatchCalls !== 1) fail(`N=0: saveWatch appelé ${saveWatchCalls} fois après Continuer (attendu 1)`);
    else ok("N=0: saveWatch appelé exactement 1 fois après Continuer (cas zéro, bloquant)");
  }

  window.saveLead = originalSaveLead;
  window.saveWatch = originalSaveWatch;

  dom.window.close();
}

await runConsentModal("veloute", 3, 3, "N>0");
await runConsentModal("gourmand", 1, 1, "N=0");

if (process.exitCode === 1) {
  console.log("\n=== DES ECHECS ONT ETE DETECTES CI-DESSUS ===");
} else {
  console.log("\n=== TOUS LES CONTROLES FONCTIONNELS SONT PASSES ===");
}
