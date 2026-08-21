import { describe, it, expect } from "vitest";
import { normalizePhone, findExactPhoneMatch } from "./phone";

describe("normalizePhone", () => {
  it("normalise un numéro camerounais local en E.164", () => {
    expect(normalizePhone("690123456")).toBe("+237690123456");
  });

  it("normalise avec espaces/tirets", () => {
    expect(normalizePhone("6 90-12-34-56")).toBe("+237690123456");
  });

  it("normalise un numéro déjà en +237", () => {
    expect(normalizePhone("+237 690 12 34 56")).toBe("+237690123456");
  });

  it("normalise un préfixe international 00", () => {
    expect(normalizePhone("00237690123456")).toBe("+237690123456");
  });

  it("retourne null pour une entrée vide", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("préserve un numéro international valide déjà présent (ex: +33), sans le forcer en +237", () => {
    expect(normalizePhone("+33 7 58 47 00 23")).toBe("+33758470023");
    expect(normalizePhone("+33758470023")).toBe("+33758470023");
  });

  it("retourne null plutôt que de deviner un format ambigu", () => {
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("findExactPhoneMatch", () => {
  const candidates = [
    { customerId: "1", phoneWhatsapp: "+237690123456", firstName: "Jean" },
    { customerId: "2", phoneWhatsapp: "+237691000000", firstName: "Marie" },
  ];

  it("trouve une correspondance exacte", () => {
    const match = findExactPhoneMatch("+237690123456", candidates);
    expect(match?.customerId).toBe("1");
  });

  it("ne fait aucun rapprochement approximatif", () => {
    const match = findExactPhoneMatch("+237699999999", candidates);
    expect(match).toBeNull();
  });

  it("retourne null si le téléphone normalisé est null", () => {
    expect(findExactPhoneMatch(null, candidates)).toBeNull();
  });
});
