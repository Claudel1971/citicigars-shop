import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

export const TARGET = Object.freeze({
  database: 'bwljrj22_citicigars_admin_staging',
  service: 'srv-da15590u01pc739gdjrg',
  name: 'citicigars-api-staging',
  source: '48d8ea8523728b00cd0a2949c61302148309656a75ede590c32c709c1b77174a',
});
const digest = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { jobCode: code }); };
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);

// This first deployment deliberately has NO mutation adapter, arbitrary SQL,
// upload URL, HTTP endpoint or credential output. All statements are fixed SELECTs.
export function validateConfiguration(env, now = Date.now()) {
  if (env.V6_JOB_ENABLED !== 'true') return null;
  if (env.RENDER !== 'true' || env.RENDER_SERVICE_ID !== TARGET.service || env.RENDER_SERVICE_NAME !== TARGET.name) fail('SERVICE_GUARD');
  if (!/^[a-f0-9]{40}$/.test(env.V6_JOB_COMMIT || '') || env.RENDER_GIT_COMMIT !== env.V6_JOB_COMMIT) fail('COMMIT_GUARD');
  if (env.V6_JOB_MODE !== 'preflight') fail('MUTATION_NOT_IMPLEMENTED');
  const expires = Date.parse(env.V6_JOB_EXPIRES_AT || '');
  if (!Number.isFinite(expires) || expires <= now || expires - now > 2 * 60 * 60 * 1000) fail('EXPIRY_GUARD');
  let url;
  try { url = new URL(env.MYSQL_URL); } catch { fail('DATABASE_URL_GUARD'); }
  if (url.protocol !== 'mysql:' || decodeURIComponent(url.pathname.slice(1)) !== TARGET.database || url.search || url.hash) fail('DATABASE_URL_GUARD');
  if (!hex(env.V6_JOB_MANIFEST_SHA256) || !env.V6_JOB_MANIFEST_GZIP || env.V6_JOB_MANIFEST_GZIP.length > 100000) fail('MANIFEST_GUARD');
  let bytes, plan;
  try {
    bytes = gunzipSync(Buffer.from(env.V6_JOB_MANIFEST_GZIP, 'base64'), { maxOutputLength: 1000000 });
    plan = JSON.parse(bytes.toString('utf8'));
  } catch { fail('MANIFEST_GUARD'); }
  if (digest(bytes.toString('utf8')) !== env.V6_JOB_MANIFEST_SHA256 || plan.source_sha256 !== TARGET.source) fail('SOURCE_GUARD');
  if (!Array.isArray(plan.facts) || plan.facts.length !== 418 || !Array.isArray(plan.skus) || plan.skus.length !== 61) fail('MANIFEST_SHAPE');
  const seen = new Set();
  for (const r of plan.facts) {
    if (typeof r.source_record_id !== 'string' || r.source_record_id.length > 250 || seen.has(r.source_record_id) || !hex(r.source_payload_sha256) || !['READY','MANUAL_REVIEW','REJECT'].includes(r.status)) fail('SOURCE_RECORD_GUARD');
    seen.add(r.source_record_id);
  }
  if (new Set(plan.skus).size !== 61 || plan.skus.some(x => typeof x !== 'string' || !/^CTCG-[A-Z0-9-]+$/.test(x))) fail('SKU_GUARD');
  return { plan, expires, manifestHash: env.V6_JOB_MANIFEST_SHA256 };
}

