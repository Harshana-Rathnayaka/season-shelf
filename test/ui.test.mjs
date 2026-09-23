import { parseEpisode } from "../src/core/catalog.mjs";
// DOM logic tests only; JSDOM is not a browser and does not validate layout.
import test from "node:test";
import assert from "node:assert/strict";
import { rendererSource } from "../scripts/lib/renderer-source.mjs";
const rendererCode = await rendererSource();
import { JSDOM } from "jsdom";
async function fixture(t, bootstrap = null, handler = null) {
  const dom = new JSDOM(
    '<div id="app"></div><dialog id="dialog"></dialog><div id="toast"></div>',
    { url: "https://sample.invalid", runScripts: "outside-only" },
  );
  const { window } = dom;
  const calls = [];
  let listener;
  if (bootstrap) window.shelf = { on(fn) {listener=fn;}, async call(method,payload) {
    calls.push({method,payload});
    if (handler && method !== "bootstrap") return {ok:true,data:await handler(method,payload)};
    return {ok:true,data:method === "bootstrap" ? {...bootstrap,connected:true,demo:false} : []};
  } };
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  await window.eval(rendererCode);
  t.after(() => window.close());
  const click = (selector) => {
    const element = window.document.querySelector(selector);
    assert.ok(element, `Control exists: ${selector}`);
    element.click();
  };
  return { window, document: window.document, click, calls, emit:value=>listener(value) };
}
test("sample UI renders eight rows, switches quality and selects a whole season", async (t) => {
  const f = await fixture(t);
  assert.equal(f.document.querySelectorAll("tbody tr").length, 8);
  assert.match(f.document.body.textContent, /Illustrative sample/);
  assert.match(
    f.document.querySelector(".selection-bar").textContent,
    /3 episodes selected/,
  );
  f.click('[data-action="mode"][data-mode="watch"]');
  assert.equal(f.document.querySelector(".quality-tag").textContent, "1080p");
  assert.match(
    f.document.querySelector(".selection-bar").textContent,
    /0 episodes selected/,
  );
  f.click('[data-action="select-season"]');
  assert.match(
    f.document.querySelector(".selection-bar").textContent,
    /8 episodes selected/,
  );
  f.click('[data-action="download"]');
  assert.equal(f.document.querySelectorAll(".queue-item").length, 8);
  assert.match(f.document.body.textContent, /no file transfers/);
});
test("search filters rows and theme toggles without a desktop bridge", async (t) => {
  const f = await fixture(t);
  const search = f.document.querySelector("#episode-search");
  search.value = "Episode 5";
  search.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.document.querySelectorAll("tbody tr").length, 1);
  f.click('[data-action="theme"]');
  assert.equal(f.document.documentElement.dataset.theme, "light");
  f.click('[data-action="nav"][data-page="settings"]');
  assert.match(f.document.body.textContent, /Simultaneous downloads/);
});
test("sample sign-in explains the desktop requirement and cannot ask for credentials", async (t) => {
  const f = await fixture(t);
  f.click('[data-action="connect"]');
  assert.equal(f.document.querySelector("#dialog").open, true);
  assert.match(
    f.document.querySelector("#dialog").textContent,
    /interface preview/,
  );
  assert.equal(f.document.querySelectorAll("#dialog input").length, 0);
});

