// Wrappers transactionnels Drizzle autour de stock-movement-processor.ts (mission V6).
// Toute écriture de solde passe par ici : verrouillage SELECT ... FOR UPDATE
// À L'INTÉRIEUR de la transaction (jamais un simple read-then-write), calcul
// des effets via les fonctions pures déjà testées, mise à jour des balances,
// insertion des lignes stock_movements before/after, rollback intégral sur
// toute erreur (StockRuleViolation ou autre).
//
// Défense en profondeur (audit, point 4) : ce fichier n'exécute JAMAIS
// d'UPDATE ni de DELETE sur stock_movements ou stock_movement_groups — uniquement
// des INSERT. Les triggers d'immutabilité (migrations 0005/0017) l'empêcheraient
// de toute façon, mais l'application ne tente même pas l'opération.

import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db.mysql";
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
import {
  skus,
  cigarCatalog,
  stockBalances,
  stockLocations,
  stockLocationBalances,
  stockLotLocationBalances,
  stockMovementGroups,
  stockMovementLotAllocations,
  stockMovements,
  stockProvenanceLots,
  stockReceiptItems,
  stockReceipts,
  packSizeConfig,
  dnaLeads,
  dnaAvailabilityWatch,
  type StockType,
  type BalanceField,
  type MovementType,
  type ReferenceType,
  type DnaLead,
  type DnaAvailabilityWatch,
  LEGACY_UNKNOWN_LOCATION_ID,
  LEGACY_UNKNOWN_LOT_ID,
} from "../shared/schema.stock";
import { products } from "../shared/schema.mysql";
import {
  Balance,
  ZERO_BALANCE,
  Effect,
  StockRuleViolation,
  applyEffect,
  effectsForReception,
  effectsForMiseEnDepot,
  effectsForRetourDeDepot,
  effectsForReservationClient,
  effectsForLiberationReservationClient,
  effectsForReservationEvenement,
  effectsForLiberationReservationEvenement,
  effectsForVente,
  effectsForSortieEvenement,
  effectsForRetourEvenement,
  effectsForCadeauEchantillon,
  effectsForPerteCasse,
  effectsForCorrectionInventaire,
  effectsForEntreeTransit,
  effectsForReceptionTransit,
  planOuvertureBoite,
  effectsForOuvertureBoiteSource,
  effectsForOuvertureBoiteDestination,
  assertPackSizeSentinel,
  assertLooseNeverInTransit,
  assertLocationProjectionMatches,
  legacyUnknownEndpointsForMovement,
  locationAwareEndpointsForMovement,
  compareLotAllocationCandidates,
  planDeterministicLotAllocation,
  type LotAllocationCandidate,
} from "./services/stock-movement-processor";
import { capturedAtStepForMode, isCommerciallyAvailable } from "./services/dna-availability";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Ordre de verrouillage stable et global (indépendant du mouvement demandé) :
// empêche deux transactions concurrentes de verrouiller les mêmes lignes dans
// un ordre différent (cause classique de deadlock MySQL/MariaDB). Utilisé par
// OUVERTURE_BOITE, qui verrouille plusieurs lignes stock_balances à la fois.
const TYPE_LOCK_RANK: Record<StockType, number> = { Box: 0, Pack: 1, Loose: 2, Accessory: 3 };
function lockOrder(a: { type: StockType; packSize: number }, b: { type: StockType; packSize: number }) {
  const t = TYPE_LOCK_RANK[a.type] - TYPE_LOCK_RANK[b.type];
  if (t !== 0) return t;
  return a.packSize - b.packSize;
}

type BalanceProjectionRow =
  | typeof stockBalances.$inferSelect
  | typeof stockLocationBalances.$inferSelect
  | typeof stockLotLocationBalances.$inferSelect;

function rowToBalance(row: BalanceProjectionRow | undefined): Balance {
  if (!row) return { ...ZERO_BALANCE };
  return {
    onHand: row.onHandQty,
    reservedClient: row.reservedClientQty,
    reservedEvent: row.reservedEventQty,
    atEvent: row.atEventQty,
    deposit: row.depositQty,
    transit: row.transitQty,
  };
}

async function lockOrCreateLocationBalanceRow(tx: Tx, locationId: string, sku: string, type: StockType, packSize: number) {
  assertPackSizeSentinel(type, packSize);
  await tx
    .insert(stockLocationBalances)
    .values({ locationId, sku, type, packSize })
    .onDuplicateKeyUpdate({ set: { locationId: sql`location_id` } });
  const [row] = await tx
    .select()
    .from(stockLocationBalances)
    .where(and(
      eq(stockLocationBalances.locationId, locationId),
      eq(stockLocationBalances.sku, sku),
      eq(stockLocationBalances.type, type),
      eq(stockLocationBalances.packSize, packSize),
    ))
    .for("update");
  return row;
}

async function lockOrCreateLotLocationBalanceRow(
  tx: Tx,
  lotId: string,
  locationId: string,
  sku: string,
  type: StockType,
  packSize: number,
) {
  assertPackSizeSentinel(type, packSize);
  await tx
    .insert(stockLotLocationBalances)
    .values({ lotId, locationId, sku, type, packSize })
    .onDuplicateKeyUpdate({ set: { lotId: sql`lot_id` } });
  const [row] = await tx
    .select()
    .from(stockLotLocationBalances)
    .where(and(
      eq(stockLotLocationBalances.lotId, lotId),
      eq(stockLotLocationBalances.locationId, locationId),
      eq(stockLotLocationBalances.sku, sku),
      eq(stockLotLocationBalances.type, type),
      eq(stockLotLocationBalances.packSize, packSize),
    ))
    .for("update");
  return row;
}

/** Garantit qu'une ligne (sku,type,packSize) existe (upsert no-op si déjà présente) PUIS la verrouille FOR UPDATE. */
async function lockOrCreateBalanceRow(tx: Tx, sku: string, type: StockType, packSize: number) {
  assertPackSizeSentinel(type, packSize);
  await tx
    .insert(stockBalances)
    .values({ sku, type, packSize })
    .onDuplicateKeyUpdate({ set: { sku: sql`sku` } });
  const [row] = await tx
    .select()
    .from(stockBalances)
    .where(and(eq(stockBalances.sku, sku), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize)))
    .for("update");
  return row;
}

