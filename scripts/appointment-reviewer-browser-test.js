import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 const sec=page.getByRole('region',{name:'Appointments'});
 await sec.getByRole('heading',{name:'Service appointments'}).waitFor();
 const all=await sec.locator('article').count();
 if(all<1)throw Error('No appointment cards');
 const txt=await sec.locator('article').first().innerText();
 for(const field of ['Assigned resources','Appointment time','technical evidence'])if(!txt.includes(field))throw Error('Missing '+field);
 await sec.getByLabel('Status').selectOption('cancelled');
 const cancelled=await sec.locator('article').count();
 if(cancelled<1||cancelled>=all)throw Error('Status filter count '+cancelled+'/'+all);
 for(const item of await sec.locator('article').all()){if(!(await item.innerText()).includes('Cancelled'))throw Error('Status filter mismatch');}
 await sec.getByLabel('Status').selectOption('all');
 await sec.getByLabel('Search details').fill('no-such-reviewer-match-unique');
 const none=await sec.locator('article').count();
 if(none!==0)throw Error('Search filter mismatch');
 if(errors.length)throw Error(errors.join(';'));
 console.log('APPOINTMENT_REVIEWER_UX_BROWSER=PASS',JSON.stringify({all,cancelled,searchNoMatches:none,pageErrors:errors}));
}catch(e){console.error('APPOINTMENT_REVIEWER_UX_BROWSER=FAIL',e.message);process.exitCode=1}finally{await browser.close()}
