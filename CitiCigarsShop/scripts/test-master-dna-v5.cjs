const data = require('../shared/master-dna-v5.cjs');
const engine = require('../shared/dna-engine-v2.cjs');

let pass = 0;
function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    pass++;
  }
}

assert(data.SOURCE_VERSION === 'MASTER_GESTION_20260820_v5', 'source version');
assert(data.CANDIDATES.length === 42, '42 MASTER DNA candidates');
assert(new Set(data.CANDIDATES.map((c) => c.cigarId)).size === 42, '42 unique CIGAR_ID');
assert(new Set(data.CANDIDATES.map((c) => c.sku)).size === 42, '42 unique product SKU');
assert(data.EXCLUDED_SKUS.length === 12, '12 Réservé - activation exclusions');
assert(data.CANDIDATES.filter((c) => !c.curatorEligible).length === 12, '12 candidates flagged excluded');
assert(data.CANDIDATES.every((c) => !String(c.sku).endsWith('-P')), 'no fake Pack SKU');

for (const sku of data.EXCLUDED_SKUS) {
  const candidate = data.CANDIDATES.find((c) => c.sku === sku);
  assert(!!candidate && candidate.curatorEligible === false, `excluded flag matches ${sku}`);
}

const eligible = data.CANDIDATES.filter((c) => c.curatorEligible);
const client = {
  families: ['Boisé', 'Fauve'],
  power: 4,
  intensity: 3,
  durationWindow: '1h-1h30',
  spice: 4,
  sweet: 3,
  signature: 'Fruité',
};
const ranked = engine.rankCandidates(client, eligible);
assert(ranked.length === 30, 'pure DNA ranking includes exactly 30 eligible MASTER rows');
assert(ranked.every((r) => !data.EXCLUDED_SKUS.includes(r.sku)), 'excluded SKU never reaches ranking');
assert(ranked.every((r, i) => i === 0 || ranked[i - 1].score >= r.score), 'DNA ranking is score-descending');

console.log(`PASS ${pass} checks — MASTER v5 DNA snapshot / exclusion integrity`);
if (process.exitCode) process.exit(process.exitCode);
