import { describe, it, expect } from "vitest";
import { buildSeedPlan, MappingRow, SeedOp } from "./seed-stock-central-plan";

function row(partial: Partial<MappingRow>): MappingRow {
  return {
    rowKind: "SKU_CIGAR_ID",
    sku: "",
    sourceSku: null,
    type: "Box",
    cigarId: null,
    componentCigarId: null,
    componentSku: null,
    componentQty: null,
    brand: "",
    line: "",
    vitole: "",
    cigarsPerUnit: null,
    heldUnits: null,
    depositUnits: null,
    pairingMethod: "",
    sourceDoctrine: "",
    note: "",
    ...partial,
  };
}

describe("P0.3 (audit) : cigarsPerBox ne doit jamais être perdu quand Box et Pack partagent un SKU", () => {
  it("CTGNI0020 : Box avant Pack dans le fichier -> les deux UPSERT_PRODUCT gardent cigarsPerBox=20", () => {
    const rows: MappingRow[] = [
      row({ sku: "CTGNI0020", type: "Box", cigarId: "CTG000020", brand: "My Father", line: "Flor de Las Antillas", vitole: "Gordo", cigarsPerUnit: 20, heldUnits: 1, depositUnits: 0 }),
      row({ sku: "CTGNI0020", type: "Pack", cigarId: "CTG000020", brand: "My Father", line: "Flor de Las Antillas", vitole: "Gordo", cigarsPerUnit: 4, heldUnits: 2, depositUnits: 0 }),
    ];
    const ops = buildSeedPlan(rows) as SeedOp[];
    const productOps = ops.filter((o) => o.kind === "UPSERT_PRODUCT") as Extract<SeedOp, { kind: "UPSERT_PRODUCT" }>[];
    expect(productOps).toHaveLength(2);
    expect(productOps.every((o) => o.cigarsPerBox === 20)).toBe(true);
  });

  it("ordre inverse (Pack avant Box dans le fichier) -> même résultat, cigarsPerBox=20 sur les deux", () => {
    const rows: MappingRow[] = [
      row({ sku: "CTGNI0021", type: "Pack", cigarId: "CTG000021", brand: "Oliva", line: "Serie V", vitole: "Double Toro", cigarsPerUnit: 4, heldUnits: 3, depositUnits: 0 }),
      row({ sku: "CTGNI0021", type: "Box", cigarId: "CTG000021", brand: "Oliva", line: "Serie V", vitole: "Double Toro", cigarsPerUnit: 24, heldUnits: 0, depositUnits: 0 }),
    ];
    const ops = buildSeedPlan(rows) as SeedOp[];
    const productOps = ops.filter((o) => o.kind === "UPSERT_PRODUCT") as Extract<SeedOp, { kind: "UPSERT_PRODUCT" }>[];
    expect(productOps).toHaveLength(2);
    expect(productOps.every((o) => o.cigarsPerBox === 24)).toBe(true);
  });

  it("SKU Pack-only (jamais de forme Box) : cigarsPerBox reste null, comportement inchangé", () => {
    const rows: MappingRow[] = [row({ sku: "CTGHO0001", type: "Pack", cigarId: "CTG000001", brand: "Bolivar", line: "Cofradia N° 654", vitole: "Toro", cigarsPerUnit: 5, heldUnits: 2, depositUnits: 0 })];
    const ops = buildSeedPlan(rows) as SeedOp[];
    const productOp = ops.find((o) => o.kind === "UPSERT_PRODUCT") as Extract<SeedOp, { kind: "UPSERT_PRODUCT" }>;
    expect(productOp.cigarsPerBox).toBeNull();
  });
});
