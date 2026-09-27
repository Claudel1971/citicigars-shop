import express from "express";
import { createServer } from "http";

const EXPECTED_DB = "bwljrj22_citicigars_admin_staging";
const mysqlUrl = process.env.MYSQL_URL;
if (!mysqlUrl) throw new Error("MYSQL_URL missing");
const dbName = new URL(mysqlUrl).pathname.replace(/^\//, "");
if (dbName !== EXPECTED_DB) throw new Error(`FAIL-CLOSED unexpected DB: ${dbName}`);
if (!process.env.CMS_ADMIN_PASSWORD) throw new Error("CMS_ADMIN_PASSWORD missing");

const { registerRoutes } = await import("../server/routes");
const { issueAdminToken } = await import("../server/middleware/auth");

const app = express();
app.use(express.json({ limit: "2mb" }));
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("local server failed");
const base = `http://127.0.0.1:${address.port}`;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(base + path, init);
  const text = await response.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, body };
}

const results: Record<string, unknown> = {};

try {
  const unauth = await request("/api/admin/stock");
  if (unauth.status !== 401) throw new Error(`RBAC unauth expected 401, got ${unauth.status}`);
  results.rbacUnauthenticated = 401;

  const login = await request("/api/content/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.CMS_ADMIN_PASSWORD }),
  });
  if (login.status !== 200 || !login.body?.token) {
    throw new Error(`admin login failed: ${login.status}`);
  }
  const ownerToken = login.body.token;
  results.adminLogin = "PASS";

  const ownerStock = await request("/api/admin/stock", {
    headers: { "x-cms-token": ownerToken },
  });
  if (ownerStock.status !== 200) throw new Error(`OWNER stock read failed: ${ownerStock.status}`);
  results.ownerStockRead = 200;

  const ownerPurchasing = await request("/api/admin/purchasing/suppliers", {
    headers: { "x-cms-token": ownerToken },
  });
  if (ownerPurchasing.status !== 200) throw new Error(`OWNER purchasing read failed: ${ownerPurchasing.status}`);
  results.ownerPurchasingRead = 200;

  const auditorToken = issueAdminToken("AUDITOR").token;
  const auditorWrite = await request("/api/admin/purchasing/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cms-token": auditorToken },
    body: JSON.stringify({ code: "TEST-RBAC", name: "TEST RBAC" }),
  });
  if (auditorWrite.status !== 403) throw new Error(`AUDITOR write expected 403, got ${auditorWrite.status}`);
  results.auditorWriteDenied = 403;

  console.log(JSON.stringify({
    database: EXPECTED_DB,
    qualification: "RBAC_ADMIN",
    ...results,
    secretValuesLogged: false,
  }, null, 2));
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}
