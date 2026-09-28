import { describe, it, expect } from "vitest";
import {
  taskInput,
  taskTransition,
  parseInternalSheet,
  nextBusinessCode,
} from "./internal-admin-model";
describe("internal administrative input contracts", () => {
  it("requires actual dates, fixed administrative categories and a responsible person", () => {
    const v = {
      customerId: "c",
      category: "ADMIN_DOCUMENT",
      dueAt: "2026-09-28",
      responsible: "CT",
    };
    expect(taskInput.parse(v)).toEqual(v);
    for (const p of [
      { dueAt: "2026-02-30" },
      { responsible: "" },
      { category: "SALES" },
      { extra: "untrusted" },
    ])
      expect(taskInput.safeParse({ ...v, ...p }).success).toBe(false);
  });
  it("extracts facts without generating promotional fields", () => {
    expect(
      parseInternalSheet(
        "Origine : Nicaragua\nCape : X\nSous-cape : Y\nTripe : Z\nAccords : promotional",
      ),
    ).toEqual({
      origin: "Nicaragua",
      wrapper: "X",
      binder: "Y",
      filler: "Z",
      format: "",
      dimensions: "",
    });
  });
  it("bounds business codes and requires a concurrency version", () => {
    expect(nextBusinessCode("SUPP", 3)).toBe("CTCG-SUPP-000003");
    expect(() => nextBusinessCode("CUST", 1000000)).toThrow();
    expect(taskTransition.safeParse({ status: "DONE" }).success).toBe(false);
  });
});
