import { describe, it, expect } from "vitest";
import { redactEconomicData, sumKnown, stockState } from "./backoffice-model";
describe("backoffice economic boundaries", () => {
  it("removes nested economics without losing quantities, dates, revenue or cash", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    expect(
      redactEconomicData({
        date,
        quantity: 3,
        amountPaid: 15,
        orders: [
          { totalCostXaf: 12, grossMarginRate: 0.2, finalSaleTotalXaf: 15 },
        ],
        purchasing: { supplier: "x" },
      }),
    ).toEqual({
      date,
      quantity: 3,
      amountPaid: 15,
      orders: [{ finalSaleTotalXaf: 15 }],
    });
  });
  it("does not equate missing cost with zero", () => {
    expect(sumKnown([0, 3])).toBe(3);
    expect(sumKnown([3, null])).toBeNull();
    expect(sumKnown([3, NaN])).toBeNull();
  });
  it("uses configured stock thresholds", () => {
    expect(stockState(0, 2)).toBe("Rupture");
    expect(stockState(2, 2)).toBe("Bas");
    expect(stockState(3, 2)).toBe("Satisfaisant");
  });
});
