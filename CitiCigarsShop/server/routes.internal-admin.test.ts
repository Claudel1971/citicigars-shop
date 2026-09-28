import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import express from 'express';
import { createServer,type Server } from 'node:http';
process.env.CMS_ADMIN_PASSWORD='internal-admin-unit-only';
const call=vi.fn(async()=>[]);
vi.mock('./services/internal-admin',()=>({identifiers:()=>call(),syncAllIdentifiers:()=>call(),listInternalSheets:()=>call(),addInternalSheet:()=>call(),listAdminTasks:()=>call(),createAdminTask:()=>call(),transitionAdminTask:()=>call(),InternalAdminError:class extends Error{status=503;}}));
const {registerInternalAdminRoutes}=await import('./routes.internal-admin');
const {issueAdminToken}=await import('./middleware/auth');
let server:Server,base:string;
beforeAll(async()=>{const app=express();app.use(express.json());registerInternalAdminRoutes(app);server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}`;});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
describe('internal admin writes remain behind RBAC',()=>{
 it('rejects anonymous calls and read-only roles before accessing storage',async()=>{
  for(const path of ['/sheets','/tasks','/identifiers/sync']){call.mockClear();for(const token of [null,issueAdminToken('AUDITOR').token]){const r=await fetch(base+'/api/admin/internal'+path,{method:'POST',headers:{'content-type':'application/json',...(token?{'x-cms-token':token}:{})},body:'{}'});expect(r.status).toBe(token?403:401);}expect(call).not.toHaveBeenCalled();}
 });
 it('allows CRM task work while supplier references and identifier sync remain CT only',async()=>{
  const headers={'x-cms-token':issueAdminToken('CRM_OPERATOR').token,'content-type':'application/json'};
  expect((await fetch(base+'/api/admin/internal/tasks',{method:'POST',headers,body:'{}'})).status).toBe(200);
  expect((await fetch(base+'/api/admin/internal/identifiers/SUPP',{headers})).status).toBe(403);
  expect((await fetch(base+'/api/admin/internal/identifiers/sync',{method:'POST',headers,body:'{}'})).status).toBe(403);
 });
});
