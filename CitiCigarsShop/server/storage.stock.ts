// Wrappers transactionnels Drizzle autour de stock-movement-processor.ts (mission V6).
// Toute écriture de solde passe par ici : verrouillage SELECT ... FOR UPDATE
// À L'INTÉRIEUR de la transaction (jamais un simple read-then-write), calcul
// des effets via les fonctions pures déjà testées, mise à jour des balances,
// insertion des lignes stock_movements before/after, rollback intégral sur
// toute erreur (StockRuleViolation ou autre).
//
// Défense en profondeur (audit, point 4) : ce fichier n'exécute JAMAIS
// d'UPDATE ni de DELETE sur stock_movements — uniquement des INSERT. Les
// triggers trg_stock_movements_bu/bd (migration 0005) l'empêcheraient de
// toute façon, mais l'application ne tente même pas l'opération.

import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db.mysql";
import {
  skus,
  cigarCatalog,
  stockBalances,
  stockMovements,
  packSizeConfig,
  dnaLeads,
  dnaAvailabilityWatch,
  type StockType,
  type BalanceField,
  type MovementType,
  type ReferenceType,
  type DnaLead,
  type DnaAvailabilityWatch,
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
} from "./services/stock-movement-processor";

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

function rowToBalance(row: typeof stockBalances.$inferSelect | undefined): Balance {
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

interface MovementMeta {
  author: string;
  referenceType?: ReferenceType;
  referenceLabel?: string;
  referenceId?: string;
  motif?: string;
  comment?: string;
  movementDate?: Date;
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
      const before = rowToBalance(row);
      const effects = computeSimpleEffects(input, before);
      for (const effect of effects) assertLooseNeverInTransit(input.type, effect.balanceField, effect.delta);

      const groupId = randomUUID();
      let current = before;
      const movementRows = [];
      for (const effect of effects) {
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(current, effect);
        movementRows.push(
          buildMovementRow(groupId, input.sku, input.type, input.packSize, input.movementType, effect, qtyBefore, qtyAfter, input),
        );
        current = next;
      }

      await writeBalanceRow(t, input.sku, input.type, input.packSize, current, groupId);
      if (movementRows.length) await t.insert(stockMovements).values(movementRows);

      return { groupId, balanceBefore: before, balanceAfter: current };
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

      const sourceRow = lockedByKey.get("Box|0")!;
      const sourceBalance = rowToBalance(sourceRow);
      const looseRow = lockedByKey.get("Loose|0");
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

      // Box source : -1 boîte (une seule boîte ouverte par appel — le plan pur
      // ne valide qu'une distribution pour UN cigarsPerBox à la fois).
      const sourceEffects = effectsForOuvertureBoiteSource(1, input.sourceBalanceField, sourceBalance);
      let sourceCurrent = sourceBalance;
      for (const effect of sourceEffects) {
        const { balance: next, qtyBefore, qtyAfter } = applyEffect(sourceCurrent, effect);
        movementRows.push(buildMovementRow(groupId, input.sku, "Box", 0, "OUVERTURE_BOITE", effect, qtyBefore, qtyAfter, input));
        sourceCurrent = next;
      }
      await writeBalanceRow(t, input.sku, "Box", 0, sourceCurrent, groupId);

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
          current = next;
        }
        await writeBalanceRow(t, input.sku, "Pack", d.packSize, current, groupId);
      }

      if (input.looseQty > 0) {
        const row = lockedByKey.get("Loose|0")!;
        const balance = rowToBalance(row);
        const destEffects = effectsForOuvertureBoiteDestination(input.looseQty, input.sourceBalanceField);
        let current = balance;
        for (const effect of destEffects) {
          const { balance: next, qtyBefore, qtyAfter } = applyEffect(current, effect);
          movementRows.push(buildMovementRow(groupId, input.sku, "Loose", 0, "OUVERTURE_BOITE", effect, qtyBefore, qtyAfter, input));
          current = next;
        }
        await writeBalanceRow(t, input.sku, "Loose", 0, current, groupId);
      }

      if (movementRows.length) await t.insert(stockMovements).values(movementRows);

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
      const availableNow = (r: (typeof rows)[number]) => Math.max(0, r.onHandQty - r.reservedClientQty - r.reservedEventQty);
      resolved[id] = {
        packAvailable: rows.some((r) => r.type === "Pack" && availableNow(r) > 0),
        boxAvailable: rows.some((r) => r.type === "Box" && availableNow(r) > 0),
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
  async upsertLeadIdempotent(input: {
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
  }): Promise<{ lead: DnaLead; created: boolean }> {
    const [existing] = await db.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
    if (existing) return { lead: existing, created: false };

    // Point 3 (audit) : `created` doit refléter si CET appel a réellement inséré
    // la ligne, pas seulement "existing était absent au moment du SELECT initial"
    // — sinon le perdant d'une course sur ER_DUP_ENTRY se voit répondre created:true
    // à tort. Recalculé après la tentative d'insertion, jamais avant.
    let created = true;
    try {
      await db.insert(dnaLeads).values({
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
        // capturedAtStep démarre à STEP4_WITH_RESULTS ; upsertWatchIdempotent le
        // fait basculer à STEP6_ZERO_CASE, seul cas où un watch est jamais créé.
        capturedAtStep: "STEP4_WITH_RESULTS",
      });
    } catch (e: any) {
      if (e?.code !== "ER_DUP_ENTRY") throw e;
      // Course perdue contre une requête concurrente avec le même clientRequestId :
      // l'unique index a gagné côté adversaire, on relit simplement la ligne gagnante.
      created = false;
    }
    const [row] = await db.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
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
  }): Promise<{ watch: DnaAvailabilityWatch; created: boolean } | { error: "lead_not_found" } | { error: "consent_missing" }> {
    const [lead] = await db.select().from(dnaLeads).where(eq(dnaLeads.clientRequestId, input.clientRequestId));
    if (!lead) return { error: "lead_not_found" };
    if (lead.consentGiven !== true) return { error: "consent_missing" };

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

    // Un watch n'existe QUE pour le cas zéro (mission §2 étape 6) : marque le
    // lead en conséquence, une fois qu'on sait qu'un watch a bien été demandé.
    await db.update(dnaLeads).set({ capturedAtStep: "STEP6_ZERO_CASE" }).where(eq(dnaLeads.id, lead.id));

    const [row] = await db.select().from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, lead.id));
    return { watch: row!, created };
  }
}

export const stockStorage = new StockStorage();
