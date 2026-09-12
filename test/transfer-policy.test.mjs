import test from 'node:test';
import assert from 'node:assert/strict';
import {TransferPolicy,withinSchedule,cleanTransfer} from '../src/core/transfer-policy.mjs';

test('schedule supports overnight windows and validates clock and rate',()=>{
  const settings=cleanTransfer({scheduled:true,start:'22:00',end:'06:00',speedKiB:1024});
  assert.equal(withinSchedule(settings,new Date(2026,8,11,23)),true);
  assert.equal(withinSchedule(settings,new Date(2026,8,11,5)),true);
  assert.equal(withinSchedule(settings,new Date(2026,8,11,6)),false);
  assert.equal(withinSchedule(settings,new Date(2026,8,11,12)),false);
  assert.throws(()=>cleanTransfer({speedKiB:-1}));assert.throws(()=>cleanTransfer({start:'24:00'}));
});
test('shared limiter reserves bandwidth across requests and cancellation stops waits',async()=>{
  let time=0;
  const policy=new TransferPolicy({speedKiB:1},{now:()=>time,wait:async ms=>{time+=ms;}});
  const signal=new AbortController().signal;
  await policy.acquire(1024,signal);assert.equal(time,0);
  await policy.acquire(1024,signal);assert.equal(time,1000);
  await policy.acquire(1024,signal);assert.equal(time,2000);
  const controller=new AbortController();controller.abort();
  await assert.rejects(policy.acquire(1,controller.signal),{name:'AbortError'});
  policy.configure({speedKiB:0});await policy.acquire(100000,signal);assert.equal(time,2000);
});