async function writeBalanceRow(tx: Tx, sku: string, type: StockType, packSize: number, balance: Balance, groupId: string) {
  await tx
    .update(stockBalances)
    .set({
      onHandQty: balance.onHand,
      reservedClientQty: balance.reservedClient,
      reservedEventQty: balance.reservedEvent,
      atEventQty: balance.atEvent,
      depositQty: balance.deposit,
      transitQty: balance.transit,
      lastMovementGroupId: groupId,
    })
    .where(and(eq(stockBalances.sku, sku), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize)));
}

async function writeLocationBalanceRow(
  tx: Tx,
  locationId: string,
  sku: string,
  type: StockType,
  packSize: number,
  balance: Balance,
  groupId: string,
) {
  await tx
    .update(stockLocationBalances)
    .set({
      onHandQty: balance.onHand,
      reservedClientQty: balance.reservedClient,
      reservedEventQty: balance.reservedEvent,
      atEventQty: balance.atEvent,
      depositQty: balance.deposit,
      transitQty: balance.transit,
      lastMovementGroupId: groupId,
    })
    .where(and(
      eq(stockLocationBalances.locationId, locationId),
      eq(stockLocationBalances.sku, sku),
      eq(stockLocationBalances.type, type),
      eq(stockLocationBalances.packSize, packSize),
    ));
}

async function writeLotLocationBalanceRow(
  tx: Tx,
  lotId: string,
  locationId: string,
  sku: string,
  type: StockType,
  packSize: number,
  balance: Balance,
  groupId: string,
) {
  await tx
    .update(stockLotLocationBalances)
    .set({
      onHandQty: balance.onHand,
      reservedClientQty: balance.reservedClient,
      reservedEventQty: balance.reservedEvent,
      atEventQty: balance.atEvent,
      depositQty: balance.deposit,
      transitQty: balance.transit,
      lastMovementGroupId: groupId,
    })
    .where(and(
      eq(stockLotLocationBalances.lotId, lotId),
      eq(stockLotLocationBalances.locationId, locationId),
      eq(stockLotLocationBalances.sku, sku),
      eq(stockLotLocationBalances.type, type),
      eq(stockLotLocationBalances.packSize, packSize),
    ));
}

interface MovementMeta {
  author: string;
  referenceType?: ReferenceType;
  referenceLabel?: string;
  referenceId?: string;
  motif?: string;
  comment?: string;
  movementDate?: Date;
}

function buildMovementGroupRow(
  groupId: string,
  movementType: MovementType,
  meta: MovementMeta,
  endpoints: { sourceLocationId: string | null; destinationLocationId: string | null } =
    legacyUnknownEndpointsForMovement(movementType, LEGACY_UNKNOWN_LOCATION_ID),
) {
  return {
    groupId,
    movementType,
    ...endpoints,
    referenceType: meta.referenceType,
    referenceLabel: meta.referenceLabel,
    referenceId: meta.referenceId,
    motif: meta.motif,
    comment: meta.comment,
    author: meta.author,
    movementDate: meta.movementDate,
  };
}

function buildMovementRow(
  groupId: string,
  sku: string,
  type: StockType,
  packSize: number,
  movementType: MovementType,
  effect: Effect,
  qtyBefore: number,
  qtyAfter: number,
  meta: MovementMeta,
) {
  return {
    groupId,
    sku,
    type,
    packSize,
    balanceField: effect.balanceField as BalanceField,
    movementType,
    qtyDelta: effect.delta,
    qtyBefore,
    qtyAfter,
    referenceType: meta.referenceType,
    referenceLabel: meta.referenceLabel,
    referenceId: meta.referenceId,
    motif: meta.motif,
    comment: meta.comment,
    author: meta.author,
    movementDate: meta.movementDate,
  };
}

function buildLotAllocationRow(
  groupId: string,
  lotId: string,
  locationId: string,
  sku: string,
  type: StockType,
  packSize: number,
  effect: Effect,
  qtyBefore: number,
  qtyAfter: number,
) {
  return {
    groupId,
    lotId,
    locationId,
    sku,
    type,
    packSize,
    balanceField: effect.balanceField as BalanceField,
    qtyDelta: effect.delta,
    qtyBefore,
    qtyAfter,
  };
}

export type SimpleMovementType =
  | "RECEPTION"
  | "VENTE"
  | "RESERVATION_CLIENT"
  | "LIBERATION_RESERVATION_CLIENT"
  | "RESERVATION_EVENEMENT"
  | "LIBERATION_RESERVATION_EVENEMENT"
  | "SORTIE_EVENEMENT"
  | "RETOUR_EVENEMENT"
  | "CADEAU"
  | "ECHANTILLON"
  | "PERTE_CASSE"
  | "CORRECTION_INVENTAIRE"
  | "MISE_EN_DEPOT"
  | "RETOUR_DE_DEPOT"
  | "ENTREE_TRANSIT"
  | "RECEPTION_TRANSIT";

export interface ApplyMovementInput extends MovementMeta {
  sku: string;
  type: StockType;
  packSize: number;
  movementType: SimpleMovementType;
  qty: number; // pour CORRECTION_INVENTAIRE : la quantité COMPTÉE, pas un delta.
  withReservation?: boolean; // VENTE uniquement (correction audit : ne jamais juger sur availableNow si la vente référence une réservation déjà posée).
}

export interface ApplyMovementResult {
  groupId: string;
  balanceBefore: Balance;
  balanceAfter: Balance;
}

type LocationMovementBase = Omit<ApplyMovementInput, "movementType"> & {
  /** For inbound/correction: omitted means explicitly unknown provenance. */
  lotId?: string;
};

export type ApplyLocationMovementInput =
  | (LocationMovementBase & {
      movementType: "RECEPTION" | "ENTREE_TRANSIT";
      sourceLocationId?: never;
      destinationLocationId: string;
    })
  | (LocationMovementBase & {
      movementType: "VENTE" | "CADEAU" | "ECHANTILLON" | "PERTE_CASSE";
      sourceLocationId: string;
      destinationLocationId?: never;
    })
  | (LocationMovementBase & {
      movementType: "MISE_EN_DEPOT" | "RETOUR_DE_DEPOT" | "SORTIE_EVENEMENT" | "RETOUR_EVENEMENT" | "RECEPTION_TRANSIT";
      sourceLocationId: string;
      destinationLocationId: string;
    })
  | (LocationMovementBase & {
      movementType: "RESERVATION_CLIENT" | "LIBERATION_RESERVATION_CLIENT" | "RESERVATION_EVENEMENT" |
        "LIBERATION_RESERVATION_EVENEMENT" | "CORRECTION_INVENTAIRE";
      sourceLocationId: string;
      destinationLocationId?: string;
    });

