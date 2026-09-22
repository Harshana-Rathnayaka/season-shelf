import test from "node:test";
import assert from "node:assert/strict";
import { registerDownloadHandlers } from "../src/desktop/handlers/downloads.mjs";

function handlersFixture(jobs, confirmInApp) {
  const handlers = {};
  const calls = [];
  const queue = {
    jobs, running: new Map(), namingLocks: new Set(),
    usage: {payloadBytes: 2048, publishedBytes: 1024, completedFiles: 1},
    seasonKey: () => "season",
    snapshot() { return structuredClone(this.jobs); },
    async control(id, action) {
      calls.push({id, action});
      if (action === "remove") this.jobs = this.jobs.filter(job => job.id !== id);
    },
    pump() {},
  };
  registerDownloadHandlers({
    handle: (name, handler) => { handlers[name] = handler; },
    queue, confirmInApp,
    adapter: {requireClient() {}},
    shell: {trashItem() { assert.fail("History removal must never trash media"); }},
  });
  return {handlers, queue, calls};
}

test("history removal cancellation preserves records and confirms that files stay on disk", async () => {
  const f = handlersFixture([{id:"done",status:"complete"}], async options => {
    assert.match(options.detail,/files stay on disk/i);
    return {response:0};
  });
  const result = await f.handlers["remove-history"]({id:"done"});
  assert.equal(result.length,1);
  assert.deepEqual(f.calls,[]);
});

test("clearing finished history only removes completed records and preserves lifetime totals", async () => {
  const f = handlersFixture([{id:"done",status:"complete"},{id:"paused",status:"paused"}], async () => ({response:1}));
  const usage = structuredClone(f.queue.usage);
  assert.deepEqual(await f.handlers["remove-history"](),[{id:"paused",status:"paused"}]);
  assert.deepEqual(f.calls,[{id:"done",action:"remove"}]);
  assert.deepEqual(f.queue.usage,usage);
});

test("remove queue IPC waits for temporary-file cleanup before returning its snapshot", async () => {
  const f = handlersFixture([{id:"paused",status:"paused"}],async () => ({response:1}));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const control = f.queue.control.bind(f.queue);
  f.queue.control = async (...args) => { await gate; await control(...args); };
  let returned = false;
  const request = f.handlers["queue-control"]({id:"paused",action:"remove"}).then(result => {returned=true;return result;});
  await Promise.resolve();
  assert.equal(returned,false);
  release();
  assert.deepEqual(await request,[]);
});

test("a download completing while removal confirmation is open is kept", async () => {
  const job = {id:"active",status:"downloading"};
  const f = handlersFixture([job],async () => {job.status="complete";return {response:1};});
  assert.deepEqual(await f.handlers["queue-control"]({id:job.id,action:"remove"}),[job]);
  assert.deepEqual(f.calls,[]);
});

test("clear queue keeps finishing work and completed history", async () => {
  const jobs = [{id:"paused",status:"paused"},{id:"saving",status:"transferring"},{id:"done",status:"complete"}];
  const f = handlersFixture(jobs,async options => {
    assert.match(options.detail,/temporary data will be permanently deleted/);
    return {response:1};
  });
  const result = await f.handlers["delete-all-queue"]();
  assert.equal(result.removed,1);
  assert.deepEqual(result.jobs.map(job=>job.id),["saving","done"]);
});
