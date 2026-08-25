// Logique pure de traitement des mouvements Stock Central (schéma diff V2 + amendements).
// Aucune dépendance DB ici volontairement : ces fonctions sont testables sans MySQL,
// et server/storage.stock.ts les enveloppe dans de vraies transactions Drizzle.

import type { MovementType } from "../../shared/schema.stock";

export type BalanceField = "onHand" | "reservedClient" | "reservedEvent" | "atEvent" | "deposit" | "transit";
export type StockType = "Box" | "Pack" | "Loose" | "Accessory";

export type Balance = Record<BalanceField, number>;

export const ZERO_BALANCE: Balance = {
  onHand: 0,
  reservedClient: 0,
  reservedEvent: 0,
  atEvent: 0,
  deposit: 0,
  transit: 0,
};

export function sumBalances(balances: readonly Balance[]): Balance {
  return balances.reduce<Balance>((sum, balance) => ({
    onHand: sum.onHand + balance.onHand,
    reservedClient: sum.reservedClient + balance.reservedClient,
    reservedEvent: sum.reservedEvent + balance.reservedEvent,
    atEvent: sum.atEvent + balance.atEvent,
    deposit: sum.deposit + balance.deposit,
    transit: sum.transit + balance.transit,
  }), { ...ZERO_BALANCE });
}

export function assertLocationProjectionMatches(aggregate: Balance, locationBalances: readonly Balance[]): void {
  const projected = sumBalances(locationBalances);
  for (const field of Object.keys(ZERO_BALANCE) as BalanceField[]) {
    if (projected[field] !== aggregate[field]) {
      throw new StockRuleViolation(
        "location_projection_mismatch",
        `${field}: aggregate=${aggregate[field]}, locations=${projected[field]}`,
      );
    }
  }
}

export function legacyUnknownEndpointsForMovement(movementType: MovementType, unknownLocationId: string) {
  if (movementType === "RECEPTION" || movementType === "ENTREE_TRANSIT") {
    return { sourceLocationId: null, destinationLocationId: unknownLocationId };
  }
  if (["VENTE", "CADEAU", "ECHANTILLON", "PERTE_CASSE"].includes(movementType)) {
    return { sourceLocationId: unknownLocationId, destinationLocationId: null };
  }
  return { sourceLocationId: unknownLocationId, destinationLocationId: unknownLocationId };
}

export class StockRuleViolation extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
    this.name = "StockRuleViolation";
  }
}

// Amendement 3 : availableNow plafonné à 0, le déficit exposé séparément, jamais mélangé.
export function computeAvailability(b: Balance): { availableNow: number; reservationDeficit: number } {
  const raw = b.onHand - b.reservedClient - b.reservedEvent;
  return {
    availableNow: Math.max(0, raw),
    reservationDeficit: Math.max(0, -raw),
  };
}

// Correction 7 : total physique Loose = onHand + deposit + atEvent, transit exclu.
export function looseTotal(b: Balance): number {
  return b.onHand + b.deposit + b.atEvent;
}

// Correction 2 : décision retenue = Loose interdit en transit (plus simple que l'inclure dans le total).
export function assertLooseNeverInTransit(type: StockType, field: BalanceField, delta: number) {
  if (type === "Loose" && field === "transit" && delta !== 0) {
    throw new StockRuleViolation("loose_forbidden_in_transit", "Le Loose ne peut jamais transiter par le bucket transit.");
  }
}

// Correction 2 (packSize entre dans la clé physique) : sentinelle 0 hors Pack, >0 pour Pack.
export function assertPackSizeSentinel(type: StockType, packSize: number) {
  if (type === "Pack" ? packSize <= 0 : packSize !== 0) {
    throw new StockRuleViolation("pack_size_sentinel_violation", `packSize=${packSize} invalide pour type=${type}`);
  }
}

export interface Effect {
  balanceField: BalanceField;
  delta: number;
}

export function applyEffect(balance: Balance, effect: Effect): { balance: Balance; qtyBefore: number; qtyAfter: number } {
  const qtyBefore = balance[effect.balanceField];
  const qtyAfter = qtyBefore + effect.delta;
  if (qtyAfter < 0) {
    throw new StockRuleViolation(`negative_${effect.balanceField}`, `${effect.balanceField} deviendrait négatif`);
  }
  return { balance: { ...balance, [effect.balanceField]: qtyAfter }, qtyBefore, qtyAfter };
}

export function applyEffects(balance: Balance, effects: Effect[]): Balance {
  let current = balance;
  for (const e of effects) {
    current = applyEffect(current, e).balance;
  }
  return current;
}

