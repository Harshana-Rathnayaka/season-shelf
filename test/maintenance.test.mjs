import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {hashFile} from "../src/core/files.mjs";
import {removePending, trashCompleted, orphanedPartials, trashOrphans} from "../src/core/maintenance.mjs";

test("bulk queue removal keeps completed and finishing entries", async () => {
  const queue = {jobs:[{id:"1",status:"downloading"},{id:"2",status:"complete"},{id:"3",status:"transferring"}],
    control(id,action){assert.equal(this.batching,true);if(action === "remove") this.jobs=this.jobs.filter(j=>j.id!==id);},pump(){}};
  assert.equal(await removePending(queue,["1","2","3"]),1);
  assert.deepEqual(queue.jobs.map(j=>j.id),["2","3"]);
});

test("bulk saved deletion trashes verified files and retains changed ones", async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"shelf-maintenance-"));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const first=path.join(dir,"first.mkv"), second=path.join(dir,"second.mkv");
  await fs.writeFile(first,"original"); await fs.writeFile(second,"original");
  const hash=await hashFile(first);
  await fs.writeFile(second,"changed");
  const queue={jobs:[{id:"1",status:"complete",finalPath:first,sha256:hash},{id:"2",status:"complete",finalPath:second,sha256:hash}],namingLocks:new Set(),seasonKey:()=>"season",save(){}};
  const result=await trashCompleted(queue,["1","2"],file=>fs.rename(file,file+".recycled"));
  assert.equal(result.deleted,1);assert.equal(result.failures.length,1);
  assert.equal(queue.jobs[0].status,"deleted");assert.equal(queue.jobs[1].status,"complete");
  assert.equal(await fs.readFile(second,"utf8"),"changed");
  assert.equal(queue.namingLocks.size,0);
});

test("orphan cleanup protects tracked and still-running partial files", async t => {
  const staging=await fs.mkdtemp(path.join(os.tmpdir(),"shelf-orphans-"));
  t.after(()=>fs.rm(staging,{recursive:true,force:true}));
  const [orphan,tracked,running]=[randomUUID(),randomUUID(),randomUUID()];
  for(const id of [orphan,tracked,running]) await fs.writeFile(path.join(staging,id+".part"),"bytes");
  await fs.writeFile(path.join(staging,"unrelated.txt"),"keep");
  const queue={staging,jobs:[{id:tracked,status:"cancelled"}],running:new Map([[running,{}]])};
  assert.deepEqual((await orphanedPartials(queue)).map(f=>f.id),[orphan]);
  const result=await trashOrphans(queue,[orphan,tracked,running],file=>fs.rename(file,file+".recycled"));
  assert.equal(result.deleted,1);
  assert.equal(await fs.readFile(path.join(staging,tracked+".part"),"utf8"),"bytes");
  assert.equal(await fs.readFile(path.join(staging,running+".part"),"utf8"),"bytes");
});

test('deleting a missing saved file clears its entry without reporting a filesystem error', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-missing-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const job={id:'1',status:'complete',finalPath:path.join(dir,'gone.mkv'),error:'ENOENT'};
  let saved=0;
  const queue={jobs:[job],namingLocks:new Set(),seasonKey:()=> 'season',save(){saved++;}};
  const result=await trashCompleted(queue,['1'],()=>assert.fail('Missing files cannot be trashed'));
  assert.equal(job.status,'missing');assert.equal(job.error,undefined);
  assert.equal(result.failures.length,0);assert.equal(saved,1);assert.equal(queue.namingLocks.size,0);
});

test('workspace reset clears metadata atomically while retaining media and account preferences',async t=>{
  const {clearWorkspace}=await import('../src/core/reset.mjs');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-reset-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'saved.mkv');await fs.writeFile(file,'keep media');
  const data={credentials:'encrypted',settings:{theme:'dark'},onboardingComplete:true,jobs:[{finalPath:file}]};const store={setMany(values){Object.assign(data,values);}};
  const queue={jobs:data.jobs,running:new Map(),namingLocks:new Set(),emit(){}};const watcher={watches:[{}]};
  clearWorkspace(queue,store,watcher);assert.deepEqual(data.jobs,[]);assert.equal(data.catalogue,null);assert.equal(data.usage.payloadBytes,0);assert.equal(data.credentials,'encrypted');assert.equal(data.onboardingComplete,true);assert.equal(await fs.readFile(file,'utf8'),'keep media');
  queue.running.set('active',{});assert.throws(()=>clearWorkspace(queue,store,watcher),/Pause downloads/);
});
