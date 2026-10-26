const {test}=require('node:test');const assert=require('node:assert/strict');
const {scanCatalog}=require('./veziaici-helper.user.js');
test('100 records per API page; reads all pages until empty and preserves opaque URLs',async()=>{
 const calls=[],rows=[];
 const fetcher=async u=>{calls.push(String(u));const page=+u.searchParams.get('page');return {ok:true,json:async()=>page===4?[]:Array.from({length:page===3?85:100},(_,i)=>({title:`Las Fierbinti Sezonul 22 Episodul ${i+1}`,url:`https://veziaici.net/opaque-${page}-${i}/`}))};};
 const result=await scanCatalog({fetcher,origin:'https://veziaici.net',query:'Las Fierbinti',onBatch:batch=>rows.push(...batch)});
 assert.equal(result.complete,true);assert.equal(rows.length,285);assert.equal(calls.length,4);assert.ok(calls.every(u=>new URL(u).searchParams.get('per_page')==='100'));assert.equal(rows[100].url,'https://veziaici.net/opaque-2-0/');
});
test('WordPress invalid page error after last page is accepted as end',async()=>{
 let calls=0;const result=await scanCatalog({origin:'https://veziaici.net',query:'x',fetcher:async()=>++calls===1?{ok:true,json:async()=>[{title:'x',url:'https://veziaici.net/x/'}]}:{ok:false,status:400,json:async()=>({code:'rest_search_invalid_page_number'})},onBatch:()=>{}});assert.equal(result.complete,true);assert.equal(calls,2);
});
test('repeated API results are an error, not a complete inventory',async()=>{
 await assert.rejects(scanCatalog({origin:'https://veziaici.net',query:'x',fetcher:async()=>({ok:true,json:async()=>[{title:'x',url:'https://veziaici.net/x/'}]}),onBatch:()=>{}}),/repetă/);
});
test('batch can stop once requested episode is found',async()=>{
 let calls=0;const result=await scanCatalog({origin:'https://veziaici.net',query:'x',fetcher:async()=>{calls++;return {ok:true,json:async()=>[{title:'x',url:'https://veziaici.net/x/'}]};},onBatch:()=>false});assert.equal(result.complete,false);assert.equal(calls,1);
});
test('aborted scan sends no request',async()=>{
 const ctrl=new AbortController();ctrl.abort();let calls=0;await assert.rejects(scanCatalog({origin:'https://veziaici.net',query:'x',signal:ctrl.signal,fetcher:async()=>{calls++;},onBatch:()=>{}}),{name:'AbortError'});assert.equal(calls,0);
});
