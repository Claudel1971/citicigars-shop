/**
 * DNA intake adapter.
 *
 * The DNA/Curator engine itself lives and runs OUTSIDE this repo (see
 * project context: it's an existing, working pipeline). This module is only
 * the receiving end: it accepts a finished DNA result, resolves/creates the
 * corresponding customer, and stores the result in customer_dna.
 *
 * It never recomputes, scores, or redefines any of the 36 DNA profiles —
 * it is a pure intake/storage adapter, matching the brief's instruction:
 * "Le moteur continue de calculer ailleurs. Le CRM reçoit et conserve le
 * résultat."
 *
 * RÉCONCILIATION (20 août 2026) : ce module n'est plus câblé directement sur
 * le contrat HTTP externe. Le vrai contrat accepté par POST /api/dna/contact
 * est celui du Curator réel (voir routes.dna.ts, inchangé) — cette fonction
 * reçoit désormais un DnaContactPayload déjà construit par un adaptateur
 * (server/services/dna-crm-mapping.ts) à partir du payload réel, jamais le
 * corps HTTP brut. profileName/family proviennent réellement du Curator ;
 * profileTagline et engineVersion ne sont PAS envoyés aujourd'hui par le
 * Curator — restent optionnels ici, jamais inventés ni rendus obligatoires.
 */

import { normalizePhone, findExactPhoneMatch } from "./phone";
import { createCustomer, recordDnaResult } from "./crm";
import { eq } from "drizzle-orm";
import { db } from "../db.mysql";
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
import { customers, customerDna } from "../../shared/schema.crm";

export interface DnaContactPayload {
  // Contact identification — mappé depuis participant.firstName/lastName +
  // contact.phone du payload réel du Curator (voir dna-crm-mapping.ts).
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactCity?: string | null;
  contactCountry?: string | null;

  // DNA result fields — profileCode/profileName/family proviennent
  // réellement du Curator (customerDNA.id/label/family). profileTagline et
  // engineVersion ne sont jamais envoyés par le Curator actuel : restent
  // optionnels, jamais requis, jamais inventés côté serveur.
  profileCode: string;
  profileName?: string | null;
  profileTagline?: string | null;
  family?: string | null;
  engineVersion?: string | null;
  testedAt?: string; // ISO datetime; defaults to now if omitted
  // Idempotency key — toujours fourni en pratique : c'est clientRequestId
  // du Curator (voir dna-crm-mapping.ts), jamais réellement absent.
  sourceRequestId?: string | null;

  // Full raw payload from the engine, kept verbatim for future
  // compatibility even if we don't map every field today.
  fullPayload: Record<string, unknown>;
}

export interface DnaIntakeResult {
  customerId: string;
  wasExistingCustomer: boolean;
  dnaId: string;
}

/**
 * exec optionnel (défaut `db`) : permet d'exécuter toute cette résolution
 * DANS la même transaction que l'écriture dna_leads (réconciliation DNA →
 * CRM, 20 août) — jamais un état où dna_leads est écrit mais le lien CRM
 * échoue silencieusement à côté.
 */
export async function ingestDnaResult(payload: DnaContactPayload, exec: DbOrTx = db): Promise<DnaIntakeResult> {
  if (!payload.profileCode) {
    throw new Error("ingestDnaResult: profileCode is required");
  }

  if (payload.sourceRequestId) {
    const [existingDna] = await exec
      .select()
      .from(customerDna)
      .where(eq(customerDna.sourceRequestId, payload.sourceRequestId));
    if (existingDna) {
      return {
        customerId: existingDna.customerId,
        wasExistingCustomer: true,
        dnaId: existingDna.dnaId,
      };
    }
  }

  const normalizedPhone = normalizePhone(payload.contactPhone ?? null);
  let customerId: string;
  let wasExistingCustomer = false;

  if (normalizedPhone) {
    const candidates = await exec
      .select({ customerId: customers.customerId, phoneWhatsapp: customers.phoneWhatsapp })
      .from(customers)
      .where(eq(customers.phoneWhatsapp, normalizedPhone));
    const match = findExactPhoneMatch(normalizedPhone, candidates);
    if (match) {
      customerId = match.customerId;
      wasExistingCustomer = true;
    } else {
      const [firstName, ...rest] = (payload.contactName ?? "Contact DNA").trim().split(" ");
      const { customer } = await createCustomer(
        {
          firstName: firstName || null,
          lastName: rest.join(" ") || null,
          phoneWhatsapp: payload.contactPhone ?? null,
          email: payload.contactEmail ?? null,
          city: payload.contactCity ?? null,
          country: payload.contactCountry ?? undefined,
          status: "PROSPECT",
          source: "dna_engine",
        } as any,
        exec
      );
      customerId = customer.customerId;
    }
  } else {
    const [firstName, ...rest] = (payload.contactName ?? "Contact DNA (téléphone manquant)")
      .trim()
      .split(" ");
    const { customer } = await createCustomer(
      {
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        email: payload.contactEmail ?? null,
        city: payload.contactCity ?? null,
        country: payload.contactCountry ?? undefined,
        status: "PROSPECT",
        source: "dna_engine_no_phone",
      } as any,
      exec
    );
    customerId = customer.customerId;
  }

  let dna: Awaited<ReturnType<typeof recordDnaResult>>;
  try {
    dna = await recordDnaResult(
      {
        customerId,
        profileCode: payload.profileCode,
        profileName: payload.profileName ?? null,
        profileTagline: payload.profileTagline ?? null,
        family: payload.family ?? null,
        engineVersion: payload.engineVersion ?? null,
        fullPayload: payload.fullPayload,
        testedAt: payload.testedAt ? new Date(payload.testedAt) : new Date(),
        sourceRequestId: payload.sourceRequestId ?? null,
      } as any,
      exec
    );
  } catch (e: any) {
    if (e?.code !== "ER_DUP_ENTRY" || !payload.sourceRequestId) throw e;
    // Course perdue contre une requête concurrente avec le même sourceRequestId
    // (même stratégie que upsertLeadIdempotent pour dna_leads, storage.stock.ts) :
    // l'unique index uq_dna_source_request a gagné côté adversaire, on relit
    // simplement la ligne gagnante — jamais d'échec silencieux ni de doublon.
    //
    // Relecture non verrouillée : suffisant maintenant que cette transaction
    // tourne en READ COMMITTED (voir routes.dna.ts) — chaque lecture y voit
    // l'état commité le plus récent, et ER_DUP_ENTRY ne peut être levé que
    // si la ligne gagnante est déjà committée. Un FOR UPDATE ici serait un
    // verrou pris pour rien (et, sous REPEATABLE READ, provoquait ER_CHECKREAD
    // — voir historique de cette investigation).
    const [existingDna] = await exec
      .select()
      .from(customerDna)
      .where(eq(customerDna.sourceRequestId, payload.sourceRequestId));
    if (!existingDna) throw e;
    return { customerId: existingDna.customerId, wasExistingCustomer: true, dnaId: existingDna.dnaId };
  }

  return { customerId, wasExistingCustomer, dnaId: dna.dnaId };
}
