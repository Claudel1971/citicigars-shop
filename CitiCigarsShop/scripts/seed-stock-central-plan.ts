// Construit le plan de seed Stock Central à partir des 81 lignes validées
// (CitiCigars_Migration_Mapping_SKU_CIGAR_ID_Type_v2_20260813.csv), rafraîchies
// par la table de réconciliation inventaire du 13 août
// (CitiCigars_Reconciliation_Inventaire_13aout_20260813.csv, 61 lignes,
// 57 MATCHED / 4 EXCEPTION_NON_RECOMPTEE / 0 NO_MATCH).
// Ce fichier ne touche AUCUNE base de données : il produit une liste
// d'opérations typées, indépendante du support d'exécution. Deux
// consommateurs possibles :
//  - scripts/seed-stock-central-dry-run.ts (exécuté, simulation en mémoire
//    via stock-movement-processor.ts, aucune écriture réelle) ;
//  - scripts/seed-stock-central-apply.ts (écriture réelle via storage.stock.ts
//    + Drizzle, NON EXÉCUTÉ dans le cadre de cette proposition — attend le GO
//    d'exécution DB explicite de Claudel).

import { readFileSync } from "fs";
import { ReconRow, reconKey } from "./seed-stock-central-reconciliation";

export type RowKind = "SKU_CIGAR_ID" | "BUNDLE_HEADER" | "BUNDLE_COMPONENT" | "ACCESSORY_SKU";

export interface MappingRow {
  rowKind: RowKind;
  sku: string;
  sourceSku: string | null;
  type: "Box" | "Pack" | "Loose" | "Accessory" | null;
  cigarId: string | null;
  componentCigarId: string | null;
  componentSku: string | null;
  componentQty: number | null;
  brand: string;
  line: string;
  vitole: string;
  cigarsPerUnit: number | null;
  heldUnits: number | null;
  depositUnits: number | null;
  pairingMethod: string;
  sourceDoctrine: string;
  note: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ";" && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

function toNumOrNull(s: string): number | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toStrOrNull(s: string): string | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  return s;
}

export function parseMappingCsv(filePath: string): MappingRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const [, ...dataLines] = lines; // ignore l'en-tête
  return dataLines.map((line) => {
    const f = parseCsvLine(line);
    const [
      rowKind, sku, sourceSku, type, cigarId, componentCigarId, componentSku, componentQty,
      brand, line_, vitole, cigarsPerUnit, heldUnits, depositUnits, pairingMethod, sourceDoctrine, note,
    ] = f;
    return {
      rowKind: rowKind as RowKind,
      sku,
      sourceSku: toStrOrNull(sourceSku),
      type: (toStrOrNull(type) as MappingRow["type"]) ?? null,
      cigarId: toStrOrNull(cigarId),
      componentCigarId: toStrOrNull(componentCigarId),
      componentSku: toStrOrNull(componentSku),
      componentQty: toNumOrNull(componentQty),
      brand,
      line: line_,
      vitole,
      cigarsPerUnit: toNumOrNull(cigarsPerUnit),
      heldUnits: toNumOrNull(heldUnits),
      depositUnits: toNumOrNull(depositUnits),
      pairingMethod,
      sourceDoctrine,
      note,
    };
  });
}

// --- Plan d'opérations, backend-agnostique ---

export type SeedOp =
  | { kind: "UPSERT_SKU"; sku: string; skuKind: "CIGAR" | "ACCESSORY" | "BUNDLE" }
  | { kind: "UPSERT_CIGAR_CATALOG"; cigarId: string; brand: string; line: string; vitole: string }
  | { kind: "UPSERT_PRODUCT"; sku: string; cigarId: string | null; brand: string; line: string; vitole: string; cigarsPerBox: number | null }
  | { kind: "UPSERT_ACCESSORY"; sku: string; nom: string; brand: string }
  | { kind: "UPSERT_BUNDLE"; sku: string; nom: string }
  | { kind: "UPSERT_PACK_SIZE_CONFIG"; sku: string; packSize: number }
  | { kind: "INSERT_BUNDLE_ITEM"; bundleSku: string; productSku: string | null; componentCigarId: string | null; qty: number }
  | {
      kind: "MOVEMENT";
      movementType: "RECEPTION" | "MISE_EN_DEPOT";
      sku: string;
      type: MappingRow["type"];
      packSize: number;
      qty: number;
      referenceLabel: string;
      confirmed: boolean; // false = quantité non recomptée le 13/08, source = ancien mapping 81 lignes
    };

