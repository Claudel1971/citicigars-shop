import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { TARGET, validateConfiguration, runV6Preflight } from './v6-preflight.mjs';
const now = Date.parse('2026-09-27T23:00:00Z');
const facts = Array.from({length:418},(_,i)=>({source_record_id:`record-${i}`,source_payload_sha256:'a'.repeat(64),status:i<365?'READY':'MANUAL_REVIEW'}));
const manifest = JSON.stringify({source_sha256:TARGET.source,facts,skus:Array.from({length:61},(_,i)=>`CTCG-TEST-${i}`)});
const env = () => ({V6_JOB_ENABLED:'true',RENDER:'true',RENDER_SERVICE_ID:TARGET.service,RENDER_SERVICE_NAME:TARGET.name,RENDER_GIT_COMMIT:'b'.repeat(40),V6_JOB_COMMIT:'b'.repeat(40),V6_JOB_MODE:'preflight',V6_JOB_EXPIRES_AT:new Date(now+3600000).toISOString(),MYSQL_URL:`mysql://test:test@localhost/${TARGET.database}`,V6_JOB_MANIFEST_SHA256:createHash('sha256').update(manifest).digest('hex'),V6_JOB_MANIFEST_GZIP:gzipSync(manifest).toString('base64')});
test('disabled configuration never connects', async()=>{assert.deepEqual(await runV6Preflight({getConnection(){throw Error('connection forbidden');}},{}),{status:'disabled'});});
for (const [key,value] of [['RENDER','false'],['RENDER_SERVICE_ID','production'],['RENDER_SERVICE_NAME','production'],['RENDER_GIT_COMMIT','c'.repeat(40)],['V6_JOB_MODE','apply'],['V6_JOB_EXPIRES_AT','2020-01-01'],['V6_JOB_EXPIRES_AT','2027-01-01'],['MYSQL_URL','mysql://test:test@localhost/production'],['MYSQL_URL',`mysql://test:test@localhost/${TARGET.database}?database=production`],['V6_JOB_MANIFEST_SHA256','c'.repeat(64)],['V6_JOB_MANIFEST_GZIP','invalid']]) {
  test(`reject ${key}=${key.includes('URL')?'wrong target':value}`,()=>{assert.throws(()=>validateConfiguration({...env(),[key]:value},now));});
}
test('live database mismatch stops before transaction or data reads', async()=>{
 const calls=[],logs=[];
 const connection={query:async x=>{calls.push(x);return [[{database_name:'production'}]];},rollback:async()=>{},release:()=>{}};
 const result=await runV6Preflight({getConnection:async()=>connection},env(),x=>logs.push(x),()=>now);
 assert.equal(result.code,'LIVE_DATABASE_GUARD');assert.equal(calls.length,1);assert(!JSON.stringify(logs).includes('mysql://'));
});
test('preflight stays read-only and reports dependencies',async()=>{
 const calls=[],logs=[];
 const names=['trg_stock_movements_bd','trg_stock_movements_bu','trg_cash_journal_entries_bd','trg_cash_journal_entries_bu','trg_stock_lot_cost_basis_bd','trg_stock_lot_cost_basis_bu'];
 const connection={query:async x=>{
   const sql=typeof x==='string'?x:x.sql;calls.push(sql);
   if(sql.startsWith('SELECT DATABASE'))return [[{database_name:TARGET.database,server_version:'fixture'}]];
   if(sql.includes('information_schema.TRIGGERS'))return [names.map(TRIGGER_NAME=>({TRIGGER_NAME,ACTION_STATEMENT:"SIGNAL SQLSTATE '45000'"}))];
   if(sql.includes('information_schema.COLUMNS'))return [[{TABLE_NAME:'stock_purchase_orders',COLUMN_NAME:'ordered_at',IS_NULLABLE:'NO'},{TABLE_NAME:'cash_journal_entries',COLUMN_NAME:'order_id',IS_NULLABLE:'NO'}]];
   if(sql.includes('COUNT(*) AS n'))return [[{n:0}]];
   return [[]];
 },rollback:async()=>calls.push('ROLLBACK'),release:()=>calls.push('RELEASE')};
 const result=await runV6Preflight({getConnection:async()=>connection},env(),x=>logs.push(x),()=>now);
 assert.equal(result.status,'BLOCKED');assert.equal(result.mutation_count,0);
 assert.equal(result.missing_sku_count,61);assert.equal(logs.filter(x=>x.event==='FACT_CHECK').length,418);
 assert(result.blockers.includes('DEPOSIT_ADVANCE_MODEL'));assert(result.blockers.includes('PARTIAL_PURCHASE_DATE_MODEL'));
 assert(calls.every(x=>/^(SELECT |SET TRANSACTION READ ONLY$|START TRANSACTION WITH CONSISTENT SNAPSHOT$|ROLLBACK$|RELEASE$)/.test(x)));
});
test('database errors never disclose SQL or credentials',async()=>{
 const logs=[];
 const result=await runV6Preflight({getConnection:async()=>{throw Error('mysql://private:secret@host SQL payload');}},env(),x=>logs.push(x),()=>now);
 assert.equal(result.code,'DATABASE_OR_RUNTIME_FAILURE');assert(!JSON.stringify(logs).includes('secret'));assert(!JSON.stringify(logs).includes('payload'));
});
