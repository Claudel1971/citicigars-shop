import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db.mysql";
import { customers } from "../shared/schema.crm";
import { requireAdminAuth } from "./middleware/auth";
import * as crmService from "./services/crm";
import { ingestDnaResult } from "./services/dna-intake";
import { analyzeConversation } from "./services/whatsapp-analysis";
import { dryRunHistoricalImport, runHistoricalImport } from "./services/historical-import";
import { queryTransactions, buildTransactionExportWorkbook } from "./services/transaction-explorer";
import { createManualSale } from "./services/manual-sale";
import { crmSavedViews } from "../shared/schema.sales";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";

// /api/dna/contact hardening (see CLAUDE_CONTINUE_NOW / prior discussion):
// no browser-side secret — a value embedded in client-side JS is not a
// secret. Origin/CORS allowlist is already enforced globally in
// server/index.ts, which covers this endpoint too. V1 protection here is:
// strict Zod validation (reject anything outside the DNA contract), a
// dedicated rate limit, a small body-size cap, structured rejection
// logging, and idempotence via sourceRequestId (already implemented in
// dna-intake.ts).
const dnaContactRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // generous for a single Curator instance, tight enough to blunt abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessayez dans un instant." },
});

const dnaContactSchema = z
  .object({
    contactName: z.string().max(255).nullable().optional(),
    contactPhone: z.string().max(50).nullable().optional(),
    contactEmail: z.string().email().max(255).nullable().optional(),
    profileCode: z.string().min(1).max(50),
    profileName: z.string().min(1).max(255),
    profileTagline: z.string().max(500).nullable().optional(),
    family: z.string().max(100).nullable().optional(),
    engineVersion: z.string().min(1).max(50),
    testedAt: z.string().datetime().optional(),
    sourceRequestId: z.string().max(100).nullable().optional(),
    fullPayload: z.record(z.string(), z.unknown()),
  })
  .strict(); // reject any field outside the DNA contract — no arbitrary data accepted

function dnaContactBodyGuard(req: any, res: any, next: any) {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const MAX_BYTES = 200 * 1024; // 200KB — generous for a DNA payload, small enough to blunt abuse
  if (contentLength > MAX_BYTES) {
    console.warn(`[dna/contact] rejected: payload too large (${contentLength} bytes)`);
    return res.status(413).json({ error: "Payload trop volumineux" });
  }
  next();
}

