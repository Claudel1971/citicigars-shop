/**
 * CitiCigars DNA Curator V2 -- normalisation des dimensions de cigare
 * saisies librement (option "Autre" du Bloc 3).
 *
 * Accepte : virgule/point decimal, x/X/×, espaces variables, fractions
 * 1/8 1/4 3/8 1/2 5/8 3/4 7/8, equivalents decimaux raisonnables.
 * Normalise vers : ⅛ ¼ ⅜ ½ ⅝ ¾ ⅞ (longueur) x ring gauge entier.
 * Ne devine/n'invente JAMAIS une valeur non parseable -- retourne null
 * plutot que d'inventer.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CitiCigarsDimensionNormalizerV2 = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FRACTION_UNICODE = {
    '0.125': '⅛', '0.25': '¼', '0.375': '⅜', '0.5': '½',
    '0.625': '⅝', '0.75': '¾', '0.875': '⅞'
  };
  var FRACTION_TOLERANCE = 0.02; // tolerance pour les equivalents decimaux "raisonnablement exacts"

  var FRACTION_SLASH = {
    '1/8': 0.125, '1/4': 0.25, '3/8': 0.375, '1/2': 0.5,
    '5/8': 0.625, '3/4': 0.75, '7/8': 0.875
  };

  function closestFractionUnicode(decimalPart) {
    var best = null, bestDiff = Infinity;
    for (var key in FRACTION_UNICODE) {
      var diff = Math.abs(parseFloat(key) - decimalPart);
      if (diff < bestDiff) { bestDiff = diff; best = key; }
    }
    if (bestDiff <= FRACTION_TOLERANCE) return FRACTION_UNICODE[best];
    return null; // pas assez proche d'une fraction connue -- ne pas inventer
  }

  /**
   * Parse une longueur en pouces depuis une chaine libre :
   * "6", "6.5", "6,5", "6 1/2", "6-1/2", "6½" -> {whole, fractionDecimal, display}
   * Retourne null si non parseable.
   */
  function parseLength(raw) {
    if (!raw) return null;
    var s = raw.trim();

    // Deja en unicode ? ex "6½"
    var unicodeMatch = s.match(/^(\d+)([⅛¼⅜½⅝¾⅞])?$/);
    if (unicodeMatch) {
      var whole = parseInt(unicodeMatch[1], 10);
      var frac = unicodeMatch[2] || '';
      return { whole: whole, fractionUnicode: frac, display: whole + frac };
    }

    // Fraction avec slash : "6 1/2", "6-1/2", "6 1 / 2"
    var slashMatch = s.match(/^(\d+)\s*[-\s]?\s*(\d\s*\/\s*\d)$/);
    if (slashMatch) {
      var w = parseInt(slashMatch[1], 10);
      var fracKey = slashMatch[2].replace(/\s+/g, '');
      if (FRACTION_SLASH.hasOwnProperty(fracKey)) {
        var fu = FRACTION_UNICODE[String(FRACTION_SLASH[fracKey])];
        return { whole: w, fractionUnicode: fu || '', display: w + (fu || '') };
      }
      return null; // fraction non reconnue -- ne pas inventer
    }

    // Decimal avec virgule ou point : "6.5", "6,5", "5.625"
    var decMatch = s.match(/^(\d+)[.,](\d+)$/);
    if (decMatch) {
      var wholePart = parseInt(decMatch[1], 10);
      var decimalPart = parseFloat('0.' + decMatch[2]);
      if (decimalPart === 0) return { whole: wholePart, fractionUnicode: '', display: String(wholePart) };
      var fu2 = closestFractionUnicode(decimalPart);
      if (fu2 === null) return null; // pas une fraction standard reconnaissable -- ne pas inventer
      return { whole: wholePart, fractionUnicode: fu2, display: wholePart + fu2 };
    }

    // Entier seul
    var intMatch = s.match(/^(\d+)$/);
    if (intMatch) {
      return { whole: parseInt(intMatch[1], 10), fractionUnicode: '', display: intMatch[1] };
    }

    return null; // format non reconnu -- jamais de valeur inventee
  }

  /**
   * Normalise une chaine "dimensions" libre complete, ex :
   * "6,5 x 60", "6.5 X 60", "6 1/2 x 60", "6-1/2 × 60", "6½x60"
   * -> "6½ × 60" (string) ou null si non parseable (jamais d'invention).
   */
  function normalizeDimensions(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var s = raw.trim();

    // Separer sur x/X/× avec espaces variables
    var parts = s.split(/\s*[xX×]\s*/);
    if (parts.length !== 2) return null;

    var lengthPart = parseLength(parts[0].trim());
    if (lengthPart === null) return null;

    var ringMatch = parts[1].trim().match(/^(\d+)$/);
    if (!ringMatch) return null; // ring gauge doit etre un entier, jamais devine
    var ring = parseInt(ringMatch[1], 10);

    return lengthPart.display + ' × ' + ring;
  }

  return {
    parseLength: parseLength,
    normalizeDimensions: normalizeDimensions
  };
});
