import {chromium} from 'playwright';
import {openDb} from '../src/db/connection.js';import {migrate} from '../src/db/migrate.js';import {seed} from '../src/db/seed.js';
import {createApp} from '../src/app.js';import {book} from '../src/domain/booking.js';import {serve} from '@hono/node-server';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'keyloop-stale-slot-')),db=openDb(join(dir,'isolated.sqlite'));migrate(db);seed(db);
const server=serve({fetch:createApp(db).fetch,port:31329,hostname:'127.0.0.1'});
const browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:31329',{waitUntil:'networkidle'});
 await page.locator('select').nth(3).selectOption('svc_brake');
 const slots=page.locator('button').filter({hasText:/^09:00$/});
 await slots.waitFor();
 await slots.click();
 const startAt=(await (await fetch('http://127.0.0.1:31329/api/v1/availability?dealershipId=dlr_001&serviceTypeId=svc_brake&date='+await page.locator('input[type=date]').inputValue())).json()).data.slots.find(x=>x.localLabel==='09:00').startAt;
 book(db,{customerId:'cus_002',vehicleId:'veh_002',dealershipId:'dlr_001',serviceTypeId:'svc_brake',startAt},'other-customer-stale');
 const before=db.prepare('SELECT COUNT(*) n FROM appointments').get().n;
 await page.getByRole('button',{name:'Confirm appointment'}).click();
 await page.getByText('No appointment was created from this request. That time is no longer available because another booking may have taken the slot or eligible resources are busy. Please choose a different available time.').waitFor();
 const remaining=await page.locator('button').filter({hasText:/^09:00$/}).count();
 const after=db.prepare('SELECT COUNT(*) n FROM appointments').get().n;
 if(remaining!==0||before!==after||errors.length)throw Error(JSON.stringify({remaining,before,after,errors}));
 console.log('STALE_SLOT_BROWSER=PASS',JSON.stringify({before,after,slotRemoved:true,pageErrors:errors}));
}catch(e){console.error('STALE_SLOT_BROWSER=FAIL',e.message);process.exitCode=1}finally{await browser.close();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true})}
