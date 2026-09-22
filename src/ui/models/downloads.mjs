export function canPauseDownload(job) {
  return ["queued", "downloading", "retrying", "preview"].includes(job.status);
}

export function canResumeDownload(job) {
  return ["paused", "failed", "waiting", "cancelled"].includes(job.status);
}

export function pendingDownloadCount(jobs) {
  return jobs.filter(job => !["complete", "deleted", "missing", "cancelled"].includes(job.status)).length;
}

function downloadPriority(job) {
  if (["downloading", "checking", "transferring", "retrying", "preview"].includes(job.status)) return 0;
  if (job.status === "queued") return 1;
  return job.status === "complete" ? 3 : 2;
}
function downloadDate(job) {
  return (job.status === "complete" && Date.parse(job.completedAt)) || Date.parse(job.createdAt) || 0;
}

export function visibleDownloads(jobs, finished) {
  return jobs.filter(job => finished ? job.status === "complete" : !["complete", "deleted", "missing"].includes(job.status))
    .sort((a,b) => (finished ? 0 : downloadPriority(a)-downloadPriority(b)) || downloadDate(b)-downloadDate(a));
}
