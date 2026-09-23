import { bytes, friendlyError } from "../../../shared/lib/format.mjs";
import { canPauseDownload, canResumeDownload, canRemoveDownload } from "../selectors";
import type { DownloadRecord, DownloadActionHandler } from "../types";
import { Icon } from "../../../shared/ui/Icon";
import { DownloadButton } from "./DownloadButton";

const pad = (value: number | undefined) => String(value ?? 0).padStart(2, "0");

export function DownloadRow({ job, onAction }: { job: DownloadRecord; onAction: DownloadActionHandler }) {
  const filename = job.finalPath?.split(/[\\/]/).pop() || job.item.filename;
  const received = Math.min(job.item.size, Math.max(0, job.received || 0));
  const episode = `S${pad(job.item.season)}E${pad(job.item.episode)}${(job.item.episodeEnd || 0) > (job.item.episode || 0) ? `-E${pad(job.item.episodeEnd)}` : ""}`;
  const phase = job.status === "checking" ? "Checking the downloaded file before saving it."
    : job.status === "transferring" ? "Saving the file to your chosen folder. The next download can start while this finishes." : null;
  return <article className="queue-item" data-download-id={job.id}>
    <span className="queue-glyph"><Icon name={job.mode === "archive" ? "drive" : "play"} /></span>
    <div className="queue-content">
      <div className="queue-title">
        <strong>{job.series} <span>{job.item.unverified ? "Unverified file" : episode}</span></strong>
        <span className={`status status-${job.status}`}>{job.status === "transferring" ? "Saving to disk" : job.status === "checking" ? "Verifying file" : job.status}</span>
      </div>
      <span className="source-filename queue-filename" title={filename}>{filename}</span>
      <p>{job.item.unverified ? "Unverified" : `${job.item.resolution || "—"}p ${job.item.codec || ""}`} <span>·</span> {job.mode === "archive" ? "Archive" : "Watch"} <span>·</span> {bytes(received)} / {bytes(job.item.size)}{job.speed ? <> <span>·</span> {bytes(job.speed)}/s</> : null}</p>
      <progress max={job.item.size || 1} value={received} aria-label={`Download progress: ${filename}`} />
      {phase && <small className="download-phase">{phase}</small>}
      {job.error && <small className="job-error">{friendlyError(job.error)}</small>}
      {job.namingError && <small className="job-error">Filename normalization: {job.namingError}</small>}
      {job.finalPath && <DownloadButton onAction={onAction} command={{ action: "file-details", job: job.id }} label="File details" glyph="info" className="text-button file-details-link" />}
    </div>
    <div className="job-controls">
      {canRemoveDownload(job) && <DownloadButton onAction={onAction} command={{ action: "job", job: job.id, control: "remove" }} label="Remove from queue" glyph="trash" iconOnly title="Remove from queue and delete temporary data" />}
      {canPauseDownload(job) && <DownloadButton onAction={onAction} command={{ action: "job", job: job.id, control: "pause" }} label="Pause download" glyph="pause" iconOnly />}
      {canResumeDownload(job) && <DownloadButton onAction={onAction} command={{ action: "job", job: job.id, control: "resume" }} label="Resume download" glyph="play" iconOnly />}
      {job.status === "complete" && <>
        <DownloadButton onAction={onAction} command={{ action: "open-job", job: job.id }} label="Open video" glyph="play" iconOnly />
        <DownloadButton onAction={onAction} command={{ action: "remove-history", job: job.id }} label="Remove from history; keep file on disk" glyph="close" iconOnly />
      </>}
    </div>
  </article>;
}