export function registerCrmRoutes(app: Express) {
  // -------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------

  app.get("/api/crm/customers", requireAdminAuth, async (req, res) => {
    try {
      const { status, search } = req.query;
      const rows = await crmService.listCustomers({
        status: typeof status === "string" ? status : undefined,
        search: typeof search === "string" ? search : undefined,
      });
      res.json(rows);
    } catch (error) {
      console.error("[GET /api/crm/customers]", error);
      res.status(500).json({ error: "Erreur lors de la récupération des clients" });
    }
  });

  app.get("/api/crm/customers/:id", requireAdminAuth, async (req, res) => {
    try {
      const detail = await crmService.getCustomerDetail(req.params.id);
      if (!detail) return res.status(404).json({ error: "Client introuvable" });
      res.json(detail);
    } catch (error) {
      console.error("[GET /api/crm/customers/:id]", error);
      res.status(500).json({ error: "Erreur lors de la récupération du client" });
    }
  });

  app.post("/api/crm/customers", requireAdminAuth, async (req, res) => {
    try {
      const result = await crmService.createCustomer(req.body);
      res.status(result.wasExistingDuplicate ? 200 : 201).json(result);
    } catch (error) {
      console.error("[POST /api/crm/customers]", error);
      res.status(500).json({ error: "Erreur lors de la création du client" });
    }
  });

  app.put("/api/crm/customers/:id", requireAdminAuth, async (req, res) => {
    try {
      const updated = await crmService.updateCustomer(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Client introuvable" });
      res.json(updated);
    } catch (error) {
      console.error("[PUT /api/crm/customers/:id]", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du client" });
    }
  });

  // -------------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------------

  app.post("/api/crm/customers/:id/interactions", requireAdminAuth, async (req, res) => {
    try {
      const interaction = await crmService.addInteraction({
        ...req.body,
        customerId: req.params.id,
      });
      res.status(201).json(interaction);
    } catch (error) {
      console.error("[POST /api/crm/customers/:id/interactions]", error);
      res.status(500).json({ error: "Erreur lors de l'ajout de l'interaction" });
    }
  });

  // -------------------------------------------------------------------
  // Followups
  // -------------------------------------------------------------------

  app.get("/api/crm/followups", requireAdminAuth, async (_req, res) => {
    try {
      const followups = await crmService.listOpenFollowups();
      res.json(followups);
    } catch (error) {
      console.error("[GET /api/crm/followups]", error);
      res.status(500).json({ error: "Erreur lors de la récupération des relances" });
    }
  });

  app.post("/api/crm/followups", requireAdminAuth, async (req, res) => {
    try {
      const followup = await crmService.createFollowup(req.body);
      res.status(201).json(followup);
    } catch (error) {
      console.error("[POST /api/crm/followups]", error);
      res.status(500).json({ error: "Erreur lors de la création de la relance" });
    }
  });

  app.put("/api/crm/followups/:id/complete", requireAdminAuth, async (req, res) => {
    try {
      await crmService.completeFollowup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[PUT /api/crm/followups/:id/complete]", error);
      res.status(500).json({ error: "Erreur lors de la clôture de la relance" });
    }
  });

  app.put("/api/crm/followups/:id/cancel", requireAdminAuth, async (req, res) => {
    try {
      await crmService.cancelFollowup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[PUT /api/crm/followups/:id/cancel]", error);
      res.status(500).json({ error: "Erreur lors de l'annulation de la relance" });
    }
  });

  // -------------------------------------------------------------------
  // DNA intake — contract preserved as instructed: /api/dna/contact.
  // NOT under requireAdminAuth by default since it's meant to be called by
  // the external DNA engine, not a logged-in admin. Protect it instead with
  // its own shared secret if/when the DNA engine can send one — flagged as
  // an open point in the delivery report (see "points restant à valider").
  // -------------------------------------------------------------------

  app.post("/api/dna/contact", dnaContactRateLimit, dnaContactBodyGuard, async (req, res) => {
    const parsed = dnaContactSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("[dna/contact] rejected: invalid payload", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })),
        ip: req.ip,
      });
      return res.status(400).json({ error: "Payload DNA invalide", issues: parsed.error.issues });
    }
    try {
      const result = await ingestDnaResult(parsed.data);
      res.status(201).json(result);
    } catch (error) {
      console.warn("[dna/contact] rejected: ingestion error", {
        message: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      res.status(400).json({ error: error instanceof Error ? error.message : "Requête invalide" });
    }
  });

  // -------------------------------------------------------------------
  // WhatsApp V1.5 analysis — AI proposes, human validates, then writes.
  // -------------------------------------------------------------------

  app.post("/api/crm/analyze-conversation", requireAdminAuth, async (req, res) => {
    try {
      const { rawText } = req.body;
      const existingCustomers = await db
        .select({
          customerId: customers.customerId,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phoneWhatsapp: customers.phoneWhatsapp,
        })
        .from(customers);
      const proposal = await analyzeConversation(rawText, existingCustomers);
      res.json(proposal);
    } catch (error) {
      console.error("[POST /api/crm/analyze-conversation]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Analyse impossible" });
    }
  });

  /**
   * Called only after human review/correction of the proposal returned by
   * /analyze-conversation. This is the ONLY endpoint that actually writes
   * to customers/customer_interactions/crm_followups as a result of a
   * WhatsApp analysis — never the /analyze-conversation endpoint itself.
   */
  app.post("/api/crm/analyze-conversation/validate", requireAdminAuth, async (req, res) => {
    try {
      const { customerId, newCustomer, interaction, followup } = req.body;

      let resolvedCustomerId = customerId as string | undefined;

      if (!resolvedCustomerId && newCustomer) {
        const { customer } = await crmService.createCustomer(newCustomer);
        resolvedCustomerId = customer.customerId;
      }

      if (!resolvedCustomerId) {
        return res.status(400).json({ error: "customerId ou newCustomer requis" });
      }

      const createdInteraction = await crmService.addInteraction({
        ...interaction,
        customerId: resolvedCustomerId,
        sourceType: "whatsapp_paste",
        createdBy: "human", // the write is human-validated, even though the
        // extraction itself was AI-assisted — see brief section 10.
      });

      let createdFollowup = null;
      if (followup?.dueAt && followup?.action) {
        createdFollowup = await crmService.createFollowup({
          customerId: resolvedCustomerId,
          sourceInteractionId: createdInteraction.interactionId,
          action: followup.action,
          dueAt: followup.dueAt,
          status: "OPEN",
        });
      }

      res.status(201).json({
        customerId: resolvedCustomerId,
        interaction: createdInteraction,
        followup: createdFollowup,
      });
    } catch (error) {
      console.error("[POST /api/crm/analyze-conversation/validate]", error);
      res.status(500).json({ error: "Erreur lors de l'enregistrement" });
    }
  });

  // -------------------------------------------------------------------
  // Historical import — dry-run first, always.
  // -------------------------------------------------------------------

  app.post("/api/crm/import/dry-run", requireAdminAuth, async (req, res) => {
    try {
      const report = await dryRunHistoricalImport(req.body.rows ?? []);
      res.json(report);
    } catch (error) {
      console.error("[POST /api/crm/import/dry-run]", error);
      res.status(500).json({ error: "Erreur lors du dry-run d'import" });
    }
  });

  app.post("/api/crm/import/run", requireAdminAuth, async (req, res) => {
    try {
      const importBatchId = req.body.importBatchId || crypto.randomUUID();
      const result = await runHistoricalImport({
        importBatchId,
        approvedRows: req.body.approvedRows ?? [],
      });
      res.json({ importBatchId, ...result });
    } catch (error) {
      console.error("[POST /api/crm/import/run]", error);
      res.status(500).json({ error: "Erreur lors de l'import" });
    }
  });

  // -------------------------------------------------------------------
  // Manual sales — Phase 1 commercial capture.
  // -------------------------------------------------------------------

  app.post("/api/crm/sales", requireAdminAuth, async (req, res) => {
    try {
      const result = await createManualSale(req.body || {});
      res.status(201).json(result);
    } catch (error) {
      console.error("[POST /api/crm/sales]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Vente invalide" });
    }
  });

  // -------------------------------------------------------------------
  // Transaction Explorer — filter + export only, no BI/charts in the CRM.
  // -------------------------------------------------------------------

  app.post("/api/crm/transactions/search", requireAdminAuth, async (req, res) => {
    try {
      const rows = await queryTransactions(req.body || {});
      res.json(rows);
    } catch (error) {
      console.error("[POST /api/crm/transactions/search]", error);
      res.status(500).json({ error: "Erreur lors de la recherche de transactions" });
    }
  });

  app.post("/api/crm/transactions/export", requireAdminAuth, async (req, res) => {
    try {
      const rows = await queryTransactions(req.body || {});
      const buffer = buildTransactionExportWorkbook(rows);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="citicigars-transactions-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      console.error("[POST /api/crm/transactions/export]", error);
      res.status(500).json({ error: "Erreur lors de l'export" });
    }
  });

  app.get("/api/crm/saved-views", requireAdminAuth, async (_req, res) => {
    try {
      const views = await db.select().from(crmSavedViews);
      res.json(views);
    } catch (error) {
      console.error("[GET /api/crm/saved-views]", error);
      res.status(500).json({ error: "Erreur lors de la récupération des vues" });
    }
  });

  app.post("/api/crm/saved-views", requireAdminAuth, async (req, res) => {
    try {
      const { name, filters } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "Nom requis" });
      const savedViewId = crypto.randomUUID();
      await db.insert(crmSavedViews).values({ savedViewId, name, filters } as any);
      const [created] = await db.select().from(crmSavedViews).where(eq(crmSavedViews.savedViewId, savedViewId));
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/crm/saved-views]", error);
      res.status(500).json({ error: "Erreur lors de la création de la vue" });
    }
  });

  app.delete("/api/crm/saved-views/:id", requireAdminAuth, async (req, res) => {
    try {
      await db.delete(crmSavedViews).where(eq(crmSavedViews.savedViewId, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/crm/saved-views/:id]", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la vue" });
    }
  });
}
