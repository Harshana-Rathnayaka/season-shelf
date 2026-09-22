import { actionButton } from "./action-button.mjs";
import { canPauseDownload, canResumeDownload } from "../models/downloads.mjs";

export function downloadActions(jobs, finished) {
  if (!jobs.length) return "";
  const controls = finished ? [] : [
    actionButton({
      action: "bulk-job", label: "Pause all", data: {control: "pause"},
      disabled: !jobs.some(canPauseDownload),
      title: "Pause active and queued downloads. Keep progress for resuming.",
    }),
    actionButton({
      action: "bulk-job", label: "Resume all", data: {control: "resume"},
      disabled: !jobs.some(canResumeDownload),
      title: "Resume paused downloads and retry failed downloads.",
    }),
  ];
  controls.push(actionButton({
    action: finished ? "remove-history" : "delete-all-queue",
    label: finished ? "Clear finished history…" : "Clear queue…",
    glyph: "trash", className: "button secondary queue-delete",
    title: finished ? "Remove completed entries from the app; keep files on disk."
      : "Remove unfinished entries and delete their temporary data. Completed files stay on disk.",
  }));
  return '<div class="queue-actions" role="group" aria-label="' +
    (finished ? "Saved file actions" : "Queue actions") + '">' + controls.join("") + '</div>';
}
