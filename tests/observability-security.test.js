import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';import {createApp} from '../src/app.js';
test('T21 request IDs and log sanitization do not disclose provided demo token',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-log-'));const db=openDb(join(dir,'db.sqlite'));migrate(db);seed(db);
 const token='PRIVATE-CANARY-NO-LOG-999';
 const previous=process.env.DEMO_WRITE_TOKEN;
 process.env.DEMO_WRITE_TOKEN=token;
 const logs=[];const old=console.log;console.log=(...args)=>logs.push(args.map(String).join(' '));
 try{
 const app=createApp(db);
 const r=await app.request('/api/v1/appointments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'idempotency-canary','X-Demo-Write-Token':token},body:'{"malformed":'});
 assert.equal(r.status,400);
 const data=await r.json();
 assert.equal(data.error.code,'INVALID_JSON');
 assert.match(data.error.requestId,/^[0-9a-f-]{36}$/);
 assert.equal(r.headers.get('X-Request-ID'),data.error.requestId);
 assert.ok(logs.some(x=>x.includes(data.error.requestId)));
 assert.ok(!logs.join('\n').includes(token));
 assert.ok(!JSON.stringify(data).includes(token));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
 }finally{console.log=old;if(previous===undefined)delete process.env.DEMO_WRITE_TOKEN;else process.env.DEMO_WRITE_TOKEN=previous;db.close();rmSync(dir,{recursive:true,force:true})}
});
