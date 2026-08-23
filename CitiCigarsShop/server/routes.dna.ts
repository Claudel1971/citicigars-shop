// Les 3 endpoints P0 DNA (mission V6 Â§14) : disponibilitÃ© live, contact, watch.
// Ne modifie jamais le frontend DNA â€” ce fichier existe pour que resolveDnaPool()
// puisse Ãªtre branchÃ© en live plus tard, sans changer son contrat.

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

// DÃ©fense en profondeur pour POST /api/dna/contact (22 aoÃ»t 2026) â€” la
// validation rÃ©elle par pays (longueur, format) a dÃ©jÃ  lieu cÃ´tÃ© Curator via
// libphonenumber-js ; ce regex ne vÃ©rifie que la forme E.164 gÃ©nÃ©rique
// (ITU-T E.164 : + suivi de 8 Ã  15 chiffres, premier chiffre non nul).
const E164_PHONE_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Garde-fous repris tels quels de l'ancien handler mort de routes.crm.ts
// (rÃ©conciliation, 20 aoÃ»t) : rate limit dÃ©diÃ© + garde de taille de payload.
const dnaContactRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // gÃ©nÃ©reux pour une instance Curator unique, assez strict pour freiner un abus
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requÃªtes, rÃ©essayez dans un instant." },
});

function dnaContactBodyGuard(req: any, res: any, next: any) {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const MAX_BYTES = 200 * 1024; // 200KB â€” gÃ©nÃ©reux pour un payload DNA, assez petit pour freiner un abus
  if (contentLength > MAX_BYTES) {
    console.warn(`[dna/contact] rejected: payload too large (${contentLength} bytes)`);
    res.status(413).json({ error: "Payload trop volumineux" });
    return;
  }
  next();
}

