import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 const area=page.locator('section[aria-label="Appointments"]');
 const items=area.locator('article');
 const status=area.getByLabel('Status');
 const dealer=area.getByLabel('Dealership');
 const search=area.getByLabel('Search details');
 const expect=async(n,name)=>{const got=await items.count();if(got!==n)throw Error(name+' expected '+n+' got '+got);console.log(name+'='+got)};
 await expect(50,'ALL');
 await status.selectOption('confirmed');await expect(37,'CONFIRMED');
 await status.selectOption('cancelled');await expect(13,'CANCELLED');
 await status.selectOption('all');await search.fill('Jack Thompson');await expect(1,'SEARCH_JACK');
 if(!await items.first().getByText('VinFast VF 8',{exact:false}).count())throw Error('Wrong Jack result');
 await search.fill('Noah Carter');await dealer.selectOption('dlr_004');await status.selectOption('confirmed');await expect(2,'EAST_NOAH_CONFIRMED');
 await status.selectOption('cancelled');await expect(2,'EAST_NOAH_CANCELLED');
 await search.fill('');await dealer.selectOption('all');await status.selectOption('all');await expect(50,'RESET_ALL');
 console.log('UI09_BROWSER=PASS');
}catch(e){console.error('UI09_BROWSER=FAIL',e.message);process.exitCode=1}
finally{await browser.close()}
