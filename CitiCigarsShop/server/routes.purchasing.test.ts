import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "http";

process.env.CMS_ADMIN_PASSWORD = "purchasing-test";
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/not_used_by_injected_routes";
const { registerPurchasingRoutes } = await import("./routes.purchasing");
const { PurchasingRuleError } = await import("./services/purchasing");

describe("Milestone 8 purchasing routes", () => {
  let server: Server; let base = "";
  const createOrder = vi.fn(async () => ({ purchaseOrderId: "po", idempotentReplay: false }));
  const createReceipt = vi.fn(async () => ({ receiptId: "receipt", idempotentReplay: false }));
  const dependencies = {
    listSuppliers: vi.fn(async () => []), createSupplier: vi.fn(async () => ({ supplierId: "s" })), updateSupplier: vi.fn(async () => ({ updated: true })),
    listPurchaseOrders: vi.fn(async () => []), getPurchaseOrder: vi.fn(async () => ({})), createPurchaseOrder: createOrder,
    listReceipts: vi.fn(async () => []), getReceipt: vi.fn(async () => ({})), createReceipt,
  };
  const token = Buffer.from("purchasing-test").toString("base64");
  const request = (path: string, options: RequestInit = {}) => fetch(base + path, { ...options, headers: { "Content-Type": "application/json", "x-cms-token": token, ...(options.headers || {}) } });
  beforeAll(async () => { const app = express(); app.use(express.json()); registerPurchasingRoutes(app, dependencies as any); server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("bind failed"); base = `http://127.0.0.1:${address.port}`; });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  it("protects every purchasing capability with existing admin auth", async () => {
    for (const [path, method] of [["/api/admin/purchasing/suppliers","GET"],["/api/admin/purchasing/orders","POST"],["/api/admin/purchasing/receipts","POST"]]) {
      expect((await fetch(base + path, { method })).status).toBe(401);
    }
  });
  it("delegates PO and receipt creation and distinguishes retry status", async () => {
    expect((await request("/api/admin/purchasing/orders", { method: "POST", body: "{}" })).status).toBe(201);
    createReceipt.mockResolvedValueOnce({ receiptId: "receipt", idempotentReplay: true });
    expect((await request("/api/admin/purchasing/receipts", { method: "POST", body: "{}" })).status).toBe(200);
    expect(createOrder).toHaveBeenCalledTimes(1); expect(createReceipt).toHaveBeenCalledTimes(1);
  });
  it("maps over-receipt to an actionable conflict", async () => {
    createReceipt.mockRejectedValueOnce(new PurchasingRuleError("over_receipt_blocked", "Quantité supérieure au restant"));
    const response = await request("/api/admin/purchasing/receipts", { method: "POST", body: "{}" });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "over_receipt_blocked" });
  });
});
