import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {ShutdownWhenDone,requestWindowsShutdown} from '../src/desktop/shutdown.mjs';

function fixture(t,{jobs=[{id:'one',status:'downloading'}],execute,countdownSeconds=3,supported=true}={}) {
  const queue={jobs,running:new Map(),tasks:new Map(),removals:new Map(),namingLocks:new Set()};
  let time=0,calls=0,busy=false;const updates=[];
  const controller=new ShutdownWhenDone({queue,supported,countdownSeconds,now:()=>time,isBusy:()=>busy,
    execute:execute||(()=>{calls++;}),notify:state=>updates.push(state)});
  t.after(()=>controller.cancel());
  return {controller,queue,updates,get calls(){return calls;},advance(ms=1000){time+=ms;return controller.check();},set busy(value){busy=value;}};
}

test('shutdown is off by default and cannot arm an empty or completed queue',t=>{
  const f=fixture(t,{jobs:[]});assert.equal(f.controller.snapshot().enabled,false);
  assert.throws(()=>f.controller.setEnabled(true),/Add downloads/);
  f.queue.jobs=[{id:'old',status:'complete'}];assert.throws(()=>f.controller.setEnabled(true),/Add downloads/);
  assert.equal(f.calls,0);assert.throws(()=>f.controller.setEnabled('true'),/Choose whether/);
});

test('paused, failed, scheduled, retrying and unfinished disk phases all block shutdown',t=>{
  const f=fixture(t);f.controller.setEnabled(true);
  for(const status of ['queued','paused','failed','waiting','retrying','checking','transferring','removing']) {
    f.queue.jobs[0].status=status;
    for(let n=0;n<5;n++)assert.equal(f.advance().phase,'waiting');
  }
  assert.equal(f.calls,0);
});

test('completion waits for lifecycle tasks, removals, naming, recovery and other app work',t=>{
  const f=fixture(t);f.controller.setEnabled(true);f.queue.jobs[0].status='complete';
  for(const map of [f.queue.running,f.queue.tasks,f.queue.removals]) {
    map.set('one',{});assert.equal(f.advance().phase,'waiting');map.clear();
  }
  f.queue.namingLocks.add('season');assert.equal(f.advance().phase,'waiting');f.queue.namingLocks.clear();
  for(const flag of ['recovering','batching','stopped']){f.queue[flag]=true;assert.equal(f.advance().phase,'waiting');f.queue[flag]=false;}
  f.busy=true;assert.equal(f.advance().phase,'waiting');f.busy=false;
  f.queue.jobs[0].namingError='Collision';assert.equal(f.advance().phase,'waiting');delete f.queue.jobs[0].namingError;
  f.queue.jobs[0].renamePending={};assert.equal(f.advance().phase,'waiting');delete f.queue.jobs[0].renamePending;
  assert.equal(f.advance().phase,'countdown');assert.equal(f.calls,0);
});

test('all saved files start a warning countdown and request shutdown once after it expires',async t=>{
  const f=fixture(t);f.controller.setEnabled(true);f.queue.jobs[0].status='complete';
  assert.equal(f.advance().remainingSeconds,3);
  assert.equal(f.advance().remainingSeconds,2);assert.equal(f.calls,0);
  assert.equal(f.advance().remainingSeconds,1);assert.equal(f.calls,0);
  assert.equal(f.advance().phase,'requested');await f.controller.execution;
  assert.equal(f.calls,1);f.advance();assert.equal(f.calls,1);
  assert.throws(()=>f.controller.setEnabled(false),/already been requested/);
});

test('cancelling the countdown or clearing unfinished downloads never requests shutdown',t=>{
  const f=fixture(t);f.controller.setEnabled(true);f.queue.jobs[0].status='complete';f.advance();
  f.controller.setEnabled(false);for(let n=0;n<5;n++)f.advance();assert.equal(f.calls,0);
  f.queue.jobs=[{id:'next',status:'queued'}];f.controller.setEnabled(true);f.queue.jobs=[];
  assert.equal(f.advance().enabled,false);assert.match(f.controller.snapshot().message,/removed or cancelled/);
  assert.equal(f.calls,0);
});

test('adding work during the countdown waits for it and starts a fresh countdown',t=>{
  const f=fixture(t);f.controller.setEnabled(true);f.queue.jobs[0].status='complete';f.advance();f.advance();
  f.queue.jobs.push({id:'two',status:'queued'});assert.equal(f.advance().phase,'waiting');
  f.queue.jobs[1].status='complete';assert.equal(f.advance().remainingSeconds,3);assert.equal(f.calls,0);
});

test('removing an unfinished job cancels shutdown even if another job already completed',t=>{
  const f=fixture(t,{jobs:[{id:'one',status:'downloading'},{id:'two',status:'queued'}]});f.controller.setEnabled(true);
  f.queue.jobs[0].status='complete';f.advance();f.queue.jobs.pop();
  assert.equal(f.advance().enabled,false);assert.equal(f.calls,0);
});

test('resumed work and notification failures cannot bypass the unfinished-download guard',t=>{
  const f=fixture(t);f.controller.notify=()=>{throw Error('Notifications unavailable');};
  assert.doesNotThrow(()=>f.controller.setEnabled(true));
  f.queue.jobs[0].status='complete';f.advance();f.queue.jobs[0].status='queued';
  assert.equal(f.advance().phase,'waiting');assert.equal(f.calls,0);
});

test('sleep and clock jumps cannot skip the cancellation period',t=>{
  const f=fixture(t,{countdownSeconds:60});f.controller.setEnabled(true);f.queue.jobs[0].status='complete';f.advance();
  assert.equal(f.advance(3600000).remainingSeconds,58);assert.equal(f.calls,0);
});

test('unsupported platforms reject enabling and native failures are visible without retries',async t=>{
  const unsupported=fixture(t,{supported:false});assert.throws(()=>unsupported.controller.setEnabled(true),/available on Windows/);
  let calls=0;const f=fixture(t,{execute:async()=>{calls++;throw Error('Denied');}});
  f.controller.setEnabled(true);f.queue.jobs[0].status='complete';for(let n=0;n<4;n++)f.advance();
  await f.controller.execution;assert.equal(f.controller.snapshot().phase,'error');assert.equal(calls,1);
  f.advance();assert.equal(calls,1);
});

test('Windows uses a fixed non-forced command, no shell, and an application-owned countdown',async()=>{
  let request;
  await requestWindowsShutdown({platform:'win32',systemRoot:'C:\\Windows',run:(...args)=>{request=args;args[3](null);}});
  assert.equal(request[0],path.join('C:\\Windows','System32','shutdown.exe'));
  assert.deepEqual(request[1],['/s','/t','0']);assert.deepEqual(request[2],{windowsHide:true,shell:false});
  await assert.rejects(requestWindowsShutdown({platform:'darwin',run:()=>assert.fail('Unsupported native action')}),/available on Windows/);
});
