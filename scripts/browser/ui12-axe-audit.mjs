import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const axe=readFileSync(requireResolveAxe(),'utf8');
function requireResolveAxe(){return new URL('../../node_modules/axe-core/axe.min.js',import.meta.url)}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out={checkedAt:new Date().toISOString(),cases:[]};
for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 for(const stage of ['main','modal']){
  if(stage==='modal')await page.getByRole('button',{name:'Booking access & help'}).click();
  await page.evaluate(axe);
  const x=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}}));
  const violations=x.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html.slice(0,260)}))}));
  const row={width,stage,violations,passes:x.passes.length,incomplete:x.incomplete.length};
  out.cases.push(row);
  console.log('AXE '+width+' '+stage+' violations='+violations.length+' '+violations.map(x=>x.id+'('+x.nodes.length+')').join(','));
  for(const v of violations)console.log('  '+v.id+' '+v.nodes.slice(0,4).map(x=>JSON.stringify(x.target)+' '+x.summary?.slice(0,130)).join(' | '));
  if(stage==='modal')await page.getByRole('button',{name:'Close booking access'}).click();
 }
 await page.close();
}
await browser.close();mkdirSync('evidence',{recursive:true});writeFileSync('evidence/ui12-axe-audit.json',JSON.stringify(out,null,2)+'\n');
