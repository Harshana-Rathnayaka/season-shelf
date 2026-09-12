import test from 'node:test';
import assert from 'node:assert/strict';
import {SeriesWatcher} from '../src/desktop/watch-series.mjs';
import {parseEpisode} from '../src/core/catalog.mjs';
test('series watch detects new matching files once and queues only when opted in',async t=>{
  const values={};const notices=[],queued=[];
  const item=id=>parseEpisode({id:String(id),filename:`Show.S01E0${id}.720p.x265.mkv`,size:100,peer:{id:'1'}});
  const channel={id:'1',title:'Show'};
  const watcher=new SeriesWatcher({store:{get:(k,d)=>values[k]??d,set:(k,v)=>{values[k]=v;}},adapter:{connected:true,scan:async(c,options)=>({channel,items:[item(2)].filter(i=>+i.id>options.minId)})},queue:{jobs:[],add:async value=>queued.push(value)},notify:value=>notices.push(value)});
  t.after(()=>watcher.stop());
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:false});
  await watcher.check();await watcher.check();assert.equal(notices.length,1);assert.equal(queued.length,0);
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:true},{id:'root'});
  await watcher.check();assert.equal(queued.length,1);assert.equal(queued[0].items[0].id,'2');
  watcher.queue.jobs.push({mode:'archive',status:'paused',item:item(2)});
  watcher.set({channel,items:[item(1)]},{mode:'archive',quality:{},automatic:true},{id:'root'});
  await watcher.check();assert.equal(queued.length,1);
  watcher.set({channel,items:[]},{mode:'archive',quality:{},automatic:null});assert.equal(watcher.watches.length,0);
});
