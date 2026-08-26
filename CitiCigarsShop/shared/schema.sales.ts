import { mysqlTable, varchar, text, int, decimal, timestamp, mysqlEnum, index, unique, json } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { customers } from "./schema.crm";
import { STOCK_TYPES, stockLocations, stockMovementGroups } from "./schema.stock";

// ---------------------------------------------------------------------------
// ORDERS
// Phase 1: cost/margin columns exist but stay NULL until Phase 2 rebuilds
// historical CMP. Never fabricate a margin. See order_source below for
// idempotent historical import tracking.
// ---------------------------------------------------------------------------

export const orderStatusValues = ["DRAFT", "CONFIRMED", "PAID", "CANCELLED"] as const;
export const orderSourceValues = ["historical_import", "manual", "online"] as const;

export const orders = mysqlTable(
  "orders",
  {
    orderId: varchar("order_id", { length: 36 }).primaryKey(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.customerId, { onDelete: "restrict" }),
    orderDate: timestamp("order_date").notNull(),
    status: mysqlEnum("status", orderStatusValues).notNull().default("CONFIRMED"),
    currency: varchar("currency", { length: 3 }).notNull().default("XAF"),

    subtotalRegularTotalXaf: int("subtotal_regular_total_xaf").notNull(),
    productDiscountsTotalXaf: int("product_discounts_total_xaf").notNull().default(0),
    subtotalAfterDiscountsXaf: int("subtotal_after_discounts_xaf").notNull(),
    extraCustomerDiscountXaf: int("extra_customer_discount_xaf").notNull().default(0),
    finalSaleTotalXaf: int("final_sale_total_xaf").notNull(),

    // Phase 2 fields — nullable on purpose (see Challenge A, validated)
    totalCostXaf: int("total_cost_xaf"),
    grossMarginXaf: int("gross_margin_xaf"),
    grossMarginRate: decimal("gross_margin_rate", { precision: 6, scale: 4 }),

    amountPaid: int("amount_paid").notNull().default(0),
    balanceDue: int("balance_due").notNull().default(0),
    paymentDate: timestamp("payment_date"),

    source: mysqlEnum("source", orderSourceValues).notNull().default("manual"),
    // Idempotent historical import tracking
    sourceSystem: varchar("source_system", { length: 100 }),
    sourceRecordId: varchar("source_record_id", { length: 255 }),
    sourceRowHash: varchar("source_row_hash", { length: 64 }),
    importBatchId: varchar("import_batch_id", { length: 36 }),

    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    customerIdx: index("idx_orders_customer").on(table.customerId),
    orderDateIdx: index("idx_orders_date").on(table.orderDate),
    // Prevents re-running the same historical import from duplicating a sale.
    // NULL source_record_id rows (manual/online orders) are unaffected —
    // MySQL unique indexes treat NULLs as distinct.
    sourceUniqueIdx: unique("uq_orders_source_record").on(table.sourceSystem, table.sourceRecordId),
  })
);

// ---------------------------------------------------------------------------
// ORDER ITEMS
// item_type discriminates PRODUCT vs BUNDLE. Only one of product_sku /
// bundle_sku is populated — enforced at the application layer (see
// services/sales.ts) since MySQL cannot express "exactly one of two FKs"
// as a portable CHECK across our Drizzle/MySQL version cleanly.
// ---------------------------------------------------------------------------

export const orderItemTypeValues = ["PRODUCT", "BUNDLE", "ACCESSORY", "SERVICE", "CUSTOM"] as const;
export const stockDispositionValues = ["CONSUME", "NON_STOCK"] as const;

