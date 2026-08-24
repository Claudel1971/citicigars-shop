import { describe, expect, it } from "vitest";
import { changedDnaFields, DNA_PROFILE_FIELDS, sanitizeDnaProfile } from "./dna-profile";

describe("DNA profile contract", () => {
  it("uses exactly the Curator 16-field contract and excludes sourcing", () => {
    expect(DNA_PROFILE_FIELDS).toHaveLength(16);
    expect(DNA_PROFILE_FIELDS).not.toContain("sourcingClass");
    expect(sanitizeDnaProfile({ brand: "Padrón", sourcingClass: "C", invented: true }))
      .toEqual({ brand: "Padrón" });
  });

  it("reports only fields changed from the immutable current snapshot", () => {
    expect(changedDnaFields({ puissance: 3, sweet: 2 }, { puissance: 4, sweet: 2 }))
      .toEqual(["puissance"]);
  });
});
