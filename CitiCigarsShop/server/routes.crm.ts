import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db.mysql";
import { customers, customerInteractions, crmFollowups } from "../shared/schema.crm";
import { requireAdminAuth } from "./middleware/auth";
import * as crmService from "./services/crm";
import { analyzeConversation } from "./services/whatsapp-analysis";
import { dryRunHistoricalImport, runHistoricalImport } from "./services/historical-import";
import { queryTransactions, buildTransactionExportWorkbook, getTopProductsByOrderCount } from "./services/transaction-explorer";
import { createManualSale, deleteManualSale } from "./services/manual-sale";
import { crmSavedViews } from "../shared/schema.sales";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";

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


  app.delete("/api/crm/customers/:id", requireAdminAuth, async (req, res) => {
    try {
      const result = await crmService.deleteOrBlacklistCustomer(
        req.params.id,
        typeof req.body?.reason === "string" ? req.body.reason : null
      );
      res.json(result);
    } catch (error) {
      console.error("[DELETE /api/crm/customers/:id]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Suppression impossible" });
    }
  });

  app.put("/api/crm/customers/:id/blacklist", requireAdminAuth, async (req, res) => {
    try {
      const updated = await crmService.setCustomerBlacklist(
        req.params.id,
        Boolean(req.body?.blacklisted),
        typeof req.body?.reason === "string" ? req.body.reason : null
      );
      res.json(updated);
    } catch (error) {
      console.error("[PUT /api/crm/customers/:id/blacklist]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Mise ? jour impossible" });
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


  app.delete("/api/crm/interactions/:id", requireAdminAuth, async (req, res) => {
    try {
      const result = await crmService.deleteManualInteraction(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("[DELETE /api/crm/interactions/:id]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Suppression impossible" });
    }
  });

  // -------------------------------------------------------------------
  // Followups
  // -------------------------------------------------------------------

  app.get("/api/crm/followups", requireAdminAuth, async (req, res) => {
    try {
      const rawStatus = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "OPEN";
      const status = ["OPEN", "DONE", "CANCELLED", "ALL"].includes(rawStatus)
        ? rawStatus as "OPEN" | "DONE" | "CANCELLED" | "ALL"
        : "OPEN";
      const followups = await crmService.listFollowups(status);
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


  app.put("/api/crm/followups/:id/reopen", requireAdminAuth, async (req, res) => {
    try {
      await crmService.reopenFollowup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[PUT /api/crm/followups/:id/reopen]", error);
      res.status(500).json({ error: "Erreur lors de la réouverture de la relance" });
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
  // Relit l'interaction déjà validée pour clientRequestId (+ son followup
  // éventuel) et la renvoie telle quelle — jamais de seconde écriture,
  // jamais d'erreur brute pour un second clic après un succès déjà acté.
  async function loadAlreadyValidated(clientRequestId: string) {
    const [existing] = await db
      .select()
      .from(customerInteractions)
      .where(eq(customerInteractions.sourceRequestId, clientRequestId));
    if (!existing) return null;
    const [existingFollowup] = await db
      .select()
      .from(crmFollowups)
      .where(eq(crmFollowups.sourceInteractionId, existing.interactionId));
    return {
      alreadyValidated: true,
      customerId: existing.customerId,
      interaction: existing,
      followup: existingFollowup ?? null,
    };
  }

  app.post("/api/crm/analyze-conversation/validate", requireAdminAuth, async (req, res) => {
    try {
      const { clientRequestId, customerId, newCustomer, customerUpdates, interaction, followup } = req.body;

      if (!customerId && !newCustomer) {
        return res.status(400).json({ error: "customerId ou newCustomer requis" });
      }

      // Idempotence (22 août 2026) : un clientRequestId généré une seule fois
      // par proposition analysée et réutilisé par le client à chaque tentative
      // de /validate — même stratégie que dna_leads/customer_dna. Chemin
      // rapide, aucune transaction ouverte si déjà validé.
      if (clientRequestId) {
        const already = await loadAlreadyValidated(clientRequestId);
        if (already) return res.status(200).json(already);
      }

      let result;
      try {
        result = await db.transaction(async (tx) => {
          let resolvedCustomerId = customerId as string | undefined;

          if (!resolvedCustomerId && newCustomer) {
            const { customer } = await crmService.createCustomer(newCustomer, tx);
            resolvedCustomerId = customer.customerId;
          }

          if (customerId && customerUpdates) {
            await crmService.updateCustomer(resolvedCustomerId!, customerUpdates, tx);
          }

          const createdInteraction = await crmService.addInteraction(
            {
              ...interaction,
              interactionDate: interaction?.interactionDate ? new Date(interaction.interactionDate) : new Date(),
              nextActionAt: interaction?.nextActionAt ? new Date(interaction.nextActionAt) : null,
              customerId: resolvedCustomerId,
              sourceType: "whatsapp_paste",
              createdBy: "human", // the write is human-validated, even though the
              // extraction itself was AI-assisted — see brief section 10.
              sourceRequestId: clientRequestId ?? null,
            },
            tx
          );

          let createdFollowup = null;
          if (followup?.dueAt && followup?.action) {
            createdFollowup = await crmService.createFollowup(
              {
                customerId: resolvedCustomerId!,
                sourceInteractionId: createdInteraction.interactionId,
                action: followup.action,
                dueAt: followup.dueAt,
                status: "OPEN",
              },
              tx
            );
          }

          return { customerId: resolvedCustomerId, interaction: createdInteraction, followup: createdFollowup };
        }, { isolationLevel: "read committed" });
        // READ COMMITTED, scopée à cette seule transaction — même raison que
        // routes.dna.ts (22 août 2026) : createCustomer()/allocateCustomerId()
        // verrouillent via FOR UPDATE, et sous REPEATABLE READ (défaut) deux
        // transactions concurrentes s'y bloquent en ER_LOCK_DEADLOCK plutôt
        // que de se sérialiser proprement (vérifié empiriquement).
      } catch (e: any) {
        // Course réelle perdue contre un appel concurrent avec le même
        // clientRequestId : celui-ci a déjà committé pendant que cette
        // transaction était en cours — elle est intégralement annulée
        // (customer y compris s'il venait d'être créé), on relit simplement
        // la version gagnante plutôt que de renvoyer une erreur brute.
        // ER_LOCK_DEADLOCK inclus : READ COMMITTED réduit très fortement le
        // risque mais ne l'élimine pas totalement sur une fenêtre de course
        // assez étroite.
        if ((e?.code === "ER_DUP_ENTRY" || e?.code === "ER_LOCK_DEADLOCK") && clientRequestId) {
          const already = await loadAlreadyValidated(clientRequestId);
          if (already) return res.status(200).json(already);
        }
        throw e;
      }

      res.status(201).json(result);
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


  app.delete("/api/crm/sales/:id", requireAdminAuth, async (req, res) => {
    try {
      const result = await deleteManualSale(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("[DELETE /api/crm/sales/:id]", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Suppression impossible" });
    }
  });

  // -------------------------------------------------------------------
  // Transaction Explorer — filter + export only, no BI/charts in the CRM.
  // -------------------------------------------------------------------

  app.get("/api/crm/dashboard/top-products", requireAdminAuth, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 3;
      const rows = await getTopProductsByOrderCount(limit);
      res.json(rows);
    } catch (error) {
      console.error("[GET /api/crm/dashboard/top-products]", error);
      res.status(500).json({ error: "Erreur lors du calcul des produits les plus vendus" });
    }
  });

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
      const buffer = buildTransactionExportWorkbook(rows, req.body?.viewMode === "orders" ? "orders" : "lines");
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