test("queue totals update for cancel, resume and removal; help is reachable", async (t) => {
  const f=await fixture(t);
  f.click('[data-action="download"]');
  const summary=()=>f.document.querySelector('.queue-summary').textContent;
  assert.equal(f.document.querySelector('[data-control="cancel"]'),null);
  assert.equal(f.document.querySelector('[data-action="bulk-job"][data-control="pause"]').disabled,false);
  assert.equal(f.document.querySelector('[data-action="bulk-job"][data-control="resume"]').disabled,true);
  assert.equal(f.document.querySelector('[data-action="delete-all-queue"]').textContent.trim(),'Clear queue…');
  const initial=summary();
  assert.match(initial,/CURRENT BATCH/);
  f.click('[data-action="bulk-job"][data-control="pause"]');
  assert.equal(f.document.querySelector('.status').textContent,'paused');
  assert.equal(f.document.querySelector('[data-action="bulk-job"][data-control="pause"]').disabled,true);
  assert.equal(f.document.querySelector('[data-action="bulk-job"][data-control="resume"]').disabled,false);

  f.click('[data-action="bulk-job"][data-control="resume"]');
  assert.equal(summary(),initial);
  f.click('[data-action="job"][data-control="remove"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,2);
  assert.notEqual(summary(),initial);
  f.click('[data-action="nav"][data-page="help"]');
  assert.match(f.document.body.textContent,/How to use Season Shelf/);
});

test("quality buttons reflect channel formats and display full source filenames", async (t) => {
  const f=await fixture(t);
  assert.equal(f.document.querySelectorAll('[data-field="resolution"]').length,2);
  assert.equal(f.document.querySelector('[data-value="2160"]'),null);
  assert.ok(f.document.querySelector('.source-filename').textContent.endsWith('.mkv'));
  f.click('[data-field="resolution"][data-value="1080"]');
  assert.equal(f.document.querySelector('.quality-tag').textContent,'1080p');
  assert.equal(f.document.activeElement.dataset.value,'1080');
  assert.equal(f.document.querySelector('[data-field="resolution"][aria-pressed="true"]').textContent,'1080p');
  assert.match(f.document.querySelector('.selection-bar').textContent,/0 episodes selected/);
});
test("unavailable default explains fallback and enqueue uses the displayed quality", async (t) => {
  const item=parseEpisode({id:"1",filename:"Show.S01E01.1080p.x264.mkv",size:100,peer:{id:"1"}});
  const f=await fixture(t,{catalogue:{channel:{id:"1",title:"Show"},items:[item]}});
  assert.match(f.document.querySelector('.quality-fallback').textContent,/Preferred quality unavailable/);
  assert.equal(f.document.querySelectorAll('[data-field="resolution"]').length,1);
  assert.equal(f.document.querySelectorAll('[data-field="codec"]').length,1);
  assert.equal(f.document.querySelector('.source-filename').textContent,item.filename);
  f.click('[data-action="select-season"]');
  f.click('[data-action="download"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  const payload=f.calls.find(c=>c.method==='enqueue').payload;
  assert.equal(payload.quality.resolution,1080);
  assert.equal(payload.quality.codec,'H.264');
});
test("suggested channels retain show names; All channels restores hidden finance results", async (t) => {
  const f=await fixture(t,{channels:[{id:"1",title:"Forex VIP"},{id:"2",title:"12 Monkeys"},{id:"3",title:"Movies Central"}]});
  f.click('[data-action="choose-series"]');
  assert.equal(f.document.querySelectorAll('.channel-option').length,2);
  assert.equal(f.document.querySelector('.channel-option').dataset.channel,'3');
  assert.ok(f.document.querySelector('[data-channel="2"]'));
  f.click('[data-action="channel-filter"][data-filter="all"]');
  assert.equal(f.document.querySelectorAll('.channel-option').length,3);
  const input=f.document.querySelector('#channel-search');
  input.value='forex';
  input.dispatchEvent(new f.window.Event('input',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(f.document.querySelectorAll('.channel-option').length,1);
  f.click('[data-action="channel-filter"][data-filter="suggested"]');
  assert.match(f.document.querySelector('#channel-results').textContent,/Try All channels/);
});

test("clicking episode rows toggles selection once and retains list position", async (t) => {
  const f=await fixture(t);
  f.document.querySelector('.episode-table').scrollTop=480;
  f.click('tbody tr .episode-copy');
  assert.match(f.document.querySelector('.selection-bar').textContent,/2 episodes selected/);
  assert.equal(f.document.querySelector('.episode-table').scrollTop,480);
  f.click('tbody tr input');
  assert.match(f.document.querySelector('.selection-bar').textContent,/3 episodes selected/);
  assert.equal(f.document.querySelector('.episode-table').scrollTop,480);
  f.click('.sidebar-toggle');
  assert.equal(f.document.querySelector('#app').classList.contains('sidebar-collapsed'),true);
  assert.equal(f.document.querySelector('.sidebar-toggle').getAttribute('aria-expanded'),'false');
  f.click('.sidebar-toggle');
  assert.equal(f.document.querySelector('#app').classList.contains('sidebar-collapsed'),false);
});
test("season navigation scrolls overflowing tabs and keyboard End reaches the last season", async (t) => {
  const items=Array.from({length:20},(_,i)=>parseEpisode({id:String(i),filename:'Show.S'+String(i+1).padStart(2,'0')+'E01.720p.x265.mkv',size:100}));
  const f=await fixture(t,{catalogue:{channel:{id:'1',title:'Show'},items}});
  const tabs=f.document.querySelector('.season-tabs');
  Object.defineProperties(tabs,{clientWidth:{value:300},scrollWidth:{value:2000}});
  f.window.dispatchEvent(new f.window.Event('resize'));
  await new Promise(resolve => setTimeout(resolve, 20));
  f.click('.season-next');
  assert.equal(tabs.scrollLeft,225);
  f.document.querySelector('[data-action="season"]').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));
  assert.equal(f.document.querySelector('.season-tab.active').dataset.season,'20');
  assert.equal(f.document.activeElement.id,'season-20');
  assert.equal(f.document.querySelector('#episode-list').getAttribute('aria-labelledby'),'season-20');
});
test("saved files show actual basename and expose original name and real path in details", async (t) => {
  const item=parseEpisode({id:'1',filename:'Show.S01E01.720p.x265.mkv',size:100});
  const finalPath='C:/Shows/Old Show/Season 01/Old Show - S01E01 - 720p HEVC.mkv';
  const f=await fixture(t,{jobs:[{id:'job1',series:'Show',item,status:'complete',received:100,mode:'archive',finalPath}]});
  f.click('[data-page="queue"]');
  f.click('[data-action="download-tab"][data-tab="finished"]');
  assert.equal(f.document.querySelector('.queue-filename').textContent,'Old Show - S01E01 - 720p HEVC.mkv');
  assert.equal(f.document.querySelector('.job-path'),null);
  f.click('[data-action="file-details"]');
  assert.ok(f.document.querySelector('#dialog').textContent.includes(finalPath));
  assert.ok(f.document.querySelector('#dialog').textContent.includes(item.filename));
  f.click('[data-action="reveal-job"]');
  assert.equal(f.calls.find(c=>c.method==='reveal-job').payload.id,'job1');
});

test("keyword editor saves user terms and archive files offer Recycle Bin deletion", async (t) => {
  const f=await fixture(t);
  f.click('[data-action="nav"][data-page="settings"]');
  const input=f.document.querySelector('#hidden-keywords');
  assert.match(input.value,/gold/);
  input.value='gold, custom channel';
  f.document.querySelector('#keyword-form').dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#hidden-keywords').value,'gold\ncustom channel');
  assert.ok(f.document.querySelector('#usage-summary'));
  f.click('[data-action="reset-keywords"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(f.document.querySelector('#hidden-keywords').value,/signals/);
  const item=parseEpisode({id:'1',filename:'Show.S01E01.720p.x265.mkv',size:100});
  const live=await fixture(t,{jobs:[{id:'1',item,series:'Show',status:'complete',mode:'archive',finalPath:'C:/Show/file.mkv'}]});
  live.click('[data-page="queue"]');
  live.click('[data-action="download-tab"][data-tab="finished"]');
  live.click('[data-action="file-details"]');
  live.click('[data-action="delete-job"]');
  assert.equal(live.calls.find(c=>c.method==='delete-job').payload.id,'1');
});

test("single season and episode labels are grammatical and controls wrap only essential filters", async t => {
  const item=parseEpisode({id:"1",filename:"Show.S01E01.720p.x265.mkv",size:100});
  const f=await fixture(t,{catalogue:{channel:{id:"1",title:"Dracula"},items:[item]}});
  assert.match(f.document.querySelector('.panel-title').textContent,/1 season found/);
  assert.match(f.document.querySelector('.panel-title').textContent,/1 matching episode/);
  assert.ok(!f.document.querySelector('.panel-title').textContent.includes('1 seasons'));
  f.click('[data-action="select-season"]');
  assert.match(f.document.querySelector('.selection-bar').textContent,/1 episode selected/);
  assert.ok(f.document.querySelector('.library-controls .quality-toolbar'));
  assert.ok(f.document.querySelector('.library-controls .season-tabs'));
  assert.equal(f.document.querySelector('.library-controls .page-heading'),null);
});
test("bulk actions and unused-partial settings are discoverable", async t => {
  const f=await fixture(t);
  f.click('[data-action="download"]');
  f.click('[data-action="delete-all-queue"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,0);
  f.click('[data-action="nav"][data-page="settings"]');
  assert.ok(f.document.querySelector('[data-action="scan-staging"]'));
  assert.ok(f.document.querySelector('[data-action="cleanup-staging"]').disabled);
});

test("appearance applies across pages and reset restores theme colours", async (t) => {
  const f = await fixture(t);
  f.click('[data-page="settings"]');
  const form=f.document.querySelector('#appearance-form');
  form.elements.size.value='120';
  form.elements.weight.value='500';
  form.elements.accent.value='#5533aa';
  form.elements.accent.dispatchEvent(new f.window.Event('input',{bubbles:true}));
  assert.equal(form.elements.autoAccent.checked,false);
  assert.equal(f.document.documentElement.style.getPropertyValue('--accent'),'#5533aa');
  form.dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.documentElement.style.getPropertyValue('--font-scale'),'1.2');
  assert.equal(f.document.documentElement.style.getPropertyValue('--accent'),'#5533aa');
  f.click('[data-page="library"]');
  assert.equal(f.document.documentElement.style.getPropertyValue('--font-weight'),'500');
  f.click('[data-page="settings"]');
  f.click('[data-action="reset-appearance"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.documentElement.style.getPropertyValue('--font-scale'),'1');
  assert.equal(f.document.documentElement.style.getPropertyValue('--accent'),'');
});

test("discovery sends only a submitted query and continues after explicit result selection", async (t) => {
  const f=await fixture(t,{settings:{theme:"dark"},channels:[],jobs:[]},async(method)=>{
    if(method==='discovery-source') return {source:{id:'source-token',title:'MovieClubFamily Chat',linked:true}};
    if(method==='discovery-search') return {messages:[{text:'Choose a result',links:[{id:'choice',label:'Banshee',kind:'public-peer'}]}]};
    if(method==='discovery-follow') return {channel:{id:'choice',title:'Banshee'}};
    if(method==='discovery-join') return {channel:{id:'joined'},channels:[]};
    if(method==='scan') return {channel:{id:'joined',title:'Banshee'},items:[]};
    return [];
  });
  f.click('[data-action="choose-series"]');
  f.click('[data-action="discover"]');
  assert.equal(f.calls.some(call=>call.method==='discovery-search'),false);
  assert.equal(f.document.querySelector('#discovery-form'),null);
  f.click('[data-action="discovery-source"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(f.document.querySelector('#dialog').textContent,/Other members can see it/);
  const form=f.document.querySelector('#discovery-form');
  form.elements.query.value='Banshee';
  form.dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.calls.find(call=>call.method==='discovery-search').payload.query,'Banshee');
  assert.equal(f.calls.find(call=>call.method==='discovery-search').payload.sourceId,'source-token');
  f.click('[data-action="discovery-follow"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(f.calls.some(call=>call.method==='discovery-join'));
  assert.ok(f.calls.some(call=>call.method==='scan'));
  assert.equal(f.document.querySelector('#dialog').open,false);
  assert.match(f.document.querySelector('.library-panel h2').textContent,/Banshee/);
});

test("discovery failures replace the waiting overlay with an actionable visible error",async(t)=>{
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs:[]},async(method)=>{
    if(method==='discovery-source') throw new Error('Telegram request failed');
    return [];
  });
  f.click('[data-action="choose-series"]');f.click('[data-action="discover"]');f.click('[data-action="discovery-source"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#dialog').open,true);
  assert.match(f.document.querySelector('#dialog [role="alert"]').textContent,/Telegram request failed/);
  assert.ok(f.document.querySelector('#dialog [data-action="choose-series"]'));
});

test("all pages keep their heading outside the scroll pane and retain position on updates", async (t) => {
  const f=await fixture(t);
  for (const page of ['queue','settings','help']) {
    f.click('[data-page="'+page+'"]');
    const pane=f.document.querySelector('.workspace-scroll');
    const heading=f.document.querySelector('.simple-heading');
    assert.ok(f.document.querySelector('.workspace-shell'));
    assert.ok(pane);assert.ok(heading);
    assert.equal(pane.contains(heading),false);
    pane.scrollTop=240;
    f.click('[data-action="theme"]');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(f.document.querySelector('.workspace-scroll').scrollTop,240);
  }
  f.click('[data-page="settings"]');
  assert.doesNotMatch(f.document.querySelector('main').textContent,/Start with 2|Compare performance|npm start/);
});

test("account button opens an anchored popup with logout without navigating",async(t)=>{
  const f=await fixture(t,{settings:{theme:'dark'},profile:{name:'Anonymous',username:'D3M0NHA2H'},jobs:[],channels:[]});
  f.click('.profile');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#account-popover').hidden,false);
  assert.ok(f.document.querySelector('.library-shell'));
  assert.match(f.document.querySelector('#account-popover').textContent,/@D3M0NHA2H/);
  assert.ok(f.document.querySelector('#account-popover [data-action="disconnect"]'));
  f.document.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#account-popover').hidden,true);
  assert.equal(f.document.activeElement,f.document.querySelector('.profile'));
  f.click('.profile');
  await new Promise(resolve=>setTimeout(resolve,0));
  f.click('[data-page="settings"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#account-popover').hidden,true);
  assert.doesNotMatch(f.document.querySelector('main').textContent,/shade of dark|Anonymous \? @/);
});

test('unverified files are selectable in the library without entering the verified quality list',async t=>{
  const item=parseEpisode({id:'42',filename:'Unknown.release.mkv',size:123,peer:{id:'1'}});
  const f=await fixture(t,{settings:{theme:'dark',archiveRoot:{id:'root',path:'D:/Shows'}},channels:[],jobs:[],catalogue:{channel:{id:'1',title:'Show'},items:[item]}},async method=>method==='enqueue'?['job']:[]);
  assert.equal(f.document.querySelector('.unverified-files'),null);
  f.click('[data-action="library-tab"][data-tab="unverified"]');
  assert.ok(f.document.querySelector('.unverified-files'));
  assert.equal(f.document.querySelector('[data-action="review"]'),null);
  f.click('.unverified-files input');
  assert.equal(f.document.querySelector('[data-action="download"]').disabled,false);
  f.click('[data-action="download"]');await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(Array.from(f.calls.find(call=>call.method==='enqueue').payload.unverifiedIds),['42']);
});

test('downloads group active and queued work first; saved files show newest completions first',async t=>{
  const job=(id,status,createdAt,completedAt)=>({id,series:'Show',status,createdAt,completedAt,mode:'archive',item:{filename:id,size:100,season:1,episode:1}});
  const jobs=[
    job('old-completion','complete','2026-01-09','2026-01-10'),
    job('queued-old','queued','2026-01-01'),
    job('paused','paused','2026-01-12'),
    job('active','downloading','2026-01-02'),
    job('new-completion','complete','2026-01-01','2026-01-11'),
    job('queued-new','queued','2026-01-03'),
    job('checking','checking','2026-01-04'),
    job('legacy','complete','2025-12-01'),
    job('undated','complete','invalid'),
    job('deleted','deleted','2026-01-13'),
    job('missing','missing','2026-01-13'),
  ];
  const originalOrder=jobs.map(job=>job.id);
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs});
  const filenames=()=>Array.from(f.document.querySelectorAll('.queue-filename'),element=>element.textContent);
  f.click('[data-page="queue"]');
  assert.deepEqual(filenames(),['checking','active','queued-new','queued-old','paused']);
  f.click('[data-page="queue"]');
  f.click('[data-action="download-tab"][data-tab="finished"]');
  assert.deepEqual(filenames(),['new-completion','old-completion','legacy','undated']);
  assert.deepEqual(jobs.map(job=>job.id),originalOrder);
});

