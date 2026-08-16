import { describe, expect, it } from "vitest";
import { capturedAtStepForMode, resolveDnaAvailability, type DnaAvailabilityBalance } from "./dna-availability";

const row = (
  type: "Pack" | "Box" | "Loose",
  onHandQty: number,
  reservedClientQty = 0,
  reservedEventQty = 0,
): DnaAvailabilityBalance => ({ sku: "SKU1", type, onHandQty, reservedClientQty, reservedEventQty });

const resolve = (rows: DnaAvailabilityBalance[], ids = ["KNOWN"]) =>
  resolveDnaAvailability(ids, ["KNOWN", "NO_SKU"], new Map([["KNOWN", "SKU1"]]), rows);

describe("Stock Central DNA availability", () => {
  it("accepts a commercially available Pack", () => {
    expect(resolve([row("Pack", 1)]).resolved.KNOWN).toEqual({ packAvailable: true, boxAvailable: false });
  });

  it("accepts a commercially available sealed Box", () => {
    expect(resolve([row("Box", 1)]).resolved.KNOWN).toEqual({ packAvailable: false, boxAvailable: true });
  });

  it("never counts Loose inventory", () => {
    expect(resolve([row("Loose", 100)]).resolved.KNOWN).toEqual({ packAvailable: false, boxAvailable: false });
  });

  it("subtracts client and event reservations", () => {
    expect(resolve([row("Pack", 3, 1, 2), row("Box", 2, 1, 1)]).resolved.KNOWN)
      .toEqual({ packAvailable: false, boxAvailable: false });
  });

  it("fails closed for an unknown CIGAR_ID", () => {
    expect(resolve([], ["UNKNOWN"])).toEqual({ resolved: {}, unresolved: ["UNKNOWN"] });
  });

  it("keeps a known catalog component without its own SKU unavailable", () => {
    expect(resolveDnaAvailability(["NO_SKU"], ["NO_SKU"], new Map(), [row("Pack", 10)]).resolved.NO_SKU)
      .toEqual({ packAvailable: false, boxAvailable: false });
  });

  it("maps captureMode directly without relying on /watch", () => {
    expect(capturedAtStepForMode("normal")).toBe("STEP4_WITH_RESULTS");
    expect(capturedAtStepForMode("zero")).toBe("STEP6_ZERO_CASE");
  });
});
