/**
 * CitiCigars DNA Curator V2 -- moteur de scoring final, architecture figee.
 * Mode C -- aucune imputation. ND (null/vide/"ND") = 0 point sur la
 * dimension concernee, jamais de rescaling ni de valeur neutre.
 * Data Confidence calculee separement, jamais melangee au score sur 100.
 *
 * Compatible require() (Node/CommonJS) et <script> classique (window global),
 * meme pattern que dna-engine.cjs existant.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CitiCigarsDnaEngineV2 = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FAMILY_SCORE_TABLE = {
    // hits(2/2 ou 1/2) x nbFamillesCigare(2 ou 3+) -> points
    '2-2': 50,
    '2-3': 45,
    '1-1': 25,
    '1-2': 25,
    '1-3': 20,
    '0': 0
  };

  var GAP_SCORE_16 = { 0: 16, 1: 12, 2: 8, 3: 4 }; // 4+ -> 0
  var GAP_SCORE_2 = { 0: 2, 1: 1.5, 2: 1, 3: 0.5 }; // 4+ -> 0

  function isND(v) {
    return v === null || v === undefined || v === '' || v === 'ND';
  }

  function cigarFamilySet(cigar) {
    var fams = [cigar.famille1, cigar.famille2, cigar.famille3];
    var out = [];
    for (var i = 0; i < fams.length; i++) {
      if (!isND(fams[i])) out.push(fams[i]);
    }
    return out;
  }

  /**
   * clientFamilies : tableau de 2 familles EXACTEMENT (ensemble non ordonne,
   *   Boise+Fauve === Fauve+Boise, verifie par test).
   */
  function familyScore(clientFamilies, cigar) {
    var cf = cigarFamilySet(cigar);
    var hits = 0;
    for (var i = 0; i < clientFamilies.length; i++) {
      if (cf.indexOf(clientFamilies[i]) !== -1) hits++;
    }
    if (hits === 0) return 0;
    var n = cf.length >= 3 ? 3 : cf.length; // 2 ou 3+ (ne devrait jamais depasser 3)
    var key = hits + '-' + n;
    return FAMILY_SCORE_TABLE.hasOwnProperty(key) ? FAMILY_SCORE_TABLE[key] : 0;
  }

  function gapScore16(clientVal, cigarVal) {
    if (isND(clientVal) || isND(cigarVal)) return 0; // Mode C : ND = 0, jamais impute
    var gap = Math.abs(clientVal - cigarVal);
    return GAP_SCORE_16.hasOwnProperty(gap) ? GAP_SCORE_16[gap] : 0;
  }

  function gapScore2(clientVal, cigarVal) {
    if (isND(clientVal) || isND(cigarVal)) return 0;
    var gap = Math.abs(clientVal - cigarVal);
    return GAP_SCORE_2.hasOwnProperty(gap) ? GAP_SCORE_2[gap] : 0;
  }

  // Fenetres client -> plage cible en minutes (reprend la formule de
  // chevauchement validee cette nuit, pas un midpoint)
  var DURATION_TARGET_WINDOWS = {
    '<1h': [0, 60],
    '~1h': [50, 70],
    '1h-1h30': [60, 90],
    '>1h30': [90, 999]
  };

  function durationScore(clientWindow, cigar, weight) {
    weight = weight || 12;
    if (isND(cigar.dureeMin) || isND(cigar.dureeMax)) return 0;
    var target = DURATION_TARGET_WINDOWS[clientWindow];
    if (!target) return 0;
    var lo = target[0], hi = target[1];
    var dmin = cigar.dureeMin, dmax = cigar.dureeMax;
    var overlap = Math.max(0, Math.min(dmax, hi) - Math.max(dmin, lo));
    if (overlap <= 0) return 0;
    var span = Math.min(dmax - dmin, hi - lo);
    if (span <= 0) span = Math.max(dmax - dmin, hi - lo);
    var ratio = span > 0 ? Math.min(1, overlap / span) : 1;
    return Math.round(weight * ratio);
  }

  function signatureScore(clientSig, cigarSignatures, weight) {
    weight = weight || 2;
    if (isND(clientSig)) return 0;
    if (!cigarSignatures || cigarSignatures.length === 0) return 0; // ND cote cigare
    return cigarSignatures.indexOf(clientSig) !== -1 ? weight : 0;
  }

  /**
   * client : { families:[f1,f2], power, intensity, durationWindow,
   *            spice, sweet, signature }
   * cigar  : { cigarId, sku, famille1, famille2, famille3, puissance,
   *            intensite, spice, sweet, signatures:[...], dureeMin, dureeMax }
   * Retourne { total, decomposition:{famille,intensite,puissance,duree,affinage},
   *            dataConfidence:"n/3" }
   */
  function scoreCandidate(client, cigar) {
    var famille = familyScore(client.families, cigar);
    var intensite = gapScore16(client.intensity, cigar.intensite);
    var puissance = gapScore16(client.power, cigar.puissance);
    var duree = durationScore(client.durationWindow, cigar, 12);

    var spiceRawND = isND(client.spice) || isND(cigar.spice);
    var sweetRawND = isND(client.sweet) || isND(cigar.sweet);
    var sigRawND = isND(client.signature) || !cigar.signatures || cigar.signatures.length === 0;

    var spice = gapScore2(client.spice, cigar.spice);
    var sweet = gapScore2(client.sweet, cigar.sweet);
    var signature = signatureScore(client.signature, cigar.signatures, 2);

    var affinage = spice + sweet + signature;
    var known = (spiceRawND ? 0 : 1) + (sweetRawND ? 0 : 1) + (sigRawND ? 0 : 1);

    var total = famille + intensite + puissance + duree + affinage;

    return {
      total: Math.round(total * 100) / 100,
      decomposition: {
        famille: famille,
        intensite: intensite,
        puissance: puissance,
        duree: duree,
        affinage: Math.round(affinage * 100) / 100
      },
      dataConfidence: known + '/3'
    };
  }

  /**
   * Calcule le score pour tous les candidats et retourne triee
   * decroissant (score total).
   */
  function rankCandidates(client, cigars) {
    var results = cigars.map(function (cigar) {
      var r = scoreCandidate(client, cigar);
      return {
        cigarId: cigar.cigarId,
        sku: cigar.sku,
        score: r.total,
        decomposition: r.decomposition,
        dataConfidence: r.dataConfidence
      };
    });
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  return {
    isND: isND,
    familyScore: familyScore,
    gapScore16: gapScore16,
    gapScore2: gapScore2,
    durationScore: durationScore,
    signatureScore: signatureScore,
    scoreCandidate: scoreCandidate,
    rankCandidates: rankCandidates
  };
});
