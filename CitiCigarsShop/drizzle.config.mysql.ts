import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations-mysql",
  // Corrigé (Stock Central) : schema.mysql.ts référence maintenant des tables
  // définies dans schema.stock.ts (skus, cigar_catalog...) et schema.bundles.ts
  // les référence aussi — un seul fichier ne suffit plus à drizzle-kit pour
  // générer un diff complet (les FK pointaient vers des tables jamais créées).
  schema: ["./shared/schema.stock.ts", "./shared/schema.mysql.ts", "./shared/schema.bundles.ts"],
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