test('Finished removes history separately from disk deletion and Downloads defaults to Ongoing',async t=>{
  const item=parseEpisode({id:'1',filename:'Show.S01E01.720p.x265.mkv',size:100});
  const f=await fixture(t,{jobs:[{id:'done',series:'Show',item,status:'complete',mode:'archive',finalPath:'C:/Show/file.mkv'}]},async()=>[]);
  f.click('[data-page="queue"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,0);
  assert.equal(f.document.querySelector('[data-page="saved"]'),null);
  f.click('[data-action="download-tab"][data-tab="finished"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,1);
  assert.equal(f.document.querySelector('.queue-item [data-action="delete-job"]'),null);
  f.click('.queue-item [data-action="remove-history"]');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(f.calls.filter(c=>c.method==='remove-history').map(c=>c.payload.id),['done']);
  assert.equal(f.calls.some(c=>c.method==='delete-job'),false);
  assert.equal(f.document.querySelectorAll('.queue-item').length,0);
  f.click('[data-page="library"]');
  f.click('[data-page="queue"]');
  assert.equal(f.document.querySelector('[data-tab="ongoing"]').getAttribute('aria-selected'),'true');
});

test('completed live downloads move from Ongoing into Finished',async t=>{
  const item=parseEpisode({id:'1',filename:'Show.S01E01.720p.x265.mkv',size:100});
  const job={id:'live',series:'Show',item,status:'downloading',mode:'archive'};
  const f=await fixture(t,{jobs:[job]});
  f.click('[data-page="queue"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,1);
  f.emit({type:'queue',data:[{...job,status:'complete',finalPath:'C:/Show/file.mkv'}]});
  assert.equal(f.document.querySelectorAll('.queue-item').length,0);
  f.click('[data-action="download-tab"][data-tab="finished"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,1);
  assert.equal(f.document.querySelector('.queue-filename').textContent,'file.mkv');
});

test('saved files hide deleted and missing history and show an empty state',async t=>{
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs:[{status:'deleted'},{status:'missing'}]});
  f.click('[data-page="queue"]');
  f.click('[data-action="download-tab"][data-tab="finished"]');
  assert.equal(f.document.querySelectorAll('.queue-item').length,0);
  assert.ok(f.document.querySelector('.empty-state'));
});

test('first-run guide persists dismissal and updates use readable status in About',async t=>{
  const f=await fixture(t,{firstRun:true,version:'0.1.0',settings:{theme:'dark'},channels:[],jobs:[]},async method=>method==='update-status'?{state:'unpublished',message:'No published versions on GitHub'}:{});
  assert.match(f.document.querySelector('#dialog').textContent,/Welcome to Season Shelf/);
  f.click('[data-action="finish-onboarding"]');await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#dialog').open,false);
  assert.ok(f.calls.some(c=>c.method==='finish-onboarding'));
  f.click('[data-page="settings"]');await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(f.document.querySelector('#update-status').textContent,/first release/);
  assert.doesNotMatch(f.document.querySelector('main').textContent,/No published versions|ENOENT/);
  assert.equal(f.document.querySelector('.settings-group:last-child h2').textContent,'About');
});

test('themed confirmation close cancels and saved login fills all three fields',async t=>{
  const f=await fixture(t,{settings:{theme:'dark'},jobs:[],channels:[]},async(method)=>method==='login-suggestions'?[{id:'saved',phone:'***6789',apiId:12}]:method==='login-suggestion'?{apiId:12,apiHash:'a'.repeat(32),phone:'+94123456789'}:{});
  f.emit({type:'confirmation',data:{id:'token',title:'Delete file?',message:'Move file?',detail:'Media will go to Recycle Bin.',buttons:['Keep','Delete']}});
  assert.ok(f.document.querySelector('[data-action="confirmation-reply"]'));
  f.click('[data-action="close-dialog"]');await new Promise(r=>setTimeout(r,0));
  assert.equal(f.calls.find(c=>c.method==='confirmation-reply').payload.response,0);
  f.click('.profile');f.click('[data-action="disconnect"]');await new Promise(r=>setTimeout(r,0));
  f.click('.profile');f.click('#account-popover [data-action="connect"]');await new Promise(r=>setTimeout(r,0));
  f.click('[data-action="use-login"]');await new Promise(r=>setTimeout(r,0));
  const form=f.document.querySelector('#connect-form');assert.equal(form.elements.apiId.value,'12');assert.equal(form.elements.apiHash.value,'a'.repeat(32));assert.equal(form.elements.phone.value,'+94123456789');
});

test('missing history has no navigation badge and an empty batch hides its progress track',async t=>{
  const f=await fixture(t,{settings:{theme:'dark'},jobs:[{status:'missing'}],channels:[]});
  assert.equal(f.document.querySelector('.nav-count'),null);f.click('[data-page="queue"]');assert.equal(f.document.querySelector('.batch-progress').hidden,true);
  f.click('[data-page="settings"]');assert.deepEqual(Array.from(f.document.querySelectorAll('.settings-group > h2'),e=>e.textContent),['Appearance','Downloads and storage','Channel filtering','Data and activity','About']);
  assert.equal(f.document.querySelector('#account-popover [data-page="settings"]'),null);
});

test('empty and unverified-only channels keep quality, tab and search controls in stable slots',async t=>{
  for(const items of [[],[parseEpisode({id:'u',filename:'Unknown.mkv',size:123,peer:{id:'1'}})]]) {
    const f=await fixture(t,{settings:{theme:'dark'},jobs:[],channels:[],catalogue:{channel:{id:'1',title:'Empty channel'},items}});
    for(const tab of ['verified','unverified']) {
      f.click(`[data-tab="${tab}"]`);
      assert.ok(f.document.querySelector('.library-controls > .quality-area > .quality-empty'));
      assert.ok(f.document.querySelector('.library-controls > .library-list-switch'));
      assert.ok(f.document.querySelector('.library-controls > .catalogue-tools .table-search'));
    }
  }
});

test('disabled schedule retains chosen hours and enabling it restores both time inputs',async t=>{
  const f=await fixture(t,{settings:{theme:'dark',transfer:{speedKiB:200,scheduled:false,start:'22:30',end:'06:15'}},jobs:[],channels:[]},async(method,payload)=>method==='settings'?payload:{});
  f.click('[data-page="settings"]');await new Promise(r=>setTimeout(r,0));
  let form=f.document.querySelector('#transfer-form');assert.equal(form.querySelector('.schedule-times').disabled,true);
  form.dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));
  const saved=f.calls.find(c=>c.method==='settings').payload.transfer;
  assert.equal(saved.start,'22:30');assert.equal(saved.end,'06:15');assert.equal(saved.scheduled,false);
  form=f.document.querySelector('#transfer-form');f.click('[name="scheduled"]');assert.equal(form.querySelector('.schedule-times').disabled,false);
});

