import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';
import {DateTime} from 'luxon';
const today=DateTime.now().setZone('Asia/Ho_Chi_Minh');
const startAt=today.plus({days:((8-today.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0}).toISO();
async function boot(path){
 const p=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:path,PORT:'31487',HOST:'127.0.0.1',PUBLIC_DEMO:'0',DEMO_WRITE_TOKEN:''},stdio:'ignore'});
 for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:31487/readyz');if(r.ok)return p;}catch{}await new Promise(r=>setTimeout(r,100));}
 p.kill();throw Error('server boot timeout');
}
async function stop(p){p.kill('SIGTERM');await new Promise(resolve=>{if(p.exitCode!==null||p.signalCode!==null)return resolve();p.once('exit',resolve);setTimeout(resolve,3000)})}
test('T17 actual HTTP server process restart preserves created appointment',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-restart-')),path=join(dir,'test.sqlite');
 const db=openDb(path);migrate(db);seed(db);db.close();
 let p;
 try{
 p=await boot(path);
 const resp=await fetch('http://127.0.0.1:31487/api/v1/appointments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'restart-e2e-0001'},body:JSON.stringify({customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt})});
 assert.equal(resp.status,201,await resp.text());
 const id=(await (await fetch('http://127.0.0.1:31487/api/v1/appointments')).json()).data[0].id;
 await stop(p);p=await boot(path);
 const result=await fetch('http://127.0.0.1:31487/api/v1/appointments/'+id);
 assert.equal(result.status,200);assert.equal((await result.json()).data.status,'confirmed');
 }finally{if(p)await stop(p);rmSync(dir,{recursive:true,force:true})}
});
