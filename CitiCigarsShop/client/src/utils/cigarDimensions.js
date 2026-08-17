import { catalogueData } from "@/data/catalogueData";

const displayDimensionsBySku = new Map(
  catalogueData.map((product) => [String(product.sku).toUpperCase(), product.format]),
);

export const formatCigarDimensions =
  globalThis.CitiCigarsDimensionFormatter.formatCigarDimensions;

export function getProductDisplayDimensions(product) {
  if (!product) return "";

  const catalogDisplayValue = displayDimensionsBySku.get(
    String(product.sku || "").toUpperCase(),
  );
  const sourceValue =
    catalogDisplayValue ||
    product.dimensions ||
    (product.longueur && product.ringGauge
      ? `${product.longueur} x ${product.ringGauge}`
      : "");

  return formatCigarDimensions(sourceValue);
}
