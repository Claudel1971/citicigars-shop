// Explicit aggregation of every active MySQL schema module.
// Do NOT replace this with a glob import: schema.postgres.ts must never be
// picked up here, and drizzle.config.mysql.ts mirrors this exact file list.
export * from "./schema.mysql";
export * from "./schema.bundles";
export * from "./schema.crm";
export * from "./schema.sales";
