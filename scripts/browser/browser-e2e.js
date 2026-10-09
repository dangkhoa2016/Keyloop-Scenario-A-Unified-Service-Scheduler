import {chromium} from 'playwright';import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const report={checkedAt:new Date().toISOString()};
try{
 await page.goto('http://127.0.0.1:3000',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Unified Service Scheduler'}).waitFor();
 const slots=page.locator('button').filter({hasText:/^\d{2}:\d{2}$/});
 await slots.first().waitFor({timeout:20000});
 report.initialSlots=await slots.count();
 await slots.first().click();
 const createResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/appointments')&&r.request().method()==='POST',{timeout:15000});
 await page.getByRole('button',{name:'Confirm appointment'}).click();
 const response=await createResponse;const body=await response.json();
 report.createStatus=response.status();report.id=body.data?.id;
 if(report.createStatus!==201)throw Error('UI booking failed: '+JSON.stringify(body));
 await page.getByText('Booking confirmed:',{exact:false}).waitFor({timeout:10000});
 await page.screenshot({path:'evidence/browser-booked.png',fullPage:true});
 const row=page.locator('div.border-t').filter({hasText:report.id});
 await row.getByRole('button',{name:'Cancel'}).click();
 await row.getByText('cancelled',{exact:false}).waitFor({timeout:10000});
 report.cancelledVisible=true;report.jsErrors=errors;
 await page.screenshot({path:'evidence/browser-cancelled.png',fullPage:true});
 mkdirSync('evidence',{recursive:true});writeFileSync('evidence/browser-e2e.json',JSON.stringify(report,null,2)+'\n');
 if(errors.length)throw Error('JS errors: '+errors.join(';'));
 console.log(JSON.stringify(report,null,2));console.log('BROWSER_E2E=PASS');
}catch(e){console.error('BROWSER_E2E=FAIL',e.message);process.exitCode=1;}
finally{await browser.close();}
