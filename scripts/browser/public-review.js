import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.SMOKE_URL;
if(!base?.startsWith('https://'))throw Error('SMOKE_URL must be an HTTPS URL');
const browser=await chromium.launch({args:['--no-sandbox'],headless:true});
const results=[];const errors=[];
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const page=await browser.newPage({viewport});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle',timeout:40000});
 await page.locator('select').first().waitFor();
 await page.keyboard.press('Tab');
 const check=await page.evaluate(()=>({
  viewportWidth:innerWidth,
  documentWidth:document.documentElement.scrollWidth,
  title:document.title,
  focusedTag:document.activeElement?.tagName,
  hasMain:!!document.querySelector('main'),
  hasHeading:!!document.querySelector('h1'),
  statusMessageRole:!!document.querySelector('[role="status"]'),
  htmlLang:document.documentElement.lang
 }));
 const slots=await page.locator('button').filter({hasText:/^\d\d:\d\d$/}).count();
 const name=viewport.width===390?'public-mobile':'public-desktop';
 await page.screenshot({path:'evidence/'+name+'.png',fullPage:true});
 results.push({...check,slots,pass:check.documentWidth<=check.viewportWidth && check.hasMain && check.hasHeading && slots>0});
 await page.close();
}
await browser.close();
mkdirSync('evidence',{recursive:true});
writeFileSync('evidence/public-review.json',JSON.stringify({url:base,checkedAt:new Date().toISOString(),results,errors},null,2));
console.log(JSON.stringify({results,errors},null,2));
if(results.every(x=>x.pass)&&errors.length===0)console.log('PUBLIC_REVIEW=PASS');
else process.exitCode=1;
