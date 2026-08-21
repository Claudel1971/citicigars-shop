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
 * Contract: POST /api/dna/contact (see routes.crm.ts) — this endpoint name
 * is preserved exactly as instructed, so the existing DNA engine can be
 * pointed at it (or kept pointed at it) without needing to change on its
 * side.
 */

import { normalizePhone, findExactPhoneMatch } from "./phone";
import { createCustomer, recordDnaResult } from "./crm";
import { eq } from "drizzle-orm";
import { db } from "../db.mysql";
import { customers, customerDna } from "../../shared/schema.crm";

export interface DnaContactPayload {
  // Contact identification as sent by the DNA engine
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;

  // DNA result fields — see brief correction: no "budget" here, this is
  // strictly the cigar-identity result, not a commercial/purchase-intent
  // field (those belong to customer_interactions / WhatsApp analysis).
  profileCode: string;
  profileName: string;
  profileTagline?: string | null;
  family?: string | null;
  engineVersion: string;
  testedAt?: string; // ISO datetime; defaults to now if omitted
  // Optional idempotency key from the DNA engine — if provided and already
  // seen, ingestion is a no-op (returns the existing record) rather than
  // creating a duplicate customer_dna row.
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

export async function ingestDnaResult(payload: DnaContactPayload): Promise<DnaIntakeResult> {
  if (!payload.profileCode || !payload.engineVersion) {
    throw new Error("ingestDnaResult: profileCode and engineVersion are required");
  }

  if (payload.sourceRequestId) {
    const [existingDna] = await db
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
    const candidates = await db
      .select({ customerId: customers.customerId, phoneWhatsapp: customers.phoneWhatsapp })
      .from(customers)
      .where(eq(customers.phoneWhatsapp, normalizedPhone));
    const match = findExactPhoneMatch(normalizedPhone, candidates);
    if (match) {
      customerId = match.customerId;
      wasExistingCustomer = true;
    } else {
      const [firstName, ...rest] = (payload.contactName ?? "Contact DNA").trim().split(" ");
      const { customer } = await createCustomer({
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        phoneWhatsapp: payload.contactPhone ?? null,
        email: payload.contactEmail ?? null,
        status: "PROSPECT",
        source: "dna_engine",
      } as any);
      customerId = customer.customerId;
    }
  } else {
    // No usable phone from the DNA engine: still create a minimal contact
    // record rather than dropping the result, but flag it via `source` so
    // it surfaces for later reconciliation — never silently discarded.
    const [firstName, ...rest] = (payload.contactName ?? "Contact DNA (téléphone manquant)")
      .trim()
      .split(" ");
    const { customer } = await createCustomer({
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      email: payload.contactEmail ?? null,
      status: "PROSPECT",
      source: "dna_engine_no_phone",
    } as any);
    customerId = customer.customerId;
  }

  const dna = await recordDnaResult({
    customerId,
    profileCode: payload.profileCode,
    profileName: payload.profileName,
    profileTagline: payload.profileTagline ?? null,
    family: payload.family ?? null,
    engineVersion: payload.engineVersion,
    fullPayload: payload.fullPayload,
    testedAt: payload.testedAt ? new Date(payload.testedAt) : new Date(),
    sourceRequestId: payload.sourceRequestId ?? null,
  } as any);

  return { customerId, wasExistingCustomer, dnaId: dna.dnaId };
}
