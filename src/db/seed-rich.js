import {demoCustomers} from './demo-customers.js';
import {openDb} from './connection.js';
import {migrate} from './migrate.js';
import {seed} from './seed.js';
import {fileURLToPath} from 'node:url';
export function seedRich(db){
 seed(db);
 db.transaction(()=>{
 const put=(t,cols,rows)=>{const sql='INSERT OR IGNORE INTO '+t+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')';const s=db.prepare(sql);rows.forEach(r=>s.run(...r));};
 const dealers=[['dlr_003','North Service Hub','Asia/Ho_Chi_Minh'],['dlr_004','East Motor Center','Asia/Ho_Chi_Minh'],['dlr_005','South Auto Care','Asia/Ho_Chi_Minh'],['dlr_006','Airport Automotive','Asia/Ho_Chi_Minh']];
 put('dealerships',['id','name','time_zone'],dealers);
 put('dealership_hours',['dealership_id','weekday','open_minute','close_minute'],dealers.flatMap(([id])=>[1,2,3,4,5,6].map(w=>[id,w,480,1080])));
 const customers=demoCustomers.slice(2).map(([id,old,name])=>[id,name]);
 put('customers',['id','display_name'],customers);
 const models=[['Toyota','Camry'],['Mazda','CX-5'],['Hyundai','Tucson'],['Kia','Sportage'],['Ford','Ranger'],['Honda','Civic'],['VinFast','VF 8'],['Toyota','Corolla'],['Mitsubishi','Xpander']];
 const vehicles=customers.flatMap(([cid],i)=>{const [make,model]=models[i%models.length];return [['veh_'+String(i+3).padStart(3,'0'),cid,'DEMO'+String(i+1).padStart(13,'0'),make,model]]});
 put('vehicles',['id','customer_id','vin','make','model'],vehicles);
 put('service_types',['id','name','duration_minutes'],[['svc_tire','Tire Rotation',60],['svc_battery','Battery Service',45],['svc_ac','Air Conditioning',90],['svc_alignment','Wheel Alignment',90],['svc_engine','Engine Diagnostics',120],['svc_transmission','Transmission Service',150],['svc_wash','Detailing',60]]);
 put('skills',['id','code'],[['skill_tire','tire'],['skill_electric','electrical'],['skill_ac','air-conditioning'],['skill_alignment','alignment'],['skill_engine','engine'],['skill_transmission','transmission'],['skill_detail','detailing']]);
 put('service_type_skills',['service_type_id','skill_id'],[['svc_tire','skill_tire'],['svc_battery','skill_electric'],['svc_ac','skill_ac'],['svc_alignment','skill_alignment'],['svc_engine','skill_engine'],['svc_transmission','skill_transmission'],['svc_wash','skill_detail']]);
 const techs=Array.from({length:24},(_,i)=>['tech_'+String(i+5).padStart(3,'0'),'dlr_'+String(Math.floor(i/6)+3).padStart(3,'0'),['Avery','River','Sam','Jamie','Riley','Casey'][i%6]+' '+(i+1)]);
 put('technicians',['id','dealership_id','name'],techs);
 put('technician_skills',['technician_id','skill_id'],techs.flatMap(([id],_,)=>{const n=Number(id.slice(5))%6;return [[id,['skill_general','skill_brake','skill_diag','skill_tire','skill_electric','skill_ac'][n]],[id,'skill_general']]}));
 put('technician_shifts',['technician_id','weekday','start_minute','end_minute'],techs.flatMap(([id])=>[1,2,3,4,5,6].flatMap(w=>[[id,w,480,720],[id,w,780,1080]])));
 const bays=Array.from({length:24},(_,i)=>['bay_'+String(i+5).padStart(3,'0'),'dlr_'+String(Math.floor(i/6)+3).padStart(3,'0'),'Service Bay '+(i%6+1)]);
 put('service_bays',['id','dealership_id','name'],bays);
 put('bay_service_types',['bay_id','service_type_id'],bays.flatMap(([id],i)=>[[id,'svc_oil'],[id,'svc_brake'],[id,'svc_diag'],[id,['svc_tire','svc_battery','svc_ac','svc_alignment','svc_engine','svc_transmission','svc_wash'][i%7]]]));
 // New service capabilities for existing dealerships are supported by additional resources, without modifying the baseline pair used by concurrency tests.
 const extraTech=[['tech_029','dlr_001','Cameron'],['tech_030','dlr_001','Quinn'],['tech_031','dlr_002','Robin'],['tech_032','dlr_002','Drew']];
 put('technicians',['id','dealership_id','name'],extraTech);
 put('technician_skills',['technician_id','skill_id'],[['tech_029','skill_tire'],['tech_029','skill_electric'],['tech_030','skill_ac'],['tech_030','skill_alignment'],['tech_031','skill_engine'],['tech_031','skill_transmission'],['tech_032','skill_detail']]);
 put('technician_shifts',['technician_id','weekday','start_minute','end_minute'],extraTech.flatMap(([id])=>[1,2,3,4,5,6].flatMap(w=>[[id,w,480,720],[id,w,780,1080]])));
 const extraBays=[['bay_029','dlr_001','Express Bay'],['bay_030','dlr_001','Climate & Alignment'],['bay_031','dlr_002','Powertrain Bay'],['bay_032','dlr_002','Detail Bay']];
 put('service_bays',['id','dealership_id','name'],extraBays);
 put('bay_service_types',['bay_id','service_type_id'],[['bay_029','svc_tire'],['bay_029','svc_battery'],['bay_030','svc_ac'],['bay_030','svc_alignment'],['bay_031','svc_engine'],['bay_031','svc_transmission'],['bay_032','svc_wash']]);
 }).immediate();
 return Object.fromEntries(['dealerships','customers','vehicles','technicians','service_bays','service_types','skills','appointments'].map(t=>[t,db.prepare('SELECT COUNT(*) n FROM '+t).get().n]));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const db=openDb();migrate(db);console.log('RICH_SEED=PASS',JSON.stringify(seedRich(db)));db.close();}
