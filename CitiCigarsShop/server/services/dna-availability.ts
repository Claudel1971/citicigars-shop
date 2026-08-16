export type DnaLiveAvailability = {
  packAvailable: boolean;
  boxAvailable: boolean;
};

export type DnaAvailabilityBalance = {
  sku: string;
  type: string;
  onHandQty: number;
  reservedClientQty: number;
  reservedEventQty: number;
};

export const isCommerciallyAvailable = (row: DnaAvailabilityBalance): boolean =>
  (row.type === "Pack" || row.type === "Box") &&
  Math.max(0, row.onHandQty - row.reservedClientQty - row.reservedEventQty) > 0;

export const capturedAtStepForMode = (mode: "normal" | "zero"):
  "STEP4_WITH_RESULTS" | "STEP6_ZERO_CASE" =>
  mode === "zero" ? "STEP6_ZERO_CASE" : "STEP4_WITH_RESULTS";

export function resolveDnaAvailability(
  cigarIds: string[],
  knownCigarIds: Iterable<string>,
  skuByCigarId: ReadonlyMap<string, string>,
  balanceRows: readonly DnaAvailabilityBalance[],
): { resolved: Record<string, DnaLiveAvailability>; unresolved: string[] } {
  const uniqueIds = Array.from(new Set(cigarIds));
  const knownIds = new Set(knownCigarIds);
  const unresolved = uniqueIds.filter((id) => !knownIds.has(id));
  const resolved: Record<string, DnaLiveAvailability> = {};

  for (const id of uniqueIds) {
    if (!knownIds.has(id)) continue;
    const sku = skuByCigarId.get(id);
    if (!sku) {
      resolved[id] = { packAvailable: false, boxAvailable: false };
      continue;
    }

    const rows = balanceRows.filter((row) => row.sku === sku);
    resolved[id] = {
      packAvailable: rows.some((row) => row.type === "Pack" && isCommerciallyAvailable(row)),
      boxAvailable: rows.some((row) => row.type === "Box" && isCommerciallyAvailable(row)),
    };
  }

  return { resolved, unresolved };
}
