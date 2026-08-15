import { mysqlTable, varchar, text, int, boolean, timestamp, index } from 'drizzle-orm/mysql-core';
import { createInsertSchema } from 'drizzle-zod';
import { products } from './schema.mysql';
import { skus, cigarCatalog } from './schema.stock';

export const bundles = mysqlTable('bundles', {
  sku: varchar('sku', { length: 50 }).primaryKey().references(() => skus.sku),
  nom: varchar('nom', { length: 255 }).notNull(),
  description: text('description'),
  prixBundle: int('prix_bundle').notNull(),
  prixSuggere: int('prix_suggere'),
  imageUrl: varchar('image_url', { length: 500 }),
  availabilityStatus: varchar('availability_status', { length: 20 }).default('IN_STOCK'),
  soldOutAt: timestamp('sold_out_at'),
  inCatalogue: boolean('in_catalogue').default(true),
  promo: int('promo_pourcentage'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  availabilityIdx: index('idx_availability').on(table.availabilityStatus),
  catalogueIdx: index('idx_catalogue').on(table.inCatalogue),
}));

export const bundleItems = mysqlTable('bundle_items', {
  id: int('id').primaryKey().autoincrement(),
  bundleSku: varchar('bundle_sku', { length: 50 }).notNull().references(() => bundles.sku, { onDelete: 'cascade' }),
  // Nullable (était NOT NULL) : un composant peut n'avoir aucun SKU, par ex.
  // les composants Horacio (SLED/Jacques Chancel/Colosso/Bolosos) identifiés
  // seulement par CIGAR_ID, jamais achetés séparément par CitiCigars.
  productSku: varchar('product_sku', { length: 50 }).references(() => products.sku),
  // Toujours renseigné quand connu, même si productSku l'est aussi (évite un
  // JOIN vers products pour le contrôle de disponibilité DNA par CIGAR_ID).
  // Cohérence productSku<->componentCigarId vérifiée par trigger, pas par
  // simple CHECK "au moins un des deux non nul" (voir migration custom).
  componentCigarId: varchar('component_cigar_id', { length: 20 }).references(() => cigarCatalog.cigarId),
  quantite: int('quantite').notNull(),
  prixUnitaire: int('prix_unitaire'),
  marque: varchar('marque', { length: 100 }),
  modele: varchar('modele', { length: 255 }),
  rating: varchar('rating', { length: 50 }),
  top25: varchar('top25', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  bundleIdx: index('idx_bundle').on(table.bundleSku),
  productIdx: index('idx_product').on(table.productSku),
  componentCigarIdx: index('idx_bundle_items_component_cigar_id').on(table.componentCigarId),
}));

export const insertBundleSchema = createInsertSchema(bundles);
export const insertBundleItemSchema = createInsertSchema(bundleItems);

export type Bundle = typeof bundles.$inferSelect;
export type InsertBundle = typeof bundles.$inferInsert;
export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = typeof bundleItems.$inferInsert;
