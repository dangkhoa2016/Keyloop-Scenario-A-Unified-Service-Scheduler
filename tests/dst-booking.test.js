import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db/connection.js';
import {migrate} from '../src/db/migrate.js';
import {seed} from '../src/db/seed.js';
import {book,context} from '../src/domain/booking.js';
const payload=(startAt)=>({customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt});
function withDST(fn){
 const dir=mkdtempSync(join(tmpdir(),'keyloop-dst-engine-')),db=openDb(join(dir,'isolated.sqlite'));
 try{
  migrate(db);seed(db);
  db.prepare("UPDATE dealerships SET time_zone='America/New_York' WHERE id='dlr_001'").run();
  db.prepare("INSERT INTO dealership_hours VALUES('dlr_001',7,0,360)").run();
  db.prepare("INSERT INTO technician_shifts VALUES('tech_001',7,0,360)").run();
  return fn(db);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
}
test('T19 booking rejects spring-forward service interval crossing offset transition',()=>withDST(db=>{
 const t='2027-03-14T01:30:00-05:00';
 assert.throws(()=>book(db,payload(t),'spring-transition-01'),{code:'DST_TRANSITION'});
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,0);
}));
test('T19 booking rejects fall-back service interval crossing offset transition',()=>withDST(db=>{
 const t='2027-11-07T01:30:00-04:00';
 assert.throws(()=>book(db,payload(t),'fall-transition-01'),{code:'DST_TRANSITION'});
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,0);
}));
test('T19 fall fold explicit -05:00 instant remains valid and unique',()=>withDST(db=>{
 const t='2027-11-07T01:30:00-05:00';
 const a=book(db,payload(t),'fall-after-01').appointment;
 assert.equal(a.status,'confirmed');
 const utc=new Date(t).toISOString();
 assert.throws(()=>book(db,payload(utc),'fall-same-utc-02'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,1);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
}));
test('T19 nonexistent local wall-clock alias maps to existing instant, not extra booking',()=>withDST(db=>{
 const actual='2027-03-14T03:30:00-04:00';
 const pseudo='2027-03-14T02:30:00-05:00';
 assert.equal(Date.parse(actual),Date.parse(pseudo));
 const a=book(db,payload(actual),'spring-after-01').appointment;
 assert.equal(a.status,'confirmed');
 assert.throws(()=>book(db,payload(pseudo),'spring-alias-02'),{code:'SLOT_UNAVAILABLE'});
 assert.equal(db.prepare('SELECT count(*) n FROM appointments').get().n,1);
}));
