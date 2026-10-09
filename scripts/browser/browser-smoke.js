import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.SMOKE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const errors=[];const failed=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
let report={url:base,checkedAt:new Date().toISOString()};
try{
 const response=await page.goto(base,{waitUntil:'networkidle',timeout:45000});
 await page.getByRole('heading',{name:'Unified Service Scheduler'}).waitFor({timeout:30000});
 await page.locator('select').first().waitFor({timeout:20000});
 const count=await page.locator('select').count();
 const slots=await page.locator('button').filter({hasText:/^\d{2}:\d{2}$/}).count();
 const title=await page.title();
 const appText=await page.locator('#app').innerText();
 report={...report,http:response?.status(),title,selects:count,slots,pageErrors:errors,failedRequests:failed,vueMounted:appText.includes('1. Choose your service'),tailwindApplied:await page.evaluate(()=>getComputedStyle(document.querySelector('body')).backgroundColor)};
 mkdirSync('evidence',{recursive:true});
 await page.screenshot({path:'evidence/browser-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'evidence/browser-mobile.png',fullPage:true});
 report.mobileViewport=390;
 writeFileSync('evidence/browser-smoke.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(response?.status()!==200||!report.vueMounted||count<4||slots<1||errors.length||failed.length)process.exitCode=1;
 else console.log('BROWSER_SMOKE=PASS');
}catch(e){console.error('BROWSER_SMOKE=FAIL',e.message);process.exitCode=1;}
finally{await browser.close();}
