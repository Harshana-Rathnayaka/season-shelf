import fs from "node:fs/promises";
import path from "node:path";
import { hashFile } from "./files.mjs";

export function pendingEntries(queue) {
  return queue.jobs.filter(job => ["queued", "downloading", "paused", "retrying", "failed", "waiting", "cancelled"].includes(job.status));
}

export async function removePending(queue, ids) {
  const eligible = new Set(pendingEntries(queue).map(job => job.id));
  let removed = 0;
  queue.batching = true;
  try {
    for (const id of ids) if (eligible.has(id)) queue.control(id, "pause");
    for (const id of ids) if (eligible.has(id)) { await queue.control(id, "remove"); removed++; }
  } finally { queue.batching = false; queue.pump(); }
  return removed;
}

export async function trashCompleted(queue, ids, trash) {
  const failures = [];
  let deleted = 0;
  for (const id of ids) {
    const job = queue.jobs.find(job => job.id === id && job.status === "complete");
    if (!job) continue;
    const key = queue.seasonKey(job);
    if (queue.namingLocks.has(key) || job.renamePending) {
      failures.push({id, error:"Filename normalization is in progress"}); continue;
    }
    queue.namingLocks.add(key);
    try {
      if (await hashFile(job.finalPath) !== job.sha256) throw new Error("File changed since download; kept for manual review");
      await trash(job.finalPath);
      job.status = "deleted";
      delete job.error;
      deleted++;
    } catch (error) {
      if (error.code === "ENOENT") { job.status = "missing"; delete job.error; deleted++; continue; }
      job.error = /EACCES|EPERM/.test(error.code || "") ? "Windows could not remove this file. Close apps using it and check permissions." : String(error.message).slice(0,300);
      failures.push({id, error:job.error});
    } finally { queue.namingLocks.delete(key); queue.save(); }
  }
  return {deleted, failures};
}

export async function orphanedPartials(queue) {
  let entries;
  try { entries = await fs.readdir(queue.staging); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const known = new Set(queue.jobs.map(job => job.id));
  const files = [];
  for (const name of entries) {
    if (!/^[0-9a-f-]{36}\.part$/i.test(name)) continue;
    const id = name.slice(0,-5);
    if (known.has(id) || queue.running.has(id)) continue;
    const filename = path.join(queue.staging,name);
    const stat = await fs.lstat(filename);
    if (stat.isFile() && !stat.isSymbolicLink()) files.push({id, filename, size:stat.size});
  }
  return files;
}

export async function trashOrphans(queue, ids, trash) {
  const selected = new Set(ids);
  const results = {deleted:0, failures:[]};
  for (const file of await orphanedPartials(queue)) {
    if (!selected.has(file.id)) continue;
    try { await trash(file.filename); results.deleted++; }
    catch(error) { results.failures.push({id:file.id,error:String(error.message).slice(0,300)}); }
  }
  return results;
}
