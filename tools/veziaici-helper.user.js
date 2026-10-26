// ==UserScript==
// @name         Navigator episoade — VeziAici și Clicksud
// @namespace    funcity-tools
// @version      1.2.0
// @description  Caută episoade după titlu; controlează numai videoclipuri HTML5 accesibile.
// @match        https://veziaici.net/*
// @match        https://www.veziaici.net/*
// @match        http://veziaici.net/*
// @match        https://clicksud.xin/*
// @match        https://www.clicksud.xin/*
// @grant        none
// @match        https://vidmoly.org/embed-*
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const parse = s => {
    const m = norm(s).match(/^(.*?)\s+(?:sezonul|sezon|season|s)\s*(\d+)\s+(?:episodul|episod|episode|ep|e)\s*(\d+)\b/);
    return m && {name:m[1],season:+m[2],episode:+m[3]};
  };
  const sameEpisode = (title,target) => {const p=parse(title); return !!p && p.name===norm(target.name) && p.season===target.season && p.episode===target.episode;};
  const nextPages = (links,base,query,visited) => [...new Set(links.map(h=>{try{return new URL(h,base).href;}catch{return null;}}).filter(Boolean))]
    .map(h=>new URL(h)).filter(u=>u.origin===new URL(base).origin && norm(u.searchParams.get('s'))===norm(query) && !visited.has(u.href))
    .sort((a,b)=> +(a.pathname.match(/\/page\/(\d+)/)?.[1] || a.searchParams.get('paged') || 1) - +(b.pathname.match(/\/page\/(\d+)/)?.[1] || b.searchParams.get('paged') || 1));
  function paginationPlan(links,base,query) {
    const pages=nextPages(links,base,query,new Set());
    const numbers=pages.map(u=>+(u.pathname.match(/\/page\/(\d+)/)?.[1] || u.searchParams.get('paged') || 1));
    const total=Math.min(120,Math.max(1,...numbers));
    return Array.from({length:total},(_,i)=>new URL(i===0?'/?s='+encodeURIComponent(query):'/page/'+(i+1)+'/?s='+encodeURIComponent(query),base));
  }
  function resultLinks(doc) {
    // Prefer article headings over menus, comments, pagination and search headings.
    const headings=[...doc.querySelectorAll('h2 a[href], h3 a[href], h4 a[href], .entry-title a[href]')];
    return headings.length ? headings : [...doc.querySelectorAll('article a[href]')];
  }
  const sequentialPage=(origin,query,page)=>new URL(page===1?'/?s='+encodeURIComponent(query):'/page/'+page+'/?s='+encodeURIComponent(query),origin);
  async function scanCatalog({fetcher,origin,query,signal,onBatch}) {
    const seen=new Set();let page=1;
    while(true) {
      if(signal?.aborted) throw new DOMException('Oprit','AbortError');
      const url=new URL('/wp-json/wp/v2/search',origin);
      url.searchParams.set('search',query);url.searchParams.set('per_page','100');url.searchParams.set('page',String(page));url.searchParams.set('_fields','title,url');
      const request=new AbortController();const abort=()=>request.abort();signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,20000);let response,data;
      try {response=await fetcher(url,{signal:request.signal,credentials:'same-origin'});data=await response.json();}
      finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
      if(!response.ok) {
        if(page>1 && data?.code==='rest_search_invalid_page_number') return {complete:true,pages:page-1};
        throw new Error(`API HTTP ${response.status}`);
      }
      if(!Array.isArray(data)) throw new Error('Răspuns API neașteptat');
      if(!data.length) return {complete:true,pages:page-1};
      if(data.some(row=>typeof row.title!=='string'||typeof row.url!=='string')) throw new Error('Catalog API invalid');
      const fingerprint=data.map(row=>row.url+'|'+row.title).sort().join('\n');
      if(seen.has(fingerprint)) throw new Error('API repetă rezultatele');
      seen.add(fingerprint);
      if(await onBatch(data,page)===false) return {complete:false,pages:page};
      page++;
    }
  }
  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {module.exports={norm,parse,sameEpisode,nextPages,paginationPlan,resultLinks,sequentialPage,scanCatalog};return;}
  const siteOrigins=new Set(['https://veziaici.net','https://www.veziaici.net','http://veziaici.net','https://clicksud.xin','https://www.clicksud.xin']);
  if(location.hostname==='vidmoly.org') {
    if(!location.pathname.startsWith('/embed-')) return;
    let parentOrigin=null;
    const media=()=>[...document.querySelectorAll('video')].find(v=>!v.paused&&!v.ended)||document.querySelector('video');
    const report=()=>{
      if(!parentOrigin) return;
      const v=media();
      parent.postMessage({channel:'va-player-state',ready:!!v,time:v?Number(v.currentTime):0,duration:v&&Number.isFinite(v.duration)?v.duration:0,ended:!!v?.ended,paused:!v||v.paused},parentOrigin);
    };
    addEventListener('message',event=>{
      if(event.source!==parent || !siteOrigins.has(event.origin) || event.data?.channel!=='va-player-command') return;
      parentOrigin=event.origin;const v=media();
      if(event.data.action==='seekBy' && v && Number.isFinite(event.data.seconds) && Math.abs(event.data.seconds)<=86400) {
        try {v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:Infinity,v.currentTime+event.data.seconds));}catch{}
      }
      report();
    });
    setInterval(report,1000);document.addEventListener('ended',report,true);return;
  }
  if(!siteOrigins.has(location.origin) || window.top!==window.self) return;
  const articleOrigins=new Set([...siteOrigins].filter(origin=>new URL(origin).hostname.replace(/^www\./,'')===location.hostname.replace(/^www\./,'')));
  if (document.getElementById('va-helper')) return;
  const box = document.createElement('div'); box.id='va-helper';
  box.style.cssText='position:fixed;bottom:12px;right:72px;z-index:2147483647;background:#18202b;color:white;padding:14px;border:1px solid #90a4ba;border-radius:12px;width:310px;max-width:calc(100vw - 84px);font:14px system-ui;box-shadow:0 4px 24px #0008';
  box.innerHTML=`<b>🎬 Playlist · 1.2.0</b> <button id="va-hide">−</button><section><small id="va-current">Identificare după titlu; episoadele pot fi pe orice pagină.</small><p><input id="va-name" placeholder="Nume serial" style="width:95%"></p><label>Sezon <input id="va-season" type="number" min="1" value="1" style="width:50px"></label> <label>Episod <input id="va-episode" type="number" min="1" value="1" style="width:50px"></label><p><button id="va-search">Caută exact</button> <button id="va-stop">Oprește</button> <button id="va-reset">De la pagina 1</button></p><p><button id="va-first">Pornește playlistul</button><br><button id="va-prev">Episod anterior disponibil</button> <button id="va-next">Skip episod →</button></p><p id="va-status" aria-live="polite"></p><div id="va-results" style="max-height:150px;overflow:auto"></div><div id="va-neighbors"></div><p><select id="va-catalog" style="width:100%"><option value="">Episoade salvate…</option></select></p><hr><button id="va-back">−10 sec</button> <button id="va-forward">+10 sec</button><p>Skip <input id="va-skiptime" type="number" min="0" value="85" style="width:60px"> sec <button id="va-skip">Sari intro</button></p><p><label><input id="va-intro-auto" type="checkbox"> Sari intro automat după pornirea redării</label></p><label><input id="va-auto" type="checkbox"> Următor automat</label><p>Mod <select id="va-mode"><option value="end">La final</option><option value="time">La secunda aleasă</option></select> <input id="va-at" type="number" min="1" value="1440" style="width:65px"></p><small>Control HTML5 local și player Vidmoly asistat. Alte servere pot fi incompatibile. Skip episod deschide următorul număr disponibil, peste episoadele lipsă; la ambiguitate alegi tu. Indexarea pornește automat. Opțiunile video se păstrează după activare.</small><p id="va-video-status" aria-live="polite"></p></section>`;
  const style=document.createElement('style');
  style.textContent=`#va-helper{box-sizing:border-box;width:360px!important;background:linear-gradient(145deg,#142337,#0c1422)!important;border:1px solid #365273!important;border-radius:18px!important;padding:18px!important;box-shadow:0 12px 50px #000a!important}#va-helper *{box-sizing:border-box}#va-helper b{font-size:17px}#va-helper p{margin:12px 0}#va-helper input,#va-helper select{background:#0a1220;color:#f0f6ff;border:1px solid #426080;border-radius:7px;padding:7px;max-width:100%}#va-helper button{background:#243b57;color:#f4f8ff;border:1px solid #426080;padding:8px 10px;border-radius:8px;cursor:pointer;margin:2px}#va-helper button:hover{background:#365879}#va-helper #va-search,#va-helper #va-first,#va-helper #va-next{background:#2877d6;border-color:#559aff}#va-helper small{display:block;color:#afc2d9;line-height:1.5;margin-top:8px}#va-helper #va-status{padding:10px;background:#ffffff09;border-radius:8px;line-height:1.5}#va-helper section{max-height:75vh;overflow:auto}#va-helper hr{border:0;border-top:1px solid #365273}`;
  document.head.append(style);
  document.body.append(box);
  for(const [id,label] of [['name','Nume serial'],['season','Sezon'],['episode','Episod'],['skiptime','Durată intro în secunde'],['at','Moment auto-next în secunde'],['mode','Mod auto-next'],['catalog','Episoade salvate']]) box.querySelector('#va-'+id)?.setAttribute('aria-label',label);
  const $ = id => box.querySelector('#va-'+id), status = text => $('status').textContent=text;
  let saved={}; try { saved=JSON.parse(localStorage.getItem('va-selection') || '{}'); } catch {}
  const current=parse(document.querySelector('h1')?.textContent || '');
  const initial=current || saved || {};
  $('current').textContent=current?`Pagina deschisă: S${current.season} E${current.episode}. Numerele de mai jos sunt pentru căutare.`:'Completează serialul, sezonul și episodul.';
  $('name').value=initial.name || 'Las Fierbinti'; $('season').value=initial.season || 1; $('episode').value=initial.episode || 1;
  $('hide').onclick=()=>{ const s=box.querySelector('section'); s.hidden=!s.hidden; $('hide').textContent=s.hidden?'+':'−'; };
  const INDEX='va-index-v1';
  const COMPLETE='va-api-complete-v1';
  function lastComplete(name) {try{return JSON.parse(localStorage.getItem(COMPLETE)||'{}')?.[norm(name)]||0;}catch{return 0;}}
  function markComplete(name) {try{const m=JSON.parse(localStorage.getItem(COMPLETE)||'{}')||{};m[norm(name)]=Date.now();localStorage.setItem(COMPLETE,JSON.stringify(m));}catch{}}
  let index={}; let storageOK=true;
  try {index=JSON.parse(localStorage.getItem(INDEX)||'{}'); if(!index || typeof index!=='object' || Array.isArray(index)) index={};} catch {index={};}
  const key=p=>`${norm(p.name)}|${p.season}|${p.episode}`;
  function remember(p,href,title) {
    try {
      const u=new URL(href,location.href); u.hash='';
      if(!articleOrigins.has(u.origin) || !/^https?:$/.test(u.protocol)) return;
      const k=key(p); const entries=Array.isArray(index[k])?index[k]:[];
      index[k]=entries.filter(e=>e.url!==u.href).concat({url:u.href,title,time:Date.now()});
    } catch {}
  }
  function save() {
    try {
      const disk=JSON.parse(localStorage.getItem(INDEX)||'{}');
      if(disk && typeof disk==='object' && !Array.isArray(disk)) {
        for(const [k,rows] of Object.entries(disk)) {
          if(!Array.isArray(rows)) continue;
          const ours=Array.isArray(index[k])?index[k]:[];const combined=new Map();
          for(const row of [...rows,...ours]) if(row && typeof row.url==='string' && typeof row.title==='string') combined.set(row.url,row);
          index[k]=[...combined.values()];
        }
      }
      localStorage.setItem(INDEX,JSON.stringify(index));storageOK=true;
    }catch {storageOK=false;}
  }
  function cached(p) {return (Array.isArray(index[key(p)])?index[key(p)]:[]).filter(e=>{try{const u=new URL(e.url);return articleOrigins.has(u.origin) && /^https?:$/.test(u.protocol);}catch{return false;}});}
  if(current) {remember(current,location.href,document.querySelector('h1')?.textContent||'Episod');save();}
  function show(p) {
    $('results').replaceChildren();
    for(const e of cached(p)) {const a=document.createElement('a');a.href=e.url;a.textContent=e.title;a.style.cssText='display:block;color:#9cdaff;padding:8px';$('results').append(a);}
  }
  function refreshCatalog() {
    const name=norm(current?.name||$('name').value);const rows=[];
    for(const [k,list] of Object.entries(index)) {
      const parts=k.split('|');if(parts[0]!==name||!Array.isArray(list)) continue;
      for(const entry of list) if(cached({name,season:+parts[1],episode:+parts[2]}).some(e=>e.url===entry.url)) rows.push({season:+parts[1],episode:+parts[2],...entry});
    }
    rows.sort((a,b)=>a.season-b.season||a.episode-b.episode);
    const select=$('catalog');select.replaceChildren(new Option(`${rows.length} linkuri salvate — alege episodul`,''));
    for(const row of rows) select.add(new Option(`S${row.season} E${row.episode} — ${row.title}`,row.url));
    const order=current?playlistEpisodes(current):[];const previous=order.filter(n=>n<current.episode).pop();const next=current?order.find(n=>n>current.episode):undefined;
    $('neighbors').textContent=current?`S${current.season} • ${order.length} episoade salvate • Anterior: ${previous===undefined?'—':'E'+previous} • Următor: ${next===undefined?'—':'E'+next}`:'';
  }
  $('catalog').onchange=()=>{const u=$('catalog').value;if(u) {save();location.assign(u);}};
  addEventListener('storage',event=>{
    if(event.key!==INDEX || !event.newValue) return;
    try {const disk=JSON.parse(event.newValue);if(!disk||typeof disk!=='object'||Array.isArray(disk)) return;
      for(const [k,rows] of Object.entries(disk)) {if(!Array.isArray(rows)) continue;const merged=new Map();for(const row of [...(Array.isArray(index[k])?index[k]:[]),...rows]) if(row&&typeof row.url==='string'&&typeof row.title==='string') merged.set(row.url,row);index[k]=[...merged.values()];}
      warmNeighbors();
    }catch{}
  });
  const warmed=new Set();
  function warmNeighbors() {
    refreshCatalog();
    if(!current) return;
    const ordered=playlistEpisodes(current);const ahead=ordered.filter(n=>n>current.episode).slice(0,2);const behind=ordered.filter(n=>n<current.episode).slice(-1);
    for(const episode of [...behind,...ahead]) {
      const entries=cached({...current,episode});
      if(entries.length!==1 || warmed.has(entries[0].url)) continue;
      warmed.add(entries[0].url);
      const link=document.createElement('link');link.rel='prefetch';link.as='document';link.href=entries[0].url;document.head.append(link);
    }
  }
  // Remember episode links already present on the open page before any network request.
  for(const a of document.querySelectorAll('a[href]')) {
    if(box.contains(a)) continue;
    const ep=parse(a.textContent);
    if(ep && (!current || ep.name===current.name)) remember(ep,a.href,a.textContent.trim());
  }
  save();warmNeighbors();
  let controller=null, busy=false, pending=null, scanningName='', stoppedByUser=false, playlistAction=0;
  $('stop').onclick=()=>{stoppedByUser=true;playlistAction++;pending=null;controller?.abort();status('Oprit. Playlistul și indexul sunt păstrate.');};
  const count=()=>Object.keys(index).length;
  function target(delta=0) {
    const base=delta && current ? current : {name:norm($('name').value),season:+$('season').value,episode:+$('episode').value};
    return {...base,episode:base.episode+delta};
  }
  function openCached(p) {
    const entries=cached(p); show(p);
    if(entries.length===1) {save();location.assign(entries[0].url);return true;}
    if(entries.length>1) {status('Mai multe pagini pentru același episod. Alege rezultatul; nu ghicesc.');return true;}
    return false;
  }
  async function search(delta=0,navigate=false) {
    const p=target(delta);
    if(!p.name || !Number.isInteger(p.season) || p.season<1 || !Number.isInteger(p.episode) || p.episode<1) return status('Completează numele și numere pozitive.');
    if(!delta) {$('name').value=p.name;$('season').value=p.season;$('episode').value=p.episode;}
    try {localStorage.setItem('va-selection',JSON.stringify(p));}catch{}
    show(p);
    if(navigate && openCached(p)) return;
    if(busy && norm(p.name)!==scanningName) return status('Oprește scanarea curentă înainte de alt serial.');
    pending=navigate?p:null;
    if(busy) return status(`Aștept S${p.season} E${p.episode}. Poate fi pe orice pagină; indexarea continuă.`);
    busy=true;controller=new AbortController();const signal=controller.signal;
    // Index all episodes of the series, not only one season/episode.
    const query=norm(p.name);scanningName=query; let cursors={};try {cursors=JSON.parse(localStorage.getItem('va-cursors-v1')||'{}');if(!cursors || typeof cursors!=='object' || Array.isArray(cursors)) cursors={};}catch{}
    let page=Number.isSafeInteger(cursors[query]) && cursors[query]>0?cursors[query]:1;
    const firstPage=page; let wrapped=false; const fingerprints=new Set();
    const checkpoint=n=>{cursors[query]=n;try {localStorage.setItem('va-cursors-v1',JSON.stringify(cursors));}catch{}};
    try {
      try {
        status('Catalog rapid API: până la 100 de articole pe cerere…');
        let navigated=false;
        const fast=await scanCatalog({fetcher:fetch,origin:location.origin,query,signal,onBatch:async(rows,batch)=>{
          for(const row of rows) {
            const decoder=document.createElement('textarea');decoder.innerHTML=row.title;const title=decoder.value;
            const ep=parse(title);if(ep && ep.name===query) remember(ep,row.url,title);
          }
          save();if(!storageOK) throw new Error('Nu pot salva indexul');
          show(pending||p);warmNeighbors();
          status(`Catalog API: ${batch} cereri cu rezultate • ${count()} episoade salvate.${pending?` Caut S${pending.season} E${pending.episode}.`:''}`);
          if(pending && openCached(pending)) {pending=null;navigated=true;return false;}
        }});
        if(fast.complete) {
          markComplete(query);checkpoint(1);
          status(`Catalog API parcurs până la capăt • ${count()} episoade salvate.${pending && !cached(pending).length?` S${pending.season} E${pending.episode} nu apare cu titlu exact în catalogul returnat.`:''}`);
        }
        if(fast.complete || navigated) return;
      } catch(apiError) {
        if(signal.aborted) throw apiError;
        status('API indisponibil. Folosesc paginile HTML; indexul este păstrat.');
      }
      while(!signal.aborted) {
        status(`Citesc pagina ${page} • ${count()} episoade salvate.${pending?` Caut S${pending.season} E${pending.episode}; nu a fost găsit încă.`:''}`);
        const request=new AbortController();const abort=()=>request.abort();signal.addEventListener('abort',abort,{once:true});
        const timer=setTimeout(abort,20000);let response,source;
        try {response=await fetch(sequentialPage(location.origin,query,page),{signal:request.signal,credentials:'same-origin'});source=await response.text();}
        catch(e) {if(signal.aborted) throw e;throw new Error('Cererea nu a reușit sau a depășit 20 secunde. Indexul găsit rămâne salvat.');}
        finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
        if(response.status===404 || response.status===410) {if(!wrapped && firstPage>1) {page=1;wrapped=true;fingerprints.clear();continue;}markComplete(query);checkpoint(1);status(`Indexare terminată: ${count()} episoade salvate.`);break;}
        if(!response.ok) throw new Error(`HTTP ${response.status}. Indexare incompletă; rezultatele sunt păstrate.`);
        const doc=new DOMParser().parseFromString(source,'text/html');
        const text=norm(doc.body?.textContent);
        if(/verify you are human|access denied|just a moment|captcha/.test(text) || doc.querySelector('input[type="password"]')) throw new Error('Site-ul cere verificare/autentificare. Indexarea s-a oprit.');
        const links=resultLinks(doc);
        const fingerprint=links.map(a=>a.getAttribute('href')+'|'+norm(a.textContent)).sort().join('\n');
        if(!links.length) {if(!wrapped && firstPage>1) {page=1;wrapped=true;fingerprints.clear();continue;}markComplete(query);checkpoint(1);status(`Nu mai sunt articole recunoscute la pagina ${page}. ${count()} episoade salvate.`);break;}
        if(fingerprints.has(fingerprint)) throw new Error('Site-ul repetă rezultatele. Scanare incompletă; indexul este păstrat.');
        fingerprints.add(fingerprint);
        for(const a of links) {const ep=parse(a.textContent);if(ep && ep.name===query) remember(ep,new URL(a.getAttribute('href'),response.url||location.origin).href,a.textContent.trim());}
        save();checkpoint(page+1);show(p);warmNeighbors();
        if(!storageOK) throw new Error('Stocarea browserului nu este disponibilă sau este plină. Rezultatele sunt doar în memoria filei.');
        if(pending && openCached(pending)) {pending=null;return;}
        page++;
        if(wrapped && page>=firstPage) {markComplete(query);checkpoint(1);break;}
        await new Promise(resolve=>setTimeout(resolve,700));
      }
      if(signal.aborted) status(`Oprit. ${count()} episoade păstrate.`);
      if(pending && !signal.aborted) {show(pending);if(!cached(pending).length) status(`S${pending.season} E${pending.episode} nu a fost găsit în paginile scanate. Nu aleg alt episod. ${count()} episoade păstrate.`);}
    } catch(e) {status(signal.aborted?`Oprit. ${count()} episoade păstrate.`:e.message);}
    finally {busy=false;controller=null;pending=null;scanningName='';}
  }
  function playlistEpisodes(p) {
    return Object.keys(index).map(k=>k.split('|')).filter(parts=>parts[0]===norm(p.name)&&+parts[1]===p.season)
      .map(parts=>+parts[2]).filter(n=>Number.isSafeInteger(n)&&n>0&&cached({...p,episode:n}).length)
      .sort((a,b)=>a-b);
  }
  async function playlist(direction=1,first=false) {
    const action=++playlistAction;
    const p=first?target():current||target();
    if(!p.name||!Number.isSafeInteger(p.season)||p.season<1) return status('Completează serialul și sezonul.');
    const choose=()=>{const list=playlistEpisodes(p);return first?list[0]:direction>0?list.find(n=>n>p.episode):list.filter(n=>n<p.episode).pop();};
    const fresh=(lastComplete(p.name)>0 && choose()!==undefined)||Date.now()-lastComplete(p.name)<10*60*1000;
    if(!fresh) {
      if(busy && scanningName!==norm(p.name)) return status('Oprește întâi scanarea celuilalt serial.');
      pending=null;
      if(!busy) {
        $('name').value=p.name;$('season').value=p.season;$('episode').value=Math.max(1,p.episode||1);
        // Playlist order needs the whole series, including pages before an old cursor.
        try {const c=JSON.parse(localStorage.getItem('va-cursors-v1')||'{}')||{};c[norm(p.name)]=1;localStorage.setItem('va-cursors-v1',JSON.stringify(c));}catch{}
        await search();
      }
      while(busy && action===playlistAction) await new Promise(resolve=>setTimeout(resolve,50));
      if(action!==playlistAction) return;
      if(Date.now()-lastComplete(p.name)>=10*60*1000) return status('Scanare incompletă. Linkurile sunt păstrate; nu aleg un minim sau un următor pe ghicite. Reîncearcă Pornește playlistul.');
    }
    if(action!==playlistAction) return;
    const episode=choose();
    if(episode===undefined) return status(first?'Nu am găsit episoade recunoscute în sezonul ales.':direction>0?'Ai ajuns la ultimul episod găsit în sezonul acesta.':'Nu este un episod anterior în playlistul găsit.');
    const selected={...p,episode};
    try{localStorage.setItem('va-selection',JSON.stringify(selected));}catch{}
    status(`Deschid S${p.season} E${episode} din playlist…`);openCached(selected);
  }
  // Edge controls appear on hover/focus; navigation requires a click.
  for(const [side,label,button] of [['left','← Episod anterior','prev'],['right','Episod următor →','next']]) {
    const zone=document.createElement('div');zone.id='va-edge-'+side;
    zone.style.cssText=`position:fixed;${side}:0;top:35%;height:30%;width:56px;z-index:2147483647;display:flex;align-items:center;justify-content:center;pointer-events:none;`;
    const edge=document.createElement('button');edge.type='button';edge.textContent=side==='left'?'❮':'❯';edge.title=label;edge.setAttribute('aria-label',label);
    edge.style.cssText='pointer-events:auto;opacity:0.12;background:#122339e8;color:white;border:1px solid #6486ab;border-radius:12px;width:48px;height:90px;font-size:30px;cursor:pointer;transition:opacity .15s,transform .15s;';
    edge.onmouseenter=edge.onfocus=()=>{edge.style.opacity='1';edge.style.transform='scale(1.06)';};
    edge.onmouseleave=edge.onblur=()=>{edge.style.opacity='0.12';edge.style.transform='';};
    edge.onclick=()=>$(button).click();zone.append(edge);document.body.append(zone);
  }
  $('search').textContent='Deschide episodul';
  $('reset').onclick=()=>{if(busy) return status('Oprește întâi scanarea.');try {const c=JSON.parse(localStorage.getItem('va-cursors-v1')||'{}')||{};delete c[norm($('name').value)];localStorage.setItem('va-cursors-v1',JSON.stringify(c));}catch{}search();};
  $('search').onclick=()=>search(0,true);$('first').onclick=()=>playlist(1,true);$('prev').onclick=()=>playlist(-1);$('next').onclick=()=>playlist(1);
  const remoteStates=new Map();
  function playerFrames() {return [...document.querySelectorAll('iframe[src]')].filter(frame=>{try{const u=new URL(frame.src);return u.origin==='https://vidmoly.org'&&u.pathname.startsWith('/embed-');}catch{return false;}});}
  function sendToPlayers(action,seconds) {const frames=playerFrames();for(const frame of frames) frame.contentWindow?.postMessage({channel:'va-player-command',action,seconds},'https://vidmoly.org');return frames.length;}
  addEventListener('message',event=>{
    if(event.origin!=='https://vidmoly.org'||event.data?.channel!=='va-player-state') return;
    const frame=playerFrames().find(f=>f.contentWindow===event.source);if(!frame) return;
    const d=event.data;
    if(typeof d.ready!=='boolean'||typeof d.ended!=='boolean'||typeof d.paused!=='boolean'||!Number.isFinite(d.time)||d.time<0||!Number.isFinite(d.duration)||d.duration<0) return;
    remoteStates.set(frame,{...d,seen:Date.now()});
  });
  function remoteVideo() {const active=playerFrames().map(f=>remoteStates.get(f)).filter(s=>s?.ready && Date.now()-s.seen<5000);return active.find(s=>!s.paused&&!s.ended)||active[0];}
  function videos(doc=document,depth=0) {let all=[...doc.querySelectorAll('video')];if(depth<4) for(const f of doc.querySelectorAll('iframe')) try {if(f.contentDocument) all.push(...videos(f.contentDocument,depth+1));}catch{} return all;}
  function video() {return videos().find(v=>!v.paused && !v.ended) || videos()[0];}
  function seek(offset) {const v=video();if(!v) {if(sendToPlayers('seekBy',offset)) $('video-status').textContent='Comandă trimisă playerului Vidmoly. Necesită script permis în iframe.';else $('video-status').textContent='Niciun player controlabil detectat. Pornește videoclipul; alte servere pot fi incompatibile.';return;}try {v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:Infinity,v.currentTime+offset));}catch {status('Playerul nu permite modificarea timpului.');}}
  $('back').onclick=()=>seek(-10);$('forward').onclick=()=>seek(10);$('skip').onclick=()=>seek(Math.max(0,+$('skiptime').value || 0));
  let preferences={};try {preferences=JSON.parse(localStorage.getItem('va-video-options-v1')||'{}')||{};}catch{}
  $('skiptime').value=Number.isFinite(preferences.skip)&&preferences.skip>=0?preferences.skip:85;
  $('at').value=Number.isFinite(preferences.at)&&preferences.at>0?preferences.at:1440;
  $('mode').value=preferences.mode==='time'?'time':'end';
  $('auto').checked=preferences.next===true;$('intro-auto').checked=preferences.intro===true;
  function persistVideoOptions() {try{localStorage.setItem('va-video-options-v1',JSON.stringify({skip:Math.max(0,+$('skiptime').value||0),at:Math.max(1,+$('at').value||1),mode:$('mode').value,next:$('auto').checked,intro:$('intro-auto').checked}));}catch{}}
  for(const id of ['skiptime','at','mode','intro-auto']) $(id).addEventListener('change',persistVideoOptions);
  let introApplied=false;
  let triggered=false;
  $('auto').onchange=()=>{persistVideoOptions();triggered=false;status($('auto').checked?'Auto activ: deschide următorul episod dacă există o potrivire unică.':'Auto oprit.');};
  setInterval(()=>{const native=video();const remote=remoteVideo();const v=native||remote;sendToPlayers('status');$('video-status').textContent=native?'Player HTML5 conectat.':remote?'Player Vidmoly conectat.':playerFrames().length?'Vidmoly detectat; aștept conexiunea cu iframe-ul.':'Niciun player detectat încă.';if(v && $('intro-auto').checked && !introApplied && !v.paused) {const time=native?native.currentTime:remote.time;const intro=Math.max(0,+$('skiptime').value||0);if(time>0) {introApplied=true;if(time<intro) seek(intro-time);}}if(!v || !$('auto').checked || triggered) return;const at=+$('at').value;const reached=$('mode').value==='end'?v.ended:at>0 && (native?native.currentTime:remote.time)>=at;if(reached){triggered=true;$('auto').checked=false;playlist(1);}},1000);
  status(`${count()} episoade în index. Deschide episodul caută și deschide potrivirea exactă. De la pagina 1 reindexează fără a deschide. Anterior/Următor folosește episodul paginii deschise.`);
  // Autostart is integrated: this script also creates its own menu and buttons.
  setTimeout(()=>{
    const name=norm($('name').value);
    if(!name || stoppedByUser || busy) return;
    if(Date.now()-lastComplete(name)<10*60*1000) return status(`Index salvat disponibil. Alege sezonul și episodul, apoi apasă Deschide episodul.`);
    const run=async()=>{await search();};
    if(navigator.locks?.request) navigator.locks.request('va-auto-index-'+name,{ifAvailable:true},async lock=>{if(lock) await run();}).catch(e=>status(e.message));
    else run();
  },800);

})();
