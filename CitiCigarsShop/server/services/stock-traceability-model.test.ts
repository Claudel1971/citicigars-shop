import { describe, expect, it } from "vitest";
import { ZERO_BALANCE, type Balance } from "./stock-movement-processor";
import {
  allocationConsistency,
  assertTraceabilityReconciled,
  compareChronologicalGroups,
  describeBalance,
  parseHistoryPage,
  projectionRowToBalance,
  resolveIdentityFilter,
  TRACE_HISTORY_DEFAULT_LIMIT,
  TRACE_HISTORY_MAX_LIMIT,
} from "./stock-traceability-model";

function balance(partial: Partial<Balance>): Balance {
  return { ...ZERO_BALANCE, ...partial };
}

describe("Milestone 5 traceability input contract", () => {
  it("requires an exact identity for the traceability read", () => {
    expect(() => resolveIdentityFilter(undefined, undefined, true))
      .toThrowError(expect.objectContaining({ code: "exact_stock_identity_required" }));
    expect(() => resolveIdentityFilter("Pack", undefined, true))
      .toThrowError(expect.objectContaining({ code: "exact_stock_identity_required" }));
  });

  it("infers only the documented zero sentinel for non-Pack identities", () => {
    expect(resolveIdentityFilter("Box", undefined, true)).toEqual({ type: "Box", packSize: 0 });
    expect(resolveIdentityFilter("Accessory", undefined, false)).toEqual({ type: "Accessory", packSize: 0 });
  });

  it("rejects invalid stock types and pack sentinels", () => {
    expect(() => resolveIdentityFilter("Bogus", 0, false))
      .toThrowError(expect.objectContaining({ code: "invalid_stock_type" }));
    expect(() => resolveIdentityFilter("Pack", 0, false))
      .toThrowError(expect.objectContaining({ code: "invalid_pack_size_for_stock_type" }));
    expect(() => resolveIdentityFilter("Loose", 4, false))
      .toThrowError(expect.objectContaining({ code: "invalid_pack_size_for_stock_type" }));
  });

  it("uses bounded offset pagination", () => {
    expect(parseHistoryPage(undefined, undefined)).toEqual({ limit: TRACE_HISTORY_DEFAULT_LIMIT, offset: 0 });
    expect(parseHistoryPage(TRACE_HISTORY_MAX_LIMIT, 7)).toEqual({ limit: TRACE_HISTORY_MAX_LIMIT, offset: 7 });
    expect(() => parseHistoryPage(TRACE_HISTORY_MAX_LIMIT + 1, 0))
      .toThrowError(expect.objectContaining({ code: "invalid_history_limit" }));
    expect(() => parseHistoryPage(10, -1))
      .toThrowError(expect.objectContaining({ code: "invalid_history_offset" }));
  });
});

describe("Milestone 5 read semantics", () => {
  it("returns an explicit zero for an absent aggregate position", () => {
    expect(projectionRowToBalance(undefined)).toEqual(ZERO_BALANCE);
    expect(describeBalance(ZERO_BALANCE)).toEqual({
      buckets: ZERO_BALANCE,
      availableNow: 0,
      reservationDeficit: 0,
      physicalTotal: 0,
      isZero: true,
    });
  });

  it("computes availability without mutating stored bucket truth", () => {
    const value = balance({ onHand: 3, reservedClient: 4, deposit: 2 });
    expect(describeBalance(value)).toMatchObject({ availableNow: 0, reservationDeficit: 1, physicalTotal: 5, isZero: false });
    expect(value).toEqual(balance({ onHand: 3, reservedClient: 4, deposit: 2 }));
  });

  it("accepts aggregate, location, and lot projections that reconcile in every bucket", () => {
    expect(assertTraceabilityReconciled(
      balance({ onHand: 5, reservedClient: 2, transit: 1 }),
      [
        { locationId: "A", balance: balance({ onHand: 3, reservedClient: 2 }) },
        { locationId: "B", balance: balance({ onHand: 2, transit: 1 }) },
      ],
      [
        { locationId: "A", lotId: "A1", balance: balance({ onHand: 1, reservedClient: 2 }) },
        { locationId: "A", lotId: "A2", balance: balance({ onHand: 2 }) },
        { locationId: "B", lotId: "B1", balance: balance({ onHand: 2, transit: 1 }) },
      ],
    )).toEqual({ status: "RECONCILED", aggregateEqualsLocations: true, locationsEqualLots: true });
  });

  it("fails closed when any projection diverges", () => {
    expect(() => assertTraceabilityReconciled(
      balance({ onHand: 2 }),
      [{ locationId: "A", balance: balance({ onHand: 1 }) }],
      [{ locationId: "A", lotId: "A1", balance: balance({ onHand: 1 }) }],
    )).toThrowError(expect.objectContaining({ details: ["aggregate_does_not_equal_location_sum"] }));
    expect(() => assertTraceabilityReconciled(
      balance({ onHand: 2 }),
      [{ locationId: "A", balance: balance({ onHand: 2 }) }],
      [{ locationId: "A", lotId: "A1", balance: balance({ onHand: 1 }) }],
    )).toThrowError(expect.objectContaining({ details: ["location_does_not_equal_lot_sum:A"] }));
  });

  it("rejects an orphan lot projection", () => {
    expect(() => assertTraceabilityReconciled(ZERO_BALANCE, [], [
      { locationId: "MISSING", lotId: "LOT", balance: ZERO_BALANCE },
    ])).toThrowError(expect.objectContaining({ details: ["lot_without_location_projection:MISSING:LOT"] }));
  });

  it("orders history by business time, creation time, then stable group id", () => {
    const rows = [
      { groupId: "B", movementDate: new Date("2026-02-01"), createdAt: new Date("2026-01-01") },
      { groupId: "C", movementDate: null, createdAt: new Date("2026-01-01") },
      { groupId: "A", movementDate: new Date("2026-02-01"), createdAt: new Date("2026-01-01") },
    ];
    expect(rows.sort(compareChronologicalGroups).map((row) => row.groupId)).toEqual(["C", "A", "B"]);
  });

  it("distinguishes legacy unrecorded allocation from recorded reconciliation", () => {
    const details = [{ balanceField: "onHand", qtyDelta: -3 }];
    expect(allocationConsistency(details, [])).toEqual({ status: "NOT_RECORDED" });
    expect(allocationConsistency(details, [
      { balanceField: "onHand", qtyDelta: -1 },
      { balanceField: "onHand", qtyDelta: -2 },
    ])).toEqual({ status: "RECONCILED" });
    expect(allocationConsistency(details, [{ balanceField: "onHand", qtyDelta: -2 }]))
      .toEqual({ status: "MISMATCH", fields: ["onHand"] });
  });
});
