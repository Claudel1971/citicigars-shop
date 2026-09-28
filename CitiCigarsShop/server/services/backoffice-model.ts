/** Read models only: never modify historical ledgers or substitute an unknown cost. */
export function redactEconomicData(value: any): any {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redactEconomicData);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !/cost|margin|cmv|purchase|prixAchat|landed|acquisition|purchasing/i.test(
            key,
          ),
      )
      .map(([key, item]) => [key, redactEconomicData(item)]),
  );
}

export function parseSourceJson(value: any): any {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function sumKnown(
  values: Array<number | string | null | undefined>,
): number | null {
  if (
    !values.length ||
    values.some((v) => v == null || !Number.isFinite(Number(v)))
  )
    return null;
  return values.reduce<number>((sum, value) => sum + Number(value), 0);
}

export function stockState(available: number, lowThreshold: number) {
  return available <= 0
    ? "Rupture"
    : available <= lowThreshold
      ? "Bas"
      : "Satisfaisant";
}
