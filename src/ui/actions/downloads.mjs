import { canPauseDownload, canResumeDownload } from "../models/downloads.mjs";
import { fileDetails } from "../components/file-details.mjs";

const downloadActionNames = new Set(["bulk-job","job","open-job","file-details","retry-naming","reveal-job","download-tab","remove-history","delete-job","delete-all-queue","scan-staging","cleanup-staging"]);

export function isDownloadAction(action) {
  return downloadActionNames.has(action);
}

export async function handleDownloadAction(action, el, {state, call, render, toast, modal, document}) {
  if (!downloadActionNames.has(action)) return false;
  const $ = selector => document.querySelector(selector);
    if (action === "bulk-job") {
      if (state.demo) {
        for (const job of state.jobs) {
          if (!(el.dataset.control === "pause" ? canPauseDownload(job) : canResumeDownload(job))) continue;
          job.status = { pause: "paused", resume: "preview", cancel: "cancelled" }[el.dataset.control];
        }
      } else state.jobs = await call("queue-control", { all: true, action: el.dataset.control });
      render();
    } else if (action === "job") {
      if (state.demo) {
        if (el.dataset.control === "remove") state.jobs = state.jobs.filter(j => j.id !== el.dataset.job);
        else state.jobs.find((j) => j.id === el.dataset.job).status = { pause: "paused", resume: "preview", cancel: "cancelled" }[el.dataset.control];
      } else
        state.jobs = await call("queue-control", {
          id: el.dataset.job,
          action: el.dataset.control,
        });
      render();
    } else if (action === "open-job")
      await call("open-job", { id: el.dataset.job });
    else if (action === "file-details") {
      const job = state.jobs.find(j => j.id === el.dataset.job);
      modal(fileDetails(job));
    } else if (action === "retry-naming") {
      state.jobs = await call("retry-naming", {id:el.dataset.job});
      const job = state.jobs.find(j => j.id === el.dataset.job);
      modal(fileDetails(job));
      render();
      toast(job.namingError || "Season filenames updated.", !!job.namingError);
    } else if (action === "reveal-job") {
      await call("reveal-job", {id:el.dataset.job});
    } else if (action === "download-tab") {
      state.downloadTab = el.dataset.tab;
      render();
      document.querySelector(`[data-action="download-tab"][data-tab="${state.downloadTab}"]`).focus();
    } else if (action === "remove-history") {
      if (state.demo) state.jobs = state.jobs.filter(job => job.status !== "complete" || (el.dataset.job && job.id !== el.dataset.job));
      else state.jobs = await call("remove-history", { id: el.dataset.job });
      render();
    } else if (action === "delete-job") {
      state.jobs = await call("delete-job", { id: el.dataset.job });
      $("#dialog").close();
      render();
    } else if (action === "delete-all-queue") {
      if (state.demo) {
        state.jobs = state.jobs.filter(job => ["complete","deleted"].includes(job.status));
        toast("Sample entries removed. Completed files stay on disk.");
      } else {
        const result = await call(action);
        state.jobs = result.jobs;
        toast(`${result.removed} queue entries removed. Files stay on disk.`);
      }
      render();
    } else if (action === "scan-staging" || action === "cleanup-staging") {
      if (state.demo) { toast("Storage cleanup is available in the desktop app."); return true; }
      if (action === "cleanup-staging") {
        const result = await call("cleanup-staging");
        toast(`${result.deleted} partial files moved to the Recycle Bin. ${result.failures.length} kept.`, !!result.failures.length);
      }
      state.stagingInfo = await call("staging-info");
      render();
    }
  return true;
}
