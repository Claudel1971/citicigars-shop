export const productionRelease = import.meta.env.VITE_STOREFRONT_RELEASE === "1";
export const dnaUrl = import.meta.env.VITE_STOREFRONT_DNA_URL || "/dna/";

export function blackFridayOpen(now = new Date()) {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return date >= "2026-11-26" && date <= "2026-11-30";
}
