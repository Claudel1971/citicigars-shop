import { describe, it, expect } from "vitest";
import {
  formatCtcgId,
  parseCtcgId,
  nextSequenceFromExisting,
  formatOrderItemId,
  formatOrderItemComponentId,
} from "./ctcg-id";

describe("CTCG id conventions", () => {
  it("formate un ID métier standard", () => {
    expect(formatCtcgId("CUST", 1)).toBe("CTCG-CUST-000001");
    expect(formatCtcgId("CUST", 0)).toBe("CTCG-CUST-000000");
    expect(formatCtcgId("SALE", 14)).toBe("CTCG-SALE-000014");
  });

  it("parse un ID métier", () => {
    expect(parseCtcgId("CTCG-CUST-000001")).toEqual({ prefix: "CUST", sequence: 1 });
    expect(parseCtcgId("not-an-id")).toBeNull();
  });

  it("calcule la prochaine séquence à partir du max existant, jamais réutilisée", () => {
    const existing = ["CTCG-CUST-000000", "CTCG-CUST-000005", "CTCG-CUST-000002"];
    expect(nextSequenceFromExisting(existing)).toBe(6);
  });

  it("commence à 0 si aucun ID existant", () => {
    expect(nextSequenceFromExisting([])).toBe(0);
  });

  it("dérive un id de ligne depuis l'id de vente, sans nouvelle séquence indépendante", () => {
    expect(formatOrderItemId("CTCG-SALE-000014", 1)).toBe("CTCG-SALE-000014-L01");
    expect(formatOrderItemId("CTCG-SALE-000004", 2)).toBe("CTCG-SALE-000004-L02");
  });

  it("dérive un id de composant depuis l'id de ligne", () => {
    expect(formatOrderItemComponentId("CTCG-SALE-000004-L01", 1)).toBe("CTCG-SALE-000004-L01-C01");
  });
});