interface LockedLotCandidate extends LotAllocationCandidate {
  balance: Balance;
}

async function assertStockLocationExists(tx: Tx, locationId: string): Promise<void> {
  const [row] = await tx.select({ locationId: stockLocations.locationId })
    .from(stockLocations)
    .where(eq(stockLocations.locationId, locationId));
  if (!row) throw new StockRuleViolation("stock_location_not_found", `locationId=${locationId}`);
}

async function loadAndLockLotCandidates(
  tx: Tx,
  locationId: string,
  sku: string,
  type: StockType,
  packSize: number,
): Promise<LockedLotCandidate[]> {
  const positions = await tx.select().from(stockLotLocationBalances).where(and(
    eq(stockLotLocationBalances.locationId, locationId),
    eq(stockLotLocationBalances.sku, sku),
    eq(stockLotLocationBalances.type, type),
    eq(stockLotLocationBalances.packSize, packSize),
  ));
  if (!positions.length) return [];

  const lotIds = positions.map((row) => row.lotId);
  const lots = await tx.select({
    lotId: stockProvenanceLots.lotId,
    originKind: stockProvenanceLots.originKind,
    receiptId: stockProvenanceLots.receiptId,
    createdAt: stockProvenanceLots.createdAt,
  }).from(stockProvenanceLots).where(inArray(stockProvenanceLots.lotId, lotIds));
  const receiptIds = lots.flatMap((lot) => lot.receiptId ? [lot.receiptId] : []);
  const receipts = receiptIds.length
    ? await tx.select({ receiptId: stockReceipts.receiptId, receivedAt: stockReceipts.receivedAt })
      .from(stockReceipts).where(inArray(stockReceipts.receiptId, receiptIds))
    : [];
  const lotById = new Map(lots.map((lot) => [lot.lotId, lot]));
  const receivedAtById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt.receivedAt]));
  const ordered = positions.map((position): LotAllocationCandidate => {
    const lot = lotById.get(position.lotId);
    if (!lot) throw new StockRuleViolation("provenance_lot_not_found", `lotId=${position.lotId}`);
    return {
      lotId: position.lotId,
      originKind: lot.originKind,
      receivedAt: lot.receiptId ? receivedAtById.get(lot.receiptId) ?? null : null,
      createdAt: lot.createdAt ?? null,
      eligibleQty: 0,
    };
  }).sort(compareLotAllocationCandidates);

  const locked: LockedLotCandidate[] = [];
  for (const candidate of ordered) {
    const row = await lockOrCreateLotLocationBalanceRow(tx, candidate.lotId, locationId, sku, type, packSize);
    locked.push({ ...candidate, balance: rowToBalance(row) });
  }
  return locked;
}

async function validateInboundLotIdentity(
  tx: Tx,
  lotId: string,
  destinationLocationId: string,
  sku: string,
  type: StockType,
  packSize: number,
): Promise<void> {
  const [lot] = await tx.select().from(stockProvenanceLots).where(eq(stockProvenanceLots.lotId, lotId));
  if (!lot) throw new StockRuleViolation("provenance_lot_not_found", `lotId=${lotId}`);
  if (lot.originKind !== "RECEIPT") return;
  if (!lot.receiptId) throw new StockRuleViolation("receipt_lot_missing_receipt", `lotId=${lotId}`);
  const [receipt] = await tx.select({ destinationLocationId: stockReceipts.destinationLocationId })
    .from(stockReceipts).where(eq(stockReceipts.receiptId, lot.receiptId));
  const [item] = await tx.select({
    receiptId: stockReceiptItems.receiptId,
    sku: stockReceiptItems.sku,
    type: stockReceiptItems.type,
    packSize: stockReceiptItems.packSize,
  }).from(stockReceiptItems).where(eq(stockReceiptItems.lotId, lotId));
  if (!receipt || !item || item.receiptId !== lot.receiptId) {
    throw new StockRuleViolation("receipt_lot_identity_missing", `lotId=${lotId}`);
  }
  if (receipt.destinationLocationId !== destinationLocationId || item.sku !== sku || item.type !== type || item.packSize !== packSize) {
    throw new StockRuleViolation("receipt_lot_identity_mismatch", `lotId=${lotId}`);
  }
}

function computeSimpleEffects(input: ApplyMovementInput, balance: Balance): Effect[] {
  switch (input.movementType) {
    case "RECEPTION":
      return effectsForReception(input.qty);
    case "VENTE":
      return effectsForVente(input.qty, balance, !!input.withReservation);
    case "RESERVATION_CLIENT":
      return effectsForReservationClient(input.qty, balance);
    case "LIBERATION_RESERVATION_CLIENT":
      return effectsForLiberationReservationClient(input.qty);
    case "RESERVATION_EVENEMENT":
      return effectsForReservationEvenement(input.qty, balance);
    case "LIBERATION_RESERVATION_EVENEMENT":
      return effectsForLiberationReservationEvenement(input.qty);
    case "SORTIE_EVENEMENT":
      return effectsForSortieEvenement(input.qty, balance);
    case "RETOUR_EVENEMENT":
      return effectsForRetourEvenement(input.qty);
    case "CADEAU":
    case "ECHANTILLON":
      return effectsForCadeauEchantillon(input.qty, balance);
    case "PERTE_CASSE":
      return effectsForPerteCasse(input.qty, balance);
    case "CORRECTION_INVENTAIRE":
      return effectsForCorrectionInventaire(input.qty, balance);
    case "MISE_EN_DEPOT":
      return effectsForMiseEnDepot(input.qty);
    case "RETOUR_DE_DEPOT":
      return effectsForRetourDeDepot(input.qty);
    case "ENTREE_TRANSIT":
      return effectsForEntreeTransit(input.qty);
    case "RECEPTION_TRANSIT":
      return effectsForReceptionTransit(input.qty);
    default: {
      const exhaustive: never = input.movementType;
      throw new StockRuleViolation("unknown_movement_type", `Mouvement non géré: ${exhaustive}`);
    }
  }
}

export interface OuvertureBoiteDistributionInput {
  packSize: number;
  packQty: number;
}

export interface ApplyOuvertureBoiteInput extends MovementMeta {
  sku: string;
  sourceBalanceField: "onHand" | "atEvent"; // correction 4 : la Box consommée peut venir du stock normal ou de atEvent.
  distribution: OuvertureBoiteDistributionInput[];
  looseQty: number;
  otherExplicitQty?: number;
}

