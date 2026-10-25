const {test}=require('node:test');
const assert=require('node:assert/strict');
const {norm,parse,sameEpisode,nextPages}=require('./veziaici-helper.user.js');
const target={name:'Las Fierbinți',season:30,episode:10};
test('Romanian accents and punctuation',()=>assert.equal(norm('Las Fierbinți!'),'las fierbinti'));
for(const title of ['Las Fierbinti Sezonul 30 Episodul 10 Integral 19 Octombrie 2026','Las Fierbinți Sezonul 30 Episodul 10 din 19 octombrie','Las Fierbinti Season 30 Episode 10']) test(title,()=>assert.ok(sameEpisode(title,target)));
for(const title of ['Las Fierbinti Sezonul 30 Episodul 11 din 22 Octombrie 2026','Las Fierbinti Sezonul 30 Episodul 9 de pe 15 Octombrie 2026','Las Fierbinti Sezonul 29 Episodul 31 Datoria partea 1 18 mai','Alt serial Sezonul 30 Episodul 10']) test('reject '+title,()=>assert.equal(sameEpisode(title,target),false));
test('season 1 does not match 30 and episode 1 does not match 11',()=>assert.equal(sameEpisode('Las Fierbinti Sezonul 30 Episodul 11',{name:'Las Fierbinti',season:1,episode:1}),false));
test('missing episode is not guessed',()=>assert.equal(parse('Las Fierbinti Integral'),null));
test('pagination accepts case changes and sorts numerically, ignores external and visited',()=>{
 const base='https://veziaici.net/?s=Las+Fierbinti';
 const pages=nextPages(['/page/97/?s=Las+Fierbinti','/page/2/?s=las+fierbinti','https://evil.example/page/3/?s=Las+Fierbinti',base,'/episode-title/'],base,'Las Fierbinti',new Set([base]));
 assert.deepEqual(pages.map(p=>p.pathname),['/page/2/','/page/97/']);
});
test('URL wording is not an input to episode matching',()=>assert.ok(sameEpisode('Las Fierbinti Sezonul 30 Episodul 10',target)));
const {paginationPlan}=require('./veziaici-helper.user.js');
test('97-page search plans every page, even if only 2 and 97 are visible',()=>{
 const plan=paginationPlan(['/page/2/?s=Las+Fierbinti','/page/97/?s=Las+Fierbinti'],'https://veziaici.net/','Las Fierbinti');
 assert.equal(plan.length,97);
 assert.equal(new Set(plan.map(u=>u.href)).size,97);
 for(let i=1;i<97;i++) assert.equal(plan[i].pathname,`/page/${i+1}/`);
});
test('no pagination means one page',()=>assert.equal(paginationPlan([], 'https://veziaici.net/','x').length,1));
test('external links cannot extend the scan',()=>assert.equal(paginationPlan(['https://evil.example/page/97/?s=x'],'https://veziaici.net/','x').length,1));
test('hostile page counts are capped at 120',()=>assert.equal(paginationPlan(['/page/999999/?s=x'],'https://veziaici.net/','x').length,120));
test('query is encoded safely',()=>assert.equal(paginationPlan([], 'https://veziaici.net/','a & b')[0].searchParams.get('s'),'a & b'));
test('actual page 97 result: punctuation accepted, search S1E1 rejected',()=>{
 const title='Las Fierbinti – Sezonul 22 Episodul 2 – 8 Septembrie 2022';
 assert.ok(sameEpisode(title,{name:'Las Fierbinti',season:22,episode:2}));
 assert.equal(sameEpisode(title,{name:'Las Fierbinti',season:1,episode:1}),false);
});
const {resultLinks}=require('./veziaici-helper.user.js');
test('article headings take priority over unrelated links',()=>{
 const heading={textContent:'Las Fierbinti Sezonul 22 Episodul 2'};
 const doc={querySelectorAll: selector=> selector.includes('h2')?[heading]:[{textContent:'comment or navigation'}]};
 assert.deepEqual(resultLinks(doc),[heading]);
});
test('fallback limited to article links when heading links are absent',()=>{
 const article={textContent:'Episode title'};
 const doc={querySelectorAll:selector=>selector==='article a[href]'?[article]:[]};
 assert.deepEqual(resultLinks(doc),[article]);
});
const {sequentialPage}=require('./veziaici-helper.user.js');
test('sequential scan starts at 1 and continues beyond 97 and 120 without a fixed ceiling',()=>{
 for(const page of [1,2,97,98,120,121,500]) {
  const u=sequentialPage('https://veziaici.net','Las Fierbinti',page);
  assert.equal(u.pathname,page===1?'/':`/page/${page}/`);
  assert.equal(u.searchParams.get('s'),'Las Fierbinti');
 }
});
