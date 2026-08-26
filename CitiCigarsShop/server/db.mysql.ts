import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { PoolOptions } from "mysql2";
import * as schema from "../shared/schema.mysql";

if (!process.env.MYSQL_URL) {
  throw new Error("MYSQL_URL must be set. Format: mysql://user:password@host:port/database");
}

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  // mysql2 accepte `false` à l'exécution pour désactiver TLS, mais sa
  // déclaration TypeScript n'expose que string | SslOptions.
  ssl: false as unknown as PoolOptions["ssl"],
  connectTimeout: 30000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const mysqlPool = pool;
export const db = drizzle(pool, { schema, mode: "default" });
