import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:3000';
const cases=[{name:'small-mobile',width:320,height:700,touch:true},{name:'android-mobile',width:360,height:800,touch:true},{name:'mobile',width:390,height:844,touch:true},{name:'large-mobile',width:430,height:932,touch:true},{name:'tablet',width:768,height:1024,touch:true},{name:'tablet-landscape',width:1024,height:768,touch:true},{name:'desktop',width:1280,height:800,touch:false},{name:'wide-desktop',width:1440,height:900,touch:false}];
const report=[];let failed=false;
const baseStats=(await (await browser.newContext().then(c=>c.request.get(base+'/api/v1/appointments/stats'))).json()).data;
for(const entry of cases){
 const context=await browser.newContext({viewport:{width:entry.width,height:entry.height},isMobile:entry.touch,hasTouch:entry.touch,deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out={...entry};
 try{
 await page.goto(base,{waitUntil:'networkidle'});
 const metrics=()=>page.evaluate(()=>({viewport:document.documentElement.clientWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,visibleWidth:innerWidth,scrollY:scrollY}));
 out.before=await metrics();
 out.horizontalOverflow=Math.max(out.before.docWidth,out.before.bodyWidth)-out.before.viewport;
 await page.getByRole('heading',{name:'Unified Service Scheduler'}).waitFor();
 const trigger=page.getByRole('button',{name:'Booking access & help'});
 if(entry.touch)await trigger.tap();else await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Booking access'});
 await dialog.waitFor();
 out.modal=await page.evaluate(()=>{
  const d=document.querySelector('[role="dialog"]'); const r=d.getBoundingClientRect();
  return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:document.documentElement.clientWidth,viewportHeight:innerHeight,inert:document.getElementById('app').inert,focusedInside:d.contains(document.activeElement),scrollHeight:d.scrollHeight,clientHeight:d.clientHeight};
 });
 const input=dialog.locator('input[type=password]');
 if(entry.touch)await input.tap();else await input.focus();
 await input.fill('invalid-ui11-token');
 const verify=dialog.getByRole('button',{name:'Verify token'});
 if(entry.touch)await verify.tap();else await verify.click();
 await dialog.getByText('That demo token is incorrect',{exact:false}).waitFor();
 out.invalidRejected=true;
 if(entry.touch)await dialog.getByRole('button',{name:'Close booking access'}).tap();else await dialog.getByRole('button',{name:'Close booking access'}).click();
 await dialog.waitFor({state:'detached',timeout:5000});
 out.afterClose=await metrics();
 out.backgroundRestored=await page.locator('#app').evaluate(e=>!e.inert);
 out.simulationButtons=await page.getByRole('button',{name:'Simulate 10 Concurrent Requests'}).isEnabled();
 out.errors=errors;
 out.pass=out.horizontalOverflow<=2&&out.modal.left>=-2&&out.modal.right<=out.modal.viewport+2&&out.modal.inert&&out.modal.focusedInside&&out.invalidRejected&&out.backgroundRestored&&out.simulationButtons&&!errors.length;
 if(!out.pass)failed=true;
 }catch(e){out.pass=false;out.error=e.message;out.errors=errors;failed=true}
 report.push(out);console.log(JSON.stringify({name:out.name,pass:out.pass,overflow:out.horizontalOverflow,modal:out.modal,error:out.error}));
 await context.close();
}
const endContext=await browser.newContext();const endStats=(await (await endContext.request.get(base+'/api/v1/appointments/stats')).json()).data;await endContext.close();
await browser.close();
const dataUnchanged=JSON.stringify(baseStats)===JSON.stringify(endStats);
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/ui11-responsive-touch.json',JSON.stringify({checkedAt:new Date().toISOString(),baseline:baseStats,end:endStats,dataUnchanged,cases:report},null,2)+'\n');
console.log('UI11_SUMMARY='+JSON.stringify({passed:report.filter(x=>x.pass).length,total:report.length,dataUnchanged}));
if(failed||!dataUnchanged)process.exitCode=1;
