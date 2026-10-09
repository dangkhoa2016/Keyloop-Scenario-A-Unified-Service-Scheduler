import {chromium} from 'playwright';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto(process.env.SMOKE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
 await page.getByText('Read-only preview · Booking access required').waitFor();
 const confirm=page.getByRole('button',{name:'Enter demo token to book'});
 if(!await confirm.isDisabled())throw Error('Confirm should be disabled without token');
 await page.getByPlaceholder('Enter token from project owner').fill('this-is-not-the-real-token');
 await page.getByRole('button',{name:'Verify token'}).click();
 await page.getByText('That demo token is incorrect or has expired.',{exact:false}).waitFor();
 const res={readOnlyMessage:true,createDisabledWithoutToken:true,invalidTokenExplained:true,pageErrors:errs};
 await page.screenshot({path:'evidence/demo-token-friendly-error.png',fullPage:true});
 writeFileSync('evidence/demo-token-ux.json',JSON.stringify(res,null,2)+'\n');
 if(errs.length)throw Error(JSON.stringify(errs));
 console.log('TOKEN_UX=PASS',JSON.stringify(res));
}catch(e){console.error('TOKEN_UX=FAIL',e.message);process.exitCode=1;}finally{await browser.close();}
