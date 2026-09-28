import { describe, it, expect } from 'vitest';
import { validateUatEnvironment, uatWriteBlocked, UAT_TARGET } from './uat-migration';
const now=Date.parse('2026-09-28T05:00:00Z');
const env=()=>({UAT0024_ENABLED:'true',RENDER:'true',RENDER_SERVICE_ID:UAT_TARGET.service,RENDER_SERVICE_NAME:UAT_TARGET.name,RENDER_GIT_COMMIT:'a'.repeat(40),UAT0024_COMMIT:'a'.repeat(40),UAT0024_EXPIRES_AT:new Date(now+3600000).toISOString(),MYSQL_URL:`mysql://test:test@localhost/${UAT_TARGET.database}`,UAT0024_MAINTENANCE:'true',UAT0024_MODE:'preflight'});
describe('UAT0024 fail-closed runtime',()=>{
 it('does nothing unless explicitly enabled',()=>expect(validateUatEnvironment({})).toBeNull());
 it('allows only the bounded staging preflight',()=>expect(validateUatEnvironment(env(),now)?.mode).toBe('preflight'));
 for(const [key,value] of [['RENDER','false'],['RENDER_SERVICE_ID','production'],['RENDER_SERVICE_NAME','production'],['UAT0024_COMMIT','b'.repeat(40)],['UAT0024_EXPIRES_AT',new Date(now-1).toISOString()],['UAT0024_EXPIRES_AT',new Date(now+7200001).toISOString()],['MYSQL_URL','mysql://test@localhost/production'],['MYSQL_URL',`mysql://test@localhost/${UAT_TARGET.database}?database=production`],['UAT0024_MAINTENANCE','false'],['UAT0024_MODE','arbitrary-sql']]) it('rejects '+key+':'+value,()=>expect(()=>validateUatEnvironment({...env(),[key]:value},now)).toThrow());
 it('requires restore attestation and both baseline hashes before apply',()=>{
  expect(()=>validateUatEnvironment({...env(),UAT0024_MODE:'apply'},now)).toThrow();
  expect(validateUatEnvironment({...env(),UAT0024_MODE:'apply',UAT0024_RESTORE_ATTESTATION:'CLAUDEL_RESTORE_TEST_258_QUERIES_20260928',UAT0024_BASELINE:'b'.repeat(64),UAT0024_SCHEMA:'c'.repeat(64)},now)?.mode).toBe('apply');
 });
 it('blocks application writes throughout maintenance, including after job completion',()=>{
  for(const method of ['POST','PUT','PATCH','DELETE']) expect(uatWriteBlocked(env(),method)).toBe(true);
  for(const method of ['GET','HEAD','OPTIONS']) expect(uatWriteBlocked(env(),method)).toBe(false);
  expect(uatWriteBlocked({...env(),UAT0024_MAINTENANCE:'false'},'POST')).toBe(false);
  expect(uatWriteBlocked({...env(),RENDER_SERVICE_ID:'production'},'POST')).toBe(false);
 });
});