export async function runV6Preflight(pool, env = process.env, emit = x => console.log(JSON.stringify(x)), now = () => Date.now()) {
  let connection;
  const audit = (event, details = {}) => emit({ job: 'v6-preflight-v1', event, at: new Date(now()).toISOString(), ...details });
  try {
    const config = validateConfiguration(env, now());
    if (!config) return { status: 'disabled' };
    audit('START', { commit: env.V6_JOB_COMMIT, manifest_sha256: config.manifestHash, mode: 'READ_ONLY' });
    connection = await pool.getConnection();
    const select = async (sql, values = []) => {
      if (now() >= config.expires) fail('EXPIRED_DURING_RUN');
      const [rows] = await connection.query({ sql, values, timeout: 15000 });
      return rows;
    };
    const [identity] = await select('SELECT DATABASE() AS database_name, VERSION() AS server_version');
    if (identity.database_name !== TARGET.database) fail('LIVE_DATABASE_GUARD');
    audit('IDENTITY_PASS', { database: identity.database_name, server_version: identity.server_version, service: TARGET.service, commit: env.V6_JOB_COMMIT });
    await connection.query('SET TRANSACTION READ ONLY');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const columns = await select('SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION', [TARGET.database]);
    const triggers = await select('SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME', [TARGET.database]);
    const required = ['trg_stock_movements_bd','trg_stock_movements_bu','trg_cash_journal_entries_bd','trg_cash_journal_entries_bu','trg_stock_lot_cost_basis_bd','trg_stock_lot_cost_basis_bu'];
    if (required.some(n => !triggers.some(t => t.TRIGGER_NAME === n && /SIGNAL\s+SQLSTATE/i.test(t.ACTION_STATEMENT)))) fail('APPEND_ONLY_GUARD');
    const skus = await select('SELECT sku, kind FROM skus ORDER BY sku');
    const orders = await select('SELECT order_id, source_system, source_record_id, source_row_hash, final_sale_total_xaf, amount_paid, balance_due, status FROM orders ORDER BY order_id');
    const cash = await select('SELECT entry_type, COUNT(*) AS count, SUM(amount_xaf) AS total FROM cash_journal_entries GROUP BY entry_type ORDER BY entry_type');
    const balances = await select('SELECT sku, type, pack_size, on_hand_qty, deposit_qty FROM stock_balances ORDER BY sku, type, pack_size');
    const counts = {};
    // Names are code constants, never supplied by manifest or environment.
    for (const table of ['customers','stock_purchase_orders','stock_receipts','stock_movements','stock_movement_groups','stock_lot_cost_basis','stock_movement_lot_allocations']) {
      counts[table] = Number((await select(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
    }
    const sourceCounts = {};
    for (const r of config.plan.facts) sourceCounts[r.status] = (sourceCounts[r.status] || 0) + 1;
    const existing = new Set(skus.map(x => x.sku));
    const missing = config.plan.skus.filter(x => !existing.has(x));
    const baseline = { orders: orders.length, sku_count: skus.length, cash, counts,
      on_hand: balances.reduce((n,r) => n + Number(r.on_hand_qty),0),
      deposit: balances.reduce((n,r) => n + Number(r.deposit_qty),0),
      snapshot_sha256: digest({ orders, cash, balances, counts, skus }),
      schema_sha256: digest(columns), triggers_sha256: digest(triggers), trigger_count: triggers.length };
    const blockers = ['PHASE_ADAPTERS_NOT_QUALIFIED'];
    if (sourceCounts.MANUAL_REVIEW) blockers.push('SOURCE_EXCEPTIONS');
    if (missing.length) blockers.push('CATALOG_MAPPING_REQUIRED');
    const dateColumn = columns.find(c => c.TABLE_NAME === 'stock_purchase_orders' && c.COLUMN_NAME === 'ordered_at');
    if (dateColumn?.IS_NULLABLE === 'NO') blockers.push('PARTIAL_PURCHASE_DATE_MODEL');
    const cashOrder = columns.find(c => c.TABLE_NAME === 'cash_journal_entries' && c.COLUMN_NAME === 'order_id');
    if (cashOrder?.IS_NULLABLE === 'NO') blockers.push('DEPOSIT_ADVANCE_MODEL');
    audit('BASELINE', baseline);
    // Hash record identities: no customer names, source payloads, SQL errors or secrets in logs.
    for (const r of config.plan.facts) audit('FACT_CHECK', { record_key_sha256: digest(r.source_record_id), source_payload_sha256: r.source_payload_sha256, status: r.status });
    const result = { status: 'BLOCKED', source_counts: sourceCounts, missing_sku_count: missing.length, blockers, mutation_count: 0, manifest_sha256: config.manifestHash };
    await connection.rollback();
    audit('DRY_RUN_COMPLETE', result);
    return result;
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    // mysql errors can contain SQL/credentials or commercial payloads: never serialize them.
    const code = error?.jobCode || 'DATABASE_OR_RUNTIME_FAILURE';
    audit('FAILED_CLOSED', { code, mutation_count: 0 });
    return { status: 'failed', code };
  } finally { if (connection) connection.release(); }
}
