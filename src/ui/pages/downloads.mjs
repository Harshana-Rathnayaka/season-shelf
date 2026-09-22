import { icon } from "../icons.mjs";
import { bytes } from "../format.mjs";
import { batchProgress } from "../../core/progress.mjs";
import { visibleDownloads, pendingDownloadCount } from "../models/downloads.mjs";
import { downloadRow } from "../components/download-row.mjs";
import { downloadActions } from "../components/download-actions.mjs";
export function queuePage(state) {
  const saved = state.downloadTab === "finished";
  const jobs = visibleDownloads(state.jobs, saved);
  const {total,received,remaining} = batchProgress(state.jobs, state.currentBatchId);
  const speed = jobs.reduce((n, job) => n + (job.speed || 0), 0);
  return `<section class="simple-heading">
    <div class="eyebrow">${saved ? "A PLACE FOR EVERYTHING" : "LET THE QUEUE DO ITS THING"}</div>
    <h1>Downloads, in motion.</h1>
    <p>${saved ? "Completed downloads, newest first. Removing history keeps your files on disk." : `${state.demo ? "Sample queue · no file transfers" : "Direct from Telegram to your computer"}${speed ? ` · ${bytes(speed)}/s` : ""}`}</p>
    </section>
  <div class="segmented download-tabs" role="group" aria-label="Download views">${[["ongoing", "Ongoing"], ["finished", "Finished"]].map(([tab, label]) => `<button data-action="download-tab" data-tab="${tab}" aria-pressed="${state.downloadTab === tab}" class="${state.downloadTab === tab ? "active" : ""}">${label}</button>`).join("")}</div>
  <div class="queue-summary">
    <div>
    <small>IN QUEUE</small>
    <strong>${pendingDownloadCount(state.jobs)}</strong>
    </div>
    <div>
    <small>${saved ? "COMPLETED" : "BATCH COMPLETED"}</small>
    <strong>${state.jobs.filter(j => j.status === "complete" && (saved || j.batchId === state.currentBatchId)).length}</strong>
    </div>
    <div>${saved ? `<small>SAVED FILE SIZE</small>
    <strong class="size-total">${bytes(jobs.filter(j => j.status === "complete").reduce((n,j) => n+j.item.size,0))}</strong>` : `<small>CURRENT BATCH</small>
    <strong class="size-total">${bytes(received)} / ${bytes(total)}</strong>
    <small>${bytes(remaining)} remaining</small>
    <progress ${total ? "" : "hidden"} class="batch-progress" max="${total || 1}" value="${received}" aria-label="Current batch download progress">
    </progress>`}</div>
    </div>
  ${downloadActions(jobs, saved)}
  <section class="catalogue-panel queue-panel workspace-scroll" tabindex="0" role="region" aria-label="${saved ? "Finished downloads" : "Ongoing downloads"}">${jobs.length ? jobs.map(downloadRow).join("") : `<div class="empty-state">
    <div class="empty-symbol">${icon(saved ? "folder" : "download")}</div>
    <h3>${saved ? "No finished downloads." : "No ongoing downloads."}</h3>
    <p>Choose episodes from your series library to get started.</p>
    <button class="button primary" data-action="nav" data-page="library">Browse your series ${icon("arrow")}</button>
    </div>`}</section>`;
}
