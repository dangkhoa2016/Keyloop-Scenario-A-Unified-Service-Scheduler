import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fork} from 'node:child_process';
import {DateTime} from 'luxon';
import {openDb} from '../src/db/connection.js';
import {migrate} from '../src/db/migrate.js';
import {seed} from '../src/db/seed.js';
const date=DateTime.now().setZone('Asia/Ho_Chi_Minh');
const at=date.plus({days:((8-date.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0}).toISO();
async function race(keys){
 const dir=mkdtempSync(join(tmpdir(),'keyloop-two-process-'));
 const db=openDb(join(dir,'race.sqlite'));migrate(db);seed(db);
 const workers=keys.map(k=>fork(new URL('./workers/booking-worker.js',import.meta.url),[join(dir,'race.sqlite'),at,k],{stdio:['ignore','ignore','ignore','ipc']}));
 try{
  await Promise.all(workers.map(w=>new Promise((ok,bad)=>{w.once('message',m=>m.ready?ok():bad(Error('not ready')));w.once('error',bad)})));
  const answers=workers.map(w=>new Promise((ok,bad)=>{w.once('message',ok);w.once('error',bad)}));
  workers.forEach(w=>w.send('GO'));
  const result=await Promise.all(answers);
  return {result,rows:db.prepare("SELECT id,idempotency_key,status FROM appointments").all(),integrity:db.pragma('integrity_check',{simple:true})};
 }finally{workers.forEach(w=>{if(w.connected)w.disconnect()});db.close();rmSync(dir,{recursive:true,force:true})}
}
test('T11 two independent processes with distinct keys confirm exactly one resource pair',async()=>{
 const x=await race(['p2-distinct-A','p2-distinct-B']);
 assert.deepEqual(x.result.map(r=>r.status).sort(),[201,409]);assert.equal(x.rows.length,1);assert.equal(x.integrity,'ok');
});
test('T13 two independent processes with same idempotency key persist one appointment',async()=>{
 const x=await race(['shared-key-12345','shared-key-12345']);
 assert.deepEqual(x.result.map(r=>r.status),[201,201]);assert.equal(x.rows.length,1);
 assert.equal(x.result[0].appointment.id,x.result[1].appointment.id);
 assert.equal(x.integrity,'ok');
});
