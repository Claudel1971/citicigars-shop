const pri = require('../shared/priorisation-engine-v2.cjs');
let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; }
  else { fail++; console.log(`ECHEC: ${label}\n  attendu: ${JSON.stringify(expected)}\n  obtenu:  ${JSON.stringify(actual)}`); }
}
function ids(list) { return list.map(x => x.cigarId); }

const dnaRanked = [
  {cigarId:'C1', sku:'SKU-1', score:86.5},
  {cigarId:'C2', sku:'SKU-2', score:86.5},
  {cigarId:'C3', sku:'SKU-3', score:86.5},
  {cigarId:'C4', sku:'SKU-4', score:82.5},
  {cigarId:'C5', sku:'SKU-5', score:82.5},
  {cigarId:'C6', sku:'SKU-6', score:80.5},
  {cigarId:'C7', sku:'SKU-7', score:75.0},
  {cigarId:'C8', sku:'SKU-8', score:65.0},
];

// Test 1 : table VIDE = strictement identique au DNA pur (garantie la plus importante)
let r1 = pri.applyCommercialPriority(dnaRanked, {}, {window:5});
assertEq(ids(r1), ['C1','C2','C3','C4','C5'], 'table vide = DNA pur (Top5)');

// Test 2 : active=true SANS priority_level -> config invalide, ignoree
let r2 = pri.applyCommercialPriority(dnaRanked, {'SKU-2': {active:true, priority_level:null}}, {window:5});
assertEq(ids(r2), ['C1','C2','C3','C4','C5'], 'active sans priority_level = ignore');

// Test 3 : priorite valide, dans la zone, sans date -> doit s'appliquer
let r3 = pri.applyCommercialPriority(dnaRanked,
  {'SKU-4': {active:true, priority_level:1, valid_from:null, valid_to:null}},
  {window:5});
assertEq(r3[0].cigarId, 'C4', 'priorite valide sans date = appliquee, promue en tete');

// Test 4 : priorite pas encore demarree (valid_from futur) -> ignoree
let r4 = pri.applyCommercialPriority(dnaRanked,
  {'SKU-4': {active:true, priority_level:1, valid_from:'2099-01-01', valid_to:null}},
  {window:5, today:new Date('2026-08-22T00:00:00Z')});
assertEq(ids(r4), ['C1','C2','C3','C4','C5'], 'priorite future = ignoree');

// Test 5 : priorite expiree (valid_to passe) -> ignoree
let r5 = pri.applyCommercialPriority(dnaRanked,
  {'SKU-4': {active:true, priority_level:1, valid_from:'2026-01-01', valid_to:'2026-06-30'}},
  {window:5, today:new Date('2026-08-22T00:00:00Z')});
assertEq(ids(r5), ['C1','C2','C3','C4','C5'], 'priorite expiree = ignoree');

// Test 6 : hors zone -> priorite valide mais score trop bas, jamais promue
let r6 = pri.applyCommercialPriority(dnaRanked,
  {'SKU-8': {active:true, priority_level:1, valid_from:null, valid_to:null}},
  {window:5});
assertEq(ids(r6), ['C1','C2','C3','C4','C5'], 'priorite hors zone = jamais promue (garde-fou principal)');

// Test 7 : tie-break Rating CA -- 3 ex-aequo meme priority_level, differencies par rating
let r7 = pri.applyCommercialPriority(dnaRanked, {
  'SKU-1': {active:true, priority_level:1, valid_from:null, valid_to:null},
  'SKU-2': {active:true, priority_level:1, valid_from:null, valid_to:null},
  'SKU-3': {active:true, priority_level:1, valid_from:null, valid_to:null},
}, {window:5, caRatingBySku:{C1:91, C2:95, C3:89}});
assertEq(ids(r7).slice(0,3), ['C2','C1','C3'], 'tie-break Rating CA (95>91>89)');

// Test 8 : P1 avant P2 (memes conditions sinon)
let r8 = pri.applyCommercialPriority(dnaRanked, {
  'SKU-4': {active:true, priority_level:2, valid_from:null, valid_to:null},
  'SKU-5': {active:true, priority_level:1, valid_from:null, valid_to:null},
}, {window:5});
assertEq(r8[0].cigarId, 'C5', 'P1 (niveau 1) passe avant P2 (niveau 2)');

console.log(`\n${pass} tests passes, ${fail} echoues.`);
process.exit(fail > 0 ? 1 : 0);
