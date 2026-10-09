import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {DateTime} from 'luxon';
import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';
import {book,available} from '../src/domain/booking.js';import {createApp} from '../src/app.js';
const now=DateTime.now().setZone('Asia/Ho_Chi_Minh'),day=now.plus({days:((8-now.weekday)%7)||7}).set({hour:9,minute:0,second:0,millisecond:0});
const req={customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt:day.toISO()};
test('T10 validation matrix rejects invalid IDs, inputs and malformed JSON without rows',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-validation-')),db=openDb(join(dir,'db.sqlite'));migrate(db);seed(db);
 try{
 const app=createApp(db);
 const cases=[
 [{...req,customerId:''},400,'INVALID_INPUT'],
 [{...req,vehicleId:null},400,'INVALID_INPUT'],
 [{...req,serviceTypeId:42},400,'INVALID_INPUT'],
 [{...req,customerId:'missing'},422,'OWNER_MISMATCH'],
 [{...req,vehicleId:'missing'},404,'NOT_FOUND'],
 [{...req,customerId:'cus_002'},422,'OWNER_MISMATCH'],
 [{...req,dealershipId:'missing'},404,'NOT_FOUND'],
 [{...req,serviceTypeId:'missing'},404,'NOT_FOUND'],
 [{...req,startAt:'garbage'},400,'INVALID_TIME'],
 [{...req,startAt:day.minus({days:14}).toISO()},422,'PAST_TIME'],
 [{...req,startAt:day.set({hour:19}).toISO()},422,'CLOSED']
 ];
 for(const [payload,status,code] of cases){const r=await app.request('/api/v1/appointments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'validation-'+String(cases.indexOf(cases.find(x=>x[0]===payload))).padStart(3,'0')},body:JSON.stringify(payload)});assert.equal(r.status,status,JSON.stringify(payload));assert.equal((await r.json()).error.code,code);}
 const malformed=await app.request('/api/v1/appointments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'validation-json'},body:'{"customerId":'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.code,'INVALID_JSON');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
 assert.equal(db.pragma('foreign_key_check').length,0);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
test('T19 DST spring gap and fall fold are not double-booked for explicit UTC instants',()=>{
 const dir=mkdtempSync(join(tmpdir(),'keyloop-dst-')),db=openDb(join(dir,'db.sqlite'));migrate(db);seed(db);
 try{
 db.prepare("UPDATE dealerships SET time_zone='America/New_York' WHERE id='dlr_001'").run();
 const spring=DateTime.fromISO('2027-03-14T02:30',{zone:'America/New_York'});
 assert.notEqual(spring.toFormat('HH:mm'),'02:30','Luxon normalizes nonexistent local time');
 const fallA=DateTime.fromISO('2027-11-07T01:30:00-04:00',{setZone:true});
 const fallB=DateTime.fromISO('2027-11-07T01:30:00-05:00',{setZone:true});
 assert.notEqual(fallA.toMillis(),fallB.toMillis());
 assert.equal(fallA.setZone('America/New_York').toFormat('HH:mm'),fallB.setZone('America/New_York').toFormat('HH:mm'));
 assert.equal(fallA.setZone('America/New_York').getPossibleOffsets().length,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM appointments').get().n,0);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
