import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Store } from "../src/core/store.mjs";
import { DownloadQueue } from "../src/core/queue.mjs";
import { registerRoot, hashFile, publishFile } from "../src/core/files.mjs";
import { parseEpisode } from "../src/core/catalog.mjs";
const chunkSize = 524288;
async function fixture(t, { size = chunkSize * 3 + 71, slow = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shelf-test-"));
  const rootDir = path.join(dir, "destination");
  await fs.mkdir(rootDir);
  const root = await registerRoot(rootDir);
  const store = new Store(path.join(dir, "state.sqlite"));
  const data = Buffer.alloc(size, 42),
    offsets = [];
  for (let i = 0; i < size; i += chunkSize)
    data.fill((i / chunkSize + 42) % 256, i, Math.min(size, i + chunkSize));
  const adapter = {
    async *download(_item, offset, signal) {
      offsets.push(offset);
      for (let i = offset; i < data.length; i += chunkSize) {
        if (slow) await delay(30);
        if (signal.aborted) return;
        yield data.subarray(i, Math.min(data.length, i + chunkSize));
      }
    },
  };
  const queue = new DownloadQueue({
    store,
    adapter,
    staging: path.join(dir, "staging"),
  });
  const item = parseEpisode({
    id: "1",
    filename: "Show.S01E01.720p.x265.mkv",
    size,
    peer: { id: "test" },
  });
  t.after(async () => {
    await queue.stop();
    while (queue.running.size) await delay(10);
    store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  return { dir, root, store, data, offsets, queue, item, adapter };
}
async function settle(queue) {
  const deadline = Date.now() + 8000;
  while (queue.running.size || queue.jobs.some((j) => j.status === "queued")) {
    if (Date.now() > deadline) throw new Error("Queue did not settle");
    await delay(10);
  }
}
test("downloads, checks and publishes correct bytes; duplicate enqueue is skipped", async (t) => {
  const f = await fixture(t);
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  await settle(f.queue);
  const job = f.queue.jobs[0];
  assert.equal(job.status, "complete", job.error);
  assert.deepEqual(await fs.readFile(job.finalPath), f.data);
  assert.equal(job.sha256, await hashFile(job.finalPath));
  assert.equal(
    (
      await f.queue.add({
        items: [f.item],
        series: "Show",
        mode: "archive",
        root: f.root,
      })
    ).length,
    0,
  );
  assert.equal((await fs.readdir(path.join(f.dir, "staging"))).length, 0);
});
test("pause and resume preserves completed prefix and produces an exact file", async (t) => {
  const f = await fixture(t, { size: chunkSize * 10 + 19, slow: true });
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  const job = f.queue.jobs[0];
  const deadline = Date.now() + 8000;
  while (job.received < chunkSize) {
    assert.notEqual(job.status, "failed", job.error);
    assert.ok(Date.now() < deadline, "Download did not make progress");
    await delay(5);
  }
  f.queue.control(job.id, "pause");
  await settle(f.queue);
  assert.equal(job.status, "paused");
  assert.ok(job.received > 0);
  f.queue.control(job.id, "resume");
  await settle(f.queue);
  assert.equal(job.status, "complete", job.error);
  assert.ok(f.offsets[1] >= chunkSize);
  assert.deepEqual(await fs.readFile(job.finalPath), f.data);
});
test("resume discards an incomplete tail and writes at the retained offset", async (t) => {
  const f = await fixture(t);
  f.queue.concurrency = 0;
  await f.queue.add({
    items: [f.item], series: "Show", mode: "archive", root: f.root,
  });
  const job = f.queue.jobs[0];
  await fs.mkdir(f.queue.staging, { recursive: true });
  await fs.writeFile(path.join(f.queue.staging, `${job.id}.part`),
    Buffer.concat([f.data.subarray(0, chunkSize), Buffer.alloc(123, 255)]));
  f.queue.concurrency = 2;
  f.queue.pump();
  await settle(f.queue);
  assert.equal(job.status, "complete", job.error);
  assert.deepEqual(f.offsets, [chunkSize]);
  assert.ok((await fs.readFile(job.finalPath)).equals(f.data), "Resumed bytes changed");
});

test("missing HDD marker waits without downloading", async (t) => {
  const f = await fixture(t);
  f.queue.concurrency = 0;
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  await fs.rm(path.join(f.root.path, ".season-shelf-root.json"));
  f.queue.concurrency = 2;
  f.queue.pump();
  await settle(f.queue);
  assert.equal(f.queue.jobs[0].status, "waiting");
  assert.deepEqual(f.offsets, []);
});
test("different destination file is never overwritten and staged original survives", async (t) => {
  const f = await fixture(t);
  const destination = path.join(
    f.root.path,
    "Season 01",
    f.item.filename,
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, "existing media");
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  await settle(f.queue);
  assert.equal(f.queue.jobs[0].status, "failed");
  assert.match(f.queue.jobs[0].error, /different file already exists/);
  assert.equal(await fs.readFile(destination, "utf8"), "existing media");
  const partial = path.join(f.dir, "staging", `${f.queue.jobs[0].id}.part`);
  assert.equal((await fs.stat(partial)).size, f.data.length);
  assert.ok((await fs.readFile(partial)).equals(f.data), "Staged bytes changed");
});
test("restart recovers unfinished state as paused; watch remains separate", async (t) => {
  const f = await fixture(t);
  f.queue.concurrency = 0;
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  const second = new DownloadQueue({
    store: f.store,
    adapter: f.adapter,
    staging: path.join(f.dir, "staging"),
    concurrency: 0,
  });
  assert.equal(second.jobs[0].status, "paused");
  const watch = { ...f.item, id: "2", resolution: 1080, filename: "Show.S01E01.1080p.x265.mkv" };
  await second.add({
    items: [watch],
    series: "Show",
    mode: "watch",
    root: f.root,
  });
  assert.equal(second.jobs.length, 2);
  await second.stop();
});
test("truncated source is not published", async (t) => {
  const f = await fixture(t);
  f.queue.adapter = {
    async *download() {
      yield Buffer.alloc(21);
    },
  };
  await f.queue.add({
    items: [f.item],
    series: "Show",
    mode: "archive",
    root: f.root,
  });
  await settle(f.queue);
  assert.equal(f.queue.jobs[0].status, "failed");
  assert.equal(f.queue.jobs[0].finalPath, undefined);
});
test("publish recognises an already verified destination after a restart", async (t) => {
  const f = await fixture(t);
  const source = path.join(f.dir, "source");
  await fs.writeFile(source, f.data);
  const args = {
    source,
    root: f.root,
    parts: ["Show", "episode.mkv"],
    id: "recovery",
    expectedHash: await hashFile(source),
  };
  const first = await publishFile(args);
  const second = await publishFile(args);
  assert.equal(first, second);
});

test("bulk pause, cancel and resume affect unfinished jobs and removal persists", async (t) => {
  const f = await fixture(t);
  f.queue.concurrency = 0;
  await f.queue.add({ items:[f.item, {...f.item,id:"2",episode:2,filename:"Show.S01E02.720p.x265.mkv"}], series:"Show", mode:"archive", root:f.root });
  f.queue.controlAll("pause");
  assert.ok(f.queue.jobs.every(j => j.status === "paused"));
  f.queue.controlAll("cancel");
  assert.ok(f.queue.jobs.every(j => j.status === "cancelled"));
  f.queue.controlAll("resume");
  assert.ok(f.queue.jobs.every(j => j.status === "queued"));
  const id = f.queue.jobs[0].id;
  f.queue.control(id, "remove");
  assert.equal(f.queue.jobs.length, 1);
  assert.equal(f.store.get("jobs", []).length, 1);
  assert.notEqual(f.store.get("jobs", [])[0].id, id);
});
test("remove aborts an active download without publishing or restoring its queue entry", async (t) => {
  const f = await fixture(t, { slow:true, size:chunkSize * 10 });
  await f.queue.add({items:[f.item],series:"Show",mode:"archive",root:f.root});
  const job=f.queue.jobs[0];
  const deadline=Date.now()+8000;
  while(job.received < chunkSize) {
    assert.notEqual(job.status,"failed",job.error);
    assert.ok(Date.now()<deadline);
    await delay(5);
  }
  f.queue.control(job.id,"remove");
  await settle(f.queue);
  assert.equal(f.queue.jobs.length,0);
  assert.deepEqual(f.store.get("jobs",[]),[]);
  assert.ok((await fs.stat(path.join(f.queue.staging,job.id+".part"))).size > 0);
  assert.equal(job.finalPath,undefined);
});

test("season keeps originals while incomplete, then normalizes minority names exactly", async (t) => {
  const f=await fixture(t);
  f.queue.concurrency=0;
  const items=[f.item,{...f.item,id:"2",episode:2,filename:"Show.S01E02.720p.x265.mkv"},{...f.item,id:"3",episode:3,filename:"Show_S01E03_720p_x265.mkv",destinationFilename:"WRONG.mkv"}];
  await f.queue.add({items,series:"Ignored show label",mode:"archive",root:f.root});
  const jobs=f.queue.jobs;
  assert.equal(jobs[2].parts.at(-1),items[2].filename);
  assert.equal(new Set(jobs.map(j=>j.batchId)).size,1);
  // Download the minority file first. Other selected episodes remain queued.
  await f.queue.run(jobs[2],new AbortController().signal);
  assert.equal(path.basename(jobs[2].finalPath),items[2].filename);
  await f.queue.run(jobs[0],new AbortController().signal);
  await f.queue.run(jobs[1],new AbortController().signal);
  assert.equal(path.basename(jobs[2].finalPath),"Show.S01E03.720p.x265.mkv");
  assert.ok((await fs.readFile(jobs[2].finalPath)).equals(f.data));
  await assert.rejects(fs.access(path.join(f.root.path,"Season 01",items[2].filename)),{code:"ENOENT"});
  assert.equal(f.queue.usage.payloadBytes,f.data.length*3);
  assert.equal(f.queue.usage.publishedBytes,f.data.length*3);
  assert.equal(f.queue.usage.completedFiles,3);
  assert.equal(f.store.get("usage",{}).completedFiles,3);
});
test("end-of-season naming refuses a collision and retains original media", async (t) => {
  const f=await fixture(t); f.queue.concurrency=0;
  const items=[f.item,{...f.item,id:"2",episode:2,filename:"Show.S01E02.720p.x265.mkv"},{...f.item,id:"3",episode:3,filename:"Show_S01E03_720p_x265.mkv"}];
  const conflict=path.join(f.root.path,"Season 01","Show.S01E03.720p.x265.mkv");
  await fs.mkdir(path.dirname(conflict),{recursive:true});
  await fs.writeFile(conflict,"other file");
  await f.queue.add({items,series:"Show",mode:"archive",root:f.root});
  for(const job of f.queue.jobs) await f.queue.run(job,new AbortController().signal);
  const last=f.queue.jobs[2];
  assert.equal(last.status,"complete");
  assert.match(last.namingError,/already exists/);
  assert.equal(path.basename(last.finalPath),items[2].filename);
  assert.ok((await fs.readFile(last.finalPath)).equals(f.data));
  assert.equal(await fs.readFile(conflict,"utf8"),"other file");
  await fs.rename(conflict,conflict+".backup");
  await f.queue.finishSeason(last);
  assert.equal(last.namingError,undefined);
  assert.equal(last.finalPath,conflict);
  assert.ok((await fs.readFile(last.finalPath)).equals(f.data));
});

test("naming journal recovers a verified target after restart without losing either source identity", async (t) => {
  const f=await fixture(t);
  await f.queue.recovery;
  f.queue.concurrency=0;
  await f.queue.add({items:[f.item],series:"Show",mode:"archive",root:f.root});
  const job=f.queue.jobs[0];
  const from=path.join(f.root.path,"Season 01","original.mkv");
  const to=path.join(f.root.path,"Season 01",f.item.filename);
  await fs.mkdir(path.dirname(from),{recursive:true});
  await fs.writeFile(from,f.data); await fs.copyFile(from,to);
  Object.assign(job,{status:"complete",received:f.data.length,sha256:await hashFile(from),finalPath:from,renamePending:{from,to,parts:["Season 01",f.item.filename]}});
  f.queue.save();
  const recovered=new DownloadQueue({store:f.store,adapter:f.adapter,staging:f.queue.staging,concurrency:0});
  await recovered.recovery;
  try {
    assert.equal(recovered.jobs[0].finalPath,to);
    assert.equal(recovered.jobs[0].renamePending,undefined);
    assert.ok((await fs.readFile(to)).equals(f.data));
    await assert.rejects(fs.access(from),{code:"ENOENT"});
  } finally { await recovered.stop(); }
});
