import type { DownloadRecord } from "../types/downloads";

export function canPauseDownload(job: DownloadRecord) {
  return ["queued", "downloading", "retrying", "preview"].includes(job.status);
}

export function canResumeDownload(job: DownloadRecord) {
  return ["paused", "failed", "waiting", "cancelled"].includes(job.status);
}

export function pendingDownloadCount(jobs: DownloadRecord[]) {
  return jobs.filter(job => !["complete", "deleted", "missing", "cancelled"].includes(job.status)).length;
}

function downloadPriority(job: DownloadRecord) {
  if (["downloading", "checking", "transferring", "retrying", "preview"].includes(job.status)) return 0;
  if (job.status === "queued") return 1;
  return job.status === "complete" ? 3 : 2;
}
function downloadDate(job: DownloadRecord) {
  return (job.status === "complete" && Date.parse(job.completedAt || "")) || Date.parse(job.createdAt || "") || 0;
}

export function visibleDownloads(jobs: DownloadRecord[], finished: boolean) {
  return jobs.filter(job => finished ? job.status === "complete" : !["complete", "deleted", "missing"].includes(job.status))
    .sort((a,b) => (finished ? 0 : downloadPriority(a)-downloadPriority(b)) || downloadDate(b)-downloadDate(a));
}

export function canRemoveDownload(job: DownloadRecord) {
  return !["checking", "transferring", "complete", "deleted", "missing", "removing"].includes(job.status);
}
