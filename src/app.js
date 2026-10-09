import {Hono} from 'hono';
import {runSimulation} from './domain/simulation.js';
import {randomUUID} from 'node:crypto';
import {serveStatic} from '@hono/node-server/serve-static';
import {DomainError,available,book,getAppointment,cancel} from './domain/booking.js';
import {fileURLToPath} from 'node:url';
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
function presentAppointment(db,a){
 const extra=db.prepare(`SELECT c.display_name AS customerName,v.make||' '||v.model AS vehicleName,d.name AS dealershipName,d.time_zone AS timeZone,s.name AS serviceName,s.duration_minutes AS durationMinutes,t.name AS technicianName,b.name AS bayName FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN vehicles v ON v.id=a.vehicle_id JOIN dealerships d ON d.id=a.dealership_id JOIN service_types s ON s.id=a.service_type_id JOIN technicians t ON t.id=a.technician_id JOIN service_bays b ON b.id=a.service_bay_id WHERE a.id=?`).get(a.id);
 return {...a,details:extra,explanation:'A qualified technician and a compatible service bay were available for the full service duration when the booking was committed.'};
}
export function createApp(db){
 const app=new Hono();
 let simulationBusy=false;const simulationCalls=new Map();
 app.use('*',async(c,next)=>{const id=randomUUID(),start=performance.now();c.set('requestId',id);await next();c.header('X-Request-ID',id);console.log(JSON.stringify({requestId:id,path:c.req.path,method:c.req.method,status:c.res.status,durationMs:Math.round(performance.now()-start)}));});
 app.onError((e,c)=>{const code=e instanceof DomainError?e.code:e.code==='SQLITE_BUSY'?'DATABASE_BUSY':'INTERNAL_ERROR',status=e instanceof DomainError?e.status:e.code==='SQLITE_BUSY'?503:500;if(status===500)console.error(e);return c.json({error:{code,message:status===500?'Internal error':e.message,requestId:c.get('requestId')}},status);});
 app.get('/healthz',c=>c.json({status:'ok'}));
 app.get('/api/v1/demo-access',c=>c.json({data:{writeProtected:!!process.env.DEMO_WRITE_TOKEN||process.env.PUBLIC_DEMO==='1',readOnlyWithoutToken:true,tokenRequired:!!process.env.DEMO_WRITE_TOKEN,help:'Browse freely. To create or cancel bookings on this public demo, request the private write token from the demo owner.'}}));
 app.get('/readyz',c=>{const v=db.pragma('integrity_check',{simple:true});return c.json({status:v==='ok'?'ready':'unhealthy',database:v},v==='ok'?200:503);});
 app.post('/api/v1/demo/simulate',async c=>{const ip=(c.req.header('cf-connecting-ip')||'anonymous').slice(0,128);const now=Date.now();if(simulationBusy)throw new DomainError(429,'SIMULATION_BUSY','Another simulation is running. Try again shortly.');if(now-(simulationCalls.get(ip)||0)<20000)throw new DomainError(429,'SIMULATION_COOLDOWN','Please wait 20 seconds before the next simulation.');const data=await c.req.json().catch(()=>({}));if(!['conflict','concurrent'].includes(data.mode))throw new DomainError(400,'INVALID_SIMULATION','Choose conflict or concurrent.');simulationBusy=true;simulationCalls.set(ip,now);for(const [k,t] of simulationCalls)if(now-t>60000)simulationCalls.delete(k);try{return c.json({data:await runSimulation(data.mode)});}finally{simulationBusy=false;}});
 app.get('/api/v1/dealerships',c=>c.json({data:db.prepare('SELECT * FROM dealerships ORDER BY id').all()}));
 app.get('/api/v1/customers',c=>c.json({data:db.prepare('SELECT * FROM customers ORDER BY id').all()}));
 app.get('/api/v1/customers/:id/vehicles',c=>c.json({data:db.prepare('SELECT * FROM vehicles WHERE customer_id=?').all(c.req.param('id'))}));
 app.get('/api/v1/dealerships/:id/service-types',c=>c.json({data:db.prepare('SELECT * FROM service_types WHERE active=1 ORDER BY id').all()}));
 app.get('/api/v1/availability',c=>c.json({data:available(db,c.req.query())}));
 app.get('/api/v1/appointments',c=>c.json({data:db.prepare('SELECT id FROM appointments ORDER BY created_at_ms DESC LIMIT 100').all().map(x=>presentAppointment(db,getAppointment(db,x.id)))}));
 app.get('/api/v1/appointments/:id',c=>c.json({data:presentAppointment(db,getAppointment(db,c.req.param('id')))}));
 const guard=async(c,next)=>{if((process.env.PUBLIC_DEMO==='1'||process.env.HOST==='0.0.0.0')&&!process.env.DEMO_WRITE_TOKEN)throw new DomainError(403,'PUBLIC_WRITE_DISABLED','Demo booking is temporarily disabled. Please contact the demo owner.');if(process.env.DEMO_WRITE_TOKEN){const supplied=c.req.header('X-Demo-Write-Token');if(!supplied)throw new DomainError(403,'DEMO_TOKEN_REQUIRED','Booking is protected. Enter the demo write token provided by the owner.');if(supplied!==process.env.DEMO_WRITE_TOKEN)throw new DomainError(403,'DEMO_TOKEN_INVALID','That token is not valid. Check the token or request a new one from the demo owner.');}await next();};
 app.post('/api/v1/demo-access/verify',guard,c=>c.json({data:{authorized:true}}));
 app.post('/api/v1/appointments',guard,async c=>{const p=await c.req.json().catch(()=>{throw new DomainError(400,'INVALID_JSON','Malformed JSON request')});const result=book(db,p,c.req.header('Idempotency-Key'));return c.json({data:presentAppointment(db,result.appointment),replay:result.replay},result.replay?200:201);});
 app.post('/api/v1/appointments/:id/cancel',guard,c=>c.json({data:presentAppointment(db,cancel(db,c.req.param('id')))}));
 app.use('/js/*',serveStatic({root:publicDir}));
 app.get('/reviewer-guide',serveStatic({path:publicDir+'reviewer-guide.html'}));
 app.get('/',serveStatic({path:publicDir+'index.html'}));
 return app;
}
