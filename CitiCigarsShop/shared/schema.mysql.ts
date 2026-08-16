import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, boolean, json, timestamp, customType } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { skus, cigarCatalog } from "./schema.stock";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
});

export const products = mysqlTable("products", {
  sku: varchar("sku", { length: 50 }).primaryKey().references(() => skus.sku),
  // CIGAR_ID : nullable (accessoires/bundles n'en ont pas — mais les bundles ne
  // sont de toute façon pas dans `products`), UNIQUE (amendement 1 : empêche
  // deux SKU différents de pointer vers le même CIGAR_ID par erreur de saisie).
  cigarId: varchar("cigar_id", { length: 20 }).unique().references(() => cigarCatalog.cigarId),
  // Propriété de dimensionnement Box->Pack/Loose, scopée par SKU (cohérent
  // avec pack_size_config qui est lui aussi par SKU, pas par CIGAR_ID).
  cigarsPerBox: int("cigars_per_box"),
  marque: text("marque").notNull(),
  ligne: text("ligne"),
  pays: text("pays"),
  modele: text("modele"),
  vitole: text("vitole"),
  format: text("format"),
  dimensions: text("dimensions"),
  dimensionsMM: text("dimensions_mm"),
  longueur: text("longueur"),
  ringGauge: int("ring_gauge"),
  diametre: text("diametre"),
  qteBoite: int("qte_boite"),
  quantiteBoite: int("quantite_boite"),
  quantitePack: int("quantite_pack"),
  typePack: int("type_pack"),
  puissance: int("puissance"),
  rating: text("rating"),
  top25: boolean("top25").default(false),
  rank: int("rank"),
  year: int("year"),
  prixUnitaire: int("prix_unitaire"),
  prixBoite: int("prix_boite"),
  prixPack: int("prix_pack"),
  inCatalogue: boolean("in_catalogue").default(true),
  availabilityStatus: varchar("availability_status", { length: 20 }).default("IN_STOCK"),
  soldOutAt: timestamp("sold_out_at"),
  coupDeCoeur: boolean("coup_de_coeur").default(false),
  type: varchar("type", { length: 50 }).default("standard"),
  description: text("description"),
  origine: text("origine"),
  promotions: json("promotions"),
  badges: json("badges"),
  composition: json("composition"),
  prixBundle: int("prix_bundle"),
  ficheTechnique: json("fiche_technique"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const productImages = mysqlTable("product_images", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sku: varchar("sku", { length: 50 }).notNull().references(() => products.sku, { onDelete: "cascade" }),
  type: text("type").notNull(),
  data: text("data"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
});

const mediumtext = customType<{ data: string }>({
  dataType() {
    return "mediumtext";
  },
});

// Table historique déjà présente dans le schéma MySQL réel. Sa déclaration
// Drizzle restaure le contrat utilisé par les routes de fiches techniques.
export const productTechnicalSheets = mysqlTable("product_technical_sheets", {
  id: int("id").primaryKey().autoincrement(),
  sku: varchar("sku", { length: 50 }).notNull().unique().references(() => products.sku, { onDelete: "cascade" }),
  smokeType: varchar("smoke_type", { length: 255 }),
  durationMin: int("duration_min"),
  durationMax: int("duration_max"),
  evolution: text("evolution"),
  originCountry: varchar("origin_country", { length: 100 }),
  wrapper: varchar("wrapper", { length: 255 }),
  binder: varchar("binder", { length: 255 }),
  filler: text("filler"),
  wrapperAppearance: text("wrapper_appearance"),
  construction: text("construction"),
  cutting: varchar("cutting", { length: 255 }),
  lighting: text("lighting"),
  draw: text("draw"),
  burn: text("burn"),
  ash: text("ash"),
  smokeQuality: text("smoke_quality"),
  dominantNotes: text("dominant_notes"),
  secondaryNotes: text("secondary_notes"),
  flavorEvolution: text("flavor_evolution"),
  localPositioning: text("local_positioning"),
  ratingScore: int("rating_score"),
  ratingSource: varchar("rating_source", { length: 255 }),
  ratingDate: varchar("rating_date", { length: 50 }),
  top25Rank: int("top25_rank"),
  tastingNotes: mediumtext("tasting_notes"),
  isPremium: boolean("is_premium").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products);
export const insertProductImageSchema = createInsertSchema(productImages).pick({
  sku: true,
  type: true,
  data: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type TechnicalSheet = typeof productTechnicalSheets.$inferSelect;
export type InsertTechnicalSheet = typeof productTechnicalSheets.$inferInsert;
