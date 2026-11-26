import apiService from "@/services/apiService";
import { calculateDiscountedPrice } from "@/utils/priceCalculator";

export const strengths = ["Léger", "Léger à moyen", "Moyen", "Moyen à corsé", "Corsé"];
const calibres = [
  ["S", "S · moins de 50", 49], ["M", "M · 50 à 52", 52], ["L", "L · 53 à 56", 56],
  ["XL", "XL · 57 à 60", 60], ["XXL", "XXL · plus de 60", Infinity],
];
const budgets = [
  ["moins8", "Moins de 8 000 FCFA", 7999], ["jusque10000", "8 000 à 10 000 FCFA", 10000],
  ["jusque12000", "10 001 à 12 000 FCFA", 12000], ["jusque14000", "12 001 à 14 000 FCFA", 14000],
  ["jusque16000", "14 001 à 16 000 FCFA", 16000], ["plus16", "Plus de 16 000 FCFA", Infinity],
];

export const publicProduct = (product) => product.inCatalogue !== false;
export const isBundle = (product) => product.type === "bundle";
export const productPath = (sku) => `/produit/${encodeURIComponent(sku)}`;
const fr = (left, right) => left.localeCompare(right, "fr", { sensitivity: "base" });
const clean = (value) => String(value ?? "").trim();
const searchText = (value) => clean(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const count = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

export function productName(product) {
  const line = clean(product.ligne);
  const variant = clean(product.modele || product.vitole);
  return isBundle(product) || !variant || searchText(line).endsWith(searchText(variant))
    ? line || variant
    : [line, variant].filter(Boolean).join(" ");
}

export function productPhotos(product) {
  const packSize = Number(product.quantitePack || product.typePack);
  const packImage = packSize === 4 ? product.imagePack4 : packSize === 5 ? product.imagePack5 : null;
  return {
    principale: product.imagePrincipale || product.imageBoite || product.imageSolo,
    solo: product.imageSolo,
    pack: packImage || product.imagePack,
    boite: product.imageBoite,
  };
}

export function stockLabel(product) {
  if (!product || !publicProduct(product)) return "Référence indisponible";
  switch (product.availabilityStatus) {
    case "IN_STOCK": return "";
    case "SOLD_OUT": return "Rupture de stock";
    case "COMING_SOON": return "À venir";
    default: return "Disponibilité à confirmer";
  }
}

export function purchaseOptions(product) {
  if (stockLabel(product)) return [];
  const promos = product.promotions;
  const photos = productPhotos(product);
  if (isBundle(product)) {
    const base = Number(product.prixUnitaire || product.prixBundle);
    if (!positive(base)) return [];
    const promotion = promos?.bundle?.actif ? promos.bundle : promos?.unitaire?.actif ? promos.unitaire : null;
    const price = calculateDiscountedPrice(base, promotion?.pourcentage);
    return positive(price)
      ? [{ id: "bundle", label: "Assortiment", pieces: Number(product.qteBoite || product.quantiteBoite),
          base, price, image: photos.boite || photos.principale }]
      : [];
  }
  const formats = [
    { id: "pack", label: "Pack", pieces: Number(product.quantitePack || product.typePack),
      price: Number(product.prixPack), image: photos.pack },
    { id: "boite", label: "Boîte", pieces: Number(product.qteBoite || product.quantiteBoite),
      price: Number(product.prixBoite), image: photos.boite },
  ];
  return formats.filter(({ price, pieces }) => positive(price) && count(pieces))
    .map((format) => {
      const promotion = promos?.[format.id];
      const reference = Number(product.prixUnitaire) * format.pieces;
      const showReference = promotion?.actif && Number(promotion.prixPromo) === format.price
        && positive(reference) && reference > format.price;
      return { ...format, base: showReference ? reference : format.price };
    });
}

const fresh = (signal) => ({
  cache: "no-store",
  signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
});

function isProduct(value) {
  return typeof value?.sku === "string" && value.sku.length > 0;
}

export async function loadCatalogue(signal) {
  const products = await apiService.getAllProducts(fresh(signal));
  if (!Array.isArray(products) || !products.every(isProduct)) throw new Error("Catalogue invalide");
  return products.filter(publicProduct);
}

export async function loadProduct(sku, signal) {
  try {
    const result = await apiService.getProduct(sku, fresh(signal));
    const product = result?.product ?? result;
    if (!isProduct(product) || product.sku.toUpperCase() !== sku) throw new Error("Référence invalide");
    return publicProduct(product) ? product : null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export function filterChoices(products) {
  const distinct = (values) => [...new Set(values.map(clean).filter(Boolean))].sort(fr)
    .map((value) => [value, value]);
  return [
    ["format", "Format du cigare", distinct(products.filter((p) => !isBundle(p)).map((p) => p.format))],
    ["calibre", "Calibre", calibres],
    ["force", "Puissance", strengths.map((label, index) => [String(index + 1), label])],
    ["budget", "Budget par cigare", budgets],
    ["pays", "Pays d’origine", distinct(products.map((p) => p.pays || p.origine))],
    ["marque", "Initiale de la marque", distinct(products.map((p) => clean(p.marque)[0]?.toUpperCase()))],
  ];
}

export function filterProducts(products, params) {
  const terms = searchText(params.get("q")).split(/\s+/).filter(Boolean);
  const matches = (key, value) => !params.has(key) || params.get(key) === String(value);
  const matchesBand = (key, value, bands) => !params.has(key) ||
    positive(value) && matches(key, bands.find((band) => Number(value) <= band[2])?.[0]);
  return products.filter((p) => {
    if (params.get("filtre") === "assortiments" && !isBundle(p)) return false;
    if (!matches("format", isBundle(p) ? "" : clean(p.format))) return false;
    if (!matches("force", p.puissance) || !matches("pays", clean(p.pays || p.origine))) return false;
    if (!matches("marque", clean(p.marque)[0]?.toUpperCase())) return false;
    const ring = p.ringGauge || p.format?.match(/[×x]\s*(\d+)$/i)?.[1] || p.vitole?.match(/[×x]\s*(\d+)\)/i)?.[1];
    if (!matchesBand("calibre", ring, calibres) || !matchesBand("budget", p.prixUnitaire, budgets)) return false;
    const text = searchText([p.sku, p.marque, p.ligne, p.modele, p.origine, p.pays,
      p.vitole, p.format, p.dimensions, p.dimensionsMM].join(" "));
    return terms.every((term) => text.includes(term));
  }).sort((a, b) => fr(clean(a.marque), clean(b.marque)));
}
