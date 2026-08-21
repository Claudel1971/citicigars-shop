import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// IMPORTANT: this must stay an explicit file list, mirroring the exports in
// shared/schema.ts. Never switch to a glob (e.g. "./shared/schema.*.ts") —
// that would accidentally pick up shared/schema.postgres.ts, which is not
// part of the active MySQL schema.
export default defineConfig({
  out: "./migrations-mysql",
  schema: [
    "./shared/schema.mysql.ts",
    "./shared/schema.bundles.ts",
    "./shared/schema.crm.ts",
    "./shared/schema.sales.ts",
  ],
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
