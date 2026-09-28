import { describe, it, expect, beforeAll } from "vitest";
import { mysqlPool } from "../db.mysql";
import {
  backofficeDashboard,
  backofficeCosting,
  orderCostTrace,
} from "./backoffice";
import { JOURNAL_DDL } from "../jobs/v6-import";
describe("backoffice read models on isolated MySQL", () => {
  beforeAll(async () => {
    const [r] = await mysqlPool.query<any[]>("SELECT DATABASE() name");
    if (r[0].name !== "citicigars_ci")
      throw new Error("Ephemeral CI database required");
    await mysqlPool.query(JOURNAL_DDL);
  });
  it("executes the canonical dashboard queries", async () => {
    const result = await backofficeDashboard();
    expect(Number(result.stock.held)).toBeGreaterThanOrEqual(0);
    expect(result.scope).toContain("Consignations");
  });
  it("reads costing without mutating ledgers and handles an absent order", async () => {
    const result = await backofficeCosting();
    expect(result.readOnly).toBe(true);
    expect(Array.isArray(result.purchases)).toBe(true);
    expect(await orderCostTrace("NONEXISTENT-CI-ORDER")).toMatchObject({
      lines: [],
      lots: [],
      allocations: [],
      readOnly: true,
    });
  });
});
