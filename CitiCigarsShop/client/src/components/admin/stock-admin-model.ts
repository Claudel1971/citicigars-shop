export type StockAdminMovementType =
  | "RECEPTION" | "MISE_EN_DEPOT" | "RETOUR_DE_DEPOT"
  | "RESERVATION_CLIENT" | "LIBERATION_RESERVATION_CLIENT"
  | "RESERVATION_EVENEMENT" | "SORTIE_EVENEMENT" | "RETOUR_EVENEMENT"
  | "CORRECTION_INVENTAIRE";

export interface StockOperationDefinition {
  value: StockAdminMovementType;
  label: string;
  source?: boolean;
  destination?: boolean;
  correction?: boolean;
}

export const STOCK_ADMIN_OPERATIONS: readonly StockOperationDefinition[] = [
  { value: "RECEPTION", label: "Réception", destination: true },
  { value: "MISE_EN_DEPOT", label: "Mise en dépôt", source: true, destination: true },
  { value: "RETOUR_DE_DEPOT", label: "Retour de dépôt", source: true, destination: true },
  { value: "RESERVATION_CLIENT", label: "Réservation client", source: true },
  { value: "LIBERATION_RESERVATION_CLIENT", label: "Libération réservation client", source: true },
  { value: "RESERVATION_EVENEMENT", label: "Réservation événement", source: true },
  { value: "SORTIE_EVENEMENT", label: "Sortie événement", source: true, destination: true },
  { value: "RETOUR_EVENEMENT", label: "Retour événement", source: true, destination: true },
  { value: "CORRECTION_INVENTAIRE", label: "Correction inventaire", source: true, correction: true },
];

export interface MovementDraft {
  movementType: StockAdminMovementType;
  qty: string | number;
  sourceLocationId?: string;
  destinationLocationId?: string;
  author?: string;
  motif?: string;
}

export function operationDefinition(type: StockAdminMovementType): StockOperationDefinition {
  return STOCK_ADMIN_OPERATIONS.find((operation) => operation.value === type)!;
}

export function validateMovementDraft(draft: MovementDraft): string[] {
  const operation = operationDefinition(draft.movementType);
  const qty = Number(draft.qty);
  const errors: string[] = [];
  if (!Number.isInteger(qty) || qty < 0 || (!operation.correction && qty < 1)) errors.push("Quantité invalide.");
  if (!draft.author?.trim()) errors.push("Auteur requis.");
  if (operation.source && !draft.sourceLocationId) errors.push("Lieu source requis.");
  if (operation.destination && !draft.destinationLocationId) errors.push("Lieu destination requis.");
  if (operation.source && operation.destination && draft.sourceLocationId === draft.destinationLocationId) errors.push("La source et la destination doivent être distinctes.");
  if (operation.correction && !draft.motif?.trim()) errors.push("Motif obligatoire pour une correction d’inventaire.");
  return errors;
}

export function stockIdentityLabel(identity: { sku: string; type: string; packSize: number } | null) {
  if (!identity) return "Aucune position matérialisée";
  return `${identity.sku} · ${identity.type}${identity.type === "Pack" ? ` ${identity.packSize}` : ""}`;
}

export function locationLabel(location: { code?: string | null; name?: string | null } | null | undefined) {
  if (!location) return "Externe / non renseigné";
  if (location.code === "LEGACY_UNKNOWN") return "Legacy / provenance inconnue (LEGACY_UNKNOWN)";
  return `${location.code || "—"}${location.name ? ` — ${location.name}` : ""}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  insufficient_eligible_lot_stock: "Stock insuffisant dans les lots éligibles du lieu sélectionné.",
  insufficient_availability_for_reservation_client: "Stock disponible insuffisant pour cette réservation client.",
  insufficient_availability_for_reservation_evenement: "Stock disponible insuffisant pour cette réservation événement.",
  negative_reservedClient: "La quantité libérée dépasse la réservation client existante.",
  negative_reservedEvent: "La quantité libérée dépasse la réservation événement existante.",
  negative_deposit: "La quantité retournée dépasse le stock actuellement en dépôt sur ce lieu.",
  negative_atEvent: "La quantité retournée dépasse le stock actuellement présent à l’événement.",
  insufficient_reserved_client: "La quantité dépasse la réservation client existante.",
  sortie_evenement_exceeds_reservedEvent: "La sortie dépasse la quantité réservée pour cet événement.",
  sortie_evenement_exceeds_onHand: "La sortie dépasse le stock physique disponible au lieu source.",
  destination_location_required: "Un lieu destination est obligatoire.",
  source_location_required: "Un lieu source est obligatoire.",
  location_required: "Un lieu physique est obligatoire.",
  physical_transfer_requires_distinct_locations: "La source et la destination doivent être distinctes.",
  stock_location_not_found: "Lieu de stock inconnu.",
  invalid_pack_size_for_stock_type: "Taille de pack incompatible avec le type de stock.",
  pack_size_sentinel_violation: "Taille de pack incompatible avec le type de stock.",
  provenance_lot_not_found: "Lot de provenance inconnu.",
  receipt_lot_identity_mismatch: "Ce lot de réception ne correspond pas à l’identité ou au lieu sélectionné.",
  stock_concurrency_conflict: "Le stock a changé simultanément. Rechargez puis réessayez.",
  stock_traceability_inconsistent: "Les projections de stock ne se réconcilient pas. Toute opération doit être suspendue.",
  sku_not_found: "SKU inconnu.",
};

export function operationalErrorMessage(code: string | undefined, fallback?: string) {
  return (code && ERROR_MESSAGES[code]) || fallback || code || "Opération impossible.";
}

export function operationQuantity(operation: { details?: Array<{ qtyDelta?: number }> }) {
  return Math.max(0, ...(operation.details || []).map((detail) => Math.abs(Number(detail.qtyDelta) || 0)));
}

export async function submitMovementAndRefresh<T>(
  submit: () => Promise<T>,
  refresh: () => Promise<unknown>,
) {
  const result = await submit();
  await refresh();
  return result;
}
