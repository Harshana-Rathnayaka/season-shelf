import type { DownloadRecord } from "../types";
import type { DialogActionHandler } from "../../../shared/ui/dialog-actions";
import { DialogButton } from "../../../shared/ui/DialogButton";

export function FileDetailsDialog({ job, onAction }: { job: DownloadRecord; onAction: DialogActionHandler }) {
  const name = job.finalPath?.split(/[\\/]/).pop() || job.item.filename;
  return <><h2>File details</h2><dl className="file-details"><dt>Saved filename</dt><dd>{name}</dd><dt>Original Telegram filename</dt><dd>{job.item.filename}</dd><dt>Location</dt><dd>{job.finalPath || "Not saved yet"}</dd></dl>
    {job.namingError && <><p className="job-error">{job.namingError}</p><DialogButton label="Retry season naming" glyph="refresh" action="retry-naming" data={{ job: job.id }} onAction={onAction} /></>}
    {job.status === "complete" && <><DialogButton label="Show in folder" glyph="folder" action="reveal-job" data={{ job: job.id }} onAction={onAction} /><DialogButton label="Move file to Recycle Bin" glyph="trash" action="delete-job" data={{ job: job.id }} onAction={onAction} /><p>This moves the file from disk to the Recycle Bin. To keep it, use Remove from history in the Finished list.</p></>}
    <p>Earlier downloads may use the old naming format. This is the recorded file location; existing files have not been renamed or moved.</p>
  </>;
}
