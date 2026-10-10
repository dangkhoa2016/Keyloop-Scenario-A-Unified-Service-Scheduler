import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const results = [];
const check = (condition, label) => {
  results.push({label, pass: Boolean(condition)});
  if(!condition) throw new Error(label);
};
const describeFocus = page => page.evaluate(() => {
  const el=document.activeElement;
  return {tag:el?.tagName, label:el?.getAttribute('aria-label'), text:el?.textContent?.trim()?.slice(0,70) || '', inside:!!el?.closest('[role="dialog"]')};
});
const html = x => JSON.stringify(x);
const errors=[];
try {
 const page = await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 const baselineResponse = await page.request.get('http://127.0.0.1:3000/api/v1/appointments/stats');
 const baseline = (await baselineResponse.json()).data;
 const trigger = page.getByRole('button',{name:'Booking access & help'});
 const dlg = page.getByRole('dialog',{name:'Booking access'});
 await page.evaluate(()=>window.scrollTo(0,Math.min(760,document.documentElement.scrollHeight-innerHeight)));
 await trigger.focus();
 const originalY=await page.evaluate(()=>window.scrollY);
 await page.keyboard.press('Enter');
 await dlg.waitFor();
 check(await dlg.getAttribute('aria-modal')==='true','Dialog has aria-modal=true');
 check(await dlg.getAttribute('aria-label')==='Booking access','Dialog has accessible name');
 check((await describeFocus(page)).label==='Close booking access','Opening dialog moves focus to Close');
 check(await page.locator('#app').evaluate(e=>e.inert),'Background app inert while modal open');
 check(await page.evaluate(()=>document.body.style.position==='fixed'),'Modal locks body scroll');
 const controls=await dlg.locator('button:not([disabled]),a[href],input:not([disabled]),summary').evaluateAll(xs=>xs.filter(e=>e.getClientRects().length).map(e=>e.outerHTML.slice(0,100)));
 check(controls.length>=4,'Dialog has keyboard controls');
 for(let i=0;i<controls.length+3;i++){
   await page.keyboard.press('Tab');
   const item=await describeFocus(page);
   check(item.inside,'Tab stays in dialog step '+i);
 }
 await dlg.getByRole('button',{name:'Close booking access'}).focus();
 await page.keyboard.press('Shift+Tab');
 check((await describeFocus(page)).inside,'Shift+Tab wrap stays within dialog');
 await page.keyboard.press('Escape');
 check(await dlg.count()===0,'Escape closes dialog');
 check((await describeFocus(page)).text.includes('Booking access & help'),'Escape returns focus to trigger');
 check(await page.locator('#app').evaluate(e=>!e.inert),'Closing modal restores background interactivity');
 check(await page.evaluate(()=>document.body.style.position!=='fixed'),'Closing modal restores body CSS');
 check(Math.abs((await page.evaluate(()=>window.scrollY))-originalY)<5,'Closing modal restores scroll position');
 await trigger.click();
 await dlg.waitFor();
 await dlg.getByRole('button',{name:'Close booking access'}).click();
 check(await dlg.count()===0,'Close button dismisses dialog');
 check((await describeFocus(page)).text.includes('Booking access & help'),'Close button returns trigger focus');
 await trigger.click();
 await dlg.waitFor();
 await page.mouse.click(3,3);
 check(await dlg.count()===0,'Backdrop dismisses dialog');
 check((await describeFocus(page)).text.includes('Booking access & help'),'Backdrop restores focus');
 await trigger.click();
 await dlg.waitFor();
 await dlg.getByText('For project owners — How to provide demo access').click();
 await dlg.locator('input[type=password]').focus();
 await page.keyboard.press('Escape');
 check(await dlg.count()===0,'Escape works from password field after expanding owner instructions');
 await page.reload({waitUntil:'networkidle'});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Booking access & help'}).click();
 await dlg.waitFor();
 check((await describeFocus(page)).label==='Close booking access','Mobile width opening focus');
 check(await page.locator('#app').evaluate(e=>e.inert),'Mobile width background inert');
 await page.keyboard.press('Escape');
 check(await dlg.count()===0,'Mobile width Escape closes');
 check(errors.length===0,'No JavaScript page errors');
 const end=(await (await page.request.get('http://127.0.0.1:3000/api/v1/appointments/stats')).json()).data;
 check(JSON.stringify(baseline)===JSON.stringify(end),'Live appointment counts unchanged');
 mkdirSync('evidence',{recursive:true});
 writeFileSync('evidence/ui10-keyboard-acceptance.json',JSON.stringify({checkedAt:new Date().toISOString(),baseline,end,controls:controls.length,results,errors},null,2)+'\n');
 console.log('UI10_BROWSER=PASS checks='+results.length+' baseline='+html(baseline));
} catch(e) {
 console.error('UI10_BROWSER=FAIL:',e.message);
 console.error('COMPLETED_CHECKS='+html(results));
 process.exitCode=1;
} finally{await browser.close();}