export interface ApplyOuvertureBoiteResult {
  groupId: string;
  cigarsPerBox: number;
}

export class StockStorage {
  /**
   * Un seul mouvement, une seule ligne stock_balances, atomique (lock FOR UPDATE
   * + calcul + write + ledger). Accepte optionnellement une transaction externe
   * (`tx`) pour participer à une transaction plus large orchestrée par
   * l'appelant (ex. scripts/seed-stock-central-apply.ts, point 1 audit :
   * les 257 opérations du seed de genèse doivent réussir ou échouer comme un
   * tout, jamais laisser un état partiel) — sinon ouvre sa propre transaction.
   */
  async applyMovement(input: ApplyMovementInput, tx?: Tx): Promise<ApplyMovementResult> {
    assertPackSizeSentinel(input.type, input.packSize);
    const run = async (t: Tx): Promise<ApplyMovementResult> => {
      const row = await lockOrCreateBalanceRow(t, input.sku, input.type, input.packSize);
      const locationRow = await lockOrCreateLocationBalanceRow(
        t,
        LEGACY_UNKNOWN_LOCATION_ID,
        input.sku,
        input.type,
        input.packSize,
      );
      const lotRow = await lockOrCreateLotLocationBalanceRow(
        t,
        LEGACY_UNKNOWN_LOT_ID,
        LEGACY_UNKNOWN_LOCATION_ID,
        input.sku,
        input.type,
        input.packSize,
      );
      const before = rowToBalance(row);
      const locationBefore = rowToBalance(locationRow);
      const lotBefore = rowToBalance(lotRow);
      assertLocationProjectionMatches(before, [locationBefore]);
      assertLocationProjectionMatches(locationBefore, [lotBefore]);
      const effects = computeSimpleEffects(input, before);
      for (const effect of effects) assertLooseNeverInTransit(input.type, effect.balanceField, effect.delta);

      const groupId = randomUUID();
      let current = before;
      const movementRows = [];
      const lotAllocationRows = [];
      for (const effect of effects) {
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(current, effect);
        movementRows.push(
          buildMovementRow(groupId, input.sku, input.type, input.packSize, input.movementType, effect, qtyBefore, qtyAfter, input),
        );
        lotAllocationRows.push(buildLotAllocationRow(
          groupId,
          LEGACY_UNKNOWN_LOT_ID,
          LEGACY_UNKNOWN_LOCATION_ID,
          input.sku,
          input.type,
          input.packSize,
          effect,
          qtyBefore,
          qtyAfter,
        ));
        current = next;
      }

      await t.insert(stockMovementGroups).values(buildMovementGroupRow(groupId, input.movementType, input));
      await writeBalanceRow(t, input.sku, input.type, input.packSize, current, groupId);
      await writeLocationBalanceRow(t, LEGACY_UNKNOWN_LOCATION_ID, input.sku, input.type, input.packSize, current, groupId);
      await writeLotLocationBalanceRow(
        t,
        LEGACY_UNKNOWN_LOT_ID,
        LEGACY_UNKNOWN_LOCATION_ID,
        input.sku,
        input.type,
        input.packSize,
        current,
        groupId,
      );
      if (movementRows.length) await t.insert(stockMovements).values(movementRows);
      if (lotAllocationRows.length) await t.insert(stockMovementLotAllocations).values(lotAllocationRows);

      return { groupId, balanceBefore: before, balanceAfter: current };
    };
    return tx ? run(tx) : db.transaction(run);
  }