test('update check button shows loading until completion and displays the last check',async t=>{
  let finish;const f=await fixture(t,{version:'1.0.0',settings:{theme:'dark'},channels:[],jobs:[]},async method=>method==='update-check'?new Promise(resolve=>finish=resolve):{state:'idle'});
  f.click('[data-page="settings"]');await new Promise(r=>setTimeout(r,0));
  assert.match(f.document.querySelector('.update-last-checked').textContent,/Never/);
  f.click('[data-action="update-check"]');
  assert.equal(f.document.querySelector('[data-action="update-check"]').disabled,true);
  assert.ok(f.document.querySelector('.update-spinner'));
  finish({state:'current',lastCheckedAt:'2026-09-14T10:00:00.000Z'});await new Promise(r=>setTimeout(r,0));
  assert.equal(f.document.querySelector('[data-action="update-check"]').disabled,false);
  assert.equal(f.document.querySelector('.update-spinner'),null);
  assert.doesNotMatch(f.document.querySelector('.update-last-checked').textContent,/Never/);
  assert.match(f.document.body.textContent,/MIT License/);
});

test('development updates explain why checks are unavailable without a misleading timestamp',async t=>{
  const f=await fixture(t,{version:'1.0.0',settings:{theme:'dark'},channels:[],jobs:[]},async()=>({state:'development'}));
  f.click('[data-page="settings"]');await new Promise(r=>setTimeout(r,0));
  assert.equal(f.document.querySelector('[data-action="update-check"]').disabled,true);
  assert.equal(f.document.querySelector('.update-last-checked'),null);
  assert.match(f.document.querySelector('#update-status').textContent,/disabled in development/);
});

