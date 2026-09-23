import { icon } from "../../../shared/ui/icons.mjs";
import { escape } from "../../../shared/lib/format.mjs";
export function fileDetails(job) {
  const name = job.finalPath?.split(/[\\/]/).pop() || job.item.filename;
  return `<h2>File details</h2>
    <dl class="file-details">
    <dt>Saved filename</dt>
    <dd>${escape(name)}</dd>
    <dt>Original Telegram filename</dt>
    <dd>${escape(job.item.filename)}</dd>
    <dt>Location</dt>
    <dd>${escape(job.finalPath || "Not saved yet")}</dd>
    </dl>${job.namingError ? `<p class="job-error">${escape(job.namingError)}</p>
    <button class="button secondary" data-action="retry-naming" data-job="${job.id}">${icon("refresh")}Retry season naming</button>` : ""}${job.status === "complete" ? `<button class="button secondary" data-action="reveal-job" data-job="${job.id}">${icon("folder")}Show in folder</button>
    <button class="button secondary" data-action="delete-job" data-job="${job.id}">${icon("trash")}Move file to Recycle Bin</button>
    <p>This moves the file from disk to the Recycle Bin. To keep it, use Remove from history in the Finished list.</p>` : ""}<p>Earlier downloads may use the old naming format. This is the recorded file location; existing files have not been renamed or moved.</p>`;
}
