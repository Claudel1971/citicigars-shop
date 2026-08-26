import type { Express, Request, Response } from "express";
import { requireAdminAuth } from "./middleware/auth";
import {
  getMovementGroup,
  getStockSummary,
  getStockTraceability,
} from "./services/stock-traceability";
import {
  parseHistoryPage,
  resolveIdentityFilter,
  TraceabilityConsistencyError,
  TraceabilityInputError,
  TraceabilityNotFoundError,
} from "./services/stock-traceability-model";

function sendTraceabilityError(res: Response, error: unknown) {
  if (error instanceof TraceabilityInputError) return res.status(400).json({ error: error.code });
  if (error instanceof TraceabilityNotFoundError) return res.status(404).json({ error: error.code });
  if (error instanceof TraceabilityConsistencyError) {
    return res.status(409).json({ error: "stock_traceability_inconsistent", details: error.details });
  }
  console.error("[stock traceability read API]", error);
  return res.status(500).json({ error: "stock_traceability_read_failed" });
}

function queryValue(req: Request, key: string) {
  const value = req.query[key];
  return Array.isArray(value) ? value[0] : value;
}

export function registerStockTraceabilityRoutes(app: Express) {
  app.get("/api/admin/stock/movements/:groupId", requireAdminAuth, async (req, res) => {
    try {
      res.json(await getMovementGroup(req.params.groupId));
    } catch (error) {
      sendTraceabilityError(res, error);
    }
  });

  app.get("/api/admin/stock/:sku/traceability", requireAdminAuth, async (req, res) => {
    try {
      const identity = resolveIdentityFilter(queryValue(req, "type"), queryValue(req, "packSize"), true);
      const page = parseHistoryPage(queryValue(req, "limit"), queryValue(req, "offset"));
      res.json(await getStockTraceability({
        sku: req.params.sku,
        type: identity.type!,
        packSize: identity.packSize!,
      }, page));
    } catch (error) {
      sendTraceabilityError(res, error);
    }
  });

  app.get("/api/admin/stock/:sku", requireAdminAuth, async (req, res) => {
    try {
      const filter = resolveIdentityFilter(queryValue(req, "type"), queryValue(req, "packSize"), false);
      res.json(await getStockSummary(req.params.sku, filter));
    } catch (error) {
      sendTraceabilityError(res, error);
    }
  });
}
