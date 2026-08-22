/**
 * Adaptateur de mapping — payload réel du Curator (POST /api/dna/contact,
 * voir routes.dna.ts, contrat inchangé) → forme attendue par
 * ingestDnaResult() (server/services/dna-intake.ts).
 *
 * Réconciliation DNA → CRM (20 août 2026). Ne remplace jamais le contrat
 * HTTP externe — celui-ci reste celui déjà accepté par routes.dna.ts,
 * exactement ce que le Curator envoie réellement.
 *
 * Mapping (mis à jour 22 août 2026 — correctif capture contact DNA) :
 *   clientRequestId              → sourceRequestId (clé d'idempotence)
 *   participant.firstName/lastName → identité client
 *   contact.phone                → téléphone WhatsApp, clé de rapprochement
 *                                   (E.164 canonique, assemblé côté Curator
 *                                   via libphonenumber-js à partir du pays
 *                                   sélectionné + numéro national saisi)
 *   contact.email                 → email client (obligatoire côté Curator
 *                                   depuis ce correctif — le champ existait
 *                                   déjà côté CRM, jamais alimenté avant)
 *   contact.city                  → ville client (customers.city existe déjà,
 *                                   aucune colonne créée)
 *   contact.country                → pays client (customers.country existe
 *                                   déjà, aucune colonne créée)
 *   customerDNA.id                → profileCode
 *   customerDNA.label              → profileName (réellement envoyé par le
 *                                    Curator — dna.name, voir buildDNA())
 *   customerDNA.family             → family
 *   corps complet                  → fullPayload
 *
 * profileTagline et engineVersion ne sont jamais envoyés par le Curator
 * actuel (vérifié directement dans le payload réel construit par loadReco()) :
 * jamais inventés ici, toujours null si absents — ingestDnaResult() les
 * traite comme optionnels, jamais requis.
 */

import type { DnaContactPayload } from "./dna-intake";

export function mapCuratorPayloadToCrmIntake(body: any): DnaContactPayload {
  const participant = body?.participant ?? {};
  const customerDNA = body?.customerDNA ?? {};
  const contact = body?.contact ?? {};

  const contactName = [participant.firstName, participant.lastName].filter(Boolean).join(" ") || null;

  return {
    contactName,
    contactPhone: contact.phone ?? null,
    contactEmail: contact.email ?? null,
    contactCity: contact.city ?? null,
    contactCountry: contact.country ?? null,
    profileCode: customerDNA.id,
    profileName: customerDNA.label ?? null,
    profileTagline: null, // jamais envoyé par le Curator actuel — voir note en tête de fichier
    family: customerDNA.family ?? null,
    engineVersion: null, // jamais envoyé par le Curator actuel — voir note en tête de fichier
    sourceRequestId: body?.clientRequestId ?? null,
    fullPayload: body,
  };
}
