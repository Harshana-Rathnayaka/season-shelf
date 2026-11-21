import { randomUUID } from 'node:crypto';
import { freshUsage } from './reset.mjs';

const blank = () => ({ jobs: [], channels: [], catalogue: null, watches: [], usage: freshUsage(), currentBatchId: randomUUID() });

/** Switch metadata only. Staged and completed files are never removed. */
export function activateAccountWorkspace({ store, queue, watcher, accountId, adoptLegacy = false }) {
  if (!/^\d+$/.test(accountId || '')) throw new Error('Verified Telegram account required');
  if (queue.running.size || queue.removals.size || queue.namingLocks.size || queue.recovering || watcher.checking)
    throw new Error('Wait for current operations to stop before switching accounts');
  const owner = store.get('workspaceAccount', null);
  if (owner !== accountId) {
    if (owner === null && adoptLegacy) {
      // Only a restored, previously stored session can claim pre-upgrade data.
      store.set('workspaceAccount', accountId);
    } else {
      const current = { jobs: queue.snapshot(), channels: store.get('channels', []), catalogue: store.get('catalogue', null),
        watches: watcher.watches, usage: queue.usage, currentBatchId: queue.currentBatchId };
      const next = store.get(`accountWorkspace:${accountId}`, blank());
      next.jobs = next.jobs.map(job => ({ ...job, speed: 0,
        status: ['queued', 'retrying', 'downloading', 'checking', 'transferring'].includes(job.status) ? 'paused' : job.status }));
      // Archive before changing the active view, in one transaction.
      const index = [...new Set([...store.get('accountWorkspaceIndex', []), owner || 'legacy'])].filter(id => id !== accountId);
      store.setMany({ [`accountWorkspace:${owner || 'legacy'}`]: current, accountWorkspaceIndex: index, ...next, workspaceAccount: accountId });
      queue.jobs = next.jobs;
      queue.usage = next.usage;
      queue.currentBatchId = next.currentBatchId;
      queue.floodUntil = 0;
      watcher.watches = next.watches;
    }
  }
  return { jobs: queue.snapshot(), usage: queue.usage, currentBatchId: queue.currentBatchId,
    channels: store.get('channels', []), catalogue: store.get('catalogue', null) };
}
