import { canPauseDownload, canResumeDownload, canRemoveDownload } from "../../models/downloads";
import type { DownloadRecord, DownloadActionHandler } from "../../types/downloads";
import { DownloadButton } from "./DownloadButton";

export function DownloadActions({ jobs, finished, onAction }: { jobs: DownloadRecord[]; finished: boolean; onAction: DownloadActionHandler }) {
  if (!jobs.length) return null;
  return <div className="queue-actions" role="group" aria-label={finished ? "Saved file actions" : "Queue actions"}>
    {!finished && <>
      <DownloadButton onAction={onAction} command={{ action: "bulk-job", control: "pause" }} label="Pause all"
        disabled={!jobs.some(canPauseDownload)} title="Pause active and queued downloads. Keep progress for resuming." />
      <DownloadButton onAction={onAction} command={{ action: "bulk-job", control: "resume" }} label="Resume all"
        disabled={!jobs.some(canResumeDownload)} title="Resume paused downloads and retry failed downloads." />
    </>}
    <DownloadButton onAction={onAction} command={{ action: finished ? "remove-history" : "delete-all-queue" }}
      label={finished ? "Clear finished history…" : "Clear queue…"} glyph="trash" className="button secondary queue-delete"
      disabled={!finished && !jobs.some(canRemoveDownload)}
      title={finished ? "Remove completed entries from the app; keep files on disk." : "Remove unfinished entries and delete their temporary data. Completed files stay on disk."} />
  </div>;
}
