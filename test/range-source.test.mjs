import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from 'teleproto';
import bigInt from 'big-integer';
import {rangeSource} from '../src/desktop/range-source.mjs';
test('resumable ranges use the pooled media scheduler and preserve migration and cancellation',async()=>{
  const document=new Api.Document({id:bigInt(1),accessHash:bigInt(2),fileReference:Buffer.from('reference'),date:0,mimeType:'video/x-matroska',size:bigInt(1024),dcId:4,attributes:[]});
  const calls=[];
  const source=rangeSource({_media:{getFile:async(...args)=>{calls.push(args);args[5](5);return Buffer.alloc(1);}}},new Api.MessageMediaDocument({document}));
  const signal=new AbortController().signal;
  await source.read(524288,524288,signal);await source.read(1048576,524288,signal);
  assert.equal(source.window,8);assert.equal(calls[0][0],4);assert.equal(calls[1][0],5);
  assert.equal(calls[0][2].toString(),'524288');assert.equal(calls[0][4],signal);
});
