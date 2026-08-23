const n = require('../shared/dimension-normalizer-v2.cjs');
let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  if (actual === expected) { pass++; }
  else { fail++; console.log(`ECHEC: ${label}\n  attendu: ${JSON.stringify(expected)}\n  obtenu:  ${JSON.stringify(actual)}`); }
}

// Exemples exacts donnes dans le prompt d'origine (section 20)
assertEq(n.normalizeDimensions('6,5 x 60'), '6½ × 60', '6,5 x 60 -> 6½ × 60');
assertEq(n.normalizeDimensions('6.5 X 60'), '6½ × 60', '6.5 X 60 -> 6½ × 60');
assertEq(n.normalizeDimensions('6 1/2 x 60'), '6½ × 60', '6 1/2 x 60 -> 6½ × 60');
assertEq(n.normalizeDimensions('6-1/2 × 60'), '6½ × 60', '6-1/2 × 60 -> 6½ × 60');
assertEq(n.normalizeDimensions('6½x60'), '6½ × 60', '6½x60 -> 6½ × 60');
assertEq(n.normalizeDimensions('6 1/4 x 58'), '6¼ × 58', '6 1/4 x 58 -> 6¼ × 58');
assertEq(n.normalizeDimensions('5.625 x 55'), '5⅝ × 55', '5.625 x 55 -> 5⅝ × 55');

// Cas limites
assertEq(n.normalizeDimensions('6 x 60'), '6 × 60', 'entier simple, pas de fraction');
assertEq(n.normalizeDimensions('7 X 70'), '7 × 70', 'entier + X majuscule');
assertEq(n.normalizeDimensions(''), null, 'chaine vide -> null, jamais invente');
assertEq(n.normalizeDimensions('abc x 60'), null, 'longueur non parseable -> null');
assertEq(n.normalizeDimensions('6.5 x abc'), null, 'ring non entier -> null');
assertEq(n.normalizeDimensions('6.333 x 60'), null, 'decimal non-fraction standard -> null (pas d\'invention)');
assertEq(n.normalizeDimensions('6'), null, 'pas de separateur x -> null');

console.log(`\n${pass} tests passes, ${fail} echoues.`);
process.exit(fail > 0 ? 1 : 0);
