import type { Express, Response } from "express";
import { requireAdminAuth } from "./middleware/auth";
import {
  PurchasingRuleError,
  createPurchaseOrder,
  createReceipt,
  createSupplier,
  getPurchaseOrder,
  getReceipt,
  listPurchaseOrders,
  listReceipts,
  listSuppliers,
  updateSupplier,
} from "./services/purchasing";

export interface PurchasingDependencies {
  listSuppliers: typeof listSuppliers;
  createSupplier: typeof createSupplier;
  updateSupplier: typeof updateSupplier;
  listPurchaseOrders: typeof listPurchaseOrders;
  getPurchaseOrder: typeof getPurchaseOrder;
  createPurchaseOrder: typeof createPurchaseOrder;
  listReceipts: typeof listReceipts;
  getReceipt: typeof getReceipt;
  createReceipt: typeof createReceipt;
}

const defaults: PurchasingDependencies = {
  listSuppliers, createSupplier, updateSupplier, listPurchaseOrders, getPurchaseOrder,
  createPurchaseOrder, listReceipts, getReceipt, createReceipt,
};

function sendError(res: Response, error: unknown) {
  if (error instanceof PurchasingRuleError) {
    const conflict = ["over_receipt_blocked", "idempotency_payload_mismatch", "purchase_order_not_receivable"].includes(error.code);
    const missing = error.code.endsWith("_not_found");
    return res.status(conflict ? 409 : missing ? 404 : 400).json({ error: error.code, message: error.message });
  }
  const databaseCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(databaseCode)) return res.status(409).json({ error: "purchasing_concurrency_conflict" });
  console.error("[purchasing API]", error);
  return res.status(500).json({ error: "purchasing_operation_failed" });
}

export function registerPurchasingRoutes(app: Express, dependencies: PurchasingDependencies = defaults) {
  app.get("/api/admin/purchasing/suppliers", requireAdminAuth, async (_req, res) => {
    try { res.json({ suppliers: await dependencies.listSuppliers() }); } catch (error) { sendError(res, error); }
  });
  app.post("/api/admin/purchasing/suppliers", requireAdminAuth, async (req, res) => {
    try { res.status(201).json(await dependencies.createSupplier(req.body || {})); } catch (error) { sendError(res, error); }
  });
  app.put("/api/admin/purchasing/suppliers/:id", requireAdminAuth, async (req, res) => {
    try { res.json(await dependencies.updateSupplier(req.params.id, req.body || {})); } catch (error) { sendError(res, error); }
  });
  app.get("/api/admin/purchasing/orders", requireAdminAuth, async (_req, res) => {
    try { res.json({ orders: await dependencies.listPurchaseOrders() }); } catch (error) { sendError(res, error); }
  });
  app.get("/api/admin/purchasing/orders/:id", requireAdminAuth, async (req, res) => {
    try { res.json(await dependencies.getPurchaseOrder(req.params.id)); } catch (error) { sendError(res, error); }
  });
  app.post("/api/admin/purchasing/orders", requireAdminAuth, async (req, res) => {
    try {
      const result = await dependencies.createPurchaseOrder(req.body || {});
      res.status(result.idempotentReplay ? 200 : 201).json(result);
    } catch (error) { sendError(res, error); }
  });
  app.get("/api/admin/purchasing/receipts", requireAdminAuth, async (_req, res) => {
    try { res.json({ receipts: await dependencies.listReceipts() }); } catch (error) { sendError(res, error); }
  });
  app.get("/api/admin/purchasing/receipts/:id", requireAdminAuth, async (req, res) => {
    try { res.json(await dependencies.getReceipt(req.params.id)); } catch (error) { sendError(res, error); }
  });
  app.post("/api/admin/purchasing/receipts", requireAdminAuth, async (req, res) => {
    try {
      const result = await dependencies.createReceipt(req.body || {});
      res.status(result.idempotentReplay ? 200 : 201).json(result);
    } catch (error) { sendError(res, error); }
  });
}
