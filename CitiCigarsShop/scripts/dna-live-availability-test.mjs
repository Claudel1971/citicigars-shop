import { readFileSync } from "fs";
import { JSDOM } from "jsdom";

const htmlPath = new URL("../client/public/CitiCigars_DNA_Curator_v2_10_3_RC.html", import.meta.url);
const enginePath = new URL("../shared/dna-engine.cjs", import.meta.url);
const runtimeConfigPath = new URL("../client/public/dna-runtime-config.js", import.meta.url);
const runtimeConfigSource = readFileSync(runtimeConfigPath, "utf8");
let html = readFileSync(htmlPath, "utf8");
html = html.replace(
  '<script src="dna-runtime-config.js"></script>',
  '<script>window.CITICIGARS_RUNTIME_CONFIG={API_BASE:"https://dna-test-api.example/api"};</script>',
);
html = html.replace('<script src="dna-engine.js"></script>', `<script>${readFileSync(enginePath, "utf8")}</script>`);

const answers = {
  family: "veloute",
  power: 3,
  intensity: 1,
  duration: "under_60",
  spice: null,
  sweetness: null,
  signatures: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`OK: ${message}`);
}

function configuredApiBase(origin, injectedApiBase) {
  const dom = new JSDOM("", { runScripts: "outside-only", url: origin });
  if (injectedApiBase) dom.window.CITICIGARS_RUNTIME_CONFIG = { API_BASE: injectedApiBase };
  dom.window.eval(runtimeConfigSource);
  const apiBase = dom.window.CITICIGARS_RUNTIME_CONFIG?.API_BASE;
  dom.window.close();
  return apiBase;
}

assert(configuredApiBase("http://localhost:5173") === "http://localhost:5000/api", "runtime local cible le backend local non-production");
assert(configuredApiBase("https://staging.citicigars.com", "https://citicigars-api-staging.onrender.com/api") === "https://citicigars-api-staging.onrender.com/api", "runtime staging conserve uniquement l'API Render staging injectée");
assert(configuredApiBase("https://citicigars.com", "https://citicigars-api.onrender.com/api") === "https://citicigars-api.onrender.com/api", "runtime production conserve l'API Render production injectée");
assert(configuredApiBase("https://staging.citicigars.com") == null, "staging sans configuration échoue fermé sans fallback production");

async function withPage(run) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.test/dna.html" });
  try {
    await run(dom.window);
  } finally {
    dom.window.close();
  }
}

async function resolveWith(targetAvailability, expectedMode, label) {
  await withPage(async (window) => {
    let calls = 0;
    window.fetch = async (url, options) => {
      calls += 1;
      assert(String(url).includes("/api/dna/availability"), `${label}: seul l'endpoint de disponibilité est appelé`);
      const cigarIds = JSON.parse(options.body).cigarIds;
      const availability = Object.fromEntries(cigarIds.map((id) => [id, targetAvailability[id] ?? { packAvailable: false, boxAvailable: false }]));
      return { ok: true, status: 200, json: async () => ({ availability }) };
    };
    const result = await window.resolveDnaPool(answers);
    assert(calls === 1, `${label}: un seul appel batch`);
    assert(result.mode === expectedMode, `${label}: cascade résolue en ${expectedMode}`);
    assert(result.top3.length <= 3, `${label}: maximum trois recommandations initiales`);
  });
}

await resolveWith({ CTG000016: { packAvailable: true, boxAvailable: false } }, "EXACT", "Pack seulement");
await resolveWith({ CTG000016: { packAvailable: false, boxAvailable: true } }, "EXACT", "Box seulement");
await resolveWith({}, "NO_MATCH", "Loose seulement / aucune forme commerciale");
await resolveWith({ CTG000020: { packAvailable: true, boxAvailable: false } }, "FALLBACK_DURATION", "Fallback durée");
await resolveWith({ CTG000042: { packAvailable: false, boxAvailable: true } }, "FALLBACK_POWER", "Fallback puissance");

await withPage(async (window) => {
  window.fetch = async () => { throw new Error("network_down"); };
  const result = await window.resolveDnaPool(answers);
  assert(result.mode === "RESOLUTION_ERROR", "Panne réseau reste RESOLUTION_ERROR, jamais N=0");
  assert(result.top3.length === 0 && result.fullPool.length === 0, "Panne réseau ne fabrique aucune recommandation");
});

await withPage(async (window) => {
  window.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: "unresolved_cigar_ids" }) });
  const result = await window.resolveDnaPool(answers);
  assert(result.mode === "RESOLUTION_ERROR", "CIGAR_ID non résolu par l'API est fail-closed");
});

console.log("=== DISPONIBILITÉ LIVE DNA: PASS ===");
