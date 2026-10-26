// Real Chromium, controlled website/API/player fixtures; no live-site playback claim.
const { chromium: playwright }=require('playwright-core');
const chromiumModule=require('@sparticuz/chromium');
const chromium=chromiumModule.default;
const fs=require('node:fs');
const assert=require('node:assert/strict');
const host=process.env.VA_SITE||'veziaici.net';
assert.ok(['veziaici.net','clicksud.xin'].includes(host));
const script=fs.readFileSync(__dirname+'/veziaici-install.user.js','utf8');
(async()=>{
 await chromiumModule.inflate(require.resolve('@sparticuz/chromium').replace(/build\/.*$/, 'bin/al2023.tar.br'));
 const browser=await playwright.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib:'+ (process.env.LD_LIBRARY_PATH||'')},executablePath:await chromium.executablePath(),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const logs=[];context.on('page',p=>p.on('pageerror',e=>logs.push(e.message)));
 const original=`https://${host}/opaque-current/`;
 const next=`https://${host}/opaque-next/`;
 const batches={1:[{title:'Las Fierbinti Sezonul 29 Episodul 31',url:`https://${host}/other/`}],2:[{title:'Las Fierbinti Sezonul 22 Episodul 3',url:`https://${host}/older/`}],3:[{title:'Las Fierbinti Sezonul 30 Episodul 12',url:next}],4:[]};
 const apiCalls=[];
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/wp-json/wp/v2/search'){const page=+u.searchParams.get('page');apiCalls.push(page);return route.fulfill({contentType:'application/json',body:JSON.stringify(batches[page]||[])});}
  if(u.hostname==='vidmoly.org')return route.fulfill({contentType:'text/html',body:`<!doctype html><video id="media"></video><script>const v=document.querySelector('video');v._time=10;v._ended=false;Object.defineProperties(v,{currentTime:{get:()=>v._time,set:n=>v._time=n},duration:{get:()=>120},paused:{get:()=>false},ended:{get:()=>v._ended}});</script>`});
  if(u.hostname===host && u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>VeziAici.NET</title></head><body><h1>VeziAici.NET</h1><h2>Seriale online</h2></body></html>'});
  if(u.hostname===host)return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>Episode</title></head><body><h1>Las Fierbinti Sezonul ${u.searchParams.get('season')||30} Episodul ${u.searchParams.get('episode')||(u.href===next?12:11)}</h1><iframe src="https://vidmoly.org/embed-fixture.html"></iframe></body></html>`});
  return route.abort();
 });
 await context.addInitScript({content:`(()=>{const boot=()=>{${script}\n};if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();})();`});
 const page=await context.newPage();
 try{
  await page.goto(original);
  await page.waitForSelector('#va-helper');
  await page.waitForFunction(()=>document.querySelector('#va-status').textContent.includes('parcurs până la capăt'));
  assert.deepEqual(apiCalls,[1,2,3,4]);console.log('PASS: real Chromium menu, automatic API scan across unordered pages');
  assert.equal(await page.locator('#va-catalog option').count(),5);
  await page.waitForFunction(()=>document.querySelector('#va-video-status').textContent.includes('Vidmoly conectat'));
  const frame=page.frames().find(f=>f.url().includes('vidmoly.org'));
  await page.click('#va-forward');await frame.waitForFunction(()=>document.querySelector('video').currentTime===20);
  await page.click('#va-back');await frame.waitForFunction(()=>document.querySelector('video').currentTime===10);
  await page.fill('#va-skiptime','85');await page.click('#va-skip');await frame.waitForFunction(()=>document.querySelector('video').currentTime===95);
  console.log('PASS: real cross-origin iframe handshake and +10/-10/skip (fixture media clock)');
  await frame.evaluate(()=>{const v=document.querySelector('video');window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',source:parent,data:{channel:'va-player-command',action:'seekBy',seconds:20}}));if(v.currentTime!==95)throw Error('Untrusted origin changed time');});
  console.log('PASS: player rejects commands from an untrusted origin');
  await frame.evaluate(()=>{const v=document.querySelector('video');v._time=10;v.dispatchEvent(new Event('ended',{bubbles:true}));});
  await page.waitForTimeout(150);
  await page.check('#va-intro-auto');
  await frame.waitForFunction(()=>document.querySelector('video').currentTime===85);
  console.log('PASS: opt-in auto intro skips to configured timestamp');
  await page.screenshot({path:'/tmp/veziaici-final-ui.png',fullPage:true});
  const right=page.locator('#va-edge-right button');await right.hover();assert.equal(await right.evaluate(el=>el.style.opacity),'1');
  await right.click();await page.waitForURL(next);await page.waitForSelector('#va-helper');
  assert.equal(apiCalls.length,4);assert.equal(await page.locator('#va-intro-auto').isChecked(),true);console.log('PASS: next from cache navigates without another API scan');
  await page.click('#va-prev');await page.waitForURL(original);await page.waitForSelector('#va-helper');
  const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('va-index-v1')));
  assert.ok(cache['las fierbinti|30|11']);assert.ok(cache['las fierbinti|30|12']);console.log('PASS: previous link and skipped episode retained across page navigation');
  await page.waitForFunction(()=>document.querySelector('#va-video-status').textContent.includes('Vidmoly conectat'));
  await page.check('#va-auto');
  const endFrame=page.frames().find(f=>f.url().includes('vidmoly.org'));
  await endFrame.evaluate(()=>{const v=document.querySelector('video');v._ended=true;v.dispatchEvent(new Event('ended',{bubbles:true}));});
  await page.waitForURL(next);console.log('PASS: iframe end event triggers cached next episode');
  await page.goto(`https://${host}/`);await page.waitForSelector('#va-search');
  await page.fill('#va-season','30');await page.fill('#va-episode','12');
  await page.click('#va-search');await page.waitForURL(next);
  assert.equal(apiCalls.length,4);console.log('PASS: homepage primary button opens chosen cached episode');
  await page.evaluate(()=>localStorage.clear());await page.goto(`https://${host}/`);
  await page.waitForSelector('#va-search');await page.fill('#va-name','Las Fierbinti');await page.fill('#va-season','30');await page.fill('#va-episode','12');
  await page.click('#va-search');await page.waitForURL(next);
  console.log('PASS: homepage fresh search discovers and opens real opaque target URL');
  for(const [season,episodes] of [[41,[3,7,10]],[42,[1,2]]]) {
   const urls=episodes.map(episode=>`https://${host}/playlist-${season}-${episode}/?season=${season}&episode=${episode}`);
   await page.evaluate(({season,episodes,urls})=>{
    const index=JSON.parse(localStorage.getItem('va-index-v1')||'{}');
    episodes.forEach((episode,i)=>index[`las fierbinti|${season}|${episode}`]=[{url:urls[i],title:`Las Fierbinti Sezonul ${season} Episodul ${episode}`}]);
    localStorage.setItem('va-index-v1',JSON.stringify(index));localStorage.setItem('va-api-complete-v1',JSON.stringify({'las fierbinti':Date.now()}));
   },{season,episodes,urls});
   const callsBefore=apiCalls.length;
   await page.goto(`https://${host}/`);await page.fill('#va-season',String(season));await page.click('#va-first');await page.waitForURL(urls[0]);
   await page.click('#va-next');await page.waitForURL(urls[1]);
   await page.click('#va-prev');await page.waitForURL(urls[0]);assert.equal(apiCalls.length,callsBefore);
   console.log(`PASS: actual page changes for playlist minimum E${episodes[0]}, Skip E${episodes[0]}→E${episodes[1]}, previous, without a rescan`);
  }
  assert.deepEqual(logs,[]);console.log('PASS: zero uncaught page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
