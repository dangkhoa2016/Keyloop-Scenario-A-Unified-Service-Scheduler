import {chromium} from 'playwright';
const base=process.env.SMOKE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const before=await (await page.request.get(base+'/api/v1/appointments/stats')).json();
 await page.goto(base,{waitUntil:'networkidle'});
 const sim=page.getByRole('region',{name:'Scheduling conflict simulator'});
 const live=page.getByRole('region',{name:'Appointments'});
 await sim.getByRole('note',{name:'Sandbox simulation notice'}).getByText('Simulation only — no appointments added to the live database.').waitFor();
 await live.getByText(new RegExp(before.data.total+' appointments in the live database')).waitFor();
 await sim.getByRole('button',{name:'Simulate 10 Concurrent Requests'}).click();
 await sim.getByText('9 rejected').waitFor({timeout:40000});
 await sim.getByText('1 confirmed').waitFor();
 await sim.getByText('Sandbox result — not saved to Service appointments').waitFor();
 const rows=await sim.locator('tbody tr').count();
 const after=await (await page.request.get(base+'/api/v1/appointments/stats')).json();
 if(rows!==10||JSON.stringify(before.data)!==JSON.stringify(after.data))throw Error('Sandbox isolation failed: '+JSON.stringify({rows,before,after}));
 if(errors.length)throw Error('Browser errors: '+errors.join(';'));
 console.log('CONCURRENT_SIMULATION_LIVE_ISOLATION=PASS '+JSON.stringify({rows,before:before.data,after:after.data,pageErrors:errors}));
}catch(e){console.error('CONCURRENT_SIMULATION_LIVE_ISOLATION=FAIL',e.message);process.exitCode=1;}
finally{await browser.close()}
