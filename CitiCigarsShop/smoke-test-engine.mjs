import engine from './shared/dna-engine.cjs';

console.log('version:', engine.version);
console.log('CATALOG length:', engine.CATALOG.length);

// Un profil qui doit matcher CTG000020 (My Father Flor de Las Antillas, Velouté/Gourmand/Boisé, power3/intensity3)
const input = {
  customerDNA: { family: 'veloute', power: 3, intensity: 3, secondaryFamily: null },
  refinements: { spice: null, sweetness: null, signatures: [], duration: null },
};

const baseline = engine.recommend(input);
console.log('baseline mode:', baseline.mode, 'count:', baseline.recommendations.length);

// Sans override : CTG000020 a heldUnits=1, available=true dans le CATALOG figé -> doit apparaitre
console.log('baseline has CTG000020:', baseline.recommendations.some(r => r.cigarId === 'CTG000020'));

// Avec override live: on force CTG000020 à indisponible malgré le CATALOG figé (fail-closed simulation)
const liveOverrideUnavailable = { CTG000020: { packAvailable: false, boxAvailable: false } };
const withOverride = engine.recommend(input, liveOverrideUnavailable);
console.log('override(unavailable) has CTG000020:', withOverride.recommendations.some(r => r.cigarId === 'CTG000020'));

// Override qui rend disponible un cigarId marqué indisponible dans le CATALOG figé (CTG000021, heldUnits=0/available=false)
// Vérifié directement sur le pool (eligiblePool), pas sur le top-3 de recommend() qui tronque par diversité.
const liveOverrideAvailable = { CTG000021: { packAvailable: true, boxAvailable: false } };
const a2 = { family: 'gourmand', power: 4, intensity: 5, secondaryFamily: null, spice: null, sweetness: null, signatures: [], duration: null };
const poolNoOverride = engine.eligiblePool(a2, 0, false);
const poolWithOverride = engine.eligiblePool(a2, 0, false, liveOverrideAvailable);
console.log('pool WITHOUT override has CTG000021:', poolNoOverride.some(p => p.cigarId === 'CTG000021'));
console.log('pool WITH override has CTG000021:', poolWithOverride.some(p => p.cigarId === 'CTG000021'));

// --- Correction audit (point 5) : fail-closed PAR CIGAR_ID, pas seulement quand
// la map entière est absente. CTG000020 a stock.available=true dans le CATALOG
// figé (donc apparaîtrait sans aucun override). Ici on fournit une map non vide,
// mais qui ne contient AUCUNE entrée pour CTG000020 (seulement pour un autre
// cigarId sans rapport) -> doit être exclu, jamais un repli sur p.stock.available.
const a3 = { family: 'veloute', power: 3, intensity: 3, secondaryFamily: null, spice: null, sweetness: null, signatures: [], duration: null };
const poolStale = engine.eligiblePool(a3, 0, false); // sans map -> comportement local existant
const mapMissingThisCigarId = { CTG999999: { packAvailable: true, boxAvailable: true } }; // non vide, mais ne couvre pas CTG000020
const poolWithPartialMap = engine.eligiblePool(a3, 0, false, mapMissingThisCigarId);
console.log('pool SANS map (legacy) has CTG000020:', poolStale.some(p => p.cigarId === 'CTG000020'));
console.log('pool AVEC map non vide mais SANS entrée CTG000020 has CTG000020 (doit être false):', poolWithPartialMap.some(p => p.cigarId === 'CTG000020'));
if (poolWithPartialMap.some(p => p.cigarId === 'CTG000020')) {
  console.error('ECHEC : fail-closed par CIGAR_ID individuel ne fonctionne pas (repli détecté sur p.stock.available)');
  process.exitCode = 1;
}
