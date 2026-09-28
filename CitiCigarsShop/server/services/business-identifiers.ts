import { mysqlPool } from "../db.mysql";
export async function withBusinessIds<T extends Record<string, any>>(
  rows: T[],
  kind: "CUST" | "SUPP",
  key: keyof T,
): Promise<(T & { businessId: string | null })[]> {
  try {
    const [mapping] = await mysqlPool.query<any[]>(
      "SELECT entity_id,business_id FROM admin_business_identifiers WHERE kind=?",
      [kind],
    );
    const map = new Map(mapping.map((r) => [r.entity_id, r.business_id]));
    return rows.map((row) => ({
      ...row,
      businessId: map.get(row[key]) ?? null,
    }));
  } catch (e: any) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
    const pattern = new RegExp(`^CTCG-${kind}-\\d{6}$`);
    return rows.map((row) => ({
      ...row,
      businessId: pattern.test(String(row[key])) ? String(row[key]) : null,
    }));
  }
}
