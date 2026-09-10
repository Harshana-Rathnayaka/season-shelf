const excluded = new Set(["cancelled", "removed", "deleted", "missing"]);
export function batchProgress(jobs, currentBatchId) {
  const eligible = jobs.filter(job => !excluded.has(job.status));
  const pending = eligible.filter(job => job.status !== "complete");
  const batchIds = new Set(currentBatchId ? [currentBatchId] : pending.map(job => job.batchId).filter(Boolean));
  if (!currentBatchId && !pending.length) {
    const latest = jobs.filter(job => job.batchId).at(-1);
    if (latest) batchIds.add(latest.batchId);
  }
  const current = eligible.filter(job => job.batchId ? batchIds.has(job.batchId) : job.status !== "complete");
  const total = current.reduce((sum, job) => sum + job.item.size, 0);
  const received = current.reduce((sum, job) => sum + Math.min(job.item.size, Math.max(0, job.received || 0)), 0);
  return { total, received, remaining: Math.max(0, total - received), files: current.length };
}