const REF_CONFIRMED = "Inventaire physique Douala 13/08/2026 (Master Gestion v3, 13_Stock_Actuel)";
const REF_UNCONFIRMED = "NON CONFIRMÉ — stock non recompté lors de l'inventaire du 13/08/2026 (source: Bootstrap V2 SCELLEMENT 20260812, à vérifier)";

/** Résout held/deposit units pour une ligne (sku,type) : réconciliation si trouvée, sinon valeurs d'origine + confirmed=false. */
function resolveQuantities(
  sku: string,
  type: string,
  oldHeld: number | null,
  oldDeposit: number | null,
  reconMap: Map<string, ReconRow> | null,
): { held: number; deposit: number; confirmed: boolean } {
  const recon = reconMap?.get(reconKey(sku, type));
  if (!recon) {
    // Pas de fichier de réconciliation fourni, ou clé absente : comportement d'origine (pré-réconciliation), non confirmé par défaut si reconMap fourni.
    return { held: oldHeld ?? 0, deposit: oldDeposit ?? 0, confirmed: reconMap == null };
  }
  if (recon.status === "MATCHED") {
    return { held: recon.newHeld ?? 0, deposit: recon.newDeposit ?? 0, confirmed: true };
  }
  // EXCEPTION_NON_RECOMPTEE (ou NO_MATCH, aucun cas dans ce jeu) : garde l'ancienne valeur, jamais confirmée.
  return { held: recon.oldHeld, deposit: recon.oldDeposit, confirmed: false };
}

