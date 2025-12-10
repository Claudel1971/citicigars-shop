import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema.mysql";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Format: mysql://user:password@host:port/database");
}

const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool, { schema, mode: "default" });
