import {openDb} from './connection.js';import {migrate} from './migrate.js';import {fileURLToPath} from 'node:url';
export function seed(db){
 const exec=db.transaction(()=>{
 const insert=(t,cols,rows)=>{const sql='INSERT OR IGNORE INTO '+t+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')';const stmt=db.prepare(sql);rows.forEach(r=>stmt.run(...r));};
 insert('dealerships',['id','name','time_zone'],[['dlr_001','Central Auto Service','Asia/Ho_Chi_Minh'],['dlr_002','West Auto Service','Asia/Ho_Chi_Minh']]);
 insert('dealership_hours',['dealership_id','weekday','open_minute','close_minute'],['dlr_001','dlr_002'].flatMap(d=>[1,2,3,4,5,6].map(w=>[d,w,480,1080])));
 insert('customers',['id','display_name'],[['cus_001','Demo Customer A'],['cus_002','Demo Customer B']]);
 insert('vehicles',['id','customer_id','vin','make','model'],[['veh_001','cus_001','1HGCM82633A004352','Honda','Accord'],['veh_002','cus_002','1FAFP404X1F192345','Ford','Mustang']]);
 insert('service_types',['id','name','duration_minutes'],[['svc_oil','Oil Change',45],['svc_brake','Brake Inspection',90],['svc_diag','Diagnostics',60]]);
 insert('skills',['id','code'],[['skill_general','general'],['skill_brake','brake'],['skill_diag','diagnostics']]);
 insert('service_type_skills',['service_type_id','skill_id'],[['svc_oil','skill_general'],['svc_brake','skill_brake'],['svc_diag','skill_diag']]);
 insert('technicians',['id','dealership_id','name'],[['tech_001','dlr_001','Morgan'],['tech_002','dlr_001','Alex'],['tech_003','dlr_001','Taylor'],['tech_004','dlr_002','Jordan']]);
 insert('technician_skills',['technician_id','skill_id'],[['tech_001','skill_general'],['tech_001','skill_brake'],['tech_002','skill_general'],['tech_003','skill_diag'],['tech_004','skill_general']]);
 insert('technician_shifts',['technician_id','weekday','start_minute','end_minute'],['tech_001','tech_002','tech_003','tech_004'].flatMap(t=>[1,2,3,4,5,6].flatMap(w=>[[t,w,480,720],[t,w,780,1080]])));
 insert('service_bays',['id','dealership_id','name'],[['bay_001','dlr_001','Bay A'],['bay_002','dlr_001','Bay B'],['bay_003','dlr_001','Bay C'],['bay_004','dlr_002','Bay West']]);
 insert('bay_service_types',['bay_id','service_type_id'],[['bay_001','svc_oil'],['bay_001','svc_brake'],['bay_002','svc_oil'],['bay_003','svc_diag'],['bay_004','svc_oil']]);
 });exec();return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const db=openDb();migrate(db);seed(db);console.log('SEED=PASS');db.close();}
