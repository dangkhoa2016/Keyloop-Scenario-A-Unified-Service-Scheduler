import test from 'node:test';import assert from 'node:assert/strict';import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {createApp} from '../src/app.js';
test('protected demo explains missing and wrong tokens without modifying data',async()=>{
 const old=process.env.DEMO_WRITE_TOKEN,oldMode=process.env.PUBLIC_DEMO;
 process.env.PUBLIC_DEMO='1';process.env.DEMO_WRITE_TOKEN='test-only-verify-123';
 const db=openDb(':memory:');migrate(db);const app=createApp(db);
 try{
  const read=await app.request('/api/v1/demo-access');assert.equal(read.status,200);assert.equal((await read.json()).data.writeProtected,true);
  const missing=await app.request('/api/v1/demo-access/verify',{method:'POST'});assert.equal(missing.status,403);assert.equal((await missing.json()).error.code,'DEMO_TOKEN_REQUIRED');
  const invalid=await app.request('/api/v1/demo-access/verify',{method:'POST',headers:{'X-Demo-Write-Token':'not-the-key'}});assert.equal(invalid.status,403);assert.equal((await invalid.json()).error.code,'DEMO_TOKEN_INVALID');
  const valid=await app.request('/api/v1/demo-access/verify',{method:'POST',headers:{'X-Demo-Write-Token':'test-only-verify-123'}});assert.equal(valid.status,200);assert.equal((await valid.json()).data.authorized,true);
  assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,0);
 }finally{db.close();if(old===undefined)delete process.env.DEMO_WRITE_TOKEN;else process.env.DEMO_WRITE_TOKEN=old;if(oldMode===undefined)delete process.env.PUBLIC_DEMO;else process.env.PUBLIC_DEMO=oldMode;}
});
