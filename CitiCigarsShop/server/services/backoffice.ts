import { mysqlPool } from "../db.mysql";
import { parseSourceJson } from "./backoffice-model";

// Explicit fixture namespace only; real transactions are not classified by amount or date.
const businessOrder = `o.status IN ('CONFIRMED','PAID') AND o.order_id NOT LIKE 'CLOSE06%' AND NOT EXISTS (SELECT 1 FROM order_items t WHERE t.order_id=o.order_id AND (t.item_sku LIKE 'CLOSE06%' OR t.item_sku LIKE 'CI06-%'))`;

export async function backofficeIdentities() {
  const [identities] = await mysqlPool.query<any[]>(
    "SELECT cigar_id,marque,ligne,vitole,format,dimensions,ring_gauge,pays,source_ref FROM cigar_catalog ORDER BY marque,ligne,vitole,cigar_id",
  );
  const [links] = await mysqlPool.query<any[]>(
    "SELECT cigar_id,sku,cigars_per_box,quantite_boite FROM products WHERE cigar_id IS NOT NULL AND sku NOT LIKE 'CLOSE06%' AND sku NOT LIKE 'CI06-%'",
  );
  return identities.map((row) => ({
    ...row,
    skus: links.filter((link) => link.cigar_id === row.cigar_id),
  }));
}

export async function backofficeDashboard() {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.query(
      "START TRANSACTION READ ONLY, WITH CONSISTENT SNAPSHOT",
    );
    const [stock] = await connection.query<any[]>(
      `SELECT COALESCE(SUM(on_hand_qty+at_event_qty+transit_qty),0) held, COALESCE(SUM(deposit_qty),0) deposit FROM stock_balances WHERE sku NOT LIKE 'CLOSE06%' AND sku NOT LIKE 'CI06-%'`,
    );
    const [finance] = await connection.query<any[]>(
      `SELECT COUNT(*) orders, COALESCE(SUM(o.final_sale_total_xaf),0) revenue, COALESCE(SUM(o.balance_due),0) receivable FROM orders o WHERE ${businessOrder}`,
    );
    const [cash] = await connection.query<any[]>(
      `SELECT COALESCE(SUM(CASE WHEN c.entry_type='RECEIPT' THEN c.amount_xaf ELSE -c.amount_xaf END),0) cash FROM cash_journal_entries c JOIN orders o ON o.order_id=c.order_id WHERE ${businessOrder}`,
    );
    const [activity] = await connection.query<any[]>(
      `SELECT o.order_id reference,o.order_date date,o.final_sale_total_xaf amount FROM orders o WHERE ${businessOrder} ORDER BY o.order_date DESC,o.order_id LIMIT 8`,
    );
    const [top] = await connection.query<any[]>(
      `SELECT i.item_sku sku,MAX(i.brand) brand,MAX(i.series) series,MAX(i.vitole) vitole,SUM(i.quantity) quantity,COUNT(DISTINCT o.order_id) orders FROM order_items i JOIN orders o ON o.order_id=i.order_id WHERE ${businessOrder} AND i.stock_disposition='CONSUME' GROUP BY i.item_sku ORDER BY SUM(i.quantity) DESC,i.item_sku LIMIT 5`,
    );
    await connection.commit();
    return {
      generatedAt: new Date().toISOString(),
      stock: stock[0],
      finance: { ...finance[0], ...cash[0] },
      activity,
      top,
      scope:
        "Commandes confirmées/payées, hors namespace de tests CLOSE06. Consignations et avances exclues du CA et de l’encaissement des ventes.",
      stockUnit:
        "Objets stockables : boîtes, packs, unités et accessoires. Ce total n’est pas un nombre de cigares.",
      heldFormula:
        "En main + événement + transit. Les réservations sont incluses dans En main ; dépôt affiché séparément.",
    };
  } finally {
    await connection.rollback().catch(() => {});
    connection.release();
  }
}

