/**
 * Phone normalization for Cameroon / international contacts.
 *
 * Goal: turn variants like "+237 6 90 12 34 56", "690123456",
 * "00237690123456", "6-90-12-34-56" into a single canonical E.164-ish form,
 * so customers.phone_whatsapp can carry a reliable unique key and duplicate
 * detection is exact, not fuzzy.
 *
 * This is intentionally conservative: if we cannot confidently normalize a
 * number, we return null rather than guessing — callers must then treat it
 * as "unnormalized" and fall back to phoneRaw / human review, in line with
 * "zéro fusion automatique douteuse".
 */

const CAMEROON_COUNTRY_CODE = "237";

/**
 * Strips everything except digits and a leading +.
 */
function stripFormatting(input: string): string {
  return input.trim().replace(/[^\d+]/g, "");
}

export function normalizePhone(rawInput: string | null | undefined): string | null {
  if (!rawInput) return null;
  let digits = stripFormatting(rawInput);
  if (!digits) return null;

  // Normalize leading "00" international prefix to "+"
  if (digits.startsWith("00")) {
    digits = "+" + digits.slice(2);
  }

  // Already has an explicit country code: preserve it as-is (any valid
  // international number, e.g. +33 for a French number), never force it
  // into +237. Cameroon is only ever a DEFAULT applied below, when there
  // is no country code at all.
  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (!/^\d{8,15}$/.test(rest)) return null;
    return "+" + rest;
  }

  // No explicit country code. Assume Cameroon ONLY for local-format numbers
  // (9-digit mobile numbers as used since the 2020 numbering plan change,
  // e.g. 6XXXXXXXX). Anything else is ambiguous — do not guess.
  if (/^6\d{8}$/.test(digits) || /^2\d{8}$/.test(digits)) {
    return "+" + CAMEROON_COUNTRY_CODE + digits;
  }

  // Already has some other country's national number length but no "+":
  // too ambiguous to assume — refuse to normalize rather than guess wrong.
  return null;
}

export interface PhoneMatchCandidate {
  customerId: string;
  phoneWhatsapp: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Exact-match duplicate detection only. Fuzzy/name-based matching is
 * intentionally NOT implemented here — per the brief, a name-only match is a
 * *proposed* reconciliation for human review, never an automatic merge.
 */
export function findExactPhoneMatch(
  normalizedPhone: string | null,
  candidates: PhoneMatchCandidate[]
): PhoneMatchCandidate | null {
  if (!normalizedPhone) return null;
  return candidates.find((c) => c.phoneWhatsapp === normalizedPhone) ?? null;
}
