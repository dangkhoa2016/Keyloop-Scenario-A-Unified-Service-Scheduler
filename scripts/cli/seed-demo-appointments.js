import {DateTime} from 'luxon';
import {openDb} from '../../src/db/connection.js';
import {migrate} from '../../src/db/migrate.js';
import {seedRich} from '../../src/db/seed-rich.js';
import {book,cancel} from '../../src/domain/booking.js';
const db=openDb();migrate(db);seedRich(db);
const today=DateTime.now().setZone('Asia/Ho_Chi_Minh');
const scenarios=[
 ['dlr_003','svc_oil','cus_003','veh_003',1,9,0,false],
 ['dlr_003','svc_brake','cus_004','veh_004',1,10,30,false],
 ['dlr_004','svc_diag','cus_005','veh_005',2,9,0,false],
 ['dlr_004','svc_oil','cus_006','veh_006',2,13,30,false],
 ['dlr_005','svc_tire','cus_007','veh_007',3,9,0,false],
 ['dlr_005','svc_oil','cus_008','veh_008',3,11,0,true],
 ['dlr_006','svc_brake','cus_009','veh_009',4,14,0,false],
 ['dlr_006','svc_diag','cus_010','veh_010',4,10,0,true],
 ['dlr_003','svc_diag','cus_011','veh_011',5,13,30,false],
 ['dlr_004','svc_brake','cus_012','veh_012',5,15,0,false],
 ['dlr_001','svc_tire','cus_013','veh_013',1,13,30,false],
 ['dlr_002','svc_engine','cus_014','veh_014',2,13,30,false]
];
let created=0,replayed=0,cancelled=0,skipped=[];
for(const [dealer,service,customer,vehicle,offset,hour,minute,isCancelled] of scenarios){
 let date=today.plus({days:offset});
 while(date.weekday===7)date=date.plus({days:1});
 const startAt=date.set({hour,minute,second:0,millisecond:0}).toISO();
 const key='seed-demo-'+dealer+'-'+service+'-'+vehicle+'-'+date.toISODate();
 try{
 const r=book(db,{dealershipId:dealer,serviceTypeId:service,customerId:customer,vehicleId:vehicle,startAt},key);
 created+=Number(!r.replay);replayed+=Number(r.replay);
 if(isCancelled){if(r.appointment.status==='confirmed')cancel(db,r.appointment.id);cancelled++;}
 }catch(e){skipped.push({dealer,service,reason:e.code||e.message});}
}
const report={created,replayed,cancelled,skipped,appointments:db.prepare('SELECT count(*) n FROM appointments').get().n,confirmed:db.prepare("SELECT count(*) n FROM appointments WHERE status='confirmed'").get().n};
console.log(JSON.stringify(report,null,2));db.close();
if(skipped.length)process.exitCode=1;
