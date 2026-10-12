import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {DateTime} from 'luxon';
import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';import {createApp} from '../src/app.js';
const now=DateTime.now().setZone('Asia/Ho_Chi_Minh');
const startAt=now.plus({days:((8-now.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0}).toISO();
const payload={customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt};
test('T21 16KiB cap returns 413 for declared and chunked booking bodies, preserving SQLite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-body-')),db=openDb(join(dir,'db.sqlite'));migrate(db);seed(db);
 try{
 const app=createApp(db),big=JSON.stringify({...payload,padding:'x'.repeat(17000)});
 const headers={'Content-Type':'application/json','Idempotency-Key':'body-limit-0001'};
 const declared=await app.request('/api/v1/appointments',{method:'POST',headers,body:big});
 assert.equal(declared.status,413);assert.equal((await declared.json()).error.code,'PAYLOAD_TOO_LARGE');
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(big.slice(0,6000)));c.enqueue(new TextEncoder().encode(big.slice(6000)));c.close()}});
 const chunked=await app.request('/api/v1/appointments',{method:'POST',headers:{...headers,'Content-Length':'not-a-number'},body:stream,duplex:'half'});
 assert.equal(chunked.status,413);assert.equal((await chunked.json()).error.code,'PAYLOAD_TOO_LARGE');
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,0);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
test('T21 SQLite concurrent writer lock maps to 503 DATABASE_BUSY with no partial writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-lock-')),file=join(dir,'db.sqlite'),db=openDb(file);migrate(db);seed(db);const locker=openDb(file);
 try{
 db.pragma('busy_timeout=80');locker.exec('BEGIN IMMEDIATE');
 const response=await createApp(db).request('/api/v1/appointments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'locked-writer-0001'},body:JSON.stringify(payload)});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error.code,'DATABASE_BUSY');
 locker.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,0);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 }finally{try{locker.exec('ROLLBACK')}catch{}locker.close();db.close();rmSync(dir,{recursive:true,force:true})}
});
