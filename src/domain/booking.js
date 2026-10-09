import {DateTime} from 'luxon';
import {randomUUID,createHash} from 'node:crypto';
export class DomainError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export const fail=(status,code,msg)=>{throw new DomainError(status,code,msg)};
export const iso=ms=>new Date(ms).toISOString();
export function context(db,dealerId,serviceId,startAt){
 const dealer=db.prepare('SELECT * FROM dealerships WHERE id=? AND active=1').get(dealerId);
 const service=db.prepare('SELECT * FROM service_types WHERE id=? AND active=1').get(serviceId);
 if(!dealer||!service)fail(404,'NOT_FOUND','Dealer/service missing');
 const p=DateTime.fromISO(startAt,{setZone:true});
 if(!p.isValid||!/(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(startAt))fail(400,'INVALID_TIME','Explicit offset required');
 const local=p.setZone(dealer.time_zone);
 if(local.toMillis()<=Date.now())fail(422,'PAST_TIME','Future date required');
 if(local.minute%30||local.second||local.millisecond)fail(400,'INVALID_SLOT','Slot step is 30 minutes');
 const end=local.plus({minutes:service.duration_minutes});
 if(end.toISODate()!==local.toISODate())fail(422,'CLOSED','Crosses closing day');
 const from=local.hour*60+local.minute,to=from+service.duration_minutes;
 if(!db.prepare('SELECT 1 FROM dealership_hours WHERE dealership_id=? AND weekday=? AND open_minute<=? AND close_minute>=?').get(dealerId,local.weekday,from,to))fail(422,'CLOSED','Outside hours');
 return {dealer,service,start:p.toMillis(),end:end.toMillis(),weekday:local.weekday,from,to};
}
export function eligible(db,c){
 const tech=db.prepare(`SELECT t.id FROM technicians t WHERE t.dealership_id=? AND t.active=1
 AND NOT EXISTS(SELECT 1 FROM service_type_skills r WHERE r.service_type_id=? AND NOT EXISTS(SELECT 1 FROM technician_skills q WHERE q.technician_id=t.id AND q.skill_id=r.skill_id))
 AND EXISTS(SELECT 1 FROM technician_shifts s WHERE s.technician_id=t.id AND s.weekday=? AND s.start_minute<=? AND s.end_minute>=?)
 AND NOT EXISTS(SELECT 1 FROM technician_blackouts b WHERE b.technician_id=t.id AND b.start_at_ms<? AND b.end_at_ms>?)
 AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.status='confirmed' AND a.technician_id=t.id AND a.start_at_ms<? AND a.end_at_ms>?) ORDER BY t.id LIMIT 1`).get(c.dealer.id,c.service.id,c.weekday,c.from,c.to,c.end,c.start,c.end,c.start);
 const bay=db.prepare(`SELECT b.id FROM service_bays b JOIN bay_service_types x ON x.bay_id=b.id AND x.service_type_id=? WHERE b.dealership_id=? AND b.active=1
 AND NOT EXISTS(SELECT 1 FROM bay_blackouts x WHERE x.bay_id=b.id AND x.start_at_ms<? AND x.end_at_ms>?)
 AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.status='confirmed' AND a.service_bay_id=b.id AND a.start_at_ms<? AND a.end_at_ms>?) ORDER BY b.id LIMIT 1`).get(c.service.id,c.dealer.id,c.end,c.start,c.end,c.start);
 return tech&&bay?{tech:tech.id,bay:bay.id}:null;
}
export const serialize=a=>({id:a.id,customerId:a.customer_id,vehicleId:a.vehicle_id,dealershipId:a.dealership_id,serviceTypeId:a.service_type_id,technicianId:a.technician_id,serviceBayId:a.service_bay_id,startAt:iso(a.start_at_ms),endAt:iso(a.end_at_ms),status:a.status});
export function getAppointment(db,id){const a=db.prepare('SELECT * FROM appointments WHERE id=?').get(id);if(!a)fail(404,'NOT_FOUND','Appointment not found');return serialize(a);}
export function available(db,q){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(q.date||''))fail(400,'INVALID_DATE','Date format must be YYYY-MM-DD');
 const d=db.prepare('SELECT time_zone FROM dealerships WHERE id=? AND active=1').get(q.dealershipId);if(!d)fail(404,'NOT_FOUND','Dealership missing');if(!db.prepare('SELECT 1 FROM service_types WHERE id=? AND active=1').get(q.serviceTypeId))fail(404,'NOT_FOUND','Service missing');
 const day=DateTime.fromISO(q.date,{zone:d.time_zone});
 if(!day.isValid||day.toISODate()!==q.date||day.diffNow('days').days>31||day.endOf('day').toMillis()<Date.now())fail(400,'INVALID_DATE','Outside booking window');
 const slots=[];for(let m=480;m<1080;m+=30){const local=day.plus({minutes:m});try{const c=context(db,q.dealershipId,q.serviceTypeId,local.toISO());if(eligible(db,c))slots.push({startAt:iso(c.start),endAt:iso(c.end),localLabel:local.toFormat('HH:mm')});}catch(e){if(!(e instanceof DomainError))throw e;}}
 return {dealershipId:q.dealershipId,serviceTypeId:q.serviceTypeId,date:q.date,timeZone:d.time_zone,slotStepMinutes:30,slots};
}
export function book(db,p,key){
 if(typeof key!=='string'||key.length<8||key.length>128)fail(400,'INVALID_KEY','Idempotency-Key (8-128 chars) required');
 const fields=['customerId','vehicleId','dealershipId','serviceTypeId','startAt'];
 if(fields.some(f=>typeof p?.[f]!=='string'||!p[f]))fail(400,'INVALID_INPUT','Missing booking field');
 const fingerprint=createHash('sha256').update(JSON.stringify(fields.map(f=>p[f]))).digest('hex');
 const tx=db.transaction(()=>{
 const old=db.prepare('SELECT * FROM appointments WHERE idempotency_key=?').get(key);
 if(old){if(old.request_fingerprint!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','Key used with another payload');return {replay:true,appointment:serialize(old)};}
 const vehicle=db.prepare('SELECT customer_id FROM vehicles WHERE id=?').get(p.vehicleId);if(!vehicle)fail(404,'NOT_FOUND','Vehicle missing');
 if(vehicle.customer_id!==p.customerId)fail(422,'OWNER_MISMATCH','Wrong vehicle owner');
 const c=context(db,p.dealershipId,p.serviceTypeId,p.startAt),pair=eligible(db,c);
 if(!pair)fail(409,'SLOT_UNAVAILABLE','No eligible technician and bay');
 const id='apt_'+randomUUID();
 db.prepare("INSERT INTO appointments(id,customer_id,vehicle_id,dealership_id,service_type_id,technician_id,service_bay_id,start_at_ms,end_at_ms,status,idempotency_key,request_fingerprint,created_at_ms) VALUES(?,?,?,?,?,?,?,?,?,'confirmed',?,?,?)").run(id,p.customerId,p.vehicleId,p.dealershipId,p.serviceTypeId,pair.tech,pair.bay,c.start,c.end,key,fingerprint,Date.now());
 return {replay:false,appointment:getAppointment(db,id)};
 });return tx.immediate();
}
export function cancel(db,id){return db.transaction(()=>{getAppointment(db,id);db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(id);return getAppointment(db,id);}).immediate();}
