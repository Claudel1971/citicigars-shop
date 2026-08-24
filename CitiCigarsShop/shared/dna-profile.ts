export const DNA_PROFILE_FIELDS = [
  "brand",
  "line",
  "vitole",
  "format",
  "dimensions",
  "puissance",
  "famille1",
  "famille2",
  "famille3",
  "intensite",
  "spice",
  "sweet",
  "signatures",
  "dureeMin",
  "dureeMax",
  "confidence",
] as const;

export type DnaProfileField = (typeof DNA_PROFILE_FIELDS)[number];
export type DnaProfile = Partial<Record<DnaProfileField, unknown>>;

export function sanitizeDnaProfile(value: unknown): DnaProfile | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_PROFILE");
  }

  const source = value as Record<string, unknown>;
  const profile: DnaProfile = {};
  for (const field of DNA_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      profile[field] = source[field];
    }
  }
  return profile;
}

export function changedDnaFields(
  current: DnaProfile | null,
  candidate: DnaProfile | null,
): DnaProfileField[] {
  return DNA_PROFILE_FIELDS.filter(
    (field) => JSON.stringify(current?.[field] ?? null) !== JSON.stringify(candidate?.[field] ?? null),
  );
}