export const orderItems = mysqlTable(
  "order_items",
  {
    orderItemId: varchar("order_item_id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 })
      .notNull()
      .references(() => orders.orderId, { onDelete: "cascade" }),

    itemType: mysqlEnum("item_type", orderItemTypeValues).notNull(),
    // Generic CitiCigars SKU — intentionally NOT a foreign key. A line can
    // be a cigar product (CTCG-NI-*/CTCG-RD-*), a bundle (CTCG-BDL-*), an
    // accessory (CTCG-ACC-*) or a non-stock service (CTCG-SRV-*, e.g.
    // CTCG-SRV-VAL "Valorisation de l'ensemble"). These live in different
    // catalogues today (products/bundles) or in none at all (services), so
    // a single strict FK would either exclude whole categories of real
    // historical sales or force premature unification of catalogues that
    // don't share a table yet. See CLAUDE_CONTINUE_NOW.md section 3.
    itemSku: varchar("item_sku", { length: 50 }).notNull(),
    // Historical snapshot of the item's brand/series/vitole AT THE TIME OF
    // SALE — plain text columns, deliberately NOT a FK to a product
    // catalogue table. This data already exists in the source (Master
    // Gestion 12_Mouvements) and was being silently dropped on import for
    // lack of a place to put it. A catalogue FK is not required to keep
    // it — these are transaction-time facts, same spirit as
    // standardUnitCostXaf below (sourced, preserved, never reconstructed).
    brand: varchar("brand", { length: 255 }),
    series: varchar("series", { length: 255 }),
    vitole: varchar("vitole", { length: 255 }),
    // Populated only for item_type='CUSTOM' — historical gift/prestige
    // offers sold without a proper catalogue SKU (e.g. "Coffret Prestige
    // VVIP — historique"). NULL otherwise.
    customLabel: varchar("custom_label", { length: 500 }),

    quantity: int("quantity").notNull(),
    regularUnitPriceXaf: int("regular_unit_price_xaf").notNull(),
    promoUnitPriceXaf: int("promo_unit_price_xaf"),
    effectiveUnitPriceXaf: int("effective_unit_price_xaf").notNull(),
    lineSubtotalXaf: int("line_subtotal_xaf").notNull(),
    allocatedOrderDiscountXaf: int("allocated_order_discount_xaf").notNull().default(0),
    actualLineRevenueXaf: int("actual_line_revenue_xaf").notNull(),
    actualUnitPriceXaf: int("actual_unit_price_xaf").notNull(),

    // Historical/sourced cost fields (Master Gestion final). These are NOT
    // a reconstructed Phase-2 CMP — they are the source's own standard vs.
    // actual cost distinction, preserved as-is per explicit instruction:
    //   standard_*  = théorique/standard cost (what the line "should" cost)
    //   actual_line_cost_xaf = cost really incurred for that transaction
    // actual_line_cost_xaf is NOT required to equal quantity * standard
    // unit cost (e.g. a delivery service done in-house vs. subcontracted
    // exceptionally) — never "fixed" to force equality.
    standardUnitCostXaf: decimal("standard_unit_cost_xaf", { precision: 12, scale: 4 }),
    standardLineCostXaf: decimal("standard_line_cost_xaf", { precision: 12, scale: 4 }),
    actualLineCostXaf: decimal("actual_line_cost_xaf", { precision: 12, scale: 4 }),
    costVarianceVsStandardXaf: decimal("cost_variance_vs_standard_xaf", { precision: 12, scale: 4 }),

    // True Phase 2 fields — CMP-derived margin, still nullable until the
    // Purchase/Inventory/CMP engine exists. Distinct from the sourced
    // standard/actual cost above.
    unitCostAtSaleXaf: int("unit_cost_at_sale_xaf"),
    totalCostXaf: int("total_cost_xaf"),
    lineMarginXaf: int("line_margin_xaf"),
    marginRate: decimal("margin_rate", { precision: 6, scale: 4 }),

    // Idempotent historical import tracking, same convention as orders
    sourceSystem: varchar("source_system", { length: 100 }),
    sourceRecordId: varchar("source_record_id", { length: 255 }),

    // M7 CRM -> Stock contract. Nullable for historical rows; every new
    // manual sale must explicitly classify each line in manual-sale.ts.
    stockDisposition: mysqlEnum("stock_disposition", stockDispositionValues),
    stockType: mysqlEnum("stock_type", STOCK_TYPES),
    stockPackSize: int("stock_pack_size"),
    stockSourceLocationId: varchar("stock_source_location_id", { length: 36 })
      .references(() => stockLocations.locationId, { onDelete: "restrict", onUpdate: "cascade" }),
    stockMovementGroupId: varchar("stock_movement_group_id", { length: 36 })
      .references(() => stockMovementGroups.groupId, { onDelete: "restrict", onUpdate: "cascade" }),
    stockNonConsumptionReason: varchar("stock_non_consumption_reason", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    orderIdx: index("idx_order_items_order").on(table.orderId),
    itemSkuIdx: index("idx_order_items_item_sku").on(table.itemSku),
    sourceUniqueIdx: unique("uq_order_items_source_record").on(table.sourceSystem, table.sourceRecordId),
    stockSourceIdx: index("idx_order_items_stock_source").on(table.stockSourceLocationId),
    stockMovementGroupUq: unique("uq_order_items_stock_movement_group").on(table.stockMovementGroupId),
  })
);

// ---------------------------------------------------------------------------
// ORDER ITEM COMPONENTS
// Snapshot of a bundle/custom offer's composition AT THE MOMENT OF SALE.
// bundle_items (the live catalogue definition) can change later without
// ever altering what a historical sale actually consisted of.
//
// IMPORTANT: component_sku is intentionally NOT a foreign key to
// products.sku. Historical custom gift offers (Coffrets Prestige VVIP,
// Humidor & Triumph, etc.) contain a mix of cigars, bundles, accessories
// (CTCG-ACC-*) and services (CTCG-SRV-*) — not all of which exist as rows
// in `products`. This table is a generic, immutable snapshot identified by
// (component_sku, component_type, component_label) as they were recorded
// at the time, not a live relational reference. Phase 2's real stock
// movements will resolve component_sku against whichever table is
// appropriate for its component_type.
// ---------------------------------------------------------------------------

export const componentTypeValues = ["CIGAR_BOX", "BUNDLE", "ACCESSORY", "SERVICE", "OTHER"] as const;

export const orderItemComponents = mysqlTable(
  "order_item_components",
  {
    orderItemComponentId: varchar("order_item_component_id", { length: 60 }).primaryKey(),
    orderItemId: varchar("order_item_id", { length: 36 })
      .notNull()
      .references(() => orderItems.orderItemId, { onDelete: "cascade" }),
    componentSku: varchar("component_sku", { length: 50 }).notNull(), // NOT a FK — see note above
    componentType: mysqlEnum("component_type", componentTypeValues).notNull(),
    componentLabel: varchar("component_label", { length: 500 }).notNull(),
    quantityPerItem: int("quantity_per_item").notNull(),
    totalQuantity: int("total_quantity").notNull(), // quantityPerItem * order_items.quantity
    // Phase 2 — nullable, filled once CMP exists at time of sale
    unitCostAtSaleXaf: int("unit_cost_at_sale_xaf"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    orderItemIdx: index("idx_order_item_components_item").on(table.orderItemId),
    componentSkuIdx: index("idx_order_item_components_sku").on(table.componentSku),
  })
);

// ---------------------------------------------------------------------------
// Zod insert schemas + types
// ---------------------------------------------------------------------------

export const insertOrderSchema = createInsertSchema(orders).omit({
  orderId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  orderItemId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderItemComponentSchema = createInsertSchema(orderItemComponents).omit({
  orderItemComponentId: true,
  createdAt: true,
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItemComponent = typeof orderItemComponents.$inferSelect;
export type InsertOrderItemComponent = z.infer<typeof insertOrderItemComponentSchema>;

// ---------------------------------------------------------------------------
// SAVED VIEWS — Transaction Explorer
// Lightweight persistence for recurring filter sets ("Créances ouvertes",
// "Gifting", "Oliva", ...). Filters are stored as opaque JSON matching the
// explorer's filter shape (server/services/transaction-explorer.ts) — this
// table has no opinion on what a filter looks like, it just persists it.
// ---------------------------------------------------------------------------

export const crmSavedViews = mysqlTable(
  "crm_saved_views",
  {
    savedViewId: varchar("saved_view_id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    filters: json("filters").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    nameIdx: index("idx_saved_views_name").on(table.name),
  })
);

export const insertCrmSavedViewSchema = createInsertSchema(crmSavedViews).omit({
  savedViewId: true,
  createdAt: true,
  updatedAt: true,
});
export type CrmSavedView = typeof crmSavedViews.$inferSelect;
export type InsertCrmSavedView = z.infer<typeof insertCrmSavedViewSchema>;
