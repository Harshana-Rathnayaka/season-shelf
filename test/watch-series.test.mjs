import test from 'node:test';
import assert from 'node:assert/strict';
import {SeriesWatcher} from '../src/desktop/watch-series.mjs';
import {parseEpisode} from '../src/core/catalog.mjs';
test('series watch detects new matching files once and queues only when opted in',async t=>{
  const values={};const notices=[],queued=[];
  let latest=2;
  const item=id=>parseEpisode({id:String(id),filename:`Show.S01E0${id}.720p.x265.mkv`,size:100,peer:{id:'1'}});
  const channel={id:'1',title:'Show'};
  const watcher=new SeriesWatcher({store:{get:(k,d)=>values[k]??d,set:(k,v)=>{values[k]=v;}},adapter:{connected:true,scan:async(c,options)=>({channel,items:[item(latest)].filter(i=>+i.id>options.minId),lastMessageId:latest})},queue:{jobs:[],add:async value=>queued.push(value)},notify:value=>notices.push(value)});
  t.after(()=>watcher.stop());
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:false});
  await watcher.check();await watcher.check();assert.equal(notices.length,1);assert.equal(queued.length,0);
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:true},{id:'root'});
  latest=3;
  await watcher.check();assert.equal(queued.length,1);assert.equal(queued[0].items[0].id,'3');
  watcher.queue.jobs.push({mode:'archive',status:'paused',item:item(2)});
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:true},{id:'root'});
  await watcher.check();assert.equal(queued.length,1);
  watcher.set({channel,items:[]},{mode:'archive',quality:{},automatic:null});assert.equal(watcher.watches.length,0);
});
test('series watch advances past posts without matching files',async t=>{
  const values={}, seen=[];const channel={id:'1',title:'Show'};
  const watcher=new SeriesWatcher({store:{get:(key,fallback)=>values[key]??fallback,set:(key,value)=>{values[key]=value;}},adapter:{connected:true,scan:async(_channel,options)=>{seen.push(options.minId);return {channel,items:[],lastMessageId:12,scanned:3};}},queue:{jobs:[]},notify:()=>{}});
  t.after(()=>watcher.stop());
  watcher.set({channel,items:[],lastMessageId:9},{mode:'archive',quality:{},automatic:false});
  await watcher.check();await watcher.check();
  assert.deepEqual(seen,[9,12]);
});