export function buildSeedPlan(rows: MappingRow[], reconMap: Map<string, ReconRow> | null = null): SeedOp[] {
  const ops: SeedOp[] = [];
  // Point 3 (audit) : suit les CIGAR_ID déjà couverts par une ligne SKU_CIGAR_ID,
  // pour émettre un UPSERT_CIGAR_CATALOG pour tout componentCigarId de bundle qui
  // n'a jamais de SKU propre (ex. CTG000868-871, Horacio) — TOUJOURS avant le
  // INSERT_BUNDLE_ITEM qui le référence, sinon la FK échouerait à l'application réelle.
  const knownCigarIds = new Set<string>();
  // Point 4 (audit) : dédup (sku, packSize) pour pack_size_config.
  const knownPackSizeConfigs = new Set<string>();
  // P0.3 (audit) : cigarsPerBox est une propriété du SKU (Box ET Pack du même SKU
  // la partagent), pas de la ligne CSV en cours. Pré-passe sur TOUTES les lignes
  // AVANT de construire le moindre op, pour que la valeur soit connue quel que
  // soit l'ordre Box/Pack dans le fichier (déterministe, indépendant de l'ordre) :
  // sans ça, si la ligne Pack précédait la ligne Box du même SKU, son propre
  // UPSERT_PRODUCT resterait figé à cigarsPerBox=null pour toujours.
  const productCigarsPerBox = new Map<string, number>();
  for (const r of rows) {
    if (r.rowKind === "SKU_CIGAR_ID" && r.type === "Box" && r.cigarsPerUnit) {
      productCigarsPerBox.set(r.sku, r.cigarsPerUnit);
    }
  }

  for (const row of rows) {
    if (row.rowKind === "SKU_CIGAR_ID") {
      const packSize = row.type === "Pack" ? row.cigarsPerUnit ?? 0 : 0;
      const q = resolveQuantities(row.sku, row.type!, row.heldUnits, row.depositUnits, reconMap);
      const ref = q.confirmed ? REF_CONFIRMED : REF_UNCONFIRMED;

      ops.push({ kind: "UPSERT_SKU", sku: row.sku, skuKind: "CIGAR" });
      if (row.cigarId) {
        if (!knownCigarIds.has(row.cigarId)) {
          ops.push({ kind: "UPSERT_CIGAR_CATALOG", cigarId: row.cigarId, brand: row.brand, line: row.line, vitole: row.vitole });
          knownCigarIds.add(row.cigarId);
        }
      }
      ops.push({
        kind: "UPSERT_PRODUCT",
        sku: row.sku,
        cigarId: row.cigarId,
        brand: row.brand,
        line: row.line,
        vitole: row.vitole,
        cigarsPerBox: productCigarsPerBox.get(row.sku) ?? null,
      });
      // Point 4 : pack_size_config alimenté depuis les tailles Pack validées du mapping.
      if (row.type === "Pack" && row.cigarsPerUnit) {
        const key = `${row.sku}|${row.cigarsPerUnit}`;
        if (!knownPackSizeConfigs.has(key)) {
          ops.push({ kind: "UPSERT_PACK_SIZE_CONFIG", sku: row.sku, packSize: row.cigarsPerUnit });
          knownPackSizeConfigs.add(key);
        }
      }
      // Correction 11 : RECEPTION toujours -> onHand ; deposit_units chaîné via MISE_EN_DEPOT séparée.
      if (q.held > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: row.type, packSize, qty: q.held, referenceLabel: ref, confirmed: q.confirmed });
      }
      if (q.deposit > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: row.type, packSize, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
        ops.push({ kind: "MOVEMENT", movementType: "MISE_EN_DEPOT", sku: row.sku, type: row.type, packSize, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
      }
    } else if (row.rowKind === "BUNDLE_HEADER") {
      const q = resolveQuantities(row.sku, "Pack", row.heldUnits, row.depositUnits, reconMap);
      const ref = q.confirmed ? REF_CONFIRMED : REF_UNCONFIRMED;

      ops.push({ kind: "UPSERT_SKU", sku: row.sku, skuKind: "BUNDLE" });
      ops.push({ kind: "UPSERT_BUNDLE", sku: row.sku, nom: row.vitole });
      if (q.held > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: "Pack", packSize: row.cigarsPerUnit ?? 0, qty: q.held, referenceLabel: ref, confirmed: q.confirmed });
      }
      if (q.deposit > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: "Pack", packSize: row.cigarsPerUnit ?? 0, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
        ops.push({ kind: "MOVEMENT", movementType: "MISE_EN_DEPOT", sku: row.sku, type: "Pack", packSize: row.cigarsPerUnit ?? 0, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
      }
    } else if (row.rowKind === "BUNDLE_COMPONENT") {
      // Composition, jamais concernée par le recomptage de quantités.
      // Point 3 : si ce componentCigarId n'a encore aucun SKU propre (ex. les
      // composants Horacio CTG000868-871), il n'a jamais reçu de ligne
      // UPSERT_CIGAR_CATALOG côté SKU_CIGAR_ID -> on l'émet ici, AVANT le
      // INSERT_BUNDLE_ITEM, avec les brand/line/vitole disponibles dans cette
      // ligne de mapping (seule source pour ces CIGAR_ID sans SKU).
      if (row.componentCigarId && !knownCigarIds.has(row.componentCigarId)) {
        ops.push({ kind: "UPSERT_CIGAR_CATALOG", cigarId: row.componentCigarId, brand: row.brand, line: row.line, vitole: row.vitole });
        knownCigarIds.add(row.componentCigarId);
      }
      ops.push({
        kind: "INSERT_BUNDLE_ITEM",
        bundleSku: row.sku,
        productSku: row.componentSku,
        componentCigarId: row.componentCigarId,
        qty: row.componentQty ?? 0,
      });
    } else if (row.rowKind === "ACCESSORY_SKU") {
      const q = resolveQuantities(row.sku, "Accessory", row.heldUnits, row.depositUnits, reconMap);
      const ref = q.confirmed ? REF_CONFIRMED : REF_UNCONFIRMED;

      ops.push({ kind: "UPSERT_SKU", sku: row.sku, skuKind: "ACCESSORY" });
      ops.push({ kind: "UPSERT_ACCESSORY", sku: row.sku, nom: row.vitole, brand: row.brand });
      if (q.held > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: "Accessory", packSize: 0, qty: q.held, referenceLabel: ref, confirmed: q.confirmed });
      }
      if (q.deposit > 0) {
        ops.push({ kind: "MOVEMENT", movementType: "RECEPTION", sku: row.sku, type: "Accessory", packSize: 0, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
        ops.push({ kind: "MOVEMENT", movementType: "MISE_EN_DEPOT", sku: row.sku, type: "Accessory", packSize: 0, qty: q.deposit, referenceLabel: ref, confirmed: q.confirmed });
      }
    }
  }
  return ops;
}
