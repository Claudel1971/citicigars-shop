const engine = require('../shared/dna-engine-v2.cjs');
let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.log(`ECHEC: ${label}\n  attendu: ${JSON.stringify(expected)}\n  obtenu:  ${JSON.stringify(actual)}`);
  }
}

// Test 1 : familles 2/2 sur cigare a 2 familles = 50
const cigarA = {cigarId:'A', sku:'SKU-A', famille1:'Boisé', famille2:'Fauve', famille3:null,
  puissance:4, intensite:3, spice:4, sweet:3, signatures:['Fruité'], dureeMin:65, dureeMax:85};
let r = engine.scoreCandidate({families:['Boisé','Fauve'], power:4, intensity:3, durationWindow:'1h-1h30',
  spice:4, sweet:3, signature:'Fruité'}, cigarA);
assertEq(r.decomposition.famille, 50, 'famille 2/2 sur cigare 2 familles = 50');

// Test 2 : invariance ordre familles -- Boise+Fauve === Fauve+Boise
let r2a = engine.familyScore(['Boisé','Fauve'], cigarA);
let r2b = engine.familyScore(['Fauve','Boisé'], cigarA);
assertEq(r2a, r2b, 'invariance ordre familles client');

// Test 3 : familles 2/2 sur cigare a 3 familles = 45
const cigarB = {...cigarA, famille3:'Gourmand'};
r = engine.familyScore(['Boisé','Fauve'], cigarB);
assertEq(r, 45, 'familles 2/2 sur cigare 3 familles = 45');

// Test 4 : Mode C -- ND cote cigare intensite = 0 point, jamais impute
const cigarND = {...cigarA, intensite: 'ND'};
r = engine.gapScore16(3, cigarND.intensite);
assertEq(r, 0, 'Mode C: intensite ND cigare = 0 (pas impute)');

// Test 5 : Mode C -- ND cote client spice = 0 point
r = engine.gapScore2(null, 4);
assertEq(r, 0, 'Mode C: spice ND client = 0');

// Test 6 : ecart intensite 0 -> 16 pts (score max)
r = engine.gapScore16(3, 3);
assertEq(r, 16, 'ecart intensite 0 = 16 pts');

// Test 7 : ecart intensite >=4 -> 0 pts
r = engine.gapScore16(1, 5);
assertEq(r, 0, 'ecart intensite 4 = 0 pts');

// Test 8 : Data Confidence -- 3/3 quand tout connu
r = engine.scoreCandidate({families:['Boisé','Fauve'], power:4, intensity:3, durationWindow:'1h-1h30',
  spice:4, sweet:3, signature:'Fruité'}, cigarA);
assertEq(r.dataConfidence, '3/3', 'Data Confidence 3/3 quand tout connu');

// Test 9 : Data Confidence -- 0/3 quand tout ND cote cigare
const cigarAllND = {...cigarA, spice:'ND', sweet:'ND', signatures:[]};
r = engine.scoreCandidate({families:['Boisé','Fauve'], power:4, intensity:3, durationWindow:'1h-1h30',
  spice:4, sweet:3, signature:'Fruité'}, cigarAllND);
assertEq(r.dataConfidence, '0/3', 'Data Confidence 0/3 quand tout ND cote cigare');
assertEq(r.decomposition.affinage, 0, 'affinage = 0 quand tout ND (Mode C, jamais impute)');

// Test 10 : durée -- chevauchement total -> proche du max
r = engine.durationScore('1h-1h30', {dureeMin:65, dureeMax:85}, 12);
assertEq(r, 12, 'duree: cigare 65-85 dans fenetre client 60-90 = 12 (max)');

// Test 11 : durée -- aucun chevauchement -> 0
r = engine.durationScore('<1h', {dureeMin:90, dureeMax:120}, 12);
assertEq(r, 0, 'duree: aucun chevauchement = 0');

// Test 12 : signature -- ND cote cigare (aucune signature documentee) = 0, jamais imputee
r = engine.signatureScore('Fruité', [], 2);
assertEq(r, 0, 'signature: cigare sans signature documentee = 0 (Mode C)');

console.log(`\n${pass} tests passes, ${fail} echoues.`);
process.exit(fail > 0 ? 1 : 0);
