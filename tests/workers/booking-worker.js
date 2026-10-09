import {openDb} from '../../src/db/connection.js';import {book} from '../../src/domain/booking.js';
const [dbPath,startAt,key]=process.argv.slice(2);
process.on('message',message=>{if(message!=='GO')return;const db=openDb(dbPath);try{const result=book(db,{customerId:'cus_001',vehicleId:'veh_001',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt},key);process.send({status:201,appointment:result.appointment});}catch(e){process.send({status:e.status||500,code:e.code||'ERROR'});}finally{db.close();process.disconnect();}});
process.send({ready:true});
