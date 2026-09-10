import test from "node:test";
import assert from "node:assert/strict";
import { batchProgress } from "../src/core/progress.mjs";

test("current batch counts finished files without including older history", () => {
  const job = (status, received, batchId = "current") => ({status, received, batchId, item:{size:5}});
  const jobs = [job("complete",5,"old"),job("complete",5),job("downloading",0)];
  assert.deepEqual(batchProgress(jobs),{received:5,total:10,remaining:5,files:2});
  jobs[2].received=3;
  assert.deepEqual(batchProgress(jobs),{received:8,total:10,remaining:2,files:2});
  jobs[2].status="complete"; jobs[2].received=5;
  assert.equal(batchProgress(jobs).received,10);
  jobs.push(job("queued",0,"next"));
  assert.deepEqual(batchProgress(jobs),{received:0,total:5,remaining:5,files:1});
  jobs[3].status="cancelled";
  assert.equal(batchProgress(jobs).total,0);
  jobs.pop();
  assert.equal(batchProgress(jobs,"next").total,0);
});

test("legacy history is excluded and removal changes active batch totals", () => {
  const jobs=[{status:"complete",received:100,item:{size:100}},
    {status:"paused",received:4,item:{size:10},batchId:"new"},
    {status:"failed",received:2,item:{size:10},batchId:"new"}];
  assert.equal(batchProgress(jobs).total,20);
  jobs.pop();
  assert.deepEqual(batchProgress(jobs),{received:4,total:10,remaining:6,files:1});
});
