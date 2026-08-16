// Les 3 endpoints P0 DNA (mission V6 §14) : disponibilité live, contact, watch.
// Ne modifie jamais le frontend DNA — ce fichier existe pour que resolveDnaPool()
// puisse être branché en live plus tard, sans changer son contrat.

import type { Express, Request, Response } from "express";
import { stockStorage } from "./storage.stock";

const MAX_CIGAR_IDS_PER_BATCH = 500;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function registerDnaRoutes(app: Express): void {
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

  // POST /api/dna/contact — persistance dna_leads, idempotent sur clientRequestId.
  app.post("/api/dna/contact", async (req: Request, res: Response) => {
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
        !isNonEmptyString(contact.phone)
      ) {
        res.status(400).json({ error: "invalid_request", message: "Champs requis manquants." });
        return;
      }

      // Décision de consentement de Claudel (remplace toute logique précédente) :
      // rejeté si absent, false, ou toute valeur autre que le booléen strict true.
      // Le backend ne fabrique jamais consentGiven=true lui-même.
      if (body.consentGiven !== true) {
        res.status(400).json({ error: "consent_required", message: "consentGiven doit être explicitement true." });
        return;
      }

      if (body.captureMode !== "normal" && body.captureMode !== "zero") {
        res.status(400).json({ error: "invalid_capture_mode", message: "captureMode doit valoir normal ou zero." });
        return;
      }

      const { lead, created } = await stockStorage.upsertLeadIdempotent({
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
      });

      res.status(200).json({ ok: true, leadId: lead.id, created });
    } catch (error) {
      console.error("Error in POST /api/dna/contact:", error);
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
