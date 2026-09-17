import { parseEpisode } from "../src/core/catalog.mjs";
// DOM logic tests only; JSDOM is not a browser and does not validate layout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
  const files = [
    "src/ui/icons.mjs",
    "src/ui/discovery-flow.mjs",
    "src/core/appearance.mjs",
    "src/ui/appearance.mjs",
    "src/core/catalog.mjs",
    "src/core/collection.mjs",
    "src/core/progress.mjs",
    "src/ui/demo.mjs",
    "src/ui/app.mjs",
  ];
  const code = (
    await Promise.all(files.map((file) => fs.readFile(file, "utf8")))
  )
    .map((text) =>
      text.replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""),
    )
    .join("\n");
  await window.eval(`(async () => {${code}\n})()`);
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
  const initial=summary();
  assert.match(initial,/CURRENT BATCH/);
  f.click('[data-action="bulk-job"][data-control="pause"]');
  assert.equal(f.document.querySelector('.status').textContent,'paused');
  f.click('[data-action="bulk-job"][data-control="cancel"]');
  assert.match(summary(),/0.0 MB \/ 0.0 MB/);
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
  f.click('[data-action="nav"][data-page="saved"]');
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
  live.click('[data-action="nav"][data-page="saved"]');
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
  for (const page of ['queue','saved','settings','help']) {
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
  assert.equal(f.document.querySelector('#account-popover').hidden,false);
  assert.ok(f.document.querySelector('.library-shell'));
  assert.match(f.document.querySelector('#account-popover').textContent,/@D3M0NHA2H/);
  assert.ok(f.document.querySelector('#account-popover [data-action="disconnect"]'));
  f.document.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(f.document.querySelector('#account-popover').hidden,true);
  f.click('[data-page="settings"]');
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

test('saved files hide deleted and missing history and show an empty state',async t=>{
  const f=await fixture(t,{settings:{theme:'dark'},channels:[],jobs:[{status:'deleted'},{status:'missing'}]});
  f.click('[data-page="saved"]');
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
