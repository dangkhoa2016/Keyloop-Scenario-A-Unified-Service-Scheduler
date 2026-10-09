import {DateTime} from 'luxon';import {createHash,randomUUID} from 'node:crypto';
export class AppError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const err=(status,code,msg)=>{throw new AppError(status,code,msg);};
const iso=ms=>new Date(ms).toISOString();
const overlap='start_at_ms < ? AND end_at_ms > ?';
export function resolveTime(db,dealershipId,serviceTypeId,startAt){
 const dealer=db.prepare('SELECT * FROM dealerships WHERE id=? AND active=1').get(dealershipId);
 const service=db.prepare('SELECT * FROM service_types WHERE id=? AND active=1').get(serviceTypeId);
 if(!dealer||!service)err(404,'NOT_FOUND','Dealership or service not found');
 const parsed=DateTime.fromISO(startAt,{setZone:true});if(!parsed.isValid||!/(?:Z|[+-]\d\d:\d\d)$/.test(startAt))err(400,'VALIDATION_ERROR','startAt must include a valid UTC offset');
 const local=parsed.setZone(dealer.time_zone);
 if(!local.isValid||parsed.offset!==local.offset)err(400,'VALIDATION_ERROR','Incorrect dealership timezone offset');
 const end=local.plus({minutes:service.duration_minutes});
 if(end.toISODate()!==local.toISODate())err(422,'OUTSIDE_HOURS','Appointment must end on same dealership day');
 if(local.toMillis()<=Date.now())err(422,'PAST_DATE','Appointment must begin in future');
 if(local.minute%30!==0||local.second!==0||local.millisecond!==0)err(400,'VALIDATION_ERROR','Start must align to 30-minute slots');
 const from=local.hour*60+local.minute,to=from+service.duration_minutes;
 const hours=db.prepare('SELECT * FROM dealership_hours WHERE dealership_id=? AND weekday=? AND open_minute<=? AND close_minute>=?').get(dealershipId,local.weekday,from,to);
 if(!hours)err(422,'OUTSIDE_HOURS','Service interval is outside dealership hours');
 return {dealer,service,start:parsed.toMillis(),end:end.toMillis(),weekday:local.weekday,from,to};
}
export function findPair(db,c){
 const technicians=db.prepare(`SELECT t.* FROM technicians t WHERE t.dealership_id=? AND t.active=1
 AND NOT EXISTS (SELECT 1 FROM service_type_skills req WHERE req.service_type_id=? AND NOT EXISTS (SELECT 1 FROM technician_skills ts WHERE ts.technician_id=t.id AND ts.skill_id=req.skill_id))
 AND EXISTS (SELECT 1 FROM technician_shifts sh WHERE sh.technician_id=t.id AND sh.weekday=? AND sh.start_minute<=? AND sh.end_minute>=?)
 AND NOT EXISTS (SELECT 1 FROM technician_blackouts b WHERE b.technician_id=t.id AND b.start_at_ms<? AND b.end_at_ms>?)
 AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.technician_id=t.id AND a.status='confirmed' AND a.start_at_ms<? AND a.end_at_ms>?)
 ORDER BY t.id`).all(c.dealer.id,c.service.id,c.weekday,c.from,c.to,c.end,c.start,c.end,c.start);
 const bays=db.prepare(`SELECT b.* FROM service_bays b JOIN bay_service_types bst ON bst.bay_id=b.id AND bst.service_type_id=?
 WHERE b.dealership_id=? AND b.active=1
 AND NOT EXISTS (SELECT 1 FROM bay_blackouts bb WHERE bb.bay_id=b.id AND bb.start_at_ms<? AND bb.end_at_ms>?)
 AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.service_bay_id=b.id AND a.status='confirmed' AND a.start_at_ms<? AND a.end_at_ms>?)
 ORDER BY b.id`).all(c.service.id,c.dealer.id,c.end,c.start,c.end,c.start);
 return technicians.length&&bays.length?{technician:technicians[0],bay:bays[0]}:null;
}
export function availability(db,{dealershipId,serviceTypeId,date}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))err(400,'VALIDATION_ERROR','date must be YYYY-MM-DD');
 const dealer=db.prepare('SELECT * FROM dealerships WHERE id=?').get(dealershipId);if(!dealer)err(404,'NOT_FOUND','Dealer not found');
 const day=DateTime.fromISO(date,{zone:dealer.time_zone});if(!day.isValid||day.toISODate()!==date)err(400,'VALIDATION_ERROR','Invalid date');
 if(day.diffNow('days').days>31||day.endOf('day').toMillis()<Date.now())err(400,'VALIDATION_ERROR','Date outside booking window');
 const slots=[];for(let minute=480;minute<1080;minute+=30){
 const local=day.plus({minutes:minute});if(local.toISODate()!==date)continue;
 try{const ctx=resolveTime(db,dealershipId,serviceTypeId,local.toISO());if(findPair(db,ctx))slots.push({startAt:iso(ctx.start),endAt:iso(ctx.end),localLabel:local.toFormat('HH:mm')});}
 catch(e){if(!(e instanceof AppError))throw e;}
 }return {dealershipId,serviceTypeId,date,timeZone:dealer.time_zone,slotStepMinutes:30,slots};
}
export function getAppointment(db,id){const a=db.prepare('SELECT * FROM appointments WHERE id=?').get(id);if(!a)err(404,'NOT_FOUND','Appointment not found');return serialize(a);}
function serialize(a){return {id:a.id,customerId:a.customer_id,vehicleId:a.vehicle_id,dealershipId:a.dealership_id,serviceTypeId:a.service_type_id,technicianId:a.technician_id,serviceBayId:a.service_bay_id,startAt:iso(a.start_at_ms),endAt:iso(a.end_at_ms),status:a.status};}
export function createBooking(db,body,key){
 if(typeof key!=='string'||key.length<8||key.length>128)err(400,'VALIDATION_ERROR','Idempotency-Key (8-128 chars) required');
 const fields=['customerId','vehicleId','dealershipId','serviceTypeId','startAt'];if(fields.some(f=>typeof body?.[f]!=='string'||!body[f]))err(400,'VALIDATION_ERROR','Missing booking fields');
 const payload=Object.fromEntries(fields.map(f=>[f,body[f]]));const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 const tx=db.transaction(()=>{
 const old=db.prepare('SELECT * FROM appointments WHERE idempotency_key=?').get(key);
 if(old){if(old.request_fingerprint!==fingerprint)err(409,'IDEMPOTENCY_KEY_REUSED','Key belongs to another request');return {replay:true,appointment:serialize(old)};}
 const vehicle=db.prepare('SELECT customer_id FROM vehicles WHERE id=?').get(body.vehicleId);
 if(!vehicle)err(404,'NOT_FOUND','Vehicle not found');
 if(vehicle.customer_id!==body.customerId)err(422,'VEHICLE_CUSTOMER_MISMATCH','Vehicle does not belong to customer');
 const ctx=resolveTime(db,body.dealershipId,body.serviceTypeId,body.startAt);
 const pair=findPair(db,ctx);if(!pair)err(409,'SLOT_UNAVAILABLE','No qualified technician and compatible bay for full duration');
 const id='apt_'+randomUUID();db.prepare(`INSERT INTO appointments(id,customer_id,vehicle_id,dealership_id,service_type_id,technician_id,service_bay_id,start_at_ms,end_at_ms,status,idempotency_key,request_fingerprint,created_at_ms)
 VALUES(?,?,?,?,?,?,?,?,?,'confirmed',?,?,?)`).run(id,body.customerId,body.vehicleId,body.dealershipId,body.serviceTypeId,pair.technician.id,pair.bay.id,ctx.start,ctx.end,key,fingerprint,Date.now());
 return {replay:false,appointment:getAppointment(db,id)};
 });return tx.immediate();
}
export function cancelBooking(db,id){const tx=db.transaction(()=>{const a=db.prepare('SELECT * FROM appointments WHERE id=?').get(id);if(!a)err(404,'NOT_FOUND','Appointment not found');if(a.status==='confirmed')db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(id);return getAppointment(db,id);});return tx.immediate();}