test('React shell updates queue badges without replacing focused page controls', async t => {
  const f = await fixture(t, { settings: { theme: 'dark' }, jobs: [], channels: [] });
  f.click('[data-page="settings"]');
  const input = f.document.querySelector('input');
  assert.ok(input);
  input.focus();
  const before = f.document.querySelector('main').firstChild;
  const job = { id: 'active', status: 'downloading', item: { filename: 'episode.mkv', size: 100 } };
  f.emit({ type: 'queue', data: [job] });
  assert.equal(f.document.querySelector('.nav-count').textContent, '1');
  assert.equal(f.document.activeElement, input);
  assert.equal(f.document.querySelector('main').firstChild, before);
  f.emit({ type: 'queue', data: [] });
  assert.equal(f.document.querySelector('.nav-count'), null);
  assert.equal(f.document.activeElement, input);
});

test('React shell renders account names as text and preserves navigation focus', async t => {
  const name = '<img src=x onerror=alert(1)>';
  const f = await fixture(t, { settings: { theme: 'dark' }, jobs: [], channels: [], profile: { name } });
  assert.equal(f.document.querySelector('.profile strong').textContent, name);
  assert.equal(f.document.querySelector('.profile img'), null);
  const settings = f.document.querySelector('[data-page="settings"]');
  settings.focus();
  settings.click();
  assert.equal(f.document.activeElement, settings);
  assert.match(settings.className, /active/);
});

