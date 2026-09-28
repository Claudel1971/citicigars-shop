import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { requirePermission } from "./middleware/auth";
import * as service from "./services/internal-admin";
import { parseInternalSheet } from "./services/internal-admin-model";
export function registerInternalAdminRoutes(app: Express) {
  const actor = (r: Request) => `${r.adminAuth!.sub}:${r.adminAuth!.role}`;
  const handle =
    (fn: (req: Request) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        res.json(await fn(req));
      } catch (e) {
        if (e instanceof ZodError)
          return res
            .status(400)
            .json({ error: "Champs invalides", details: e.flatten() });
        if (e instanceof service.InternalAdminError)
          return res.status(e.status).json({ error: e.message });
        res
          .status(503)
          .json({
            error:
              "Référentiel administratif indisponible. Vérifier la migration 0024 et la connexion.",
          });
      }
    };
  for (const kind of ["CUST", "SUPP"] as const)
    app.get(
      `/api/admin/internal/identifiers/${kind}`,
      requirePermission(kind === "CUST" ? "crm:read" : "purchasing:read"),
      handle(() => service.identifiers(kind)),
    );
  app.post(
    "/api/admin/internal/identifiers/sync",
    requirePermission("costing:read"),
    handle(() => service.syncAllIdentifiers()),
  );
  app.get(
    "/api/admin/internal/sheets/:id",
    requirePermission("product:read"),
    handle((r) => service.listInternalSheets(r.params.id)),
  );
  app.post(
    "/api/admin/internal/sheets/parse",
    requirePermission("product:write"),
    handle(async (r) => {
      if (typeof r.body.text !== "string" || r.body.text.length > 50000)
        throw new service.InternalAdminError(400, "Texte invalide");
      return parseInternalSheet(r.body.text);
    }),
  );
  app.post(
    "/api/admin/internal/sheets",
    requirePermission("product:write"),
    handle((r) => service.addInternalSheet(r.body, actor(r))),
  );
  app.get(
    "/api/admin/internal/tasks",
    requirePermission("crm:read"),
    handle((r) =>
      service.listAdminTasks(
        typeof r.query.customerId === "string" ? r.query.customerId : undefined,
      ),
    ),
  );
  app.post(
    "/api/admin/internal/tasks",
    requirePermission("crm:write"),
    handle((r) => service.createAdminTask(r.body, actor(r))),
  );
  app.put(
    "/api/admin/internal/tasks/:id",
    requirePermission("crm:write"),
    handle((r) => service.transitionAdminTask(r.params.id, r.body, actor(r))),
  );
}
