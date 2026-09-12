import {randomUUID} from 'node:crypto';

export function freshUsage() {
  return {since:new Date().toISOString(),payloadBytes:0,publishedBytes:0,completedFiles:0};
}

// Metadata only: never unlink, move, truncate or traverse downloaded files.
export function clearWorkspace(queue, store, watcher) {
  if (queue.running.size || queue.namingLocks.size || queue.recovering || watcher.checking)
    throw new Error('Pause downloads and wait for file checks to finish before clearing app data.');
  const data={jobs:[],catalogue:null,channels:[],watches:[],usage:freshUsage(),currentBatchId:randomUUID()};
  store.setMany(data);
  queue.jobs=[];queue.usage=data.usage;queue.currentBatchId=data.currentBatchId;
  watcher.watches=[];
  queue.emit('change',[]);
  return data;
}