test('React download rows retain DOM, focus and scroll through live progress updates', async t => {
  const job = { id: 'live', series: 'Show', status: 'downloading', mode: 'archive', received: 10, item: { filename: 'Show.S01E01.mkv', size: 100, season: 1, episode: 1 } };
  const f = await fixture(t, { jobs: [job], channels: [], settings: { theme: 'dark' } });
  f.click('[data-page="queue"]');
  const row = f.document.querySelector('[data-download-id="live"]');
  const control = row.querySelector('[data-control="pause"]');
  const pane = f.document.querySelector('.workspace-scroll');
  control.focus();
  pane.scrollTop = 120;
  f.emit({ type: 'queue', data: [{ ...job, received: 60, speed: 20 }] });
  assert.equal(f.document.querySelector('[data-download-id="live"]'), row);
  assert.equal(f.document.activeElement, control);
  assert.equal(row.querySelector('progress').value, 60);
  assert.equal(pane.scrollTop, 120);
});

test('Download tabs support keyboard navigation and reset the view scroll', async t => {
  const f = await fixture(t);
  f.click('[data-page="queue"]');
  const ongoing = f.document.querySelector('[data-tab="ongoing"]');
  const finished = f.document.querySelector('[data-tab="finished"]');
  ongoing.focus();
  f.document.querySelector('.workspace-scroll').scrollTop = 120;
  ongoing.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(f.document.activeElement, finished);
  assert.equal(finished.getAttribute('aria-selected'), 'true');
  assert.equal(ongoing.tabIndex, -1);
  assert.equal(f.document.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'), finished.id);
  assert.equal(f.document.querySelector('.workspace-scroll').scrollTop, 0);
  finished.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(f.document.activeElement, ongoing);
  assert.equal(ongoing.getAttribute('aria-selected'), 'true');
});

test('Download actions send one request while pending and recover from errors', async t => {
  const job = { id: 'live', series: 'Show', status: 'downloading', mode: 'archive', item: { filename: 'episode.mkv', size: 100 } };
  let reject;
  const f = await fixture(t, { jobs: [job], settings: { theme: 'dark' } }, () => new Promise((_resolve, fail) => { reject = fail; }));
  f.click('[data-page="queue"]');
  const button = f.document.querySelector('.queue-item [data-control="pause"]');
  button.click();
  button.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  f.emit({ type: 'queue', data: [{ ...job, received: 50 }] });
  button.click();
  assert.equal(f.calls.filter(call => call.method === 'queue-control').length, 1);
  reject(new Error('Connection temporarily unavailable'));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(button.disabled, false);
  assert.match(f.document.querySelector('#toast').textContent, /Connection temporarily unavailable/);
  assert.equal(f.document.querySelector('progress[aria-label^="Download progress"]').value, 50);
});

test('Saving phase explains disk transfer and prevents clearing finishing files', async t => {
  const f = await fixture(t, { jobs: [{ id: 'saving', series: 'Show', status: 'transferring', mode: 'archive', received: 100, item: { filename: 'episode.mkv', size: 100 } }] });
  f.click('[data-page="queue"]');
  assert.equal(f.document.querySelector('.status').textContent, 'Saving to disk');
  assert.match(f.document.querySelector('.download-phase').textContent, /next download can start/);
  assert.equal(f.document.querySelector('[data-action="delete-all-queue"]').disabled, true);
  assert.equal(f.document.querySelector('.queue-item [data-control="remove"]'), null);
});

test('React library search retains its input and caret while filtering rows', async t => {
  const f = await fixture(t);
  const input = f.document.querySelector('#episode-search');
  input.focus();
  input.value = 'Episode 5';
  input.setSelectionRange(4, 4);
  input.dispatchEvent(new f.window.Event('input', { bubbles: true }));
  assert.equal(f.document.querySelector('#episode-search'), input);
  assert.equal(f.document.activeElement, input);
  assert.equal(input.selectionStart, 4);
  assert.equal(f.document.querySelectorAll('[data-episode-row]').length, 1);
  assert.match(f.document.querySelector('[data-episode-row]').textContent, /Episode 5/);
});

test('React library retains selected rows and exposes partial selection', async t => {
  const f = await fixture(t);
  const row = f.document.querySelector('[data-episode-row]');
  const checkbox = row.querySelector('input');
  const all = f.document.querySelector('#select-all');
  assert.equal(all.indeterminate, true);
  checkbox.focus();
  checkbox.click();
  assert.equal(f.document.querySelector('[data-episode-row]'), row);
  assert.equal(f.document.activeElement, checkbox);
  assert.equal(checkbox.checked, false);
  assert.match(f.document.querySelector('.selection-bar').textContent, /2 episodes selected/);
  all.click();
  assert.equal(all.checked, true);
  assert.equal(all.indeterminate, false);
  assert.match(f.document.querySelector('.selection-bar').textContent, /8 episodes selected/);
  all.click();
  assert.match(f.document.querySelector('.selection-bar').textContent, /0 episodes selected/);
  assert.equal(all.indeterminate, false);
});

test('Settings retain unsaved form values and focus during usage and update events', async t => {
  const f=await fixture(t,{settings:{theme:'dark',transfer:{start:'22:00',end:'06:00'}},jobs:[],channels:[]},async()=>({state:'idle'}));
  f.click('[data-page="settings"]');await new Promise(r=>setTimeout(r,0));
  const input=f.document.querySelector('[name="speedKiB"]');
  const keywords=f.document.querySelector('#hidden-keywords');
  input.value='777'; keywords.value='unsaved filter'; input.focus();
  f.emit({type:'usage',data:{payloadBytes:2097152,publishedBytes:0,completedFiles:0}});
  f.emit({type:'updates',data:{state:'current'}});
  assert.equal(f.document.querySelector('[name="speedKiB"]'),input);
  assert.equal(input.value,'777'); assert.equal(keywords.value,'unsaved filter');
  assert.equal(f.document.activeElement,input);
  assert.match(f.document.querySelector('#usage-summary').textContent,/2.0 MB/);
});

test('Settings failed saves preserve drafts and prevent duplicate submissions', async t => {
  let reject;
  const f=await fixture(t,{settings:{theme:'dark'},jobs:[],channels:[]},async method=>method==='settings'?new Promise((_resolve,fail)=>{reject=fail;}):{state:'idle'});
  f.click('[data-page="settings"]');await new Promise(r=>setTimeout(r,0));
  const form=f.document.querySelector('#keyword-form');
  form.elements.keywords.value='keep this draft';
  for(let i=0;i<2;i++)form.dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,0));
  assert.equal(f.calls.filter(c=>c.method==='settings').length,1);
  assert.equal(form.querySelector('[type="submit"]').disabled,true);
  reject(new Error('Could not save preferences'));
  await new Promise(r=>setTimeout(r,20));
  assert.equal(form.elements.keywords.value,'keep this draft');
  assert.equal(form.querySelector('[type="submit"]').disabled,false);
  assert.match(f.document.querySelector('#toast').textContent,/Could not save preferences/);
});

