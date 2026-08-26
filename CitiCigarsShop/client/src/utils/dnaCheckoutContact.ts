export const DNA_CHECKOUT_CONTACT_KEY = "citicigars:dna-checkout-contact:v1";

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

export type DnaCheckoutDefaults = {
  nom: string;
  telephone: string;
  ville: string;
  email: string;
};

const emptyDefaults = (): DnaCheckoutDefaults => ({
  nom: "",
  telephone: "",
  ville: "",
  email: "",
});

function currentSessionStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function readDnaCheckoutContact(
  storage: StorageLike | null = currentSessionStorage(),
): DnaCheckoutDefaults {
  if (!storage) return emptyDefaults();
  try {
    const raw = storage.getItem(DNA_CHECKOUT_CONTACT_KEY);
    if (!raw) return emptyDefaults();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || parsed.version !== 1) return emptyDefaults();
    const firstName = cleanString(parsed.firstName, 100);
    const lastName = cleanString(parsed.lastName, 100);
    return {
      nom: [firstName, lastName].filter(Boolean).join(" "),
      telephone: cleanString(parsed.phone, 30),
      ville: cleanString(parsed.city, 150),
      email: cleanString(parsed.email, 254),
    };
  } catch {
    return emptyDefaults();
  }
}

export function clearDnaCheckoutContact(
  storage: StorageLike | null = currentSessionStorage(),
): void {
  try {
    storage?.removeItem(DNA_CHECKOUT_CONTACT_KEY);
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
}
