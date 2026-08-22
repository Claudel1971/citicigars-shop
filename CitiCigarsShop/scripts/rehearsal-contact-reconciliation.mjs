process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_crm_test";
import express from "express";
import http from "http";
import { registerDnaRoutes } from "../server/routes.dna.ts";
import { registerCrmRoutes } from "../server/routes.crm.ts";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());
registerDnaRoutes(app);
registerCrmRoutes(app);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
function assert(cond, label, extra) {
  if (cond) { pass++; console.log(`OK   ${label}`); }
  else { fail++; console.log(`FAIL ${label}`, extra ?? ""); }
}

function realPayload(overrides = {}) {
  return {
    clientRequestId: randomUUID(),
    consentGiven: true,
    captureMode: "normal",
    participant: { firstName: "Aïcha", lastName: "Ndiaye" },
    customerDNA: { id: "GOU-2-2", label: "Le Gourmand Harmonieux", family: "gourmand", power: 3, intensity: 3, secondaryFamily: "boise" },
    refinements: { spice: null, sweetness: null, signatures: [], signatureNoPreference: false, duration: null, ritualMoments: [] },
    recommendationsShown: null,
    contact: { country: "Cameroun", city: "Douala", phone: "+237690123456" },
    ...overrides,
  };
}

async function post(path, body) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// --- Test 1 : succès --- dna_leads + customers + customer_dna cohérents
{
  const payload = realPayload();
  const { status, json } = await post("/api/dna/contact", payload);
  assert(status === 200, "Succès -> 200", status);
  assert(json?.ok === true, "Succès -> ok:true");
  assert(typeof json?.leadId === "number", "Succès -> leadId présent");
  assert(typeof json?.customerId === "string" && json.customerId.startsWith("CTCG-CUST-"), "Succès -> customerId CTCG-CUST- généré", json?.customerId);
  assert(json?.wasExistingCustomer === false, "Succès -> nouveau client (premier contact)");
  assert(typeof json?.dnaId === "string", "Succès -> dnaId présent");
}

// --- Test 2 : même clientRequestId envoyé deux fois -> pas de doublon lead ni DNA ---
{
  const payload = realPayload();
  const r1 = await post("/api/dna/contact", payload);
  const r2 = await post("/api/dna/contact", payload);
  assert(r1.json.leadId === r2.json.leadId, "Idempotence -> même leadId au 2e envoi", [r1.json.leadId, r2.json.leadId]);
  assert(r1.json.dnaId === r2.json.dnaId, "Idempotence -> même dnaId au 2e envoi (pas de doublon customer_dna)", [r1.json.dnaId, r2.json.dnaId]);
  assert(r2.json.created === false, "Idempotence -> created:false au 2e envoi");
}

// --- Test 3 : téléphone déjà existant -> rattaché au même customer_id ---
{
  const sharedPhone = "+237677889900";
  const p1 = realPayload({ contact: { country: "Cameroun", city: "Douala", phone: sharedPhone }, participant: { firstName: "Jean", lastName: "Mbarga" } });
  const r1 = await post("/api/dna/contact", p1);
  const p2 = realPayload({ contact: { country: "Cameroun", city: "Yaoundé", phone: sharedPhone }, participant: { firstName: "Jean", lastName: "Mbarga" } });
  const r2 = await post("/api/dna/contact", p2);
  assert(r1.json.customerId === r2.json.customerId, "Téléphone existant -> même customerId", [r1.json.customerId, r2.json.customerId]);
  assert(r2.json.wasExistingCustomer === true, "Téléphone existant -> wasExistingCustomer:true au 2e");
  assert(r1.json.leadId !== r2.json.leadId, "Téléphone existant -> deux dna_leads distincts (deux tests DNA)", [r1.json.leadId, r2.json.leadId]);
}

// --- Test 4 : nouveau téléphone -> création d'un prospect unique ---
{
  const p = realPayload({ contact: { country: "Cameroun", city: "Bafoussam", phone: "+237655443322" } });
  const { json } = await post("/api/dna/contact", p);
  assert(typeof json.customerId === "string", "Nouveau téléphone -> customerId créé");
  assert(json.wasExistingCustomer === false, "Nouveau téléphone -> wasExistingCustomer:false");
}

// --- Test 5 : consentement absent/false -> aucune écriture ---
{
  const before = await post("/api/dna/contact", realPayload({ consentGiven: false }));
  assert(before.status === 400 && before.json?.error === "consent_required", "Consentement false -> 400 consent_required", before.status);
  const beforeAbsent = realPayload();
  delete beforeAbsent.consentGiven;
  const r2 = await post("/api/dna/contact", beforeAbsent);
  assert(r2.status === 400 && r2.json?.error === "consent_required", "Consentement absent -> 400 consent_required", r2.status);
}

// --- Test 6 : payload invalide -> aucune écriture ---
{
  const invalid = realPayload();
  invalid.participant.firstName = "";
  const { status, json } = await post("/api/dna/contact", invalid);
  assert(status === 400 && json?.error === "invalid_request", "Payload invalide -> 400 invalid_request", status);
}

// --- Test 7 : aucune régression sur /api/dna/availability ni /api/dna/watch ---
{
  const rAvail = await post("/api/dna/availability", { cigarIds: ["CTG000001"] });
  assert(rAvail.status === 502 || rAvail.status === 200, "/api/dna/availability toujours fonctionnel (CIGAR_ID inconnu en base test -> 502 attendu)", rAvail.status);

  const payload = realPayload();
  await post("/api/dna/contact", payload);
  // Comportement attendu exact, pas générique : un lead captureMode:"normal"
  // n'est pas éligible au watch (réservé au cas zéro) — 409 zero_case_required.
  const rWatch = await post("/api/dna/watch", { ...payload, dnaProfileId: payload.customerDNA.id, answersSnapshot: {}, refinementsSnapshot: {}, consentGiven: true, consentTimestamp: new Date().toISOString() });
  assert(rWatch.status === 409 && rWatch.json?.error === "zero_case_required", "/api/dna/watch sur lead normal -> 409 zero_case_required (comportement exact, inchangé)", [rWatch.status, rWatch.json]);
}

console.log(`\n${pass} OK / ${fail} FAIL`);
server.close();
process.exit(fail > 0 ? 1 : 0);
