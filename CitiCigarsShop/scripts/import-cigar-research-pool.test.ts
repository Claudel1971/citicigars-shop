import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildImportPlan } from "./import-cigar-research-pool";

const source = path.resolve("_local_imports/top25v5.xlsx");
const localIt = existsSync(source) ? it : it.skip;

describe("Research Pool Top25 v5 import", () => {
  localIt("passes the audited source gate and preserves every appearance", () => {
    const plan = buildImportPlan(source);
    expect(plan.report.top25_source_rows).toBe(925);
    expect(plan.report.top25_unique_cigars).toBe(838);
    expect(plan.report.duplicate_appearances).toBe(87);
    expect(plan.evidence).toHaveLength(925);
    expect(new Set(plan.evidence.map((item) => item.id)).size).toBe(925);
    expect(plan.evidence.every((item) => ["CA", "CJ"].includes(item.rankingSource))).toBe(true);
    expect(plan.evidence.every((item) => item.rankingYear > 2000 && item.rankingRank > 0)).toBe(true);
  });

  localIt("deduplicates appearances and rejects the three known composites", () => {
    const plan = buildImportPlan(source);
    const appearancesByPool = new Map<string, number>();
    for (const item of plan.evidence) appearancesByPool.set(item.poolId, (appearancesByPool.get(item.poolId) ?? 0) + 1);
    expect([...appearancesByPool.values()].some((count) => count > 1)).toBe(true);
    expect(plan.report.rejected_composites).toEqual(expect.arrayContaining([
      "CTG000875", "CTG000876", "CTG000877",
    ]));
    expect([...plan.pools.values()].some((pool) => ["CTG000875", "CTG000876", "CTG000877"].includes(pool.canonicalCigarId ?? ""))).toBe(false);
  });
});