// --- Constructeurs d'effets par movementType (tableau §4.c du diff, corrigé) ---

export function effectsForReception(qty: number): Effect[] {
  // Correction 11 : RECEPTION signifie toujours "arrivé chez CitiCigars" -> onHand uniquement.
  return [{ balanceField: "onHand", delta: qty }];
}

export function effectsForMiseEnDepot(qty: number): Effect[] {
  return [
    { balanceField: "onHand", delta: -qty },
    { balanceField: "deposit", delta: qty },
  ];
}

export function effectsForRetourDeDepot(qty: number): Effect[] {
  return [
    { balanceField: "deposit", delta: -qty },
    { balanceField: "onHand", delta: qty },
  ];
}

export function effectsForReservationClient(qty: number, balance: Balance): Effect[] {
  const { availableNow } = computeAvailability(balance);
  if (qty > availableNow) throw new StockRuleViolation("insufficient_availability_for_reservation_client");
  return [{ balanceField: "reservedClient", delta: qty }];
}

export function effectsForLiberationReservationClient(qty: number): Effect[] {
  return [{ balanceField: "reservedClient", delta: -qty }];
}

export function effectsForReservationEvenement(qty: number, balance: Balance): Effect[] {
  const { availableNow } = computeAvailability(balance);
  if (qty > availableNow) throw new StockRuleViolation("insufficient_availability_for_reservation_evenement");
  return [{ balanceField: "reservedEvent", delta: qty }];
}

export function effectsForLiberationReservationEvenement(qty: number): Effect[] {
  return [{ balanceField: "reservedEvent", delta: -qty }];
}

// Amendement 6 : vente référencée décrémente onHand ET reservedClient ensemble ; vente directe, onHand seul.
// Correction (audit) : une vente qui référence une réservation existante ne doit
// JAMAIS être jugée sur availableNow (= onHand-reservedClient-reservedEvent, qui
// vaut 0 dès que tout onHand est déjà réservé) — sinon on bloque à tort la vente
// qui concrétise exactement cette réservation. Le bon contrôle pour ce cas précis :
// la quantité doit être couverte par reservedClient ET par onHand, indépendamment.
export function effectsForVente(qty: number, balance: Balance, withReservation: boolean): Effect[] {
  if (withReservation) {
    if (qty > balance.reservedClient) throw new StockRuleViolation("insufficient_reserved_for_vente");
    if (qty > balance.onHand) throw new StockRuleViolation("insufficient_onhand_for_vente");
    return [
      { balanceField: "onHand", delta: -qty },
      { balanceField: "reservedClient", delta: -qty },
    ];
  }
  const { availableNow } = computeAvailability(balance);
  if (qty > availableNow) throw new StockRuleViolation("insufficient_availability_for_vente");
  return [{ balanceField: "onHand", delta: -qty }];
}

// Correction 4 : sourceBalanceField paramétrable (onHand ou atEvent) pour la Box consommée.
export function effectsForSortieEvenement(qty: number, balance: Balance): Effect[] {
  if (qty > balance.reservedEvent) throw new StockRuleViolation("sortie_evenement_exceeds_reservedEvent");
  if (qty > balance.onHand) throw new StockRuleViolation("sortie_evenement_exceeds_onHand");
  return [
    { balanceField: "onHand", delta: -qty },
    { balanceField: "reservedEvent", delta: -qty },
    { balanceField: "atEvent", delta: qty },
  ];
}

export function effectsForRetourEvenement(qty: number): Effect[] {
  return [
    { balanceField: "atEvent", delta: -qty },
    { balanceField: "onHand", delta: qty },
  ];
}

// CADEAU/ECHANTILLON : consommation volontaire, ne doit jamais empiéter sur du stock réservé.
export function effectsForCadeauEchantillon(qty: number, balance: Balance): Effect[] {
  const { availableNow } = computeAvailability(balance);
  if (qty > availableNow) throw new StockRuleViolation("insufficient_availability");
  return [{ balanceField: "onHand", delta: -qty }];
}

// PERTE_CASSE (point 5, audit) : une perte/casse physique est un constat, pas un choix.
// Elle doit pouvoir être enregistrée dès que la quantité physique onHand le permet,
// même si elle crée ensuite un déficit de réservation (symétrique à l'amendement 8
// pour CORRECTION_INVENTAIRE) — contrairement à CADEAU/ECHANTILLON qui restent bornés
// par availableNow puisqu'il s'agit là d'une consommation volontaire évitable.
export function effectsForPerteCasse(qty: number, balance: Balance): Effect[] {
  if (qty > balance.onHand) throw new StockRuleViolation("insufficient_onhand_for_perte_casse");
  return [{ balanceField: "onHand", delta: -qty }];
}

