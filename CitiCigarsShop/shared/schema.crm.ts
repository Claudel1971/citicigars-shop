import { sql } from "drizzle-orm";
import { mysqlTable, varchar, text, timestamp, json, mysqlEnum, index, date, foreignKey, unique, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------

export const customerStatusValues = [
  "PROSPECT",
  "QUALIFIED",
  "CUSTOMER",
  "DORMANT",
  "LOST",
] as const;

export const customerTypeValues = ["B2C", "CORPORATE", "PARTNER", "OTHER"] as const;

export const customers = mysqlTable(
  "customers",
  {
    customerId: varchar("customer_id", { length: 36 }).primaryKey(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    phoneWhatsapp: varchar("phone_whatsapp", { length: 30 }), // normalized E.164, e.g. +237...
    phoneRaw: varchar("phone_raw", { length: 50 }), // original value pre-normalization, kept for audit
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }).default("Cameroun"),
    customerType: mysqlEnum("customer_type", customerTypeValues).default("B2C"),
    companyName: varchar("company_name", { length: 255 }),
    jobTitle: varchar("job_title", { length: 255 }),
    source: varchar("source", { length: 100 }),
    status: mysqlEnum("status", customerStatusValues).default("PROSPECT"),
    // CTCG-CUST-000000 (CitiCigars itself, used for internal stock
    // movements) must be excludable from external customer/acquisition
    // KPIs without a special-cased id check scattered across queries.
    isInternal: boolean("is_internal").notNull().default(false),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    blacklistReason: varchar("blacklist_reason", { length: 500 }),
    blacklistedAt: timestamp("blacklisted_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    phoneIdx: index("idx_customers_phone").on(table.phoneWhatsapp),
    statusIdx: index("idx_customers_status").on(table.status),
    blacklistedIdx: index("idx_customers_blacklisted").on(table.isBlacklisted),
  })
);

// ---------------------------------------------------------------------------
// CUSTOMER INTERACTIONS  (append-only: never overwrite history)
// ---------------------------------------------------------------------------

export const interactionDirectionValues = ["INBOUND", "OUTBOUND"] as const;
export const interactionSourceTypeValues = ["manual", "whatsapp_paste", "dna", "api", "system"] as const;
export const interactionCreatedByValues = ["human", "ai", "system"] as const;

export const customerInteractions = mysqlTable(
  "customer_interactions",
  {
    interactionId: varchar("interaction_id", { length: 36 }).primaryKey(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.customerId, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 30 }).notNull(), // whatsapp, call, in_person, email...
    interactionDate: timestamp("interaction_date").notNull(),
    direction: mysqlEnum("direction", interactionDirectionValues).notNull(),
    rawText: text("raw_text"),
    summary: text("summary").notNull(),
    productsMentioned: json("products_mentioned"),
    interest: varchar("interest", { length: 255 }),
    nextAction: text("next_action"),
    nextActionAt: date("next_action_at"),
    sourceType: mysqlEnum("source_type", interactionSourceTypeValues).notNull().default("manual"),
    createdBy: mysqlEnum("created_by", interactionCreatedByValues).notNull().default("human"),
    // Nullable + unique: MySQL allows multiple NULLs in a unique index, so
    // pre-existing rows (manual interactions, historical data) are unaffected
    // — no backfill needed. Idempotence key for /analyze-conversation/validate
    // (WhatsApp Analysis, 22 août 2026) : le client génère un clientRequestId
    // une seule fois par proposition analysée et le réutilise si /validate est
    // rappelé (double clic, retry) — même stratégie que dna_leads/customer_dna.
    sourceRequestId: varchar("source_request_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    customerIdx: index("idx_interactions_customer").on(table.customerId),
    nextActionIdx: index("idx_interactions_next_action").on(table.nextActionAt),
    sourceRequestUnique: unique("uq_interactions_source_request").on(table.sourceRequestId),
  })
);

// ---------------------------------------------------------------------------
// CUSTOMER DNA  (destination of the existing, external DNA/Curator engine —
// this table NEVER recomputes or redefines the DNA model, it only stores it)
// ---------------------------------------------------------------------------

export const customerDna = mysqlTable(
  "customer_dna",
  {
    dnaId: varchar("dna_id", { length: 36 }).primaryKey(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.customerId, { onDelete: "cascade" }),
    profileCode: varchar("profile_code", { length: 50 }), // e.g. one of the 36 DNA profiles
    profileName: varchar("profile_name", { length: 255 }),
    profileTagline: varchar("profile_tagline", { length: 500 }),
    family: varchar("family", { length: 100 }),
    engineVersion: varchar("engine_version", { length: 50 }),
    fullPayload: json("full_payload"), // raw output from the DNA engine, kept as-is
    testedAt: timestamp("tested_at").notNull(),
    // Optional idempotency key the DNA engine MAY send (e.g. its own result
    // id) so re-sending the same result never creates a duplicate row here.
    // Nullable + unique: MySQL allows multiple NULLs in a unique index, so
    // engines that don't send one are unaffected.
    sourceRequestId: varchar("source_request_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    customerIdx: index("idx_dna_customer").on(table.customerId),
    testedAtIdx: index("idx_dna_tested_at").on(table.testedAt),
    sourceRequestUnique: unique("uq_dna_source_request").on(table.sourceRequestId),
  })
);

// ---------------------------------------------------------------------------
// CRM FOLLOWUPS  (first-class object — distinct from raw interaction text,
// so a followup can be tracked as OPEN / DONE / CANCELLED over time)
// ---------------------------------------------------------------------------

export const followupStatusValues = ["OPEN", "DONE", "CANCELLED"] as const;

export const crmFollowups = mysqlTable(
  "crm_followups",
  {
    followupId: varchar("followup_id", { length: 36 }).primaryKey(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.customerId, { onDelete: "cascade" }),
    sourceInteractionId: varchar("source_interaction_id", { length: 36 }),
    action: text("action").notNull(),
    dueAt: date("due_at").notNull(),
    status: mysqlEnum("status", followupStatusValues).notNull().default("OPEN"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    customerIdx: index("idx_followups_customer").on(table.customerId),
    dueAtIdx: index("idx_followups_due_at").on(table.dueAt),
    statusIdx: index("idx_followups_status").on(table.status),
    // Explicit short FK name — the Drizzle-generated default name exceeds
    // MySQL's 64-char identifier limit (real bug caught by testing against
    // an actual MySQL instance, not just reviewing the generated SQL).
    sourceInteractionFk: foreignKey({
      columns: [table.sourceInteractionId],
      foreignColumns: [customerInteractions.interactionId],
      name: "fk_followups_source_interaction",
    }).onDelete("set null"),
  })
);

// ---------------------------------------------------------------------------
// Zod insert schemas + types
// ---------------------------------------------------------------------------

export const insertCustomerSchema = createInsertSchema(customers).omit({
  customerId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCustomerInteractionSchema = createInsertSchema(customerInteractions).omit({
  interactionId: true,
  createdAt: true,
});
export const insertCustomerDnaSchema = createInsertSchema(customerDna).omit({
  dnaId: true,
  createdAt: true,
});
export const insertCrmFollowupSchema = createInsertSchema(crmFollowups).omit({
  followupId: true,
  createdAt: true,
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type InsertCustomerInteraction = z.infer<typeof insertCustomerInteractionSchema>;
export type CustomerDna = typeof customerDna.$inferSelect;
export type InsertCustomerDna = z.infer<typeof insertCustomerDnaSchema>;
export type CrmFollowup = typeof crmFollowups.$inferSelect;
export type InsertCrmFollowup = z.infer<typeof insertCrmFollowupSchema>;
