(function exposeCitiCigarsDimensionFormatter(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CitiCigarsDimensionFormatter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFormatter() {
  const fractionGlyphs = {
    "1/2": "½",
    "1/4": "¼",
    "3/4": "¾",
    "1/8": "⅛",
    "3/8": "⅜",
    "5/8": "⅝",
    "7/8": "⅞",
  };

  function formatCigarDimensions(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .trim()
      .replace(
        /(^|[^\d])(?:(\d+)\s+)?(1\/2|1\/4|3\/4|1\/8|3\/8|5\/8|7\/8)(?=$|[^\d])/g,
        (match, prefix, whole, fraction) =>
          `${prefix}${whole || ""}${fractionGlyphs[fraction]}`,
      )
      .replace(/\s+\?{2}\s+(?=\d)/g, " × ")
      .replace(/(\d|[½¼¾⅛⅜⅝⅞])\s*[xX×]\s*(?=\d)/g, "$1 × ")
      .replace(/\s{2,}/g, " ");
  }

  return { formatCigarDimensions };
});