  /**
   * Milestone 4 writer. Legacy callers keep applyMovement/LEGACY_UNKNOWN;
   * location-aware callers must provide the physical endpoints required by the
   * movement semantics. All projections and append-only ledgers are committed
   * by the same transaction.
   */
  async applyLocationMovement(input: ApplyLocationMovementInput, tx?: Tx): Promise<ApplyMovementResult> {
    assertPackSizeSentinel(input.type, input.packSize);
    if (!Number.isInteger(input.qty) || input.qty < 0 || (input.movementType !== "CORRECTION_INVENTAIRE" && input.qty === 0)) {
      throw new StockRuleViolation("invalid_movement_quantity");
    }
    const endpoints = locationAwareEndpointsForMovement(
      input.movementType,
      input.sourceLocationId,
      input.destinationLocationId,
    );

    const run = async (t: Tx): Promise<ApplyMovementResult> => {
      const affectedLocationIds = Array.from(new Set([
        endpoints.sourceLocationId,
        endpoints.destinationLocationId,
      ].filter((value): value is string => !!value))).sort();
      for (const locationId of affectedLocationIds) await assertStockLocationExists(t, locationId);

      // One aggregate identity is the first/global lock. It serializes all old
      // and new writers for that identity before location/lot discovery.
      const aggregateRow = await lockOrCreateBalanceRow(t, input.sku, input.type, input.packSize);
      const aggregateBefore = rowToBalance(aggregateRow);

      const locationRows = new Map<string, typeof stockLocationBalances.$inferSelect>();
      for (const locationId of affectedLocationIds) {
        locationRows.set(locationId, await lockOrCreateLocationBalanceRow(t, locationId, input.sku, input.type, input.packSize));
      }
      const allLocationsBefore = await t.select().from(stockLocationBalances).where(and(
        eq(stockLocationBalances.sku, input.sku),
        eq(stockLocationBalances.type, input.type),
        eq(stockLocationBalances.packSize, input.packSize),
      ));
      assertLocationProjectionMatches(aggregateBefore, allLocationsBefore.map(rowToBalance));

      // Stable order: aggregate identity, locationId lexical, then evidenced
      // FIFO order within each location (lotId is the final total-order key).
      const lotsByLocation = new Map<string, LockedLotCandidate[]>();
      for (const locationId of affectedLocationIds) {
        const lots = await loadAndLockLotCandidates(t, locationId, input.sku, input.type, input.packSize);
        lotsByLocation.set(locationId, lots);
        assertLocationProjectionMatches(rowToBalance(locationRows.get(locationId)), lots.map((lot) => lot.balance));
      }

      const ruleLocationId = endpoints.sourceLocationId ?? endpoints.destinationLocationId!;
      const ruleBalance = rowToBalance(locationRows.get(ruleLocationId));
      const effects: Effect[] = input.movementType === "CORRECTION_INVENTAIRE"
        ? [{ balanceField: "onHand", delta: input.qty - ruleBalance.onHand }]
        : computeSimpleEffects(input, ruleBalance);
      for (const effect of effects) assertLooseNeverInTransit(input.type, effect.balanceField, effect.delta);

      const groupId = randomUUID();
      let aggregateAfter = aggregateBefore;
      const movementRows = [];
      for (const effect of effects) {
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(aggregateAfter, effect);
        movementRows.push(buildMovementRow(
          groupId,
          input.sku,
          input.type,
          input.packSize,
          input.movementType,
          effect,
          qtyBefore,
          qtyAfter,
          input,
        ));
        aggregateAfter = next;
      }

      const findLot = (locationId: string, lotId: string) =>
        lotsByLocation.get(locationId)?.find((candidate) => candidate.lotId === lotId);
      const ensureLot = async (locationId: string, lotId: string): Promise<LockedLotCandidate> => {
        const existing = findLot(locationId, lotId);
        if (existing) return existing;
        const [lot] = await t.select({
          lotId: stockProvenanceLots.lotId,
          originKind: stockProvenanceLots.originKind,
          receiptId: stockProvenanceLots.receiptId,
          createdAt: stockProvenanceLots.createdAt,
        }).from(stockProvenanceLots).where(eq(stockProvenanceLots.lotId, lotId));
        if (!lot) throw new StockRuleViolation("provenance_lot_not_found", `lotId=${lotId}`);
        const [receipt] = lot.receiptId
          ? await t.select({ receivedAt: stockReceipts.receivedAt }).from(stockReceipts).where(eq(stockReceipts.receiptId, lot.receiptId))
          : [];
        const row = await lockOrCreateLotLocationBalanceRow(t, lotId, locationId, input.sku, input.type, input.packSize);
        const candidate: LockedLotCandidate = {
          lotId,
          originKind: lot.originKind,
          receivedAt: receipt?.receivedAt ?? null,
          createdAt: lot.createdAt ?? null,
          eligibleQty: 0,
          balance: rowToBalance(row),
        };
        const candidates = lotsByLocation.get(locationId) ?? [];
        candidates.push(candidate);
        candidates.sort(compareLotAllocationCandidates);
        lotsByLocation.set(locationId, candidates);
        return candidate;
      };
      const planAt = (
        locationId: string,
        qty: number,
        capacity: (balance: Balance) => number,
      ) => planDeterministicLotAllocation(
        (lotsByLocation.get(locationId) ?? []).map((candidate) => ({ ...candidate, eligibleQty: capacity(candidate.balance) })),
        qty,
      );

      type LotAction = { locationId: string; lotId: string; effect: Effect };
      const lotActions: LotAction[] = [];
      const addActions = (locationId: string, plans: { lotId: string; qty: number }[], field: BalanceField, sign: 1 | -1) => {
        for (const plan of plans) lotActions.push({
          locationId,
          lotId: plan.lotId,
          effect: { balanceField: field, delta: sign * plan.qty },
        });
      };
      const available = (balance: Balance) => Math.max(0, balance.onHand - balance.reservedClient - balance.reservedEvent);
      const sourceId = endpoints.sourceLocationId;
      const destinationId = endpoints.destinationLocationId;

      if (input.movementType === "RECEPTION" || input.movementType === "ENTREE_TRANSIT") {
        const lotId = input.lotId ?? LEGACY_UNKNOWN_LOT_ID;
        await validateInboundLotIdentity(t, lotId, destinationId!, input.sku, input.type, input.packSize);
        await ensureLot(destinationId!, lotId);
        lotActions.push({
          locationId: destinationId!,
          lotId,
          effect: { balanceField: input.movementType === "RECEPTION" ? "onHand" : "transit", delta: input.qty },
        });
      } else if (input.movementType === "RESERVATION_CLIENT" || input.movementType === "RESERVATION_EVENEMENT") {
        const field: BalanceField = input.movementType === "RESERVATION_CLIENT" ? "reservedClient" : "reservedEvent";
        addActions(sourceId!, planAt(sourceId!, input.qty, available), field, 1);
      } else if (input.movementType === "LIBERATION_RESERVATION_CLIENT" || input.movementType === "LIBERATION_RESERVATION_EVENEMENT") {
        const field: BalanceField = input.movementType === "LIBERATION_RESERVATION_CLIENT" ? "reservedClient" : "reservedEvent";
        addActions(sourceId!, planAt(sourceId!, input.qty, (balance) => balance[field]), field, -1);
      } else if (input.movementType === "VENTE" && input.withReservation) {
        const plans = planAt(sourceId!, input.qty, (balance) => Math.min(balance.onHand, balance.reservedClient));
        addActions(sourceId!, plans, "onHand", -1);
        addActions(sourceId!, plans, "reservedClient", -1);
      } else if (["VENTE", "CADEAU", "ECHANTILLON"].includes(input.movementType)) {
        addActions(sourceId!, planAt(sourceId!, input.qty, available), "onHand", -1);
      } else if (input.movementType === "PERTE_CASSE") {
        addActions(sourceId!, planAt(sourceId!, input.qty, (balance) => balance.onHand), "onHand", -1);
      } else if (input.movementType === "CORRECTION_INVENTAIRE") {
        const delta = effects[0].delta;
        if (delta > 0) {
          const lotId = input.lotId ?? LEGACY_UNKNOWN_LOT_ID;
          await validateInboundLotIdentity(t, lotId, sourceId!, input.sku, input.type, input.packSize);
          await ensureLot(sourceId!, lotId);
          lotActions.push({ locationId: sourceId!, lotId, effect: { balanceField: "onHand", delta } });
        } else if (delta < 0) {
          addActions(sourceId!, planAt(sourceId!, -delta, (balance) => balance.onHand), "onHand", -1);
        }
      } else {
        let plans: { lotId: string; qty: number }[];
        let sourceFields: BalanceField[];
        let destinationField: BalanceField;
        switch (input.movementType) {
          case "MISE_EN_DEPOT":
            plans = planAt(sourceId!, input.qty, available);
            sourceFields = ["onHand"];
            destinationField = "deposit";
            break;
          case "RETOUR_DE_DEPOT":
            plans = planAt(sourceId!, input.qty, (balance) => balance.deposit);
            sourceFields = ["deposit"];
            destinationField = "onHand";
            break;
          case "SORTIE_EVENEMENT":
            plans = planAt(sourceId!, input.qty, (balance) => Math.min(balance.onHand, balance.reservedEvent));
            sourceFields = ["onHand", "reservedEvent"];
            destinationField = "atEvent";
            break;
          case "RETOUR_EVENEMENT":
            plans = planAt(sourceId!, input.qty, (balance) => balance.atEvent);
            sourceFields = ["atEvent"];
            destinationField = "onHand";
            break;
          case "RECEPTION_TRANSIT":
            plans = planAt(sourceId!, input.qty, (balance) => balance.transit);
            sourceFields = ["transit"];
            destinationField = "onHand";
            break;
          default:
            throw new StockRuleViolation("location_aware_movement_not_supported", input.movementType);
        }
        for (const plan of plans) await ensureLot(destinationId!, plan.lotId);
        for (const field of sourceFields) addActions(sourceId!, plans, field, -1);
        addActions(destinationId!, plans, destinationField, 1);
      }

      // Every affected destination lot row has now been created and locked;
      // only now may projection mutation begin.
      const lotAllocationRows = [];
      const touchedLots = new Map<string, LockedLotCandidate>();
      for (const action of lotActions) {
        const lot = findLot(action.locationId, action.lotId)!;
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(lot.balance, action.effect);
        lotAllocationRows.push(buildLotAllocationRow(
          groupId,
          action.lotId,
          action.locationId,
          input.sku,
          input.type,
          input.packSize,
          action.effect,
          qtyBefore,
          qtyAfter,
        ));
        lot.balance = next;
        touchedLots.set(`${action.locationId}|${action.lotId}`, lot);
      }

      const locationAfter = new Map(affectedLocationIds.map((locationId) => [locationId, rowToBalance(locationRows.get(locationId))]));
      for (const effect of effects) {
        const targetLocationId = endpoints.sourceLocationId === endpoints.destinationLocationId
          ? endpoints.sourceLocationId!
          : effect.delta < 0 ? endpoints.sourceLocationId! : endpoints.destinationLocationId!;
        locationAfter.set(targetLocationId, applyEffect(locationAfter.get(targetLocationId)!, effect).balance);
      }

      await t.insert(stockMovementGroups).values(buildMovementGroupRow(groupId, input.movementType, input, endpoints));
      await writeBalanceRow(t, input.sku, input.type, input.packSize, aggregateAfter, groupId);
      for (const locationId of affectedLocationIds) {
        await writeLocationBalanceRow(t, locationId, input.sku, input.type, input.packSize, locationAfter.get(locationId)!, groupId);
      }
      for (const [key, lot] of Array.from(touchedLots.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        const separator = key.indexOf("|");
        const locationId = key.slice(0, separator);
        await writeLotLocationBalanceRow(t, lot.lotId, locationId, input.sku, input.type, input.packSize, lot.balance, groupId);
      }

      const allLocationsAfter = await t.select().from(stockLocationBalances).where(and(
        eq(stockLocationBalances.sku, input.sku),
        eq(stockLocationBalances.type, input.type),
        eq(stockLocationBalances.packSize, input.packSize),
      ));
      assertLocationProjectionMatches(aggregateAfter, allLocationsAfter.map(rowToBalance));
      for (const locationId of affectedLocationIds) {
        const allLotsAfter = await t.select().from(stockLotLocationBalances).where(and(
          eq(stockLotLocationBalances.locationId, locationId),
          eq(stockLotLocationBalances.sku, input.sku),
          eq(stockLotLocationBalances.type, input.type),
          eq(stockLotLocationBalances.packSize, input.packSize),
        ));
        assertLocationProjectionMatches(locationAfter.get(locationId)!, allLotsAfter.map(rowToBalance));
      }

      if (movementRows.length) await t.insert(stockMovements).values(movementRows);
      if (lotAllocationRows.length) await t.insert(stockMovementLotAllocations).values(lotAllocationRows);
      return { groupId, balanceBefore: aggregateBefore, balanceAfter: aggregateAfter };
    };
    return tx ? run(tx) : db.transaction(run);
  }

  /**
   * OUVERTURE_BOITE : atomique multi-lignes (audit, point 1). Verrouille la ligne
   * Box source ET toutes les lignes destination (Pack par taille + Loose) DANS
   * UN ORDRE STABLE (Box, puis Pack croissant, puis Loose) avant de calculer le
   * moindre effet, pour ne jamais pouvoir deadlocker contre une autre transaction
   * touchant un sous-ensemble chevauchant de ces mêmes lignes.
   */
  async applyOuvertureBoite(input: ApplyOuvertureBoiteInput, tx?: Tx): Promise<ApplyOuvertureBoiteResult> {
    const run = async (t: Tx): Promise<ApplyOuvertureBoiteResult> => {
      const [productRow] = await t.select({ cigarsPerBox: products.cigarsPerBox }).from(products).where(eq(products.sku, input.sku));
      if (!productRow || productRow.cigarsPerBox == null) {
        throw new StockRuleViolation("cigars_per_box_not_configured", `Aucun cigarsPerBox configuré pour sku=${input.sku}`);
      }
      const cigarsPerBox = productRow.cigarsPerBox;

      const activeConfigs = await t
        .select({ packSize: packSizeConfig.packSize })
        .from(packSizeConfig)
        .where(and(eq(packSizeConfig.sku, input.sku), eq(packSizeConfig.active, true)));
      const allowedPackSizes = activeConfigs.map((c) => c.packSize);

      const rowsToLock: { type: StockType; packSize: number }[] = [{ type: "Box", packSize: 0 }];
      for (const d of input.distribution) rowsToLock.push({ type: "Pack", packSize: d.packSize });
      if (input.looseQty > 0) rowsToLock.push({ type: "Loose", packSize: 0 });
      rowsToLock.sort(lockOrder);

      const lockedByKey = new Map<string, typeof stockBalances.$inferSelect>();
      for (const r of rowsToLock) {
        const row = await lockOrCreateBalanceRow(t, input.sku, r.type, r.packSize);
        lockedByKey.set(`${r.type}|${r.packSize}`, row);
      }

      // Global order is aggregate rows first, then location rows, with the same
      // stable identity ordering inside each projection. Simple movements use
      // the same aggregate-before-location order.
      const locationLockedByKey = new Map<string, typeof stockLocationBalances.$inferSelect>();
      for (const r of rowsToLock) {
        const row = await lockOrCreateLocationBalanceRow(
          t,
          LEGACY_UNKNOWN_LOCATION_ID,
          input.sku,
          r.type,
          r.packSize,
        );
        locationLockedByKey.set(`${r.type}|${r.packSize}`, row);
      }

      const lotLockedByKey = new Map<string, typeof stockLotLocationBalances.$inferSelect>();
      for (const r of rowsToLock) {
        const row = await lockOrCreateLotLocationBalanceRow(
          t,
          LEGACY_UNKNOWN_LOT_ID,
          LEGACY_UNKNOWN_LOCATION_ID,
          input.sku,
          r.type,
          r.packSize,
        );
        lotLockedByKey.set(`${r.type}|${r.packSize}`, row);
      }

      for (const r of rowsToLock) {
        const aggregate = rowToBalance(lockedByKey.get(`${r.type}|${r.packSize}`));
        const location = rowToBalance(locationLockedByKey.get(`${r.type}|${r.packSize}`));
        assertLocationProjectionMatches(
          aggregate,
          [location],
        );
        assertLocationProjectionMatches(location, [rowToBalance(lotLockedByKey.get(`${r.type}|${r.packSize}`))]);
      }

      const sourceRow = lockedByKey.get("Box|0")!;
      const sourceBalance = rowToBalance(sourceRow);
      const looseRow = locationLockedByKey.get("Loose|0");
      const currentLooseTotalInSourceBucket = looseRow ? looseRow[`${input.sourceBalanceField}Qty` as "onHandQty" | "atEventQty"] : 0;

      // Validation pure (planOuvertureBoite lève StockRuleViolation si incohérent,
      // y compris packSize dupliqué / packQty<=0 / quantités négatives — point 2
      // audit) : rollback automatique puisqu'on est déjà dans la transaction.
      planOuvertureBoite({
        cigarsPerBox,
        allowedPackSizes,
        distribution: input.distribution,
        looseQty: input.looseQty,
        otherExplicitQty: input.otherExplicitQty,
        sourceBalanceField: input.sourceBalanceField,
        currentLooseTotalInSourceBucket,
      });

      const groupId = randomUUID();
      const movementRows = [];
      const lotAllocationRows = [];
      await t.insert(stockMovementGroups).values(buildMovementGroupRow(groupId, "OUVERTURE_BOITE", input));

      // Box source : -1 boîte (une seule boîte ouverte par appel — le plan pur
      // ne valide qu'une distribution pour UN cigarsPerBox à la fois).
      const sourceEffects = effectsForOuvertureBoiteSource(1, input.sourceBalanceField, sourceBalance);
      let sourceCurrent = sourceBalance;
      for (const effect of sourceEffects) {
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(sourceCurrent, effect);
        movementRows.push(buildMovementRow(groupId, input.sku, "Box", 0, "OUVERTURE_BOITE", effect, qtyBefore, qtyAfter, input));
        lotAllocationRows.push(buildLotAllocationRow(groupId, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Box", 0, effect, qtyBefore, qtyAfter));
        sourceCurrent = next;
      }
      await writeBalanceRow(t, input.sku, "Box", 0, sourceCurrent, groupId);
      await writeLocationBalanceRow(t, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Box", 0, sourceCurrent, groupId);
      await writeLotLocationBalanceRow(t, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Box", 0, sourceCurrent, groupId);

      // planOuvertureBoite garantit désormais packQty>0 pour chaque entrée
      // (point 2 audit) : plus besoin de filtrer les entrées nulles ici.
      for (const d of input.distribution) {
        const row = lockedByKey.get(`Pack|${d.packSize}`)!;
        const balance = rowToBalance(row);
        const destEffects = effectsForOuvertureBoiteDestination(d.packQty, input.sourceBalanceField);
        let current = balance;
        for (const effect of destEffects) {
          const { balance: next, qtyBefore, qtyAfter } = applyEffect(current, effect);
          movementRows.push(buildMovementRow(groupId, input.sku, "Pack", d.packSize, "OUVERTURE_BOITE", effect, qtyBefore, qtyAfter, input));
          lotAllocationRows.push(buildLotAllocationRow(groupId, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Pack", d.packSize, effect, qtyBefore, qtyAfter));
          current = next;
        }
        await writeBalanceRow(t, input.sku, "Pack", d.packSize, current, groupId);
        await writeLocationBalanceRow(t, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Pack", d.packSize, current, groupId);
        await writeLotLocationBalanceRow(t, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Pack", d.packSize, current, groupId);
      }

      if (input.looseQty > 0) {
        const row = lockedByKey.get("Loose|0")!;
        const balance = rowToBalance(row);
        const destEffects = effectsForOuvertureBoiteDestination(input.looseQty, input.sourceBalanceField);
        let current = balance;
        for (const effect of destEffects) {
          const { balance: next, qtyBefore, qtyAfter } = applyEffect(current, effect);
          movementRows.push(buildMovementRow(groupId, input.sku, "Loose", 0, "OUVERTURE_BOITE", effect, qtyBefore, qtyAfter, input));
          lotAllocationRows.push(buildLotAllocationRow(groupId, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Loose", 0, effect, qtyBefore, qtyAfter));
          current = next;
        }
        await writeBalanceRow(t, input.sku, "Loose", 0, current, groupId);
        await writeLocationBalanceRow(t, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Loose", 0, current, groupId);
        await writeLotLocationBalanceRow(t, LEGACY_UNKNOWN_LOT_ID, LEGACY_UNKNOWN_LOCATION_ID, input.sku, "Loose", 0, current, groupId);
      }

      if (movementRows.length) await t.insert(stockMovements).values(movementRows);
      if (lotAllocationRows.length) await t.insert(stockMovementLotAllocations).values(lotAllocationRows);

      return { groupId, cigarsPerBox };
    };
    return tx ? run(tx) : db.transaction(run);
  }

  /**
   * Disponibilité DNA (mission §14, endpoint /api/dna/availability). Batch
   * unique. Un CIGAR_ID absent de cigar_catalog est "non résolu" (retourné
   * séparément) — jamais silencieusement omis ni traité comme indisponible :
   * c'est à l'appelant (route HTTP) de décider de faire échouer toute la
   * réponse plutôt que de renvoyer un résultat partiel qui ressemblerait à
   * un faux N=0 côté DNA.
   */
  async getAvailabilityForCigarIds(
    cigarIds: string[],
  ): Promise<{ resolved: Record<string, { packAvailable: boolean; boxAvailable: boolean }>; unresolved: string[] }> {
    const uniqueIds = Array.from(new Set(cigarIds));
    if (!uniqueIds.length) return { resolved: {}, unresolved: [] };

    const catalogRows = await db.select({ cigarId: cigarCatalog.cigarId }).from(cigarCatalog).where(inArray(cigarCatalog.cigarId, uniqueIds));
    const knownIds = new Set(catalogRows.map((r) => r.cigarId));
    const unresolved = uniqueIds.filter((id) => !knownIds.has(id));

    const productRows = await db
      .select({ sku: products.sku, cigarId: products.cigarId })
      .from(products)
      .where(inArray(products.cigarId, uniqueIds));
    const skuByCigarId = new Map<string, string>();
    for (const r of productRows) if (r.cigarId) skuByCigarId.set(r.cigarId, r.sku);

    const relevantSkus = Array.from(new Set(skuByCigarId.values()));
    const balanceRows = relevantSkus.length
      ? await db
          .select()
          .from(stockBalances)
          .where(and(inArray(stockBalances.sku, relevantSkus), inArray(stockBalances.type, ["Box", "Pack"])))
      : [];

    const resolved: Record<string, { packAvailable: boolean; boxAvailable: boolean }> = {};
    for (const id of uniqueIds) {
      if (!knownIds.has(id)) continue;
      const sku = skuByCigarId.get(id);
      if (!sku) {
        // CIGAR_ID connu (existe dans cigar_catalog) mais sans SKU propre chez
        // CitiCigars (ex. composant de bundle only) : disponibilité réelle = false/false,
        // ce n'est PAS une erreur de résolution.
        resolved[id] = { packAvailable: false, boxAvailable: false };
        continue;
      }
      const rows = balanceRows.filter((r) => r.sku === sku);
      resolved[id] = {
        packAvailable: rows.some((r) => r.type === "Pack" && isCommerciallyAvailable(r)),
        boxAvailable: rows.some((r) => r.type === "Box" && isCommerciallyAvailable(r)),
      };
    }
    return { resolved, unresolved };
  }

  /**
   * POST /api/dna/contact : idempotent sur clientRequestId (unique index), jamais
   * de doublon. Décision de consentement de Claudel (remplace la précédente) :
   * `consentGiven` est reçu explicitement de l'appelant (le routeur HTTP a déjà
   * rejeté 400 tout ce qui n'est pas strictement `true` avant d'arriver ici) —
   * ce storage ne fabrique JAMAIS consentGiven=true lui-même. consentTimestamp
   * est toujours généré ici, côté serveur, au moment de l'acceptation ; un
   * timestamp éventuellement fourni par l'appelant est ignoré (le frontend n'en
   * envoie de toute façon plus).
   */
  /**
   * exec optionnel (défaut `db`) : permet d'exécuter cette méthode À L'INTÉRIEUR
   * d'une transaction Drizzle partagée avec d'autres écritures (réconciliation
   * DNA → CRM, 20 août) sans dupliquer la logique ni casser les appelants
   * existants qui ne passent rien (comportement strictement inchangé pour eux).
   */
  async upsertLeadIdempotent(
    input: {
      clientRequestId: string;
      firstName: string;
      lastName: string;
      country: string;
      city: string;
      whatsapp: string;
      dnaProfileId: string;
      answersSnapshot: unknown;
      refinementsSnapshot: unknown;
      consentGiven: boolean;
      captureMode: "normal" | "zero";
    },
    exec: DbOrTx = db
  ): Promise<{ lead: DnaLead; created: boolean }> {
    const [existing] = await exec.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
    if (existing) return { lead: existing, created: false };

    // Point 3 (audit) : `created` doit refléter si CET appel a réellement inséré
    // la ligne, pas seulement "existing était absent au moment du SELECT initial"
    // — sinon le perdant d'une course sur ER_DUP_ENTRY se voit répondre created:true
    // à tort. Recalculé après la tentative d'insertion, jamais avant.
    let created = true;
    try {
      await exec.insert(dnaLeads).values({
        clientRequestId: input.clientRequestId,
        firstName: input.firstName,
        lastName: input.lastName,
        country: input.country,
        city: input.city,
        whatsapp: input.whatsapp,
        dnaProfileId: input.dnaProfileId,
        answersSnapshot: input.answersSnapshot,
        refinementsSnapshot: input.refinementsSnapshot,
        consentGiven: input.consentGiven,
        consentTimestamp: new Date(),
        // Le mode de capture est connu au moment du contact : /watch ne l'infère
        // et ne le corrige jamais après coup.
        capturedAtStep: capturedAtStepForMode(input.captureMode),
      });
    } catch (e: any) {
      if (e?.code !== "ER_DUP_ENTRY") throw e;
      // Course perdue contre une requête concurrente avec le même clientRequestId :
      // l'unique index a gagné côté adversaire, on relit simplement la ligne gagnante.
      created = false;
    }
    const [row] = await exec.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
    return { lead: row!, created };
  }

  /**
   * POST /api/dna/watch : erreur si le lead n'existe pas, idempotent sur leadId
   * (unique index). Décision de consentement de Claudel : ne dépend d'aucun
   * consentGiven envoyé dans SA PROPRE requête — vérifie exclusivement
   * lead.consentGiven déjà persisté (source de vérité unique). Un lead créé
   * avant que ce champ existe / sans consentement explicite est refusé.
   */
  async upsertWatchIdempotent(input: {
    clientRequestId: string;
    dnaProfileId: string;
    answersSnapshot: unknown;
    refinementsSnapshot: unknown;
  }): Promise<{ watch: DnaAvailabilityWatch; created: boolean } | { error: "lead_not_found" } | { error: "consent_missing" } | { error: "zero_case_required" }> {
    const [lead] = await db.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
    if (!lead) return { error: "lead_not_found" };
    if (lead.consentGiven !== true) return { error: "consent_missing" };
    if (lead.capturedAtStep !== "STEP6_ZERO_CASE") return { error: "zero_case_required" };

    const [existing] = await db.select().from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, lead.id));
    if (existing) return { watch: existing, created: false };

    // Point 3 (audit) : même correction que upsertLeadIdempotent — `created`
    // recalculé après la tentative d'insertion, pas avant.
    let created = true;
    try {
      await db.insert(dnaAvailabilityWatch).values({
        leadId: lead.id,
        dnaProfileId: input.dnaProfileId,
        answersSnapshot: input.answersSnapshot,
        refinementsSnapshot: input.refinementsSnapshot,
        status: "ACTIVE",
      });
    } catch (e: any) {
      if (e?.code !== "ER_DUP_ENTRY") throw e;
      created = false;
    }

    const [row] = await db.select().from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, lead.id));
    return { watch: row!, created };
  }
}

export const stockStorage = new StockStorage();