// Amendement 8 : jamais bloquée, même si elle crée un déficit de réservation visible ensuite.
export function effectsForCorrectionInventaire(countedQty: number, balance: Balance): Effect[] {
  const delta = countedQty - balance.onHand;
  return [{ balanceField: "onHand", delta }];
}

export function effectsForEntreeTransit(qty: number): Effect[] {
  return [{ balanceField: "transit", delta: qty }];
}

export function effectsForReceptionTransit(qty: number): Effect[] {
  return [
    { balanceField: "transit", delta: -qty },
    { balanceField: "onHand", delta: qty },
  ];
}

// --- OUVERTURE_BOITE : validation dédiée (orchestration multi-lignes faite par storage.stock.ts) ---

export interface PackDistribution {
  packSize: number;
  packQty: number;
}

export interface OuvertureBoitePlan {
  cigarsPerBox: number;
  allowedPackSizes: number[]; // pack_size_config actif pour ce SKU
  distribution: PackDistribution[];
  looseQty: number;
  otherExplicitQty?: number;
  sourceBalanceField: "onHand" | "atEvent"; // correction 4
  currentLooseTotalInSourceBucket: number; // total physique Loose AVANT l'opération, même bucket que la source
}

export function planOuvertureBoite(plan: OuvertureBoitePlan): void {
  if (plan.cigarsPerBox == null) {
    throw new StockRuleViolation("cigars_per_box_not_configured");
  }
  // Point 2 (audit) : une distribution dangereuse doit être rejetée ICI, avant
  // d'atteindre storage.stock.ts — pas seulement documentée comme risquée.
  // Un packSize dupliqué écraserait silencieusement une des deux quantités
  // lors de l'écriture (une seule ligne stock_balances par packSize) ; un
  // packQty<=0 ou une quantité négative pourrait compenser artificiellement
  // le total attendu sans représenter un état physique réel.
  const seenPackSizes = new Set<number>();
  for (const d of plan.distribution) {
    if (seenPackSizes.has(d.packSize)) {
      throw new StockRuleViolation("ouverture_boite_duplicate_pack_size", `packSize=${d.packSize} apparaît plusieurs fois dans la distribution`);
    }
    seenPackSizes.add(d.packSize);
    if (d.packQty <= 0) {
      throw new StockRuleViolation("ouverture_boite_invalid_pack_qty", `packQty=${d.packQty} doit être > 0 pour packSize=${d.packSize}`);
    }
    if (!plan.allowedPackSizes.includes(d.packSize)) {
      throw new StockRuleViolation("pack_size_not_configured", `packSize=${d.packSize} non configuré/actif pour ce SKU`);
    }
  }
  if (plan.looseQty < 0) {
    throw new StockRuleViolation("ouverture_boite_invalid_loose_qty", `looseQty=${plan.looseQty} ne peut pas être négatif`);
  }
  if ((plan.otherExplicitQty ?? 0) < 0) {
    throw new StockRuleViolation("ouverture_boite_invalid_other_qty", `otherExplicitQty=${plan.otherExplicitQty} ne peut pas être négatif`);
  }
  const distributedInPacks = plan.distribution.reduce((t, d) => t + d.packSize * d.packQty, 0);
  const total = distributedInPacks + plan.looseQty + (plan.otherExplicitQty || 0);
  if (total !== plan.cigarsPerBox) {
    throw new StockRuleViolation(
      "ouverture_boite_distribution_mismatch",
      `Distribution=${total} != cigarsPerBox=${plan.cigarsPerBox}`,
    );
  }
  const newLooseTotal = plan.currentLooseTotalInSourceBucket + plan.looseQty;
  if (newLooseTotal > 4) {
    throw new StockRuleViolation("loose_max_4_exceeded", `Solde Loose final=${newLooseTotal} > 4`);
  }
}

export function effectsForOuvertureBoiteSource(qty: number, sourceBalanceField: "onHand" | "atEvent", balance: Balance): Effect[] {
  if (qty > balance[sourceBalanceField]) {
    throw new StockRuleViolation("ouverture_boite_insufficient_box_source");
  }
  return [{ balanceField: sourceBalanceField, delta: -qty }];
}

export function effectsForOuvertureBoiteDestination(qty: number, sourceBalanceField: "onHand" | "atEvent"): Effect[] {
  // Les Packs/Loose créés atterrissent dans le MÊME bucket que la Box consommée (correction 4).
  return [{ balanceField: sourceBalanceField, delta: qty }];
}
