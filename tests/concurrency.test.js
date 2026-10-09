import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {fork} from 'node:child_process';import {DateTime} from 'luxon';import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';
test('ten independent SQLite processes race for one qualified resource pair',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-race-')),path=join(dir,'race.sqlite');const db=openDb(path);migrate(db);seed(db);
 const now=DateTime.now().setZone('Asia/Ho_Chi_Minh');const startAt=now.plus({days:((8-now.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0}).toISO();
 const workers=Array.from({length:10},(_,i)=>fork(new URL('./workers/booking-worker.js',import.meta.url),[path,startAt,'race-test-'+i.toString().padStart(8,'0')],{stdio:['ignore','ignore','ignore','ipc']}));
 try{
 // Ready barrier: ensure ALL child processes have loaded separate SQLite connections before releasing them together.
 await Promise.all(workers.map(w=>new Promise((resolve,reject)=>{w.once('message',msg=>msg.ready?resolve():reject(Error('Invalid ready message')));w.once('error',reject);})));
 const pending=workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);}));
 workers.forEach(w=>w.send('GO'));
 const answers=await Promise.all(pending);
 const successful=answers.filter(x=>x.status===201),rejected=answers.filter(x=>x.status===409);
 assert.equal(successful.length,1,JSON.stringify(answers));assert.equal(rejected.length,9,JSON.stringify(answers));
 assert.equal(db.prepare("SELECT count(*) n FROM appointments WHERE status='confirmed'").get().n,1);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 }finally{workers.forEach(w=>{if(w.connected)w.disconnect();});db.close();rmSync(dir,{recursive:true,force:true});}
});
