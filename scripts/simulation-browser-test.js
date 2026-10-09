import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.SMOKE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Test Booking Conflict (2 requests)'}).click();
 await page.getByText('1 confirmed').waitFor({timeout:20000});
 await page.getByText('1 rejected').waitFor();
 const rows=page.locator('[aria-label="Scheduling conflict simulator"] tbody tr');
 if(await rows.count()!==2)throw Error('Expected two result rows');
 const report={url:page.url(),conflictRows:await rows.count(),confirmed:await rows.filter({hasText:'CONFIRMED'}).count(),rejected:await rows.filter({hasText:'REJECTED'}).count(),pageErrors:errors};
 mkdirSync('evidence',{recursive:true});await page.screenshot({path:'evidence/simulation-conflict.png',fullPage:true});
 writeFileSync('evidence/simulation-browser.json',JSON.stringify(report,null,2)+'\n');
 if(errors.length||report.confirmed!==1||report.rejected!==1)throw Error('Browser verification failed');
 console.log('SIMULATION_BROWSER=PASS',JSON.stringify(report));
}catch(e){console.error('SIMULATION_BROWSER=FAIL',e.message);process.exitCode=1;}
finally{await browser.close();}
