// Les 3 endpoints P0 DNA (mission V6 §14) : disponibilité live, contact, watch.
// Ne modifie jamais le frontend DNA — ce fichier existe pour que resolveDnaPool()
// puisse être branché en live plus tard, sans changer son contrat.

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { stockStorage } from "./storage.stock";
import { db } from "./db.mysql";
import { ingestDnaResult } from "./services/dna-intake";
import { mapCuratorPayloadToCrmIntake } from "./services/dna-crm-mapping";
import { getLiveDnaRankingV2 } from "./services/dna-recommendations-v2";

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
