export const MONITORING_DEFAULTS = { lowStockThreshold: 2, dormantDays: 90, oldLotDays: 180, poOverdueGraceDays: 0 } as const;
export const MONITORING_MAX_LIMIT = 100;

export class MonitoringInputError extends Error {
  constructor(public code: string) { super(code); }
}

export function parseMonitoringQuery(input: Record<string, unknown>) {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = input[key];
    if (raw == null || raw === "") return fallback;
    const value = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new MonitoringInputError(`invalid_${key}`);
    return value;
  };
  const text = (key: string, max = 100) => {
    const raw = Array.isArray(input[key]) ? input[key][0] : input[key];
    const value = String(raw || "").trim();
    if (value.length > max) throw new MonitoringInputError(`invalid_${key}`);
    return value;
  };
  return {
    limit: integer("limit", 25, 1, MONITORING_MAX_LIMIT), offset: integer("offset", 0, 0, 1_000_000),
    lowStockThreshold: integer("lowStockThreshold", MONITORING_DEFAULTS.lowStockThreshold, 0, 1_000_000),
    dormantDays: integer("dormantDays", MONITORING_DEFAULTS.dormantDays, 1, 3650),
    oldLotDays: integer("oldLotDays", MONITORING_DEFAULTS.oldLotDays, 1, 3650),
    poOverdueGraceDays: integer("poOverdueGraceDays", MONITORING_DEFAULTS.poOverdueGraceDays, 0, 365),
    search: text("search"), locationId: text("locationId", 36), alertType: text("alertType", 40),
    movementType: text("movementType", 50), referenceType: text("referenceType", 50), poStatus: text("poStatus", 50), supplierId: text("supplierId", 36),
  };
}

export function balanceOf(row: any) {
  const buckets = { onHand: Number(row.on_hand_qty || 0), reservedClient: Number(row.reserved_client_qty || 0), reservedEvent: Number(row.reserved_event_qty || 0), atEvent: Number(row.at_event_qty || 0), deposit: Number(row.deposit_qty || 0), transit: Number(row.transit_qty || 0) };
  return { buckets, availableNow: Math.max(0, buckets.onHand - buckets.reservedClient - buckets.reservedEvent), physicalUnits: buckets.onHand + buckets.atEvent + buckets.deposit + buckets.transit };
}

export function movementClass(type: string, delta = 0) {
  if (type === "VENTE") return "COMMERCIAL_OUTBOUND";
  if (["RESERVATION_CLIENT", "LIBERATION_RESERVATION_CLIENT", "RESERVATION_EVENEMENT"].includes(type)) return "RESERVATION";
  if (["MISE_EN_DEPOT", "RETOUR_DE_DEPOT", "SORTIE_EVENEMENT", "RETOUR_EVENEMENT"].includes(type)) return "PHYSICAL_DEPLOYMENT";
  if (type === "CORRECTION_INVENTAIRE") return "CORRECTION";
  if (type === "RECEPTION" || delta > 0) return "INBOUND";
  return "OTHER";
}

export function evaluateIdentity(position: any, now: Date, options: { lowStockThreshold: number; dormantDays: number }) {
  const alerts: any[] = [];
  if (!position.reconciled) alerts.push({ type: "RECONCILIATION_ERROR", severity: "CRITICAL" });
  if (position.reconciled) {
    if (position.availableNow === 0 && position.buckets.onHand > 0 && position.buckets.reservedClient + position.buckets.reservedEvent >= position.buckets.onHand) alerts.push({ type: "FULLY_RESERVED", severity: "ATTENTION" });
    else if (position.availableNow === 0) alerts.push({ type: "OUT_OF_STOCK", severity: "ATTENTION" });
    else if (position.availableNow <= options.lowStockThreshold) alerts.push({ type: "LOW_STOCK", severity: "WATCH" });
    if (position.legacyUnknown) alerts.push({ type: "LEGACY_UNKNOWN_EXPOSURE", severity: "WATCH" });
    const cutoff = now.getTime() - options.dormantDays * 86_400_000;
    const observed = position.historySince ? new Date(position.historySince).getTime() : NaN;
    const lastSale = position.lastSaleAt ? new Date(position.lastSaleAt).getTime() : NaN;
    position.historySufficient = Number.isFinite(observed) && observed <= cutoff;
    position.dormant = position.availableNow > 0 && position.historySufficient && (!Number.isFinite(lastSale) || lastSale < cutoff);
    if (position.dormant) alerts.push({ type: "DORMANT", severity: "WATCH" });
  }
  return alerts;
}

export function isOverdue(expectedAt: unknown, status: string, now: Date, graceDays: number) {
  if (!expectedAt || !["ORDERED", "PARTIALLY_RECEIVED"].includes(status)) return false;
  return new Date(String(expectedAt)).getTime() + graceDays * 86_400_000 < now.getTime();
}
