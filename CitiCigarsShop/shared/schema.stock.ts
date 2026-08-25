import { sql } from "drizzle-orm";
import { mysqlTable, varchar, int, text, boolean, json, timestamp, date, mysqlEnum, primaryKey, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Stock Central + CIGAR_ID doctrine (mission V6) ---
// Ce fichier est volontairement séparé de schema.mysql.ts / schema.bundles.ts :
// il ne les importe pas (skus/cigar_catalog sont la base), eux l'importeront.

export const SKU_KINDS = ["CIGAR", "ACCESSORY", "BUNDLE"] as const;
export type SkuKind = (typeof SKU_KINDS)[number];

export const STOCK_TYPES = ["Box", "Pack", "Loose", "Accessory"] as const;
export type StockType = (typeof STOCK_TYPES)[number];

export const BALANCE_FIELDS = ["onHand", "reservedClient", "reservedEvent", "atEvent", "deposit", "transit"] as const;
export type BalanceField = (typeof BALANCE_FIELDS)[number];

export const STOCK_LOCATION_CATEGORIES = ["CITI_STORAGE", "PARTNER", "EVENT", "TRANSIT", "OTHER"] as const;
export type StockLocationCategory = (typeof STOCK_LOCATION_CATEGORIES)[number];

// Stable system identity used only when no evidenced physical location exists.
// It is deliberately not a synonym for Douala or any other known site.
export const LEGACY_UNKNOWN_LOCATION_ID = "00000000-0000-0000-0000-000000000000";
export const LEGACY_UNKNOWN_LOCATION_CODE = "LEGACY_UNKNOWN";

// 19 mouvements exacts — 15 P0 + 4 P1 (mission V6 section 1.1)
export const MOVEMENT_TYPES = [
  "RECEPTION",
  "VENTE",
  "RESERVATION_CLIENT",
  "LIBERATION_RESERVATION_CLIENT",
  "RESERVATION_EVENEMENT",
  "LIBERATION_RESERVATION_EVENEMENT",
  "SORTIE_EVENEMENT",
  "RETOUR_EVENEMENT",
  "CADEAU",
  "ECHANTILLON",
  "PERTE_CASSE",
  "CORRECTION_INVENTAIRE",
  "MISE_EN_DEPOT",
  "RETOUR_DE_DEPOT",
  "OUVERTURE_BOITE",
  "ENTREE_TRANSIT",
  "RECEPTION_TRANSIT",
  "ASSEMBLAGE_COMPOSITE",
  "DESASSEMBLAGE_COMPOSITE",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const REFERENCE_TYPES = ["CLIENT", "ORDER", "EVENT", "PARTNER", "OTHER"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

// --- 1. Table racine skus (décision D1) ---
export const skus = mysqlTable("skus", {
  sku: varchar("sku", { length: 50 }).primaryKey(),
  kind: mysqlEnum("kind", SKU_KINDS).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Research Pool: documentaire et strictement cigar-only. Un POOL_ID ne vaut
// jamais admission au catalogue; canonical_cigar_id reste donc nullable.
export const cigarResearchPool = mysqlTable("cigar_research_pool", {
  poolId: varchar("pool_id", { length: 40 }).primaryKey(),
  sourceCigarId: varchar("source_cigar_id", { length: 20 }),
  canonicalCigarId: varchar("canonical_cigar_id", { length: 20 }),
  brand: varchar("brand", { length: 150 }).notNull(),
  line: varchar("line", { length: 255 }).notNull(),
  vitole: varchar("vitole", { length: 255 }),
  format: varchar("format", { length: 150 }),
  boxPressed: boolean("box_pressed"),
  boxCount: int("box_count"),
  length: varchar("length", { length: 50 }),
  ring: int("ring"),
  dimensions: varchar("dimensions", { length: 100 }),
  strength: varchar("strength", { length: 50 }),
  sourcingRating: varchar("sourcing_rating", { length: 20 }),
  originCountry: varchar("origin_country", { length: 150 }),
  owner: varchar("owner", { length: 255 }),
  factory: varchar("factory", { length: 255 }),
  madeBy: varchar("made_by", { length: 255 }),
  wrapper: text("wrapper"),
  binder: text("binder"),
  filler: text("filler"),
  productStatus: varchar("product_status", { length: 255 }),
  technicalKey: varchar("technical_key", { length: 700 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceVersion: varchar("source_version", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  technicalKeyUq: uniqueIndex("uq_research_pool_technical_key").on(table.technicalKey),
  searchIdx: index("idx_research_pool_search").on(table.brand, table.line, table.vitole),
  factoryIdx: index("idx_research_pool_factory").on(table.factory),
  madeByIdx: index("idx_research_pool_made_by").on(table.madeBy),
  canonicalIdx: index("idx_research_pool_canonical").on(table.canonicalCigarId),
}));

export const cigarResearchPoolEvidence = mysqlTable("cigar_research_pool_evidence", {
  id: varchar("id", { length: 40 }).primaryKey(),
  poolId: varchar("pool_id", { length: 40 }).notNull()
    .references(() => cigarResearchPool.poolId, { onDelete: "cascade", onUpdate: "cascade" }),
  rankingSource: mysqlEnum("ranking_source", ["CA", "CJ"]).notNull(),
  rankingYear: int("ranking_year").notNull(),
  rankingRank: int("ranking_rank").notNull(),
  rankingRating: int("ranking_rating"),
  officialSourceUrl: text("official_source_url"),
  rankingSourceUrl: text("ranking_source_url"),
  secondarySourceUrl: text("secondary_source_url"),
  confidence: varchar("confidence", { length: 50 }),
  rawPayload: json("raw_payload"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueAppearance: uniqueIndex("uq_pool_evidence_appearance").on(
    table.poolId, table.rankingSource, table.rankingYear, table.rankingRank,
  ),
  rankingIdx: index("idx_pool_evidence_ranking").on(table.rankingSource, table.rankingYear),
}));

// --- 2. Référentiel CIGAR_ID, séparé de products ---
export const cigarCatalog = mysqlTable("cigar_catalog", {
  cigarId: varchar("cigar_id", { length: 20 }).primaryKey(), // importé du Master externe, jamais généré ici (décision A)
  marque: varchar("marque", { length: 100 }).notNull(),
  ligne: varchar("ligne", { length: 150 }).notNull(),
  vitole: varchar("vitole", { length: 150 }).notNull(),
  format: varchar("format", { length: 100 }),
  dimensions: varchar("dimensions", { length: 50 }),
  ringGauge: int("ring_gauge"),
  pays: varchar("pays", { length: 100 }),
  sourceRef: varchar("source_ref", { length: 255 }),
  poolId: varchar("pool_id", { length: 40 })
    .references(() => cigarResearchPool.poolId, { onDelete: "set null", onUpdate: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  // décision B : index non-unique (variations d'accents/espacement dans les données source)
  marqueLigneVitoleIdx: index("idx_cigar_catalog_mlv").on(table.marque, table.ligne, table.vitole),
  poolIdUq: uniqueIndex("uq_cigar_catalog_pool_id").on(table.poolId),
}));

// --- DNA Research & Approval — Task 22 informelle ---
export const cigarDnaReviewStatusValues = [
  "DRAFT",
  "RESEARCHED",
  "REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

export const cigarDnaReviews = mysqlTable("cigar_dna_reviews", {
  cigarId: varchar("cigar_id", { length: 20 })
    .primaryKey()
    .references(() => cigarCatalog.cigarId, { onDelete: "cascade", onUpdate: "cascade" }),

  status: mysqlEnum("status", cigarDnaReviewStatusValues)
    .notNull()
    .default("DRAFT"),

  proposedProfile: json("proposed_profile"),
  finalProfile: json("final_profile"),

  memoResearch: text("memo_research"),
  memoValidation: text("memo_validation"),

  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index("idx_cigar_dna_reviews_status").on(table.status),
}));

export const dnaResearchCases = mysqlTable("dna_research_cases", {
  caseId: varchar("case_id", { length: 40 }).primaryKey(),
  poolId: varchar("pool_id", { length: 40 })
    .references(() => cigarResearchPool.poolId, { onDelete: "set null", onUpdate: "cascade" }),
  cigarId: varchar("cigar_id", { length: 20 })
    .references(() => cigarCatalog.cigarId, { onDelete: "set null", onUpdate: "cascade" }),
  status: mysqlEnum("status", cigarDnaReviewStatusValues).notNull().default("DRAFT"),
  caseType: mysqlEnum("case_type", ["CREATE", "UPDATE"]).notNull().default("CREATE"),
  researchMode: mysqlEnum("research_mode", ["AGENT", "DIRECT"]),
  currentProfileSnapshot: json("current_profile_snapshot"),
  proposedProfile: json("proposed_profile"),
  finalProfile: json("final_profile"),
  memoResearch: text("memo_research"),
  memoValidation: text("memo_validation"),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  poolStatusIdx: index("idx_dna_cases_pool_status").on(table.poolId, table.status),
  cigarIdx: index("idx_dna_cases_cigar").on(table.cigarId),
  statusIdx: index("idx_dna_cases_status").on(table.status),
}));

// --- 3. Accessoires, table séparée (décision C1) ---
export const accessories = mysqlTable("accessories", {
  sku: varchar("sku", { length: 50 }).primaryKey().references(() => skus.sku),
  nom: varchar("nom", { length: 255 }).notNull(),
  marque: varchar("marque", { length: 100 }),
  description: text("description"),
  prixUnitaire: int("prix_unitaire"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// --- 4. Configuration des tailles de Pack — PAR SKU (correction 1, plus de packSku séparé) ---
export const packSizeConfig = mysqlTable("pack_size_config", {
  id: int("id").primaryKey().autoincrement(),
  sku: varchar("sku", { length: 50 }).notNull().references(() => skus.sku),
  packSize: int("pack_size").notNull(), // >0, vérifié en application + trigger
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  skuPackSizeIdx: index("idx_pack_size_config_sku").on(table.sku),
  uniqueSkuPackSize: uniqueIndex("uq_pack_size_config_sku_size").on(table.sku, table.packSize),
}));

// --- 5. Stock Central : solde matérialisé ---
// Clé composite (sku, type, packSize) — correction 2 : packSize fait partie de
// l'identité physique. Sentinelle packSize=0 pour Box/Loose/Accessory.
// Toutes les quantités en unsigned : empêche les valeurs négatives au niveau
// du type de colonne, portable quelle que soit la version MySQL/MariaDB
// (contrairement à un CHECK, dont le support est incertain ici — voir notes
// de déploiement : hébergement WHC.ca / cPanel, version non confirmée).
export const stockBalances = mysqlTable("stock_balances", {
  sku: varchar("sku", { length: 50 }).notNull().references(() => skus.sku),
  type: mysqlEnum("type", STOCK_TYPES).notNull(),
  packSize: int("pack_size").notNull().default(0),
  onHandQty: int("on_hand_qty", { unsigned: true }).notNull().default(0),
  reservedClientQty: int("reserved_client_qty", { unsigned: true }).notNull().default(0),
  reservedEventQty: int("reserved_event_qty", { unsigned: true }).notNull().default(0),
  atEventQty: int("at_event_qty", { unsigned: true }).notNull().default(0),
  depositQty: int("deposit_qty", { unsigned: true }).notNull().default(0),
  transitQty: int("transit_qty", { unsigned: true }).notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  lastMovementGroupId: varchar("last_movement_group_id", { length: 36 }),
}, (table) => ({
  pk: primaryKey({ columns: [table.sku, table.type, table.packSize] }),
}));
// Règles appliquées par trigger (voir migration custom 0001_stock_triggers.sql), pas par CHECK :
//  - (type='Pack' AND packSize>0) OR (type<>'Pack' AND packSize=0)
//  - type='Loose' -> transitQty doit rester à 0 (Loose interdit en transit — décision correction 2)
//  - type='Loose' -> (onHandQty+depositQty+atEventQty) <= 4 (total physique, pas seulement onHand)
// availableNow / reservationDeficit : jamais stockés, toujours calculés en requête (décision G, corrigée par amendement 3) :
//   availableNow       = GREATEST(0, onHandQty - reservedClientQty - reservedEventQty)
//   reservationDeficit = GREATEST(0, reservedClientQty + reservedEventQty - onHandQty)

// --- 5b. Physical-location projection (Phase 2) ---
// stock_balances remains the aggregate compatibility projection. These rows are
// maintained atomically by the same storage transaction and must reconcile to it.
export const stockLocations = mysqlTable("stock_locations", {
  locationId: varchar("location_id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  category: mysqlEnum("category", STOCK_LOCATION_CATEGORIES).notNull(),
  active: boolean("active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  codeUq: uniqueIndex("uq_stock_locations_code").on(table.code),
  categoryIdx: index("idx_stock_locations_category").on(table.category),
}));

export const stockLocationBalances = mysqlTable("stock_location_balances", {
  locationId: varchar("location_id", { length: 36 }).notNull()
    .references(() => stockLocations.locationId, { onDelete: "restrict", onUpdate: "cascade" }),
  sku: varchar("sku", { length: 50 }).notNull().references(() => skus.sku),
  type: mysqlEnum("type", STOCK_TYPES).notNull(),
  packSize: int("pack_size").notNull().default(0),
  onHandQty: int("on_hand_qty", { unsigned: true }).notNull().default(0),
  reservedClientQty: int("reserved_client_qty", { unsigned: true }).notNull().default(0),
  reservedEventQty: int("reserved_event_qty", { unsigned: true }).notNull().default(0),
  atEventQty: int("at_event_qty", { unsigned: true }).notNull().default(0),
  depositQty: int("deposit_qty", { unsigned: true }).notNull().default(0),
  transitQty: int("transit_qty", { unsigned: true }).notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  lastMovementGroupId: varchar("last_movement_group_id", { length: 36 }),
}, (table) => ({
  pk: primaryKey({ columns: [table.locationId, table.sku, table.type, table.packSize] }),
  stockIdentityIdx: index("idx_stock_location_balances_identity").on(table.sku, table.type, table.packSize),
}));

// --- 6. Ledger de mouvements, append-only, une ligne par (mouvement x bucket) ---
export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").primaryKey().autoincrement(),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  sku: varchar("sku", { length: 50 }).notNull().references(() => skus.sku),
  type: mysqlEnum("type", STOCK_TYPES).notNull(),
  packSize: int("pack_size").notNull().default(0),
  balanceField: mysqlEnum("balance_field", BALANCE_FIELDS).notNull(),
  movementType: mysqlEnum("movement_type", MOVEMENT_TYPES).notNull(),
  qtyDelta: int("qty_delta").notNull(), // signé : pas unsigned ici, le signe est la donnée
  qtyBefore: int("qty_before", { unsigned: true }).notNull(),
  qtyAfter: int("qty_after", { unsigned: true }).notNull(),
  referenceType: mysqlEnum("reference_type", REFERENCE_TYPES),
  referenceLabel: varchar("reference_label", { length: 255 }),
  referenceId: varchar("reference_id", { length: 100 }),
  motif: text("motif"),
  comment: text("comment"),
  author: varchar("author", { length: 100 }).notNull(),
  movementDate: timestamp("movement_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  historyIdx: index("idx_stock_movements_history").on(table.sku, table.type, table.balanceField, table.createdAt),
  groupIdx: index("idx_stock_movements_group").on(table.groupId),
  typeDateIdx: index("idx_stock_movements_type_date").on(table.movementType, table.createdAt),
}));

// --- 7. dna_leads (amendements 4b, 6) ---
export const dnaLeads = mysqlTable("dna_leads", {
  id: int("id").primaryKey().autoincrement(),
  clientRequestId: varchar("client_request_id", { length: 36 }).notNull().unique(), // idempotence retry (amendement 6 : le retry lui-même reste côté client)
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  dnaProfileId: varchar("dna_profile_id", { length: 20 }).notNull(), // texte, pas de FK : les 36 profils restent hors base
  answersSnapshot: json("answers_snapshot").notNull(),
  refinementsSnapshot: json("refinements_snapshot").notNull(),
  recommendationsShown: json("recommendations_shown"),
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").notNull(),
  capturedAtStep: mysqlEnum("captured_at_step", ["STEP4_WITH_RESULTS", "STEP6_ZERO_CASE"]).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  profileIdx: index("idx_dna_leads_profile").on(table.dnaProfileId),
}));
// Pas de colonne saveStatus (amendement 6) : une ligne qui existe est par
// définition sauvegardée. L'état "en échec, à réessayer" est un état de
// transport côté client (outbox localStorage, retried jusqu'à 2xx), jamais
// une valeur persistée ici.

// --- 8. dna_availability_watch (amendements 4a, 4b, 5) ---
export const dnaAvailabilityWatch = mysqlTable("dna_availability_watch", {
  id: int("id").primaryKey().autoincrement(),
  leadId: int("lead_id").notNull().unique().references(() => dnaLeads.id), // amendement 4a : unique -> idempotence à la création
  dnaProfileId: varchar("dna_profile_id", { length: 20 }).notNull(), // copie dénormalisée du lead
  answersSnapshot: json("answers_snapshot").notNull(), // amendement 4b : gelé ici, pas une simple référence au lead
  refinementsSnapshot: json("refinements_snapshot").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "TRIGGERED", "CLOSED"]).notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
  triggeredAt: timestamp("triggered_at"),
  closedAt: timestamp("closed_at"),
  firstMatchCigarIds: json("first_match_cigar_ids"), // amendement 5 : liste, pas un seul CIGAR_ID
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  lastEvaluatedEngineVersion: varchar("last_evaluated_engine_version", { length: 20 }), // traçabilité anti-divergence moteur DNA
}, (table) => ({
  statusIdx: index("idx_dna_watch_status").on(table.status),
}));

// --- 9. priorisation (priorité commerciale de liquidation, DNA Curator V2) ---
// Ne couvre QUE les SKU ayant une priorité commerciale explicite (P1/P2) --
// un SKU absent de cette table participe normalement au moteur DNA par son
// seul score (aucune ligne ici != exclu du Curator; l'exclusion complète se
// fait en amont, au niveau du stock/catalogue, comme un stock=0). La fenêtre
// d'application (score >= meilleur_score - 5) et l'ordre P1 avant P2 sont une
// responsabilité de la fonction de priorisation, pas de cette table.
export const priorisation = mysqlTable("priorisation", {
  id: int("id").primaryKey().autoincrement(),
  sku: varchar("sku", { length: 50 }).notNull().references(() => skus.sku),
  priorityLevel: int("priority_level").notNull(), // 1 ou 2
  active: boolean("active").notNull().default(true),
  reason: varchar("reason", { length: 500 }),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"), // NULL = sans expiration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  skuIdx: index("idx_priorisation_sku").on(table.sku),
  activeIdx: index("idx_priorisation_active").on(table.active),
}));

// --- Zod insert schemas + types ---
export const insertCigarCatalogSchema = createInsertSchema(cigarCatalog);
export const insertCigarResearchPoolSchema = createInsertSchema(cigarResearchPool).omit({ createdAt: true, updatedAt: true });
export const insertDnaResearchCaseSchema = createInsertSchema(dnaResearchCases).omit({ createdAt: true, updatedAt: true });
export const insertCigarDnaReviewSchema = createInsertSchema(cigarDnaReviews).omit({ createdAt: true, updatedAt: true });
export const insertAccessorySchema = createInsertSchema(accessories);
export const insertPackSizeConfigSchema = createInsertSchema(packSizeConfig).pick({ sku: true, packSize: true, active: true });
export const insertStockLocationSchema = createInsertSchema(stockLocations).omit({ createdAt: true, updatedAt: true });
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true, qtyBefore: true, qtyAfter: true });
export const insertDnaLeadSchema = createInsertSchema(dnaLeads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDnaAvailabilityWatchSchema = createInsertSchema(dnaAvailabilityWatch).omit({ id: true, createdAt: true, triggeredAt: true, closedAt: true });

export type Sku = typeof skus.$inferSelect;
export type CigarCatalog = typeof cigarCatalog.$inferSelect;
export type CigarResearchPool = typeof cigarResearchPool.$inferSelect;
export type CigarResearchPoolEvidence = typeof cigarResearchPoolEvidence.$inferSelect;
export type DnaResearchCase = typeof dnaResearchCases.$inferSelect;
export type CigarDnaReview = typeof cigarDnaReviews.$inferSelect;
export type InsertCigarDnaReview = z.infer<typeof insertCigarDnaReviewSchema>;
export type InsertCigarCatalog = z.infer<typeof insertCigarCatalogSchema>;
export type Accessory = typeof accessories.$inferSelect;
export type InsertAccessory = z.infer<typeof insertAccessorySchema>;
export type PackSizeConfig = typeof packSizeConfig.$inferSelect;
export type StockBalance = typeof stockBalances.$inferSelect;
export type StockLocation = typeof stockLocations.$inferSelect;
export type InsertStockLocation = z.infer<typeof insertStockLocationSchema>;
export type StockLocationBalance = typeof stockLocationBalances.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type DnaLead = typeof dnaLeads.$inferSelect;
export type InsertDnaLead = z.infer<typeof insertDnaLeadSchema>;
export type DnaAvailabilityWatch = typeof dnaAvailabilityWatch.$inferSelect;
export type Priorisation = typeof priorisation.$inferSelect;
export type InsertPriorisation = typeof priorisation.$inferInsert;
export type InsertDnaAvailabilityWatch = z.infer<typeof insertDnaAvailabilityWatchSchema>;
