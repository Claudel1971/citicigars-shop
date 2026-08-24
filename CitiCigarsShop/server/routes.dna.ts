// Les 3 endpoints P0 DNA (mission V6 §14) : disponibilité live, contact, watch.
// Ne modifie jamais le frontend DNA — ce fichier existe pour que resolveDnaPool()
// puisse être branché en live plus tard, sans changer son contrat.

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { stockStorage } from "./storage.stock";
import { db } from "./db.mysql";
import { ingestDnaResult } from "./services/dna-intake";
import { mapCuratorPayloadToCrmIntake } from "./services/dna-crm-mapping";
import { getLiveDnaRankingV2 } from "./services/dna-recommendations-v2";
import {
  customerDna,
  customerDnaRecommendations,
  customerDnaRecommendationEvents,
  customerSourcingInterests,
  customerCigarPreferences,
} from "../shared/schema.crm";

const MAX_CIGAR_IDS_PER_BATCH = 500;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// Défense en profondeur pour POST /api/dna/contact (22 août 2026) — la
// validation réelle par pays (longueur, format) a déjà lieu côté Curator via
// libphonenumber-js ; ce regex ne vérifie que la forme E.164 générique
// (ITU-T E.164 : + suivi de 8 à 15 chiffres, premier chiffre non nul).
const E164_PHONE_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Garde-fous repris tels quels de l'ancien handler mort de routes.crm.ts
// (réconciliation, 20 août) : rate limit dédié + garde de taille de payload.
const dnaContactRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // généreux pour une instance Curator unique, assez strict pour freiner un abus
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessayez dans un instant." },
});

function dnaContactBodyGuard(req: any, res: any, next: any) {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const MAX_BYTES = 200 * 1024; // 200KB — généreux pour un payload DNA, assez petit pour freiner un abus
  if (contentLength > MAX_BYTES) {
    console.warn(`[dna/contact] rejected: payload too large (${contentLength} bytes)`);
    res.status(413).json({ error: "Payload trop volumineux" });
    return;
  }
  next();
}

