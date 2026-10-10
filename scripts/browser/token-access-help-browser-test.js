import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 const box=page.getByRole('region',{name:'Demo access'});
 await box.getByRole('heading',{name:'How to get a demo write token'}).waitFor();
 for(const s of ['Contact the project owner privately.','Verify token','No token?']){if(!(await box.innerText()).includes(s))throw Error('Missing guidance '+s);}
 const copy=box.getByRole('button',{name:'Copy access request'});
 if(await copy.evaluate(el=>getComputedStyle(el).cursor)!=='pointer')throw Error('Cursor not pointer');
 await copy.click();
 await box.getByText(/Request copied|Clipboard unavailable/).waitFor();
 if(errors.length)throw Error(errors.join(';'));
 console.log('TOKEN_ACCESS_HELP_BROWSER=PASS',JSON.stringify({steps:3,copyButton:true,errors}));
}catch(e){console.error('TOKEN_ACCESS_HELP_BROWSER=FAIL',e.message);process.exitCode=1}finally{await browser.close()}