export function registerDnaRoutes(app: Express): void {
  // Task 5 â€” scoring DNA V2 sur le snapshot MASTER v5, filtrÃ© par le stock
  // commercial rÃ©el de Stock Central Ã  chaque requÃªte. Les 12 SKU
  // "RÃ©servÃ© - activation" sont exclus avant scoring.
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
  // POST /api/dna/availability â€” batch unique, disponibilitÃ© Pack/Box uniquement.
  // Contrat volontairement identique Ã  liveAvailabilityByCigarId cÃ´tÃ© moteur
  // (shared/dna-engine.cjs) : { [cigarId]: { packAvailable, boxAvailable } },
  // directement rÃ©utilisable sans transformation une fois le live branchÃ©.
  app.post("/api/dna/availability", async (req: Request, res: Response) => {
    try {
      const cigarIds = req.body?.cigarIds;
      if (!Array.isArray(cigarIds) || cigarIds.length === 0 || !cigarIds.every(isNonEmptyString)) {
        res.status(400).json({ error: "invalid_request", message: "cigarIds doit Ãªtre un tableau non vide de chaÃ®nes." });
        return;
      }
      if (cigarIds.length > MAX_CIGAR_IDS_PER_BATCH) {
        res.status(400).json({ error: "too_many_cigar_ids", max: MAX_CIGAR_IDS_PER_BATCH });
        return;
      }

      const { resolved, unresolved } = await stockStorage.getAvailabilityForCigarIds(cigarIds);

      if (unresolved.length > 0) {
        // RÃ©ponse volontairement NON-2xx et explicite (audit, point 3) : un
        // CIGAR_ID non rÃ©solu ne doit jamais Ãªtre omis silencieusement d'une
        // rÃ©ponse 200, ce qui produirait un faux "indisponible" indiscernable
        // d'un vrai N=0 cÃ´tÃ© DNA. Le frontend doit pouvoir distinguer cet Ã©tat
        // et dÃ©clencher RESOLUTION_ERROR plutÃ´t que d'afficher un rÃ©sultat.
        res.status(502).json({ error: "unresolved_cigar_ids", unresolved, resolved });
        return;
      }

      res.status(200).json({ availability: resolved });
    } catch (error) {
      console.error("Error in POST /api/dna/availability:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/dna/contact â€” RÃ‰CONCILIÃ‰ (20 aoÃ»t 2026) : contrat HTTP rÃ©el du
  // Curator inchangÃ©, mais exÃ©cute dÃ©sormais dans la mÃªme requÃªte (1) la
  // persistance Ã©vÃ©nementielle dna_leads et (2) la rÃ©solution/crÃ©ation du
  // client CRM + customer_dna. Garde-fous repris de l'ancien handler mort de
  // routes.crm.ts (rate limit, garde de taille, validation stricte,
  // journalisation structurÃ©e des rejets) â€” plus un seul handler pour cette
  // route, l'ancien enregistrement dans routes.crm.ts est retirÃ©.
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

      // DÃ©fense en profondeur (22 aoÃ»t 2026) : le Curator assemble et valide dÃ©jÃ 
      // le numÃ©ro en E.164 via libphonenumber-js cÃ´tÃ© client avant l'envoi â€” ce
      // garde-fou ne fait que refuser explicitement tout appel qui contournerait
      // cette validation (jamais silencieusement tolÃ©rÃ©), mÃªme principe que le
      // rejet serveur du consentement juste en dessous.
      if (!E164_PHONE_RE.test(contact.phone)) {
        console.warn("[dna/contact] rejected: invalid_phone_format", { clientRequestId, phone: contact.phone });
        res.status(400).json({
          error: "invalid_phone_format",
          message: "contact.phone doit Ãªtre un numÃ©ro E.164 valide (+indicatif suivi de chiffres, ex. +15148929488).",
        });
        return;
      }
      if (!EMAIL_RE.test(contact.email)) {
        console.warn("[dna/contact] rejected: invalid_email_format", { clientRequestId });
        res.status(400).json({ error: "invalid_email_format", message: "contact.email doit Ãªtre une adresse email valide." });
        return;
      }

      // DÃ©cision de consentement de Claudel (remplace toute logique prÃ©cÃ©dente) :
      // rejetÃ© si absent, false, ou toute valeur autre que le boolÃ©en strict true.
      // Le backend ne fabrique jamais consentGiven=true lui-mÃªme. Aucune Ã©criture
      // (ni dna_leads ni CRM) tant que ceci n'a pas Ã©tÃ© validÃ©.
      if (body.consentGiven !== true) {
        console.warn("[dna/contact] rejected: consent_required", { clientRequestId });
        res.status(400).json({ error: "consent_required", message: "consentGiven doit Ãªtre explicitement true." });
        return;
      }

      if (body.captureMode !== "normal" && body.captureMode !== "zero") {
        console.warn("[dna/contact] rejected: invalid_capture_mode", { clientRequestId, captureMode: body.captureMode });
        res.status(400).json({ error: "invalid_capture_mode", message: "captureMode doit valoir normal ou zero." });
        return;
      }

      // Transaction unique : dna_leads (trace d'Ã©vÃ©nement) + rÃ©solution/
      // crÃ©ation client CRM + customer_dna, ensemble ou pas du tout â€” jamais
      // un dna_leads Ã©crit avec un lien CRM manquant Ã  cÃ´tÃ© sans le savoir.
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

        // TentÃ©e systÃ©matiquement, mÃªme si le lead existait dÃ©jÃ  (retry) :
        // ingestDnaResult() est elle-mÃªme idempotente sur sourceRequestId
        // (=clientRequestId), donc un retry aprÃ¨s un Ã©chec CRM prÃ©cÃ©dent
        // complÃ¨te le lien manquant au lieu de s'arrÃªter court sur le lead.
        const crm = await ingestDnaResult(mapCuratorPayloadToCrmIntake(body), tx);

        return { lead, created, crm };
      }, { isolationLevel: "read committed" });
      // READ COMMITTED, scopÃ©e Ã  cette seule transaction (SET TRANSACTION ISOLATION
      // LEVEL sans SESSION/GLOBAL ne s'applique qu'Ã  la prochaine transaction sur
      // cette connexion, relÃ¢chÃ©e au pool ensuite â€” aucune autre transaction de
      // l'app n'est affectÃ©e). NÃ©cessaire car cette transaction fait des relectures
      // aprÃ¨s capture d'ER_DUP_ENTRY (dna_leads, customer_dna) : sous REPEATABLE
      // READ (dÃ©faut), l'instantanÃ© de cette transaction est fixÃ© dÃ¨s sa premiÃ¨re
      // lecture, avant qu'une requÃªte concurrente n'ait committÃ© â€” une relecture
      // non verrouillÃ©e reste alors aveugle Ã  la ligne pourtant dÃ©jÃ  committÃ©e
      // (vÃ©rifiÃ© empiriquement sur dna_leads ET customer_dna), et une relecture
      // verrouillÃ©e (FOR UPDATE) est explicitement refusÃ©e par ce moteur
      // (ER_CHECKREAD) plutÃ´t que de servir la version fraÃ®che.

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


  // POST /api/dna/watch â€” retrouve le lead via clientRequestId (le frontend n'a
  // jamais besoin de connaÃ®tre leadId), crÃ©e le watch idempotent sur leadId.
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
          res.status(409).json({ error: "zero_case_required", message: "Un watch est rÃ©servÃ© aux leads capturÃ©s dans le cas zÃ©ro." });
          return;
        }
        if (result.error === "consent_missing") {
          // DÃ©cision de consentement de Claudel : source de vÃ©ritÃ© unique = le lead
          // persistÃ© (lead.consentGiven), jamais un flag rÃ©pÃ©tÃ© dans la requÃªte /watch.
          // 403 : autorisation sur un Ã©tat existant, pas une erreur de validation de
          // la requÃªte courante (elle-mÃªme bien formÃ©e).
          res.status(403).json({ error: "consent_missing", message: "Le lead associÃ© n'a pas de consentement enregistrÃ©." });
          return;
        }
        res.status(404).json({ error: "lead_not_found", message: "Aucun lead trouvÃ© pour ce clientRequestId â€” appelez /api/dna/contact d'abord." });
        return;
      }

      res.status(200).json({ ok: true, watchId: result.watch.id, leadId: result.watch.leadId, created: result.created });
    } catch (error) {
      console.error("Error in POST /api/dna/watch:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
