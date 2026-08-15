import { readFileSync } from "fs";

export type ReconStatus = "MATCHED" | "EXCEPTION_NON_RECOMPTEE" | "NO_MATCH";

export interface ReconRow {
  sku: string;
  sourceSku: string | null;
  type: string;
  rowKind: string;
  oldHeld: number;
  oldDeposit: number;
  newHeld: number | null;
  newDeposit: number | null;
  status: ReconStatus;
  note: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ";" && !inQuotes) { fields.push(current); current = ""; }
    else current += c;
  }
  fields.push(current);
  return fields;
}

function toNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function toNumOrNull(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseReconciliationCsv(filePath: string): ReconRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const [, ...dataLines] = lines;
  return dataLines.map((line) => {
    const f = parseCsvLine(line);
    const [sku, sourceSku, type, rowKind, oldHeld, oldDeposit, newHeld, newDeposit, , , status, note] = f;
    return {
      sku,
      sourceSku: sourceSku && sourceSku.trim() !== "" ? sourceSku : null,
      type,
      rowKind,
      oldHeld: toNum(oldHeld),
      oldDeposit: toNum(oldDeposit),
      newHeld: toNumOrNull(newHeld),
      newDeposit: toNumOrNull(newDeposit),
      status: status as ReconStatus,
      note,
    };
  });
}

/** Clé de rapprochement (SKU, Type) — pas SKU seul (piège des lignes Loose partageant un SKU avec leur Pack). */
export function reconKey(sku: string, type: string): string {
  return `${sku}|${type}`;
}

export function buildReconciliationMap(rows: ReconRow[]): Map<string, ReconRow> {
  const m = new Map<string, ReconRow>();
  for (const r of rows) m.set(reconKey(r.sku, r.type), r);
  return m;
}
