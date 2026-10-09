import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fork} from 'node:child_process';
import {DateTime} from 'luxon';
import {openDb} from '../db/connection.js';
import {migrate} from '../db/migrate.js';
import {seed} from '../db/seed.js';
import {book} from './booking.js';

function scenarioDate(){
 const today=DateTime.now().setZone('Asia/Ho_Chi_Minh');
 return today.plus({days:((8-today.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0}).toISO();
}
const request=(startAt)=>({customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt});
function result(index,attempt){return {request:'Request '+String(index).padStart(2,'0'),status:attempt.status===201?'CONFIRMED':'REJECTED',httpStatus:attempt.status,code:attempt.code||null,appointmentId:attempt.appointment?.id||null,technicianId:attempt.appointment?.technicianId||null,bayId:attempt.appointment?.serviceBayId||null,reason:attempt.status===201?'Qualified technician and compatible service bay reserved for all 90 minutes.':attempt.code==='SLOT_UNAVAILABLE'?'The only eligible technician and compatible bay are already reserved for this interval.':attempt.code||'Unexpected worker outcome'};}
export async function runSimulation(mode){
 if(!['conflict','concurrent'].includes(mode))throw Error('Unknown simulation');
 const directory=mkdtempSync(join(tmpdir(),'keyloop-sim-'));
 const path=join(directory,'simulation.sqlite');
 const db=openDb(path);const startAt=scenarioDate();
 const workers=[];
 try{
  migrate(db);seed(db);
  const rows=[];
  if(mode==='conflict'){
   for(let i=1;i<=2;i++){
    try{const b=book(db,request(startAt),'simulation-conflict-'+i);rows.push(result(i,{status:201,appointment:b.appointment}));}
    catch(e){rows.push(result(i,{status:e.status||500,code:e.code||'ERROR'}));}
   }
  }else{
   for(let i=1;i<=10;i++)workers.push(fork(new URL('../../tests/workers/booking-worker.js',import.meta.url),[path,startAt,'simulation-concurrent-'+i],{stdio:['ignore','ignore','ignore','ipc']}));
   const readiness=workers.map(w=>new Promise((resolve,reject)=>{w.once('message',m=>m.ready?resolve():reject(Error('Worker failed startup')));w.once('error',reject);w.once('exit',()=>reject(Error('Worker exited before ready')));}));
   await Promise.all(readiness);
   const responses=workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);w.once('exit',()=>reject(Error('Worker exited before response')));}));
   workers.forEach(w=>w.send('GO'));
   let timeout;const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Simulation exceeded 15 seconds')),15000);});let answers;try{answers=await Promise.race([Promise.all(responses),deadline]);}finally{clearTimeout(timeout);}
   answers.forEach((a,i)=>rows.push(result(i+1,a)));
  }
  const confirmed=db.prepare("SELECT count(*) n FROM appointments WHERE status='confirmed'").get().n;
  const integrity=db.pragma('integrity_check',{simple:true});
  const success=rows.filter(r=>r.httpStatus===201).length;
  const conflicts=rows.filter(r=>r.httpStatus===409).length;
  if(success!==1||conflicts!==rows.length-1||confirmed!==1||integrity!=='ok')throw Error('Simulation invariant failed');
  return {mode,requested:rows.length,confirmed:success,rejected:conflicts,databaseConfirmed:confirmed,integrity,startAt,durationMinutes:90,service:'Brake Inspection',dealership:'Central Auto Service',capacity:'One qualified technician (Morgan / tech_001) + one compatible service bay (Bay A / bay_001)',isolated:true,results:rows};
 }finally{
  workers.forEach(w=>{if(w.connected)w.disconnect();if(!w.killed)w.kill();});
  db.close();rmSync(directory,{recursive:true,force:true});
 }
}
