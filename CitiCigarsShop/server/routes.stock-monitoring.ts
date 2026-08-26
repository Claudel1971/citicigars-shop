import type { Express, Response } from "express";
import { requireAdminAuth } from "./middleware/auth";
import { getStockMonitoring } from "./services/stock-monitoring";
import { MonitoringInputError } from "./services/stock-monitoring-model";

export function registerStockMonitoringRoutes(app: Express, readMonitoring = getStockMonitoring) {
  app.get("/api/admin/stock/monitoring", requireAdminAuth, async (req, res: Response) => {
    try { res.json(await readMonitoring(req.query)); }
    catch (error) {
      if (error instanceof MonitoringInputError) return res.status(400).json({ error: error.code });
      console.error("[stock monitoring read API]", error);
      return res.status(500).json({ error: "stock_monitoring_read_failed" });
    }
  });
}
