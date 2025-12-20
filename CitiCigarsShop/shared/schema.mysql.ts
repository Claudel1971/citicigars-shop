import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, boolean, json, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
});

export const products = mysqlTable("products", {
  sku: varchar("sku", { length: 50 }).primaryKey(),
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
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
