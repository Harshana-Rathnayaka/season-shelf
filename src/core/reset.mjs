import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {pendingEntries,removePending,orphanedPartials} from './maintenance.mjs';

export function freshUsage() {
  return {since:new Date().toISOString(),payloadBytes:0,publishedBytes:0,completedFiles:0};
}

// Metadata only: never unlink, move, truncate or traverse downloaded files.
export async function clearWorkspace(queue, store, watcher) {
  if (queue.running.size || queue.removals?.size || queue.namingLocks.size || queue.recovering || watcher.checking)
    throw new Error('Pause downloads and wait for file checks to finish before clearing app data.');
  await removePending(queue,pendingEntries(queue).map(job=>job.id));
  for (const file of await orphanedPartials({...queue,jobs:[]})) await fs.rm(file.filename);
  const data={jobs:[],catalogue:null,channels:[],watches:[],usage:freshUsage(),currentBatchId:randomUUID()};
  store.setMany(data);
  queue.jobs=[];queue.usage=data.usage;queue.currentBatchId=data.currentBatchId;
  watcher.watches=[];
  queue.emit('change',[]);
  return data;
}
