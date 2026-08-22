/**
 * WhatsApp conversation analysis (V1.5 — copier-coller, pas de Cloud API).
 *
 * Principle (non-negotiable, per brief section 10):
 *   L'IA propose. L'humain valide. Le CRM écrit ensuite.
 *
 * This module ONLY produces a structured proposal. It never writes to the
 * database — that happens in routes.crm.ts's /validate endpoint, and only
 * after a human has reviewed/corrected the proposal.
 *
 * Every extracted field carries { value, confidence, sourceExcerpt } so the
 * UI can show provenance and the human can judge whether to trust it. The
 * model is explicitly instructed not to invent missing facts.
 */

import { getAiProvider } from "./ai-provider";

export interface ExtractedField<T> {
  value: T;
  confidence: "high" | "medium" | "low";
  sourceExcerpt: string | null;
}

export interface ConversationAnalysisProposal {
  matchedCustomerId: string | null; // null if likely a new prospect
  matchedCustomerConfidence: "high" | "medium" | "low" | "none";
  suggestedFirstName: ExtractedField<string> | null;
  suggestedLastName: ExtractedField<string> | null;
  suggestedPhone: ExtractedField<string> | null;
  // Valeur DB (customerTypeValues), pas le libellé UI — la UI affiche "B2B"
  // pour CORPORATE, la valeur stockée reste inchangée (contrat interne actuel).
  suggestedCustomerType: ExtractedField<"B2C" | "CORPORATE" | "PARTNER" | "OTHER"> | null;
  summary: ExtractedField<string>;
  interest: ExtractedField<string> | null;
  productsMentioned: ExtractedField<string[]>;
  suggestedStatus: ExtractedField<string> | null;
  nextAction: ExtractedField<string> | null;
  nextActionAt: ExtractedField<string> | null; // ISO date
  notes: ExtractedField<string> | null;
}

const SYSTEM_PROMPT = `Tu es un assistant d'extraction pour le CRM de CitiCigars, un distributeur
de cigares premium au Cameroun. On te fournit une conversation WhatsApp
copiée-collée entre un commercial et un client/prospect.

Règles strictes :
- N'invente JAMAIS une information absente de la conversation.
- Pour chaque champ, indique un niveau de confiance (high/medium/low) et,
  si possible, un court extrait source qui justifie la valeur.
- Si une information n'est pas présente, retourne null pour ce champ plutôt
  que de deviner.
- Si un prénom ET un nom de famille sont mentionnés, sépare-les entre
  suggestedFirstName et suggestedLastName — ne mets jamais le nom complet
  dans un seul des deux champs. Si un seul mot est mentionné et que son
  rôle (prénom ou nom) n'est pas clair, mets-le dans suggestedFirstName et
  laisse suggestedLastName à null plutôt que de deviner.
- Classe suggestedCustomerType à "CORPORATE" uniquement si la conversation
  indique explicitement une commande en gros, un achat pour une entreprise,
  ou un contact au nom d'une société. Sinon "B2C" par défaut si un contexte
  d'achat personnel est clair, sinon null.
- Réponds UNIQUEMENT en JSON valide, sans texte autour, correspondant
  exactement au schéma demandé.`;

const RESPONSE_FORMAT_HINT = `{
  "suggestedFirstName": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "suggestedLastName": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "suggestedPhone": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "suggestedCustomerType": {"value": "B2C"|"CORPORATE"|"PARTNER"|"OTHER", "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "summary": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string},
  "interest": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "productsMentioned": {"value": string[], "confidence": "high"|"medium"|"low", "sourceExcerpt": string},
  "suggestedStatus": {"value": "PROSPECT"|"QUALIFIED"|"CUSTOMER"|"DORMANT"|"LOST", "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "nextAction": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "nextActionAt": {"value": string (ISO date), "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null,
  "notes": {"value": string, "confidence": "high"|"medium"|"low", "sourceExcerpt": string} | null
}`;

/**
 * Parses and validates the model's raw text output into our typed shape.
 * Throws on malformed JSON rather than silently guessing — a broken
 * extraction must surface as an error the human sees, not a corrupted
 * proposal.
 */
function parseModelOutput(raw: string): Omit<ConversationAnalysisProposal, "matchedCustomerId" | "matchedCustomerConfidence"> {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  // Minimal shape check — Phase 1 keeps this lightweight; a zod schema can
  // be introduced later if the model output proves unreliable in practice.
  if (!parsed.summary) {
    throw new Error("whatsapp-analysis: model output missing required 'summary' field");
  }
  return parsed;
}

export interface ExistingCustomerCandidate {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  phoneWhatsapp: string | null;
}

/**
 * Analyzes a pasted conversation. Customer matching is done ourselves (not
 * left to the model) using the same exact-phone-match rule as the rest of
 * the CRM, so it stays consistent and auditable.
 */
export async function analyzeConversation(
  rawText: string,
  existingCustomers: ExistingCustomerCandidate[]
): Promise<ConversationAnalysisProposal> {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("analyzeConversation: rawText is empty");
  }

  const provider = getAiProvider();
  const raw = await provider.complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: rawText,
    responseFormatHint: RESPONSE_FORMAT_HINT,
  });

  const extracted = parseModelOutput(raw);

  // Customer resolution: exact phone match only, same rule as everywhere
  // else in the CRM. A name-only "match" is never auto-applied.
  const { normalizePhone, findExactPhoneMatch } = await import("./phone");
  const suggestedPhoneValue = extracted.suggestedPhone?.value ?? null;
  const normalized = normalizePhone(suggestedPhoneValue);
  const match = normalized
    ? findExactPhoneMatch(
        normalized,
        existingCustomers.map((c) => ({ customerId: c.customerId, phoneWhatsapp: c.phoneWhatsapp }))
      )
    : null;

  return {
    ...extracted,
    matchedCustomerId: match?.customerId ?? null,
    matchedCustomerConfidence: match ? "high" : normalized ? "none" : "none",
  };
}
