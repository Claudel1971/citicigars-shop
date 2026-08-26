import { STOCK_TYPES, type StockType } from "../../shared/schema.stock";
import {
  ZERO_BALANCE,
  assertPackSizeSentinel,
  computeAvailability,
  sumBalances,
  type Balance,
  type BalanceField,
} from "./stock-movement-processor";

export const TRACE_HISTORY_DEFAULT_LIMIT = 50;
export const TRACE_HISTORY_MAX_LIMIT = 100;
export const BALANCE_FIELD_NAMES = Object.keys(ZERO_BALANCE) as BalanceField[];

export class TraceabilityInputError extends Error {
  constructor(public code: string, message = code) {
    super(message);
    this.name = "TraceabilityInputError";
  }
}

export class TraceabilityNotFoundError extends Error {
  constructor(public code: string, message = code) {
    super(message);
    this.name = "TraceabilityNotFoundError";
  }
}

export class TraceabilityConsistencyError extends Error {
  constructor(public details: string[]) {
    super("stock_traceability_inconsistent");
    this.name = "TraceabilityConsistencyError";
  }
}

export function projectionRowToBalance(row: {
  onHandQty: number;
  reservedClientQty: number;
  reservedEventQty: number;
  atEventQty: number;
  depositQty: number;
  transitQty: number;
} | undefined): Balance {
  if (!row) return { ...ZERO_BALANCE };
  return {
    onHand: row.onHandQty,
    reservedClient: row.reservedClientQty,
    reservedEvent: row.reservedEventQty,
    atEvent: row.atEventQty,
    deposit: row.depositQty,
    transit: row.transitQty,
  };
}

export function describeBalance(balance: Balance) {
  const availability = computeAvailability(balance);
  return {
    buckets: balance,
    availableNow: availability.availableNow,
    reservationDeficit: availability.reservationDeficit,
    physicalTotal: balance.onHand + balance.deposit + balance.atEvent + balance.transit,
    isZero: BALANCE_FIELD_NAMES.every((field) => balance[field] === 0),
  };
}

export function parseStockType(value: unknown): StockType | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !(STOCK_TYPES as readonly string[]).includes(value)) {
    throw new TraceabilityInputError("invalid_stock_type");
  }
  return value as StockType;
}

export function parsePackSize(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new TraceabilityInputError("invalid_pack_size");
  return parsed;
}

export function resolveIdentityFilter(typeValue: unknown, packSizeValue: unknown, exact: boolean) {
  const type = parseStockType(typeValue);
  let packSize = parsePackSize(packSizeValue);
  if (packSize !== undefined && !type) throw new TraceabilityInputError("stock_type_required_with_pack_size");
  if (type && packSize === undefined && type !== "Pack") packSize = 0;
  if (exact && (!type || packSize === undefined)) throw new TraceabilityInputError("exact_stock_identity_required");
  if (type && packSize !== undefined) {
    try {
      assertPackSizeSentinel(type, packSize);
    } catch {
      throw new TraceabilityInputError("invalid_pack_size_for_stock_type");
    }
  }
  return { type, packSize };
}

export function parseHistoryPage(limitValue: unknown, offsetValue: unknown) {
  const parse = (value: unknown, fallback: number, code: string) => {
    if (value == null || value === "") return fallback;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) throw new TraceabilityInputError(code);
    return parsed;
  };
  const limit = parse(limitValue, TRACE_HISTORY_DEFAULT_LIMIT, "invalid_history_limit");
  const offset = parse(offsetValue, 0, "invalid_history_offset");
  if (limit < 1 || limit > TRACE_HISTORY_MAX_LIMIT) throw new TraceabilityInputError("invalid_history_limit");
  return { limit, offset };
}

function balancesEqual(a: Balance, b: Balance): boolean {
  return BALANCE_FIELD_NAMES.every((field) => a[field] === b[field]);
}

export function assertTraceabilityReconciled(
  aggregate: Balance,
  locations: readonly { locationId: string; balance: Balance }[],
  lots: readonly { locationId: string; lotId: string; balance: Balance }[],
) {
  const details: string[] = [];
  const locationTotal = sumBalances(locations.map((row) => row.balance));
  if (!balancesEqual(aggregate, locationTotal)) details.push("aggregate_does_not_equal_location_sum");
  const locationIds = new Set(locations.map((row) => row.locationId));
  for (const location of locations) {
    const lotTotal = sumBalances(lots.filter((lot) => lot.locationId === location.locationId).map((lot) => lot.balance));
    if (!balancesEqual(location.balance, lotTotal)) details.push(`location_does_not_equal_lot_sum:${location.locationId}`);
  }
  for (const lot of lots) {
    if (!locationIds.has(lot.locationId)) details.push(`lot_without_location_projection:${lot.locationId}:${lot.lotId}`);
  }
  if (details.length) throw new TraceabilityConsistencyError(details);
  return { status: "RECONCILED" as const, aggregateEqualsLocations: true, locationsEqualLots: true };
}

export function compareChronologicalGroups(
  a: { groupId: string; movementDate: Date | null; createdAt: Date | null },
  b: { groupId: string; movementDate: Date | null; createdAt: Date | null },
) {
  const aBusiness = (a.movementDate ?? a.createdAt)?.getTime() ?? 0;
  const bBusiness = (b.movementDate ?? b.createdAt)?.getTime() ?? 0;
  if (aBusiness !== bBusiness) return aBusiness - bBusiness;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return aCreated - bCreated;
  return a.groupId.localeCompare(b.groupId);
}

export function allocationConsistency(
  details: readonly { balanceField: string; qtyDelta: number }[],
  allocations: readonly { balanceField: string; qtyDelta: number }[],
) {
  if (!allocations.length) return { status: "NOT_RECORDED" as const };
  const fields = new Set([...details.map((row) => row.balanceField), ...allocations.map((row) => row.balanceField)]);
  const mismatches = Array.from(fields).filter((field) =>
    details.filter((row) => row.balanceField === field).reduce((sum, row) => sum + row.qtyDelta, 0) !==
    allocations.filter((row) => row.balanceField === field).reduce((sum, row) => sum + row.qtyDelta, 0));
  return mismatches.length
    ? { status: "MISMATCH" as const, fields: mismatches.sort() }
    : { status: "RECONCILED" as const };
}
