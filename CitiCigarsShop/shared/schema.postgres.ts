import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
});

export const products = pgTable("products", {
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
  ringGauge: integer("ring_gauge"),
  diametre: text("diametre"),
  qteBoite: integer("qte_boite"),
  quantiteBoite: integer("quantite_boite"),
  quantitePack: integer("quantite_pack"),
  typePack: integer("type_pack"),
  puissance: integer("puissance"),
  rating: text("rating"),
  top25: boolean("top25").default(false),
  rank: integer("rank"),
  year: integer("year"),
  prixUnitaire: integer("prix_unitaire"),
  prixBoite: integer("prix_boite"),
  prixPack: integer("prix_pack"),
  inCatalogue: boolean("in_catalogue").default(true),
  coupDeCoeur: boolean("coup_de_coeur").default(false),
  type: varchar("type", { length: 50 }).default("standard"),
  description: text("description"),
  origine: text("origine"),
  promotions: json("promotions"),
  badges: json("badges"),
  composition: json("composition"),
  prixBundle: integer("prix_bundle"),
  ficheTechnique: json("fiche_technique"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sku: varchar("sku", { length: 50 }).notNull().references(() => products.sku, { onDelete: "cascade" }),
  type: text("type").notNull(),
  data: text("data").notNull(),
  url: text("url"),
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
