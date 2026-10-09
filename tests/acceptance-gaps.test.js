import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DateTime} from 'luxon';
import {openDb} from '../src/db/connection.js';
import {migrate} from '../src/db/migrate.js';
import {seed} from '../src/db/seed.js';
import {book,available,context,eligible} from '../src/domain/booking.js';
const now=DateTime.now().setZone('Asia/Ho_Chi_Minh');
const day=now.plus({days:((8-now.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0});
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'keyloop-accept-'));const db=openDb(join(dir,'test.sqlite'));try{migrate(db);seed(db);return fn(db)}finally{db.close();rmSync(dir,{recursive:true,force:true})}}
const at=(h,m=0)=>day.set({hour:h,minute:m}).toISO();
const req=(startAt=at(9),serviceTypeId='svc_brake')=>({customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId,startAt});
test('T03 technician free but only compatible bay occupied rejects without inserts',()=>fixture(db=>{
 db.prepare('INSERT INTO bay_blackouts VALUES(?,?,?,?)').run('b1','bay_001',day.toMillis(),day.plus({minutes:90}).toMillis());
 const before=db.prepare('SELECT COUNT(*) n FROM appointments').get().n;
 assert.equal(eligible(db,context(db,'dlr_001','svc_brake',at(9))),null);
 assert.throws(()=>book(db,req(),'t03-bay-only'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,before);
}));
test('T04 bay free but only qualified technician occupied rejects without inserts',()=>fixture(db=>{
 db.prepare('INSERT INTO technician_blackouts VALUES(?,?,?,?)').run('t1','tech_001',day.toMillis(),day.plus({minutes:90}).toMillis());
 assert.equal(eligible(db,context(db,'dlr_001','svc_brake',at(9))),null);
 assert.throws(()=>book(db,req(),'t04-tech-only'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
}));
test('T05 left and right partial overlap rejected',()=>fixture(db=>{
 book(db,req(at(10)),'overlap-anchor');
 assert.throws(()=>book(db,req(at(9)),'overlap-left'),{code:'SLOT_UNAVAILABLE'});
 assert.throws(()=>book(db,req(at(11)),'overlap-right'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare("SELECT COUNT(*) n FROM appointments WHERE status='confirmed'").get().n,1);
}));
test('T07 technician cannot cover entire service when shift ends',()=>fixture(db=>{
 assert.throws(()=>book(db,req(at(11)),'shift-cross-lunch'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
}));
test('T09 stored duration sourced from service_types',()=>fixture(db=>{
 const saved=book(db,{...req(at(9),'svc_oil'),durationMinutes:1},'dur-from-db').appointment;
 assert.equal(Date.parse(saved.endAt)-Date.parse(saved.startAt),45*60000);
 assert.equal(db.prepare('SELECT (end_at_ms-start_at_ms) AS ms FROM appointments WHERE id=?').get(saved.id).ms,45*60000);
}));
test('T10 invalid vehicle and customer ownership reject without partial writes',()=>fixture(db=>{
 assert.throws(()=>book(db,{...req(),vehicleId:'missing_vehicle'},'missing-vehicle'),{code:'NOT_FOUND'});
 assert.throws(()=>book(db,{...req(),customerId:'missing_customer'},'missing-customer'),{code:'OWNER_MISMATCH'});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
}));
test('T16 UPDATE trigger rejects overlap without changing original rows',()=>fixture(db=>{
 const a=book(db,req(at(9)),'update-trigger-a').appointment;
 const b=book(db,req(at(10,30)),'update-trigger-b').appointment;
 const sql="UPDATE appointments SET start_at_ms=?,end_at_ms=? WHERE id=?";
 assert.throws(()=>db.prepare(sql).run(Date.parse(a.startAt),Date.parse(a.endAt),b.id),/OVERLAP/);
 assert.equal(db.prepare('SELECT start_at_ms t FROM appointments WHERE id=?').get(b.id).t,Date.parse(b.startAt));
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
}));
test('T19 malformed time offsets rejected, no database mutation',()=>fixture(db=>{
 for(const time of ['2030-01-07T09:00:00','not-a-time','2030-01-07T09:00:00+99:00']){
   assert.throws(()=>book(db,req(time),'invalidtime-'+time),{code:'INVALID_TIME'});
 }
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
}));
test('T18 backup restore is consistent with WAL and linked records',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-restore-'));const db=openDb(join(dir,'live.sqlite'));
 try{migrate(db);seed(db);const booked=book(db,req(),'backup-source').appointment;
 const dest=join(dir,'restored.sqlite');await db.backup(dest);
 const restored=openDb(dest);
 try{assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');assert.equal(restored.prepare('SELECT COUNT(*) n FROM appointments').get().n,1);assert.equal(restored.prepare('SELECT status FROM appointments WHERE id=?').get(booked.id).status,'confirmed')}finally{restored.close()}
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