test('React confirmation Escape cancels once and treats server text as text', async t => {
  const f=await fixture(t,{settings:{theme:'dark'},jobs:[],channels:[]},async()=>({}));
  f.emit({type:'confirmation',data:{id:'confirm',title:'<img src=x>',message:'Keep or remove?',detail:'Completed files stay on disk.',buttons:['Keep','Remove']}});
  const dialog=f.document.querySelector('#dialog');
  assert.equal(dialog.querySelector('h2').textContent,'<img src=x>');
  assert.equal(dialog.querySelector('img'),null);
  assert.equal(dialog.getAttribute('aria-labelledby'),dialog.querySelector('h2').id);
  dialog.dispatchEvent(new f.window.Event('cancel',{cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(dialog.open,false);
  assert.deepEqual(f.calls.filter(c=>c.method==='confirmation-reply').map(c=>({id:c.payload.id,response:c.payload.response})),[{id:'confirm',response:0}]);
});

test('Closing discovery ignores a late response instead of reopening the dialog', async t => {
  let finish;
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs:[]},async method=>method==='discovery-source'?new Promise(resolve=>{finish=resolve;}):{});
  f.click('[data-action="choose-series"]');f.click('[data-action="discover"]');f.click('[data-action="discovery-source"]');
  f.click('[data-action="close-dialog"]');await new Promise(resolve=>setTimeout(resolve,0));
  finish({source:{id:'late',title:'Late group'}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#dialog').open,false);
  assert.equal(f.document.querySelector('#discovery-form'),null);
  assert.equal(f.calls.filter(c=>c.method==='discovery-cancel').length,1);
});

test('Closing an authentication prompt cancels it and removes credential controls', async t => {
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs:[]},async()=>({}));
  f.emit({type:'auth-prompt',data:{id:'auth',label:'Two-step verification',kind:'password'}});
  f.document.querySelector('#auth-form input').value='test-only-secret';
  f.click('[data-action="close-dialog"]');await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.document.querySelector('#auth-form'),null);
  assert.equal(f.document.querySelector('#dialog').open,false);
  assert.deepEqual(f.calls.filter(c=>c.method==='auth-reply').map(c=>({id:c.payload.id,cancel:c.payload.cancel})),[{id:'auth',cancel:true}]);
});
