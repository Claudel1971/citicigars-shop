import type { Express, Response } from "express";
import { requireAdminAuth, requirePermission } from "./middleware/auth";
import {
  backofficeDashboard,
  backofficeCosting,
  orderCostTrace,
  backofficeIdentities,
} from "./services/backoffice";

export function registerBackofficeRoutes(app: Express) {
  app.get("/api/admin/session", requireAdminAuth, (req, res) =>
    res.json({
      role: req.adminAuth!.role,
      ct: req.adminAuth!.role === "OWNER",
    }),
  );
  const failed = (res: Response) =>
    res
      .status(503)
      .json({
        error: "Vue indisponible. Aucune donnée estimée n’a été substituée.",
      });
  app.get(
    "/api/admin/backoffice/identities",
    requirePermission("product:read"),
    async (_req, res) => {
      try {
        res.json(await backofficeIdentities());
      } catch {
        failed(res);
      }
    },
  );
  app.get(
    "/api/admin/backoffice/dashboard",
    requirePermission("crm:read"),
    requirePermission("stock:read"),
    async (_req, res) => {
      try {
        res.json(await backofficeDashboard());
      } catch {
        failed(res);
      }
    },
  );
  app.get(
    "/api/admin/backoffice/costing",
    requirePermission("costing:read"),
    async (_req, res) => {
      try {
        res.json(await backofficeCosting());
      } catch {
        failed(res);
      }
    },
  );
  app.get(
    "/api/admin/backoffice/costing/orders/:id",
    requirePermission("costing:read"),
    async (req, res) => {
      if (!/^[A-Za-z0-9-]{1,50}$/.test(req.params.id))
        return res.status(400).json({ error: "Identifiant invalide" });
      try {
        const data = await orderCostTrace(req.params.id);
        res.status(data.lines.length ? 200 : 404).json(data);
      } catch {
        failed(res);
      }
    },
  );
}
