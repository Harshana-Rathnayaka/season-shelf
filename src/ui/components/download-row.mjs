import { actionButton } from "./action-button.mjs";
import { canPauseDownload, canResumeDownload } from "../models/downloads.mjs";
import { icon } from "../icons.mjs";
import { escape, bytes, friendlyError } from "../format.mjs";
import { pad } from "../../core/catalog.mjs";

export function downloadRow(job) {
  return `<article class="queue-item">
    <span class="queue-glyph">${icon(job.mode === "archive" ? "drive" : "play")}</span>
    <div class="queue-content">
    <div class="queue-title">
    <strong>${escape(job.series)} <span>${job.item.unverified ? "Unverified file" : `S${pad(job.item.season)}E${pad(job.item.episode)}${job.item.episodeEnd > job.item.episode ? `-E${pad(job.item.episodeEnd)}` : ""}`}</span>
    </strong>
    <span class="status status-${job.status}">${escape(job.status)}</span>
    </div>
    <span class="source-filename queue-filename" title="${escape(job.finalPath ? job.finalPath.split(/[\\/]/).pop() : job.item.filename)}">${escape(job.finalPath ? job.finalPath.split(/[\\/]/).pop() : job.item.filename)}</span>
    <p>${job.item.unverified ? "Unverified" : `${job.item.resolution}p ${job.item.codec}`} <span>·</span> ${job.mode === "archive" ? "Archive" : "Watch"} <span>·</span> ${bytes(job.received || 0)} / ${bytes(job.item.size)}${job.speed ? ` <span>·</span> ${bytes(job.speed)}/s` : ""}</p>
    <progress max="${job.item.size}" value="${job.received || 0}" aria-label="Download progress">
    </progress>${job.error ? `<small class="job-error">${escape(friendlyError(job.error))}</small>` : ""}${job.namingError ? `<small class="job-error">Filename normalization: ${escape(job.namingError)}</small>` : ""}${job.finalPath ? `<button class="text-button file-details-link" data-action="file-details" data-job="${job.id}">File details ${icon("info")}</button>` : ""}</div>
    <div class="job-controls">${downloadRowControls(job)}</div>
    </article>`;
}

function downloadRowControls(job) {
  const button = (action, label, glyph, control, title) => actionButton({
    action, label, glyph, title, iconOnly: true,
    data: {job: job.id, ...(control ? {control} : {})},
  });
  const controls = [];
  if (!["checking", "transferring", "complete", "deleted", "removing"].includes(job.status))
    controls.push(button("job", "Remove from queue", "trash", "remove", "Remove from queue and delete temporary data"));
  if (canPauseDownload(job)) controls.push(button("job", "Pause download", "pause", "pause"));
  if (canResumeDownload(job)) controls.push(button("job", "Resume download", "play", "resume"));
  if (job.status === "complete") {
    controls.push(button("open-job", "Open video", "play"));
    controls.push(button("remove-history", "Remove from history; keep file on disk", "close"));
  }
  return controls.join("");
}