export function registerDnaRoutes(app: Express): void {
  // Task 5 — scoring DNA V2 sur le snapshot MASTER v5, filtré par le stock
  // commercial réel de Stock Central à chaque requête. Les 12 SKU
  // "Réservé - activation" sont exclus avant scoring.
  app.post("/api/dna/recommendations-v2", async (req: Request, res: Response) => {
    try {
      const client = req.body?.client ?? req.body;
      const result = await getLiveDnaRankingV2(client);
      res.json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("DNA_V2_INVALID_CLIENT_FAMILIES")) {
        return res.status(400).json({ error: "invalid_dna_profile", detail: message });
      }
      if (message.startsWith("DNA_V2_UNRESOLVED_CIGAR_IDS")) {
        return res.status(502).json({ error: "unresolved_cigar_ids", detail: message });
      }
      console.error("DNA V2 recommendations error:", error);
      res.status(500).json({ error: "dna_recommendations_failed" });
    }
  });

  // POST /api/dna/availability — batch unique, disponibilité Pack/Box uniquement.
  // Contrat volontairement identique à liveAvailabilityByCigarId côté moteur
  // (shared/dna-engine.cjs) : { [cigarId]: { packAvailable, boxAvailable } },
  // directement réutilisable sans transformation une fois le live branché.
  app.post("/api/dna/availability", async (req: Request, res: Response) => {
    try {
      const cigarIds = req.body?.cigarIds;
      if (!Array.isArray(cigarIds) || cigarIds.length === 0 || !cigarIds.every(isNonEmptyString)) {
        res.status(400).json({ error: "invalid_request", message: "cigarIds doit être un tableau non vide de chaînes." });
        return;
      }
      if (cigarIds.length > MAX_CIGAR_IDS_PER_BATCH) {
        res.status(400).json({ error: "too_many_cigar_ids", max: MAX_CIGAR_IDS_PER_BATCH });
        return;
      }

      const { resolved, unresolved } = await stockStorage.getAvailabilityForCigarIds(cigarIds);

      if (unresolved.length > 0) {
        // Réponse volontairement NON-2xx et explicite (audit, point 3) : un
        // CIGAR_ID non résolu ne doit jamais être omis silencieusement d'une
        // réponse 200, ce qui produirait un faux "indisponible" indiscernable
        // d'un vrai N=0 côté DNA. Le frontend doit pouvoir distinguer cet état
        // et déclencher RESOLUTION_ERROR plutôt que d'afficher un résultat.
        res.status(502).json({ error: "unresolved_cigar_ids", unresolved, resolved });
        return;
      }

      res.status(200).json({ availability: resolved });
    } catch (error) {
      console.error("Error in POST /api/dna/availability:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/dna/contact — RÉCONCILIÉ (20 août 2026) : contrat HTTP réel du
  // Curator inchangé, mais exécute désormais dans la même requête (1) la
  // persistance événementielle dna_leads et (2) la résolution/création du
  // client CRM + customer_dna. Garde-fous repris de l'ancien handler mort de
  // routes.crm.ts (rate limit, garde de taille, validation stricte,
  // journalisation structurée des rejets) — plus un seul handler pour cette
  // route, l'ancien enregistrement dans routes.crm.ts est retiré.
  app.post("/api/dna/contact", dnaContactRateLimit, dnaContactBodyGuard, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const clientRequestId = body.clientRequestId;
      const participant = body.participant ?? {};
      const customerDNA = body.customerDNA ?? {};
      const refinements = body.refinements ?? {};
      const contact = body.contact ?? {};

      if (
        !isNonEmptyString(clientRequestId) ||
        !isNonEmptyString(participant.firstName) ||
        !isNonEmptyString(participant.lastName) ||
        !isNonEmptyString(customerDNA.id) ||
        !isNonEmptyString(contact.country) ||
        !isNonEmptyString(contact.city) ||
        !isNonEmptyString(contact.phone) ||
        !isNonEmptyString(contact.email)
      ) {
        console.warn("[dna/contact] rejected: invalid_request (champ requis manquant)", {
          hasClientRequestId: isNonEmptyString(clientRequestId),
          hasFirstName: isNonEmptyString(participant.firstName),
          hasLastName: isNonEmptyString(participant.lastName),
          hasDnaId: isNonEmptyString(customerDNA.id),
          hasCountry: isNonEmptyString(contact.country),
          hasCity: isNonEmptyString(contact.city),
          hasPhone: isNonEmptyString(contact.phone),
          hasEmail: isNonEmptyString(contact.email),
        });
        res.status(400).json({ error: "invalid_request", message: "Champs requis manquants." });
        return;
      }

      // Défense en profondeur (22 août 2026) : le Curator assemble et valide déjà
      // le numéro en E.164 via libphonenumber-js côté client avant l'envoi — ce
      // garde-fou ne fait que refuser explicitement tout appel qui contournerait
      // cette validation (jamais silencieusement toléré), même principe que le
      // rejet serveur du consentement juste en dessous.
      if (!E164_PHONE_RE.test(contact.phone)) {
        console.warn("[dna/contact] rejected: invalid_phone_format", { clientRequestId, phone: contact.phone });
        res.status(400).json({
          error: "invalid_phone_format",
          message: "contact.phone doit être un numéro E.164 valide (+indicatif suivi de chiffres, ex. +15148929488).",
        });
        return;
      }
      if (!EMAIL_RE.test(contact.email)) {
        console.warn("[dna/contact] rejected: invalid_email_format", { clientRequestId });
        res.status(400).json({ error: "invalid_email_format", message: "contact.email doit être une adresse email valide." });
        return;
      }

      // Décision de consentement de Claudel (remplace toute logique précédente) :
      // rejeté si absent, false, ou toute valeur autre que le booléen strict true.
      // Le backend ne fabrique jamais consentGiven=true lui-même. Aucune écriture
      // (ni dna_leads ni CRM) tant que ceci n'a pas été validé.
      if (body.consentGiven !== true) {
        console.warn("[dna/contact] rejected: consent_required", { clientRequestId });
        res.status(400).json({ error: "consent_required", message: "consentGiven doit être explicitement true." });
        return;
      }

      if (body.captureMode !== "normal" && body.captureMode !== "zero") {
        console.warn("[dna/contact] rejected: invalid_capture_mode", { clientRequestId, captureMode: body.captureMode });
        res.status(400).json({ error: "invalid_capture_mode", message: "captureMode doit valoir normal ou zero." });
        return;
      }

      // Transaction unique : dna_leads (trace d'événement) + résolution/
      // création client CRM + customer_dna, ensemble ou pas du tout — jamais
      // un dna_leads écrit avec un lien CRM manquant à côté sans le savoir.
      const { lead, created, crm } = await db.transaction(async (tx) => {
        const { lead, created } = await stockStorage.upsertLeadIdempotent(
          {
            clientRequestId,
            firstName: participant.firstName,
            lastName: participant.lastName,
            country: contact.country,
            city: contact.city,
            whatsapp: contact.phone,
            dnaProfileId: customerDNA.id,
            answersSnapshot: {
              power: customerDNA.power ?? null,
              intensity: customerDNA.intensity ?? null,
              family: customerDNA.family ?? null,
              secondaryFamily: customerDNA.secondaryFamily ?? null,
            },
            refinementsSnapshot: {
              spice: refinements.spice ?? null,
              sweetness: refinements.sweetness ?? null,
              signatures: refinements.signatures ?? [],
              duration: refinements.duration ?? null,
              ritualMoments: refinements.ritualMoments ?? [],
            },
            consentGiven: true,
            captureMode: body.captureMode,
          },
          tx
        );

        // Tentée systématiquement, même si le lead existait déjà (retry) :
        // ingestDnaResult() est elle-même idempotente sur sourceRequestId
        // (=clientRequestId), donc un retry après un échec CRM précédent
        // complète le lien manquant au lieu de s'arrêter court sur le lead.
        const crm = await ingestDnaResult(mapCuratorPayloadToCrmIntake(body), tx);

        return { lead, created, crm };
      }, { isolationLevel: "read committed" });
      // READ COMMITTED, scopée à cette seule transaction (SET TRANSACTION ISOLATION
      // LEVEL sans SESSION/GLOBAL ne s'applique qu'à la prochaine transaction sur
      // cette connexion, relâchée au pool ensuite — aucune autre transaction de
      // l'app n'est affectée). Nécessaire car cette transaction fait des relectures
      // après capture d'ER_DUP_ENTRY (dna_leads, customer_dna) : sous REPEATABLE
      // READ (défaut), l'instantané de cette transaction est fixé dès sa première
      // lecture, avant qu'une requête concurrente n'ait committé — une relecture
      // non verrouillée reste alors aveugle à la ligne pourtant déjà committée
      // (vérifié empiriquement sur dna_leads ET customer_dna), et une relecture
      // verrouillée (FOR UPDATE) est explicitement refusée par ce moteur
      // (ER_CHECKREAD) plutôt que de servir la version fraîche.

      res.status(200).json({
        ok: true,
        leadId: lead.id,
        created,
        customerId: crm.customerId,
        wasExistingCustomer: crm.wasExistingCustomer,
        dnaId: crm.dnaId,
      });
    } catch (error) {
      console.error("Error in POST /api/dna/contact:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });



  // -------------------------------------------------------------------------
  // TASK 18 ? Finalisation Page 6 / DNA Run
  //
  // Sauvegarde atomiquement :
  //   Bloc 1 = snapshot immuable des recommandations r?ellement expos?es
  //   Bloc 2 = int?r?ts sourcing, y compris les non-s?lections explicites
  //   Bloc 3 = cigares d?clar?s par le client
  //   customer_dna.page6_completed_at = cl?ture du DNA Run
  //
  // Une fois compl?t?, un run n'est jamais recalcul? ni r??crit.
  // -------------------------------------------------------------------------
  app.post("/api/dna/page6", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      const clientRequestId = body.clientRequestId;
      const customerId = body.customerId;
      const dnaId = body.dnaId;

      const block1 = body.block1 ?? {};
      const block2 = body.block2 ?? {};
      const block3 = body.block3 ?? {};

      if (
        !isNonEmptyString(clientRequestId) ||
        !isNonEmptyString(customerId) ||
        !isNonEmptyString(dnaId)
      ) {
        res.status(400).json({
          error: "invalid_request",
          message: "clientRequestId, customerId et dnaId sont requis.",
        });
        return;
      }

      if (
        !Array.isArray(block1.recommendations) ||
        !Array.isArray(block2.proposals) ||
        !Array.isArray(block3.entries)
      ) {
        res.status(400).json({
          error: "invalid_request",
          message: "Structure Page 6 invalide.",
        });
        return;
      }

      if (
        block2.treated !== true ||
        block3.treated !== true
      ) {
        res.status(409).json({
          error: "page6_incomplete",
          message: "Les Blocs 2 et 3 doivent ?tre trait?s avant la finalisation.",
        });
        return;
      }

      if (block1.recommendations.length > 5 || block3.entries.length > 5) {
        res.status(400).json({
          error: "invalid_request",
          message: "Maximum 5 ?l?ments autoris?s par bloc.",
        });
        return;
      }

      const result = await db.transaction(async (tx) => {
        const runs = await tx
          .select({
            dnaId: customerDna.dnaId,
            customerId: customerDna.customerId,
            sourceRequestId: customerDna.sourceRequestId,
            page6CompletedAt: customerDna.page6CompletedAt,
          })
          .from(customerDna)
          .where(
            and(
              eq(customerDna.dnaId, dnaId),
              eq(customerDna.customerId, customerId),
              eq(customerDna.sourceRequestId, clientRequestId)
            )
          )
          .limit(1)
          .for("update");

        const run = runs[0];

        if (!run) {
          return { error: "dna_run_not_found" };
        }

        // Idempotence + immutabilit? historique :
        // un retry apr?s succ?s ne modifie jamais le snapshot.
        if (run.page6CompletedAt) {
          return {
            ok: true,
            alreadyCompleted: true,
            completedAt: run.page6CompletedAt,
          };
        }

        // Bloc 1 ? snapshot exact de ce qui a ?t? expos? au client.
        if (block1.recommendations.length > 0) {
          await tx.insert(customerDnaRecommendations).values(
            block1.recommendations.map((r: any, index: number) => ({
              customerId,
              dnaId,
              sourceRequestId: clientRequestId,
              cigarId: String(r.cigarId),
              sku: String(r.sku),
              rankPosition: Number(r.rankPosition ?? index + 1),
              dnaScore: String(Number(r.dnaScore ?? r.score ?? 0).toFixed(1)),
              priorityLevel:
                r.priorityLevel === null || r.priorityLevel === undefined
                  ? null
                  : Number(r.priorityLevel),
              packAvailable: r.packAvailable === true,
              boxAvailable: r.boxAvailable === true,
              dnaSourceVersion: block1.sourceVersion ?? null,
              sourcingSourceVersion: block1.sourcingSourceVersion ?? null,
            }))
          );
        }

        // Bloc 2 ? on conserve toutes les propositions expos?es :
        // interested=true/false donne le d?nominateur n?cessaire au funnel.
        if (block2.proposals.length > 0) {
          await tx.insert(customerSourcingInterests).values(
            block2.proposals.map((r: any) => ({
              customerId,
              dnaId,
              sourceRequestId: clientRequestId,
              cigarId: String(r.cigarId),
              sourcingClass: r.sourcingClass,
              dnaScore: String(Number(r.dnaScore ?? r.score ?? 0).toFixed(1)),
              interested: r.interested === true,
            }))
          );
        }

        // Bloc 3 ? pr?f?rences d?clar?es.
        // dimensions_normalized reste obligatoire en DB :
        // r?f?rentiel -> dimension canonique ;
        // "Autre" parseable -> valeur normalis?e ;
        // "Autre" non parseable -> saisie brute conserv?e telle quelle.
        if (block3.entries.length > 0) {
          await tx.insert(customerCigarPreferences).values(
            block3.entries.map((e: any, index: number) => {
              const dimensionsNormalized =
                e.dimensionsNormalized ||
                e.dimension ||
                e.dimensionsRaw;

              if (!isNonEmptyString(dimensionsNormalized)) {
                throw new Error("DNA_PAGE6_INVALID_DIMENSIONS");
              }

              return {
                customerId,
                sourceRequestId: clientRequestId,
                position: index + 1,
                referenceId: e.referenceId ?? null,
                brand: String(e.marque ?? ""),
                line: String(e.ligne ?? ""),
                dimensionsRaw: e.dimensionsRaw ?? null,
                dimensionsNormalized,
                format: e.format ?? null,
                vitola: e.vitole ?? null,
                source: "DNA",
              };
            })
          );
        }

        const completedAt = new Date();

        await tx
          .update(customerDna)
          .set({ page6CompletedAt: completedAt })
          .where(eq(customerDna.dnaId, dnaId));

        return {
          ok: true,
          alreadyCompleted: false,
          completedAt,
          counts: {
            block1: block1.recommendations.length,
            block2: block2.proposals.length,
            block3: block3.entries.length,
          },
        };
      }, { isolationLevel: "read committed" });

      if ("error" in result) {
        if (result.error === "dna_run_not_found") {
          res.status(404).json({
            error: "dna_run_not_found",
            message: "Le DNA Run correspondant est introuvable ou incoh?rent.",
          });
          return;
        }
      }

      res.status(200).json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === "DNA_PAGE6_INVALID_DIMENSIONS") {
        res.status(400).json({
          error: "invalid_dimensions",
          message: "Une pr?f?rence Bloc 3 ne contient aucune dimension exploitable.",
        });
        return;
      }

      console.error("Error in POST /api/dna/page6:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });


  // Task 19 ? attribution d'un clic depuis le Bloc 1 du Curator.
  // Le clic n'est accepte que pour une recommandation effectivement exposee
  // dans ce DNA Run et apres finalisation de la Page 6.
  app.post("/api/dna/recommendation-click", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      const clientRequestId = body.clientRequestId;
      const customerId = body.customerId;
      const dnaId = body.dnaId;
      const sku = body.sku;

      if (
        !isNonEmptyString(clientRequestId) ||
        !isNonEmptyString(customerId) ||
        !isNonEmptyString(dnaId) ||
        !isNonEmptyString(sku)
      ) {
        res.status(400).json({
          error: "invalid_request",
          message: "Identifiants CLICK incomplets.",
        });
        return;
      }

      const rows = await db
        .select({
          recommendationId: customerDnaRecommendations.id,
          customerId: customerDnaRecommendations.customerId,
          dnaId: customerDnaRecommendations.dnaId,
          sku: customerDnaRecommendations.sku,
          page6CompletedAt: customerDna.page6CompletedAt,
        })
        .from(customerDnaRecommendations)
        .innerJoin(
          customerDna,
          eq(customerDna.dnaId, customerDnaRecommendations.dnaId),
        )
        .where(
          and(
            eq(customerDnaRecommendations.sourceRequestId, clientRequestId),
            eq(customerDnaRecommendations.customerId, customerId),
            eq(customerDnaRecommendations.dnaId, dnaId),
            eq(customerDnaRecommendations.sku, sku),
          ),
        )
        .limit(1);

      const recommendation = rows[0];

      if (!recommendation) {
        res.status(404).json({
          error: "recommendation_not_found",
        });
        return;
      }

      if (!recommendation.page6CompletedAt) {
        res.status(409).json({
          error: "dna_run_not_completed",
        });
        return;
      }

      const inserted = await db
        .insert(customerDnaRecommendationEvents)
        .values({
          recommendationId: recommendation.recommendationId,
          customerId,
          dnaId,
          eventType: "CLICK",
          sku: recommendation.sku,
          occurredAt: new Date(),
        });

      const eventId =
        Number((inserted as any)[0]?.insertId ?? 0) || null;

      res.status(201).json({
        ok: true,
        eventType: "CLICK",
        eventId,
        recommendationId: recommendation.recommendationId,
        sku: recommendation.sku,
      });
    } catch (error) {
      console.error("Error in POST /api/dna/recommendation-click:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });


  // POST /api/dna/watch — retrouve le lead via clientRequestId (le frontend n'a
  // jamais besoin de connaître leadId), crée le watch idempotent sur leadId.
  app.post("/api/dna/watch", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const clientRequestId = body.clientRequestId;
      const dnaProfileId = body.dnaProfileId;

      if (!isNonEmptyString(clientRequestId) || !isNonEmptyString(dnaProfileId)) {
        res.status(400).json({ error: "invalid_request", message: "Champs requis manquants." });
        return;
      }

      const answersSnapshot = body.answersSnapshot ?? {};
      const refinementsSnapshot = body.refinementsSnapshot ?? {};

      const result = await stockStorage.upsertWatchIdempotent({
        clientRequestId,
        dnaProfileId,
        answersSnapshot,
        refinementsSnapshot,
      });

      if ("error" in result) {
        if (result.error === "zero_case_required") {
          res.status(409).json({ error: "zero_case_required", message: "Un watch est réservé aux leads capturés dans le cas zéro." });
          return;
        }
        if (result.error === "consent_missing") {
          // Décision de consentement de Claudel : source de vérité unique = le lead
          // persisté (lead.consentGiven), jamais un flag répété dans la requête /watch.
          // 403 : autorisation sur un état existant, pas une erreur de validation de
          // la requête courante (elle-même bien formée).
          res.status(403).json({ error: "consent_missing", message: "Le lead associé n'a pas de consentement enregistré." });
          return;
        }
        res.status(404).json({ error: "lead_not_found", message: "Aucun lead trouvé pour ce clientRequestId — appelez /api/dna/contact d'abord." });
        return;
      }

      res.status(200).json({ ok: true, watchId: result.watch.id, leadId: result.watch.leadId, created: result.created });
    } catch (error) {
      console.error("Error in POST /api/dna/watch:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
