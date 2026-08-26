import type { Express, Response } from "express";
import { z } from "zod";
import { requireAdminAuth } from "./middleware/auth";
import { stockStorage, type ApplyLocationMovementInput } from "./storage.stock";
import { StockRuleViolation } from "./services/stock-movement-processor";
import {
  getStockSummary,
  listReceptionLots,
  listStockLocations,
  listStockPositions,
} from "./services/stock-traceability";
import { resolveIdentityFilter, TraceabilityNotFoundError } from "./services/stock-traceability-model";

export const ADMIN_STOCK_MOVEMENT_TYPES = [
  "RECEPTION",
  "MISE_EN_DEPOT",
  "RETOUR_DE_DEPOT",
  "RESERVATION_CLIENT",
  "LIBERATION_RESERVATION_CLIENT",
  "RESERVATION_EVENEMENT",
  "SORTIE_EVENEMENT",
  "RETOUR_EVENEMENT",
  "CORRECTION_INVENTAIRE",
] as const;

const movementSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  type: z.enum(["Box", "Pack", "Loose", "Accessory"]),
  packSize: z.number().int().nonnegative(),
  movementType: z.enum(ADMIN_STOCK_MOVEMENT_TYPES),
  qty: z.number().int().nonnegative(),
  sourceLocationId: z.string().uuid().optional(),
  destinationLocationId: z.string().uuid().optional(),
  lotId: z.string().uuid().optional(),
  author: z.string().trim().min(1).max(100),
  referenceType: z.enum(["CLIENT", "ORDER", "EVENT", "PARTNER", "OTHER"]).optional(),
  referenceLabel: z.string().trim().max(255).optional(),
  referenceId: z.string().trim().max(100).optional(),
  motif: z.string().trim().max(2000).optional(),
  comment: z.string().trim().max(2000).optional(),
  movementDate: z.string().datetime().optional(),
}).strict().superRefine((value, context) => {
  if (value.movementType !== "CORRECTION_INVENTAIRE" && value.qty < 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["qty"], message: "quantity_must_be_positive" });
  }
  if (value.movementType === "CORRECTION_INVENTAIRE" && !value.motif) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["motif"], message: "correction_reason_required" });
  }
});

export function parseAdminStockMovement(value: unknown): ApplyLocationMovementInput {
  const parsed = movementSchema.parse(value);
  return {
    ...parsed,
    movementDate: parsed.movementDate ? new Date(parsed.movementDate) : undefined,
  } as ApplyLocationMovementInput;
}

export interface StockAdminDependencies {
  listPositions: typeof listStockPositions;
  listLocations: typeof listStockLocations;
  listReceptionLots: typeof listReceptionLots;
  assertSku: (sku: string) => Promise<unknown>;
  applyMovement: (input: ApplyLocationMovementInput) => Promise<unknown>;
}

const defaultDependencies: StockAdminDependencies = {
  listPositions: listStockPositions,
  listLocations: listStockLocations,
  listReceptionLots,
  assertSku: (sku) => getStockSummary(sku, {}),
  applyMovement: (input) => stockStorage.applyLocationMovement(input),
};

function queryString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function sendAdminStockError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "invalid_stock_movement_payload", details: error.flatten() });
  }
  if (error instanceof TraceabilityNotFoundError) return res.status(404).json({ error: error.code });
  if (error instanceof StockRuleViolation) {
    const status = error.code.startsWith("insufficient_") || error.code.includes("exceeds_") ? 409 : 400;
    return res.status(status).json({ error: error.code, message: error.message });
  }
  const databaseCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(databaseCode)) {
    return res.status(409).json({ error: "stock_concurrency_conflict" });
  }
  console.error("[stock admin API]", error);
  return res.status(500).json({ error: "stock_operation_failed" });
}

export function registerStockAdminRoutes(app: Express, dependencies: StockAdminDependencies = defaultDependencies) {
  app.get("/api/admin/stock", requireAdminAuth, async (req, res) => {
    try {
      res.json(await dependencies.listPositions(queryString(req.query.search)));
    } catch (error) {
      sendAdminStockError(res, error);
    }
  });

  app.get("/api/admin/stock/locations", requireAdminAuth, async (_req, res) => {
    try {
      res.json({ locations: await dependencies.listLocations() });
    } catch (error) {
      sendAdminStockError(res, error);
    }
  });

  app.get("/api/admin/stock/reception-lots", requireAdminAuth, async (req, res) => {
    try {
      const sku = queryString(req.query.sku);
      const destinationLocationId = queryString(req.query.destinationLocationId);
      if (!sku || !destinationLocationId) throw new StockRuleViolation("reception_lot_identity_required");
      const identity = resolveIdentityFilter(req.query.type, req.query.packSize, true);
      res.json({ lots: await dependencies.listReceptionLots({
        sku,
        type: identity.type!,
        packSize: identity.packSize!,
        destinationLocationId,
      }) });
    } catch (error) {
      sendAdminStockError(res, error);
    }
  });

  app.post("/api/admin/stock/movements", requireAdminAuth, async (req, res) => {
    try {
      const input = parseAdminStockMovement(req.body);
      await dependencies.assertSku(input.sku);
      const result = await dependencies.applyMovement(input);
      res.status(201).json(result);
    } catch (error) {
      sendAdminStockError(res, error);
    }
  });
}
