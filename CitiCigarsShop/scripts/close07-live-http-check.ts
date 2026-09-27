import { issueAdminToken } from "../server/middleware/auth";

const base = "https://citicigars-api-staging.onrender.com";
const password = process.env.CMS_ADMIN_PASSWORD;
if (!password) throw new Error("CMS_ADMIN_PASSWORD missing");

async function expectStatus(name: string, response: Response, expected: number) {
  if (response.status !== expected) {
    const body = await response.text().catch(() => "");
    throw new Error(`${name}: expected ${expected}, got ${response.status}: ${body.slice(0,300)}`);
  }
  console.log(`PASS ${name}: ${response.status}`);
}

const health = await fetch(`${base}/health`);
await expectStatus("health", health, 200);

const login = await fetch(`${base}/api/content/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
await expectStatus("admin login", login, 200);
const loginBody = await login.json() as any;
if (!loginBody?.token) throw new Error("admin login returned no token");

const unauthStock = await fetch(`${base}/api/admin/stock`);
await expectStatus("stock unauthorized", unauthStock, 401);

const ownerToken = loginBody.token;
const ownerStock = await fetch(`${base}/api/admin/stock`, {
  headers: { "x-cms-token": ownerToken },
});
await expectStatus("stock OWNER read", ownerStock, 200);

const ownerPurchasing = await fetch(`${base}/api/admin/purchasing/suppliers`, {
  headers: { "x-cms-token": ownerToken },
});
await expectStatus("purchasing OWNER read", ownerPurchasing, 200);

const auditorToken = issueAdminToken("AUDITOR").token;
const auditorRead = await fetch(`${base}/api/admin/stock`, {
  headers: { "x-cms-token": auditorToken },
});
await expectStatus("stock AUDITOR read", auditorRead, 200);

const auditorWrite = await fetch(`${base}/api/admin/stock/movements`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-cms-token": auditorToken,
  },
  body: JSON.stringify({}),
});
await expectStatus("stock AUDITOR write denied", auditorWrite, 403);

console.log(JSON.stringify({
  health: 200,
  adminLogin: 200,
  unauthorizedStock: 401,
  ownerStockRead: 200,
  ownerPurchasingRead: 200,
  auditorStockRead: 200,
  auditorStockWrite: 403,
}, null, 2));
