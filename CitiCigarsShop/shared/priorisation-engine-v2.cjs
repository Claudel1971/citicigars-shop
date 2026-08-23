/**
 * CitiCigars DNA Curator V2 -- mecanique de priorisation commerciale.
 * Port fidele du moteur Python code et teste cette nuit -- memes garde-fous.
 *
 * Pipeline, ordre exact :
 *  1. Score DNA (dna-engine-v2.cjs) -- jamais modifie par cette fonction.
 *  2. Filtre stock > 0 -- fait en amont, avant l'appel.
 *  3. Meilleur score DNA de la population filtree.
 *  4. Zone = score >= meilleur_score - window (retenu : 5).
 *  5. Dans la zone SEULEMENT :
 *       a. "effectivement actif" d'abord (voir isEffectivelyActive) ;
 *       b. priority_level croissant -- 1 = priorite la plus forte ;
 *       c. score DNA decroissant ;
 *       d. Rating CA decroissant (uniquement entre candidats actifs) ;
 *       e. ordre stable d'origine si tout egal.
 *  6. Hors zone : ordre DNA strictement conserve.
 *  7. Troncature Top 5 a l'affichage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CitiCigarsPriorisationEngineV2 = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      var d = new Date(value + 'T00:00:00Z');
      if (isNaN(d.getTime())) throw new Error('Format de date non reconnu : ' + value);
      return d;
    }
    throw new Error('Format de date non reconnu : ' + value);
  }

  /**
   * Une ligne Priorisation n'est effectivement active que si TOUTES ces
   * conditions sont vraies :
   *  - active === true
   *  - priority_level est un entier valide (pas null/undefined) -- une
   *    ligne active=true sans priority_level est une configuration
   *    invalide, traitee comme non-active plutot que de passer devant
   *    tout le monde par accident.
   *  - valid_from <= today (ou absent = toujours demarree)
   *  - today <= valid_to (ou absent = pas de date de fin)
   */
  function isEffectivelyActive(pri, today) {
    if (!pri || !pri.active) return false;
    if (pri.priority_level === null || pri.priority_level === undefined) return false;

    var validFrom = parseDate(pri.valid_from);
    var validTo = parseDate(pri.valid_to);

    if (validFrom !== null && today < validFrom) return false;
    if (validTo !== null && today > validTo) return false;

    return true;
  }

  /**
   * dnaRanked : tableau [{cigarId, sku, score}, ...] DEJA trie par score
   *   DNA decroissant (etapes 1-3 deja faites en amont, y compris
   *   l'exclusion des SKU "Reserve - activation" du filtre stock>0).
   * priorityTable : objet { sku: {active, priority_level, valid_from,
   *   valid_to} }. Vide par defaut tant qu'aucune decision commerciale
   *   n'est prise -- jamais rempli ici.
   * window : ecart maximal sous le meilleur score (retenu : 5).
   * caRatingBySku : objet { sku: rating } optionnel.
   * today : Date de reference (par defaut new Date()), injectable pour
   *   les tests et la reproductibilite.
   */
  function applyCommercialPriority(dnaRanked, priorityTable, options) {
    options = options || {};
    var window = options.window !== undefined ? options.window : 5;
    var caRatingBySku = options.caRatingBySku || null;
    var today = options.today || new Date();

    if (!dnaRanked || dnaRanked.length === 0) return [];

    var bestScore = dnaRanked[0].score;
    var zone = [];
    var horsZone = [];
    for (var i = 0; i < dnaRanked.length; i++) {
      if (dnaRanked[i].score >= bestScore - window) zone.push(dnaRanked[i]);
      else horsZone.push(dnaRanked[i]);
    }

    // Indices d'origine pour garantir un tri STABLE (tie-break final :
    // ordre deja trie par score DNA preserve si tout le reste est egal).
    var zoneIndexed = zone.map(function (item, idx) { return { item: item, idx: idx }; });

    zoneIndexed.sort(function (A, B) {
      var priA = priorityTable[A.item.sku];
      var priB = priorityTable[B.item.sku];
      var activeA = isEffectivelyActive(priA, today);
      var activeB = isEffectivelyActive(priB, today);

      if (activeA !== activeB) return activeA ? -1 : 1; // actifs d'abord

      var levelA = activeA ? priA.priority_level : Infinity;
      var levelB = activeB ? priB.priority_level : Infinity;
      if (levelA !== levelB) return levelA - levelB; // 1 avant 2 avant ... avant Infinity

      if (A.item.score !== B.item.score) return B.item.score - A.item.score; // score desc

      // Rating CA -- uniquement entre candidats effectivement actifs
      var ratingA = (activeA && caRatingBySku) ? caRatingBySku[A.item.cigarId] : undefined;
      var ratingB = (activeB && caRatingBySku) ? caRatingBySku[B.item.cigarId] : undefined;
      var rkA = (activeA && ratingA !== undefined) ? -ratingA : 0;
      var rkB = (activeB && ratingB !== undefined) ? -ratingB : 0;
      if (rkA !== rkB) return rkA - rkB;

      return A.idx - B.idx; // ordre stable d'origine
    });

    var zoneSorted = zoneIndexed.map(function (x) { return x.item; });
    var final = zoneSorted.concat(horsZone);
    return final.slice(0, 5);
  }

  return {
    isEffectivelyActive: isEffectivelyActive,
    applyCommercialPriority: applyCommercialPriority,
    parseDate: parseDate
  };
});
