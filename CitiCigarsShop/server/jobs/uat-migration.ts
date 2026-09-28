/** Temporary, explicitly armed staging operator. No HTTP execution endpoint. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const UAT_TARGET = { service: 'srv-da15590u01pc739gdjrg', name: 'citicigars-api-staging', database: 'bwljrj22_citicigars_admin_staging' };
const added = ['admin_business_identifiers','admin_business_sequences','admin_technical_sheet_versions','admin_tasks','admin_task_events'];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const refuse = (code: string): never => { throw new Error('UAT0024_' + code); };
export function validateUatEnvironment(env: NodeJS.ProcessEnv, now = Date.now()) {
  if (env.UAT0024_ENABLED !== 'true') return null;
  if (env.RENDER !== 'true' || env.RENDER_SERVICE_ID !== UAT_TARGET.service || env.RENDER_SERVICE_NAME !== UAT_TARGET.name) refuse('SERVICE');
  if (!/^[a-f0-9]{40}$/.test(env.UAT0024_COMMIT || '') || env.RENDER_GIT_COMMIT !== env.UAT0024_COMMIT) refuse('COMMIT');
  const expiry = Date.parse(env.UAT0024_EXPIRES_AT || '');
  if (!Number.isFinite(expiry) || expiry <= now || expiry - now > 7200000) refuse('EXPIRY');
  let url: URL; try { url = new URL(env.MYSQL_URL || ''); } catch { refuse('URL'); }
  if (url!.protocol !== 'mysql:' || decodeURIComponent(url!.pathname.slice(1)) !== UAT_TARGET.database || url!.search || url!.hash) refuse('DATABASE');
  if (env.UAT0024_MAINTENANCE !== 'true') refuse('MAINTENANCE');
  if (!['preflight','apply','qualify'].includes(env.UAT0024_MODE || '')) refuse('MODE');
  if (env.UAT0024_MODE === 'apply') {
    if (env.UAT0024_RESTORE_ATTESTATION !== 'CLAUDEL_RESTORE_TEST_258_QUERIES_20260928') refuse('RESTORE_ATTESTATION');
    if (![env.UAT0024_BASELINE,env.UAT0024_SCHEMA].every(x => /^[a-f0-9]{64}$/.test(x || ''))) refuse('BASELINE');
  }
  return { mode: env.UAT0024_MODE!, expiry };
}
export function uatWriteBlocked(env: NodeJS.ProcessEnv, method: string) {
  return env.RENDER_SERVICE_ID === UAT_TARGET.service && env.UAT0024_MAINTENANCE === 'true' && !['GET','HEAD','OPTIONS'].includes(method);
}
export async function runUatMigration() {
  const config = validateUatEnvironment(process.env);
  if (!config) return;
  const { mysqlPool } = await import('../db.mysql');
  const { syncIdentifiers } = await import('../services/internal-admin');
  const c = await mysqlPool.getConnection();
  const audit = (event: string, detail: object = {}) => console.log(JSON.stringify({job:'uat-0024',event,commit:process.env.RENDER_GIT_COMMIT,at:new Date().toISOString(),...detail}));
  const rows = async (q: string, values: any[] = []) => (await c.query<any[]>(q,values))[0];
  const snapshot = async () => {
    const tables = (await rows("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")).map(r=>r.name as string).filter(n=>!added.includes(n));
    const state: Record<string,string> = {};
    for (const table of tables) {
      if (!/^[a-zA-Z0-9_]+$/.test(table)) refuse('TABLE_NAME');
      state[table] = hash((await rows('SELECT * FROM `'+table+'`')).map(r=>JSON.stringify(r)).sort());
    }
    return { digest:hash(state),tableCount:tables.length };
  };
  const schemas = async () => hash(await rows('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION'));
  const ddl = await readFile('migrations-mysql/0024_uat_internal_admin.sql','utf8');
  const triggers = (await readFile('migrations-mysql/0024b_uat_identifier_triggers.sql','utf8')).split('--> statement-breakpoint');
  try {
    if ((await rows('SELECT DATABASE() name'))[0]?.name !== UAT_TARGET.database) refuse('LIVE_DATABASE');
    if (Number((await rows("SELECT GET_LOCK('UAT0024_STAGING',0) acquired"))[0]?.acquired)!==1) refuse('LOCK');
    const before = await snapshot(), schema = await schemas();
    const existing = await rows("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'admin_%'");
    audit('PREFLIGHT_PASS',{database:UAT_TARGET.database,mode:config.mode,baseline_sha256:before.digest,schema_sha256:schema,protected_tables:before.tableCount,existing_admin_tables:existing.map(r=>r.name),migration_sha256:hash([ddl,...triggers])});
    if (config.mode === 'preflight') return;
    if (Date.now() >= config.expiry) refuse('EXPIRED');
    if (config.mode === 'apply') {
      if (before.digest !== process.env.UAT0024_BASELINE || schema !== process.env.UAT0024_SCHEMA) refuse('BASELINE_CHANGED');
      audit('RESTORE_ATTESTED',{source:'User confirmation',target:'bwljrj22_citicigars_restore_test',queries:258});
      for (const q of ddl.split(';').filter(q=>q.trim())) await c.query(q);
      await c.beginTransaction();
      try { await syncIdentifiers(c,'CUST'); await syncIdentifiers(c,'SUPP'); await c.commit(); } catch(e) { await c.rollback(); throw e; }
      for (const q of triggers) {
        const name = q.match(/CREATE TRIGGER (\w+)/)?.[1];
        if (!name) refuse('TRIGGER_PARSE');
        if (!(await rows('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?',[name])).length) await c.query(q);
      }
    }
    for (const q of triggers) {
      const name=q.match(/CREATE TRIGGER (\w+)/)![1];
      const actual=await rows('SELECT ACTION_STATEMENT statement FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?',[name]);
      const normalize=(v:string)=>v.replace(/\s+/g,' ').trim().replace(/;$/, '');
      if (actual.length!==1 || normalize(actual[0].statement)!==normalize(q.slice(q.indexOf('BEGIN')))) refuse('TRIGGER_DEFINITION');
    }
    const missing = await rows("SELECT (SELECT COUNT(*) FROM customers c LEFT JOIN admin_business_identifiers b ON b.kind='CUST' AND b.entity_id=c.customer_id WHERE b.entity_id IS NULL)+(SELECT COUNT(*) FROM stock_suppliers s LEFT JOIN admin_business_identifiers b ON b.kind='SUPP' AND b.entity_id=s.supplier_id WHERE b.entity_id IS NULL) n");
    if(Number(missing[0].n)!==0) refuse('MISSING_IDENTIFIERS');
    const mappings=await rows('SELECT kind,entity_id,business_id FROM admin_business_identifiers ORDER BY kind,entity_id');
    await c.beginTransaction();
    try { await syncIdentifiers(c,'CUST'); await syncIdentifiers(c,'SUPP');
      if(hash(await rows('SELECT kind,entity_id,business_id FROM admin_business_identifiers ORDER BY kind,entity_id'))!==hash(mappings)) refuse('IDENTIFIER_REPLAY');
    } finally { await c.rollback(); }
    // Exercise additive task/event and source-version writes, then roll all proof rows back.
    const [customer] = await rows('SELECT customer_id id FROM customers ORDER BY customer_id LIMIT 1');
    const [cigar] = await rows('SELECT cigar_id id FROM cigar_catalog ORDER BY cigar_id LIMIT 1');
    if (!customer || !cigar) refuse('QUALIFICATION_REFERENCES');
    const task = randomUUID(), sheet = randomUUID();
    await c.beginTransaction();
    try {
      await c.query("INSERT INTO admin_tasks(task_id,customer_id,category,due_at,responsible,created_by) VALUES (?,?,'ADMIN_DOCUMENT','2026-09-28','UAT_ROLLBACK_PROOF','UAT')",[task,customer.id]);
      await c.query("INSERT INTO admin_task_events(event_id,task_id,status,actor,version) VALUES (?,?,'OPEN','UAT',1)",[randomUUID(),task]);
      await c.query("UPDATE admin_tasks SET status='DONE',version=2 WHERE task_id=? AND version=1",[task]);
      await c.query("INSERT INTO admin_task_events(event_id,task_id,status,actor,version) VALUES (?,?,'DONE','UAT',2)",[randomUUID(),task]);
      if(Number((await rows('SELECT COUNT(*) n FROM admin_task_events WHERE task_id=?',[task]))[0].n)!==2) refuse('TASK_EVENTS');
      await c.query("INSERT INTO admin_technical_sheet_versions(version_id,cigar_id,source,original_text,fields_json,created_by) VALUES (?,?,'UAT_ROLLBACK_PROOF','Synthetic verification','{}','UAT')",[sheet,cigar.id]);
    } finally { await c.rollback(); }
    if ((await rows('SELECT task_id FROM admin_tasks WHERE task_id=?',[task])).length || (await rows('SELECT version_id FROM admin_technical_sheet_versions WHERE version_id=?',[sheet])).length || (await rows('SELECT event_id FROM admin_task_events WHERE task_id=?',[task])).length) refuse('PROOF_ROLLBACK');
    const after=await snapshot();
    if(before.digest!==after.digest) refuse('HISTORICAL_DATA_CHANGED');
    audit('QUALIFICATION_PASS',{mode:config.mode,protected_tables:after.tableCount,baseline_sha256:after.digest,identifiers:mappings.length,identifier_replay:'PASS',triggers:2,task_sheet_rollback:'PASS',historical_data:'UNCHANGED'});
  } catch(e:any) {
    audit('FAILED',{code:typeof e?.message==='string'&&e.message.startsWith('UAT0024_')?e.message:(e?.code||'UNEXPECTED')});
    throw new Error('UAT0024 execution failed; inspect sanitized audit events');
  } finally { await c.query("SELECT RELEASE_LOCK('UAT0024_STAGING')").catch(()=>{}); c.release(); }
}
