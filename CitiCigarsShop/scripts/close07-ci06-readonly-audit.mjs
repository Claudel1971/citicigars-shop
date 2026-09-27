import mysql from "mysql2/promise";

const EXPECTED_DB = "bwljrj22_citicigars_admin_staging";
const mysqlUrl = process.env.MYSQL_URL;
if (!mysqlUrl) throw new Error("MYSQL_URL missing");

const parsed = new URL(mysqlUrl);
const dbFromUrl = parsed.pathname.replace(/^\//, "");
if (dbFromUrl !== EXPECTED_DB) throw new Error(`FAIL-CLOSED unexpected DB in MYSQL_URL: ${dbFromUrl}`);

const connection = await mysql.createConnection(mysqlUrl);

async function rows(sql, params = []) {
  const [result] = await connection.execute(sql, params);
  return result as any[];
}

try {
  await connection.query("START TRANSACTION READ ONLY");

  const dbCheck = await rows("SELECT DATABASE() AS db");
  if (dbCheck[0]?.db !== EXPECTED_DB) {
    throw new Error(`FAIL-CLOSED SELECT DATABASE()=${dbCheck[0]?.db}`);
  }

  const skus = await rows(`
    SELECT sku, kind
    FROM skus
    WHERE sku LIKE 'CI06-%'
    ORDER BY sku
  `);

  const customers = await rows(`
    SELECT customer_id, first_name, last_name, status, is_internal, is_blacklisted, created_at
    FROM customers
    WHERE first_name = 'Close' AND last_name = 'Six'
    ORDER BY created_at, customer_id
  `);

  const suppliers = await rows(`
    SELECT supplier_id, code, name, active, created_at
    FROM stock_suppliers
    WHERE code LIKE 'SUP-%' AND name LIKE 'CLOSE06 Supplier %'
    ORDER BY created_at, supplier_id
  `);

  const purchaseOrders = await rows(`
    SELECT
      poi.sku,
      po.purchase_order_id,
      po.purchase_order_code,
      po.status,
      po.supplier_id,
      poi.purchase_order_item_id,
      poi.ordered_quantity,
      po.created_by,
      po.created_at
    FROM stock_purchase_order_items poi
    JOIN stock_purchase_orders po ON po.purchase_order_id = poi.purchase_order_id
    WHERE poi.sku LIKE 'CI06-%'
    ORDER BY po.created_at, po.purchase_order_id
  `);

  const receipts = await rows(`
    SELECT
      sri.sku,
      sr.receipt_id,
      sr.receipt_code,
      sr.purchase_order_id,
      sr.supplier_id,
      sr.destination_location_id,
      sri.receipt_item_id,
      sri.quantity,
      sri.lot_id,
      sr.invoice_reference,
      sr.author,
      sr.created_at
    FROM stock_receipt_items sri
    JOIN stock_receipts sr ON sr.receipt_id = sri.receipt_id
    WHERE sri.sku LIKE 'CI06-%'
    ORDER BY sr.created_at, sr.receipt_id
  `);

  const balances = await rows(`
    SELECT
      sku, type, pack_size,
      on_hand_qty, reserved_client_qty, reserved_event_qty,
      at_event_qty, deposit_qty, transit_qty,
      last_movement_group_id, updated_at
    FROM stock_balances
    WHERE sku LIKE 'CI06-%'
    ORDER BY sku, type, pack_size
  `);

  const lotBalances = await rows(`
    SELECT
      sku, lot_id, location_id, type, pack_size,
      on_hand_qty, reserved_client_qty, reserved_event_qty,
      at_event_qty, deposit_qty, transit_qty,
      last_movement_group_id, updated_at
    FROM stock_lot_location_balances
    WHERE sku LIKE 'CI06-%'
    ORDER BY sku, lot_id, location_id
  `);

  const costBasis = await rows(`
    SELECT sku, lot_id, type, pack_size, unit_cost_xaf, source, source_reference, created_at
    FROM stock_lot_cost_basis
    WHERE sku LIKE 'CI06-%'
    ORDER BY sku, created_at, lot_id
  `);

  const movements = await rows(`
    SELECT
      sku, movement_type, reference_type, reference_id,
      SUM(qty_delta) AS net_qty_delta,
      COUNT(*) AS row_count,
      MIN(created_at) AS first_created_at,
      MAX(created_at) AS last_created_at
    FROM stock_movements
    WHERE sku LIKE 'CI06-%'
    GROUP BY sku, movement_type, reference_type, reference_id
    ORDER BY sku, first_created_at, movement_type
  `);

  const sales = await rows(`
    SELECT
      oi.item_sku AS sku,
      o.order_id,
      o.customer_id,
      o.status,
      oi.quantity,
      o.final_sale_total_xaf,
      o.total_cost_xaf,
      o.gross_margin_xaf,
      o.gross_margin_rate,
      o.amount_paid,
      o.balance_due,
      o.source,
      o.source_system,
      o.created_at
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE oi.item_sku LIKE 'CI06-%'
    ORDER BY o.created_at, o.order_id
  `);

  const cash = await rows(`
    SELECT
      c.order_id,
      c.cash_entry_id,
      c.entry_type,
      c.amount_xaf,
      c.occurred_at,
      c.author,
      c.reference,
      c.created_at
    FROM cash_journal_entries c
    WHERE EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = c.order_id
        AND oi.item_sku LIKE 'CI06-%'
    )
    ORDER BY c.order_id, c.occurred_at, c.created_at, c.cash_entry_id
  `);

  const cashByOrder = new Map();
  for (const entry of cash) {
    const current = cashByOrder.get(entry.order_id) ?? { receiptXaf: 0, refundXaf: 0, balanceXaf: 0, entryTypes: [] };
    const amount = Number(entry.amount_xaf || 0);
    if (entry.entry_type === "RECEIPT") current.receiptXaf += amount;
    if (entry.entry_type === "REFUND") current.refundXaf += amount;
    current.balanceXaf = current.receiptXaf - current.refundXaf;
    current.entryTypes.push(entry.entry_type);
    cashByOrder.set(entry.order_id, current);
  }

  const perSku = skus.map((skuRow) => {
    const sku = skuRow.sku;
    const skuBalances = balances.filter((r) => r.sku === sku);
    const skuLotBalances = lotBalances.filter((r) => r.sku === sku);
    const skuPos = purchaseOrders.filter((r) => r.sku === sku);
    const skuReceipts = receipts.filter((r) => r.sku === sku);
    const skuSales = sales.filter((r) => r.sku === sku);
    const skuMovements = movements.filter((r) => r.sku === sku);
    const skuCosts = costBasis.filter((r) => r.sku === sku);

    const aggregate = skuBalances.reduce((acc, r) => {
      acc.onHand += Number(r.on_hand_qty || 0);
      acc.reservedClient += Number(r.reserved_client_qty || 0);
      acc.reservedEvent += Number(r.reserved_event_qty || 0);
      acc.atEvent += Number(r.at_event_qty || 0);
      acc.deposit += Number(r.deposit_qty || 0);
      acc.transit += Number(r.transit_qty || 0);
      return acc;
    }, { onHand: 0, reservedClient: 0, reservedEvent: 0, atEvent: 0, deposit: 0, transit: 0 });

    const saleStates = skuSales.map((sale) => ({
      orderId: sale.order_id,
      customerId: sale.customer_id,
      status: sale.status,
      quantity: Number(sale.quantity),
      finalSaleTotalXaf: Number(sale.final_sale_total_xaf),
      totalCostXaf: sale.total_cost_xaf == null ? null : Number(sale.total_cost_xaf),
      grossMarginXaf: sale.gross_margin_xaf == null ? null : Number(sale.gross_margin_xaf),
      grossMarginRate: sale.gross_margin_rate == null ? null : Number(sale.gross_margin_rate),
      cash: cashByOrder.get(sale.order_id) ?? { receiptXaf: 0, refundXaf: 0, balanceXaf: 0, entryTypes: [] },
    }));

    const issues = [];
    if (skuPos.some((po) => po.status !== "RECEIVED")) issues.push("purchase_order_not_fully_received");
    if (skuReceipts.length === 0) issues.push("no_receipt");
    if (skuCosts.length === 0) issues.push("no_cost_basis");
    if (saleStates.some((s) => s.status !== "CANCELLED")) issues.push("sale_not_cancelled");
    if (saleStates.some((s) => s.cash.balanceXaf !== 0)) issues.push("nonzero_cash_balance");
    if (aggregate.reservedClient || aggregate.reservedEvent || aggregate.atEvent || aggregate.deposit || aggregate.transit) {
      issues.push("nonzero_non_onhand_stock_bucket");
    }

    const expectedCompletedScenario = skuPos.length > 0 && skuReceipts.length > 0 && saleStates.length > 0;
    if (expectedCompletedScenario && aggregate.onHand !== 10) issues.push("completed_scenario_onhand_not_10");

    return {
      sku,
      aggregateStock: aggregate,
      purchaseOrders: skuPos,
      receipts: skuReceipts,
      lotCostBasis: skuCosts,
      lotBalances: skuLotBalances,
      sales: saleStates,
      movements: skuMovements,
      issues,
      classification: issues.length === 0
        ? "COMPLETE_SYNTHETIC_TEST_SET"
        : saleStates.length === 0
          ? "PARTIAL_SYNTHETIC_TEST_SET_NO_SALE"
          : "SYNTHETIC_TEST_SET_REQUIRES_REVIEW",
    };
  });

  const customerIds = new Set(customers.map((c) => c.customer_id));
  const supplierIds = new Set(suppliers.map((s) => s.supplier_id));
  const relatedOnly = {
    allCi06SalesUseCloseSixCustomers: sales.every((s) => customerIds.has(s.customer_id)),
    allCi06PurchaseOrdersUseSyntheticSuppliers: purchaseOrders.every((po) => supplierIds.has(po.supplier_id)),
  };

  const summary = {
    database: EXPECTED_DB,
    mode: "READ_ONLY",
    ci06SkuCount: skus.length,
    syntheticCustomerCount: customers.length,
    syntheticSupplierCount: suppliers.length,
    purchaseOrderCount: purchaseOrders.length,
    receiptCount: receipts.length,
    saleCount: sales.length,
    cashEntryCount: cash.length,
    completeSyntheticSets: perSku.filter((x) => x.classification === "COMPLETE_SYNTHETIC_TEST_SET").length,
    partialSyntheticSets: perSku.filter((x) => x.classification !== "COMPLETE_SYNTHETIC_TEST_SET").length,
    issueCount: perSku.reduce((n, x) => n + x.issues.length, 0),
    ...relatedOnly,
  };

  console.log(JSON.stringify({
    audit: "CLOSE-07 CI06 residue audit",
    summary,
    syntheticCustomers: customers,
    syntheticSuppliers: suppliers,
    perSku,
  }, null, 2));

  await connection.rollback();
} finally {
  await connection.end();
}
