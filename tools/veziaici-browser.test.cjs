const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const script=fs.readFileSync(__dirname+'/'+(process.env.VA_SCRIPT || 'veziaici-helper.user.js'),'utf8');
const episode='<h1>Las Fierbinti – Sezonul 22 Episodul 2 – 8 Septembrie 2022</h1>';
async function until(fn){const end=Date.now()+3000;while(!fn()){if(Date.now()>end)throw Error('Timeout');await new Promise(r=>setTimeout(r,10));}}
test('browser: current page overrides old fields; scans sequentially and saves all matched series episodes',async()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/example/',runScripts:'outside-only'}); const w=dom.window; const calls=[];
 w.localStorage.setItem('va-selection',JSON.stringify({name:'Las Fierbinti',season:1,episode:1}));
 w.fetch=async u=>{if(new URL(u).pathname.startsWith('/wp-json/')) return {ok:false,status:404,json:async()=>({code:'rest_no_route'})};const p=new URL(u).pathname;calls.push(p);return {status:p==='/page/3/'?404:200,ok:p!=='/page/3/',url:String(u),text:async()=>p==='/'?'<h4><a href="/random-a/">Las Fierbinti Sezonul 22 Episodul 3</a></h4>':'<h4><a href="/random-b/">Las Fierbinti Sezonul 30 Episodul 10</a></h4>'};};
 try {w.eval(script);assert.equal(w.document.querySelector('#va-season').value,'22');
 w.document.querySelector('#va-reset').click();
 await until(()=>w.document.querySelector('#va-status').textContent.includes('Indexare terminată'));
 assert.deepEqual(calls,['/','/page/2/','/page/3/']);
 const index=JSON.parse(w.localStorage.getItem('va-index-v1'));
 assert.ok(index['las fierbinti|22|2']);assert.ok(index['las fierbinti|22|3']);assert.ok(index['las fierbinti|30|10']);
 assert.equal(index['las fierbinti|22|3'][0].url,'https://veziaici.net/random-a/');
 } finally {w.close();}
});
test('browser: Stop preserves cache and terminates scan',async()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/example/',runScripts:'outside-only'});const w=dom.window;
 w.fetch=async u=>{ if(new URL(u).pathname.startsWith('/wp-json/')) return {ok:false,status:404,json:async()=>({code:'rest_no_route'})}; return {status:200,ok:true,url:String(u),text:async()=>'<h4><a href="/e3/">Las Fierbinti Sezonul 22 Episodul 3</a></h4>'};};
 try {w.eval(script);w.document.querySelector('#va-reset').click();await until(()=>JSON.parse(w.localStorage.getItem('va-index-v1'))['las fierbinti|22|3']);w.document.querySelector('#va-stop').click();await until(()=>w.document.querySelector('#va-status').textContent.startsWith('Oprit.'));assert.ok(JSON.parse(w.localStorage.getItem('va-index-v1'))['las fierbinti|22|3']);}finally{w.close();}
});
test('edge controls: two accessible buttons, hover reveals, click delegates navigation',()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/example/',runScripts:'outside-only'});const w=dom.window;
 try {w.eval(script);let clicked=0;w.document.querySelector('#va-next').onclick=()=>clicked++;
 const edge=w.document.querySelector('#va-edge-right button');assert.ok(edge);assert.equal(edge.getAttribute('aria-label'),'Episod următor →');edge.dispatchEvent(new w.Event('mouseenter'));assert.equal(edge.style.opacity,'1');assert.equal(clicked,0);edge.click();assert.equal(clicked,1);
 assert.ok(w.document.querySelector('#va-edge-left button'));
 }finally{w.close();}
});
test('integrated autostart keeps menu visible and starts fetching without a click',async()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/example/',runScripts:'outside-only'});const w=dom.window;let calls=0;
 w.fetch=async u=>{if(new URL(u).pathname.startsWith('/wp-json/')) return {ok:false,status:404,json:async()=>({code:'rest_no_route'})};calls++;return {status:404,ok:false,url:String(u),text:async()=>''};};
 try{w.eval(script);assert.ok(w.document.querySelector('#va-search'));assert.ok(w.document.querySelector('#va-edge-right button'));await until(()=>calls>0);assert.equal(calls,1);}finally{w.close();}
});
test('next episode on a distant, unordered search page navigates using the real opaque URL',async()=>{
 const dom=new JSDOM('<h1>Las Fierbinti Sezonul 30 Episodul 11</h1>',{url:'https://veziaici.net/opaque-current/',runScripts:'outside-only'});const w=dom.window;const calls=[];
 const pages={1:[29,31],2:[22,2],3:[30,12]};
 w.fetch=async u=>{if(new URL(u).pathname.startsWith('/wp-json/')) return {ok:false,status:404,json:async()=>({code:'rest_no_route'})};const page=+(new URL(u).pathname.match(/page\/(\d+)/)?.[1]||1);calls.push(page);const ep=pages[page];return {status:ep?200:404,ok:!!ep,url:String(u),text:async()=>ep?`<h4><a href="/opaque-${page}/">Las Fierbinti Sezonul ${ep[0]} Episodul ${ep[1]}</a></h4>`:''};};
 try {w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>{w.destination=url;};w.document.querySelector('#va-next').click();await until(()=>w.destination);
 assert.deepEqual(calls,[1,2,3,4]);assert.equal(w.destination,'https://veziaici.net/opaque-3/');assert.equal(w.document.querySelector('#va-episode').value,'11');assert.ok(JSON.parse(w.localStorage.getItem('va-index-v1'))['las fierbinti|30|11']);
 }finally{w.close();}
});
test('resumed scan checks earlier pages before declaring requested episode unfound',async()=>{
 const dom=new JSDOM('<h1>Las Fierbinti Sezonul 30 Episodul 11</h1>',{url:'https://veziaici.net/current/',runScripts:'outside-only'});const w=dom.window;const calls=[];
 w.localStorage.setItem('va-cursors-v1',JSON.stringify({'las fierbinti':3}));
 w.fetch=async u=>{if(new URL(u).pathname.startsWith('/wp-json/')) return {ok:false,status:404,json:async()=>({code:'rest_no_route'})};const page=+(new URL(u).pathname.match(/page\/(\d+)/)?.[1]||1);calls.push(page);return {status:page===4?404:200,ok:page!==4,url:String(u),text:async()=>`<h4><a href="/found-${page}/">Las Fierbinti Sezonul 30 Episodul ${page===1?12:8}</a></h4>`};};
 try {w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>w.destination=url;w.document.querySelector('#va-next').click();await until(()=>w.destination);assert.deepEqual(calls,[1,2,3,4]);assert.equal(w.destination,'https://veziaici.net/found-1/');}finally{w.close();}
});
test('API fast path indexes distant episodes without fetching HTML search pages',async()=>{
 const dom=new JSDOM('<h1>Las Fierbinti Sezonul 22 Episodul 2</h1>',{url:'https://veziaici.net/current/',runScripts:'outside-only'});const w=dom.window;const calls=[];
 w.fetch=async u=>{assert.equal(new URL(u).pathname,'/wp-json/wp/v2/search');const page=+new URL(u).searchParams.get('page');calls.push(page);return {ok:true,json:async()=>page===1?[{title:'Las Fierbinti Sezonul 30 Episodul 11',url:'https://veziaici.net/recent/'}]:page===2?[{title:'Las Fierbinti &#8211; Sezonul 22 Episodul 3',url:'https://veziaici.net/opaque-older/'}]:[]};};
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>w.destination=url;w.document.querySelector('#va-next').click();await until(()=>w.destination);assert.deepEqual(calls,[1,2,3]);assert.equal(w.destination,'https://veziaici.net/opaque-older/');assert.ok(JSON.parse(w.localStorage.getItem('va-index-v1'))['las fierbinti|30|11']);}finally{w.close();}
});
test('Stop before autostart prevents network requests',async()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/current/',runScripts:'outside-only'});const w=dom.window;let calls=0;
 w.fetch=async()=>{calls++;throw Error('Unexpected request');};
 try{w.eval(script);w.document.querySelector('#va-stop').click();await new Promise(r=>setTimeout(r,950));assert.equal(calls,0);assert.ok(w.document.querySelector('#va-helper'));}finally{w.close();}
});
test('saved video preferences and another tab index are restored safely',()=>{
 const dom=new JSDOM(episode,{url:'https://veziaici.net/current/',runScripts:'outside-only'});const w=dom.window;
 w.localStorage.setItem('va-video-options-v1',JSON.stringify({skip:90,at:1800,mode:'time',next:true,intro:true}));
 try{w.eval(script);assert.equal(w.document.querySelector('#va-skiptime').value,'90');assert.equal(w.document.querySelector('#va-auto').checked,true);assert.equal(w.document.querySelector('#va-intro-auto').checked,true);
 const newValue=JSON.stringify({'las fierbinti|22|3':[{url:'https://veziaici.net/opaque-new/',title:'Las Fierbinti Sezonul 22 Episodul 3'}]});
 w.dispatchEvent(new w.StorageEvent('storage',{key:'va-index-v1',newValue}));
 assert.ok([...w.document.querySelector('#va-catalog').options].some(o=>o.value==='https://veziaici.net/opaque-new/'));
 assert.match(w.document.querySelector('#va-neighbors').textContent,/Următor: E3/);
 }finally{w.close();}
});
test('homepage: primary button finds and opens exact requested episode, not just result links',async()=>{
 const dom=new JSDOM('<h1>VeziAici.NET</h1>',{url:'https://veziaici.net/',runScripts:'outside-only'});const w=dom.window;const calls=[];
 w.fetch=async u=>{const page=+new URL(u).searchParams.get('page');calls.push(page);return {ok:true,json:async()=>page===1?[{title:'Las Fierbinti Sezonul 29 Episodul 12',url:'https://veziaici.net/wrong-season/'}]:page===2?[{title:'Las Fierbinti Sezonul 30 Episodul 12',url:'https://veziaici.net/real-opaque-target/'}]:[]};};
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>w.destination=url;
 w.document.querySelector('#va-season').value='30';w.document.querySelector('#va-episode').value='12';w.document.querySelector('#va-search').click();await until(()=>w.destination);assert.equal(w.destination,'https://veziaici.net/real-opaque-target/');assert.deepEqual(calls,[1,2]);
 }finally{w.close();}
});
test('homepage: saved selection starts indexing automatically without opening arbitrary episode',async()=>{
 const dom=new JSDOM('<h1>VeziAici.NET</h1>',{url:'https://veziaici.net/',runScripts:'outside-only'});const w=dom.window;let calls=0;
 w.localStorage.setItem('va-selection',JSON.stringify({name:'Las Fierbinti',season:30,episode:11}));w.fetch=async()=>{calls++;return {ok:true,json:async()=>[]};};
 try{w.eval(script);await until(()=>calls>0);assert.equal(calls,1);assert.equal(w.document.querySelector('#va-season').value,'30');assert.ok(w.document.querySelector('#va-status').compareDocumentPosition(w.document.querySelector('#va-neighbors'))&w.Node.DOCUMENT_POSITION_FOLLOWING);}finally{w.close();}
});
test('www homepage accepts actual canonical API URLs instead of silently discarding them',async()=>{
 const dom=new JSDOM('<h1>VeziAici.NET</h1>',{url:'https://www.veziaici.net/',runScripts:'outside-only'});const w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>[{title:'Las Fierbinti Sezonul 30 Episodul 11',url:'https://veziaici.net/actual-canonical/'}]});
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>w.destination=url;w.document.querySelector('#va-season').value='30';w.document.querySelector('#va-episode').value='11';w.document.querySelector('#va-search').click();await until(()=>w.destination);assert.equal(w.destination,'https://veziaici.net/actual-canonical/');}finally{w.close();}
});
test('Clicksud: discovers live-observed E10 URL and rejects links to the other site',async()=>{
 const dom=new JSDOM('<h1>Las Fierbinti Sezonul 30 Episodul 11 Online 22 Octombrie</h1>',{url:'https://clicksud.xin/las-fierbinti-sezonul-30-episodul-11-online-22-octombrie/',runScripts:'outside-only'});const w=dom.window;const expected='https://clicksud.xin/las-fierbinti-sezonul-30-episodul-10-complet-19-octombrie/';const calls=[];
 w.fetch=async u=>{const page=+new URL(u).searchParams.get('page');calls.push(page);return {ok:true,json:async()=>page===1?[{title:'Las Fierbinti Sezonul 30 Episodul 10 Complet 19 Octombrie',url:'https://veziaici.net/not-on-clicksud/'}]:page===2?[{title:'Las Fierbinti Sezonul 30 Episodul 10 Complet 19 Octombrie',url:expected}]:[]};};
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=url=>w.destination=url;w.document.querySelector('#va-prev').click();await until(()=>w.destination);assert.equal(w.destination,expected);assert.deepEqual(calls,[1,2,3]);assert.ok(!Object.values(JSON.parse(w.localStorage.getItem('va-index-v1'))).flat().some(e=>e.url.includes('veziaici.net')));}finally{w.close();}
});
test('playlist starts at minimum from ALL unordered API pages when E1 is absent',async()=>{
 const dom=new JSDOM('<h1>Clicksud</h1>',{url:'https://clicksud.xin/',runScripts:'outside-only'});const w=dom.window;const calls=[];
 const pages={1:[9,7],2:[3,5],3:[]};
 w.fetch=async u=>{const n=+new URL(u).searchParams.get('page');calls.push(n);assert.equal(w.destination,undefined,'must not choose a minimum from a partial catalog');return {ok:true,json:async()=>pages[n].map(e=>({title:`Las Fierbinti Sezonul 30 Episodul ${e}`,url:`https://clicksud.xin/opaque-${e}/`}))};};
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=u=>w.destination=u;w.document.querySelector('#va-season').value='30';w.document.querySelector('#va-first').click();await until(()=>w.destination);assert.equal(w.destination,'https://clicksud.xin/opaque-3/');assert.deepEqual(calls,[1,2,3]);}finally{w.close();}
});
test('playlist Skip navigates E1→E2 and gaps E3→E7 even after a long episode without rescan',()=>{
 for(const [episode,next,episodes] of [[1,2,[1,2]],[3,7,[3,7,10]]]){
 const dom=new JSDOM(`<h1>Las Fierbinti Sezonul 30 Episodul ${episode}</h1>`,{url:`https://clicksud.xin/ep-${episode}/`,runScripts:'outside-only'});const w=dom.window;const cache={};
 for(const e of episodes)cache[`las fierbinti|30|${e}`]=[{url:`https://clicksud.xin/ep-${e}/`,title:`Las Fierbinti Sezonul 30 Episodul ${e}`}];
 w.localStorage.setItem('va-index-v1',JSON.stringify(cache));w.localStorage.setItem('va-api-complete-v1',JSON.stringify({'las fierbinti':Date.now()-2*60*60*1000}));w.fetch=()=>{throw Error('Cached Skip must not scan');};
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=u=>w.destination=u;assert.match(w.document.querySelector('#va-next').textContent,/Skip episod/);w.document.querySelector('#va-next').click();assert.equal(w.destination,`https://clicksud.xin/ep-${next}/`);assert.ok(w.document.querySelector(`link[rel=prefetch][href="https://clicksud.xin/ep-${next}/"]`));}finally{w.close();}
 }
});
test('playlist previous crosses gaps and last item does not invent a URL',()=>{
 const dom=new JSDOM('<h1>Las Fierbinti Sezonul 30 Episodul 7</h1>',{url:'https://clicksud.xin/ep-7/',runScripts:'outside-only'});const w=dom.window;w.localStorage.setItem('va-index-v1',JSON.stringify({'las fierbinti|30|3':[{url:'https://clicksud.xin/ep-3/',title:'Las Fierbinti Sezonul 30 Episodul 3'}]}));w.localStorage.setItem('va-api-complete-v1',JSON.stringify({'las fierbinti':Date.now()}));
 try{w.eval(script.replaceAll('location.assign(', 'window.__go('));w.__go=u=>w.destination=u;w.document.querySelector('#va-next').click();assert.equal(w.destination,undefined);assert.match(w.document.querySelector('#va-status').textContent,/ultimul/);w.document.querySelector('#va-prev').click();assert.equal(w.destination,'https://clicksud.xin/ep-3/');}finally{w.close();}
});