export async function backofficeCosting() {
  const [inventory] = await mysqlPool.query<any[]>(
    `SELECT b.sku,b.type,b.pack_size,b.lot_id,l.lot_code,l.origin_kind,l.source_reference,p.marque,p.ligne,p.vitole,p.format,p.diametre,p.longueur,p.cigars_per_box, SUM(b.on_hand_qty+b.at_event_qty+b.deposit_qty+b.transit_qty) quantity,c.unit_cost_xaf,c.source cost_source FROM stock_lot_location_balances b JOIN stock_provenance_lots l ON l.lot_id=b.lot_id LEFT JOIN stock_lot_cost_basis c ON c.lot_id=b.lot_id AND c.sku=b.sku AND c.type=b.type AND c.pack_size=b.pack_size LEFT JOIN products p ON p.sku=b.sku WHERE b.sku NOT LIKE 'CLOSE06%' AND b.sku NOT LIKE 'CI06-%' GROUP BY b.sku,b.type,b.pack_size,b.lot_id,l.lot_code,l.origin_kind,l.source_reference,p.marque,p.ligne,p.vitole,p.format,p.diametre,p.longueur,p.cigars_per_box,c.unit_cost_xaf,c.source HAVING quantity<>0 ORDER BY p.marque,b.sku,b.lot_id`,
  );
  const [sales] = await mysqlPool.query<any[]>(
    `SELECT o.order_id,o.order_date,o.final_sale_total_xaf,o.total_cost_xaf,o.gross_margin_xaf,o.balance_due,COALESCE(SUM(CASE WHEN i.stock_disposition='CONSUME' THEN i.quantity ELSE 0 END),0) articles FROM orders o LEFT JOIN order_items i ON i.order_id=o.order_id WHERE ${businessOrder} GROUP BY o.order_id,o.order_date,o.final_sale_total_xaf,o.total_cost_xaf,o.gross_margin_xaf,o.balance_due ORDER BY o.order_date DESC`,
  );
  const [sourceRows] = await mysqlPool.query<any[]>(
    "SELECT source_record_id,payload_json,target_json FROM v6_import_journal WHERE source_system='MASTER_GESTION' AND phase='PS2' ORDER BY source_record_id",
  );
  const [identities] = await mysqlPool.query<any[]>(
    "SELECT sku,marque,ligne,vitole,format,diametre,longueur,cigars_per_box FROM products",
  );
  const identity = new Map(identities.map((row) => [row.sku, row]));
  const purchases = sourceRows.flatMap((row) => {
    const source = parseSourceJson(row.payload_json);
    if (!Array.isArray(source?.lines)) return [];
    return source.lines.map((line: any) => ({
      ...line,
      identity: identity.get(line.sku) ?? null,
      supplier: source.supplierCode?.replace(/^V6_/, ""),
      date: source.orderedAt ?? source.period ?? null,
      datePrecision: source.period
        ? "MONTH"
        : source.orderedAt
          ? "DAY"
          : "UNKNOWN",
      sourceRecordId: row.source_record_id,
      source: line.money ?? null,
      // Preserve all source components for audit. No inferred freight/tax allocation.
      landedUnitCostXaf: line.unitCostXaf ?? null,
      landedTotalXaf: line.exact_landed_xaf ?? null,
    }));
  });
  return { inventory, sales, purchases, readOnly: true };
}

export async function orderCostTrace(orderId: string) {
  const [lines] = await mysqlPool.query<any[]>(
    "SELECT order_item_id,item_sku,brand,series,vitole,quantity,stock_disposition,stock_movement_group_id,total_cost_xaf,actual_line_revenue_xaf FROM order_items WHERE order_id=? ORDER BY order_item_id",
    [orderId],
  );
  const [allocations] = await mysqlPool.query<any[]>(
    `SELECT i.order_item_id,a.lot_id,a.sku,a.type,a.pack_size,-a.qty_delta consumed,c.unit_cost_xaf,c.source cost_source FROM order_items i JOIN stock_movement_lot_allocations a ON a.group_id=i.stock_movement_group_id LEFT JOIN stock_lot_cost_basis c ON c.lot_id=a.lot_id AND c.sku=a.sku AND c.type=a.type AND c.pack_size=a.pack_size WHERE i.order_id=? AND a.balance_field='onHand' AND a.qty_delta<0`,
    [orderId],
  );
  const visited = new Set<string>();
  const lots: any[] = [];
  const pending = allocations.map((a) => a.lot_id as string);
  // Bounded graph traversal exposes transformed lots and the receipt lots they consumed.
  while (pending.length) {
    const ids = Array.from(new Set(pending.splice(0))).filter(
      (id) => !visited.has(id),
    );
    if (!ids.length) break;
    if (visited.size + ids.length > 1000) throw new Error("trace_graph_limit");
    ids.forEach((id) => visited.add(id));
    const [rows] = await mysqlPool.query<any[]>(
      `SELECT l.*,ri.sku receipt_sku,ri.quantity received_quantity,r.received_at,r.purchase_reference,r.invoice_reference,r.notes receipt_notes,s.name supplier FROM stock_provenance_lots l LEFT JOIN stock_receipt_items ri ON ri.lot_id=l.lot_id LEFT JOIN stock_receipts r ON r.receipt_id=l.receipt_id LEFT JOIN stock_suppliers s ON s.supplier_id=r.supplier_id WHERE l.lot_id IN (${ids.map(() => "?").join(",")})`,
      ids,
    );
    for (const row of rows) {
      const provenance = parseSourceJson(row.notes);
      lots.push({ ...row, provenance });
      for (const input of provenance?.inputLots ?? [])
        for (const allocation of input.allocations ?? [])
          if (typeof allocation.lot_id === "string")
            pending.push(allocation.lot_id);
    }
  }
  const sourceIds = Array.from(
    new Set(
      lots
        .map((l) => parseSourceJson(l.receipt_notes)?.source_record_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  if (sourceIds.length) {
    const [sources] = await mysqlPool.query<any[]>(
      `SELECT source_record_id,payload_json FROM v6_import_journal WHERE source_system='MASTER_GESTION' AND source_record_id IN (${sourceIds.map(() => "?").join(",")})`,
      sourceIds,
    );
    const byId = new Map(
      sources.map((row) => [
        row.source_record_id,
        parseSourceJson(row.payload_json),
      ]),
    );
    for (const lot of lots) {
      const source = byId.get(
        parseSourceJson(lot.receipt_notes)?.source_record_id,
      );
      const line = source?.lines?.find((l: any) => l.sku === lot.receipt_sku);
      lot.purchaseSource = line
        ? {
            date: source.orderedAt ?? source.period ?? null,
            quantity: line.quantity,
            type: line.type,
            packSize: line.packSize,
            money: line.money ?? null,
            landedUnitCostXaf: line.unitCostXaf ?? null,
            exactLandedXaf: line.exact_landed_xaf ?? null,
            costingMethod: source.costingMethod ?? null,
          }
        : null;
    }
  }
  return { orderId, lines, allocations, lots, readOnly: true };
}
