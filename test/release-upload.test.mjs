import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadAsset} from '../scripts/upload-release.mjs';

test('release upload retries the same asset and replaces incomplete uploads', async () => {
  const calls = [], waits = [];
  await uploadAsset('v1.0.0', 'release/app.zip', args => {
    calls.push(args);
    return {status:calls.length < 3 ? 1 : 0};
  }, async ms => waits.push(ms));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['release','upload','v1.0.0','release/app.zip','--clobber']);
  assert.deepEqual(calls[1], calls[0]);
  assert.deepEqual(waits, [15000,30000]);
});

test('upload failures stop publication after bounded retries', async () => {
  let calls = 0;
  await assert.rejects(uploadAsset('v1.0.0','app.dmg',()=>{calls++;return {status:null,error:new Error('timeout')};},async()=>{}),/3 attempts/);
  assert.equal(calls,3);
});
