import { bytes } from "../../shared/lib/format.mjs";
import { batchProgress } from "../../../core/progress.mjs";
import { visibleDownloads, pendingDownloadCount } from "./selectors";
import type { DownloadsState, DownloadActionHandler } from "./types";
import { DownloadRow } from "./components/DownloadRow";
import { DownloadActions } from "./components/DownloadActions";
import { DownloadTabs } from "./components/DownloadTabs";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Icon } from "../../shared/ui/Icon";

interface Props { state: DownloadsState; onAction: DownloadActionHandler; onBrowse: () => void }

export function DownloadsPage({ state, onAction, onBrowse }: Props) {
  const finished = state.downloadTab === "finished";
  const jobs = visibleDownloads(state.jobs, finished);
  const { total, received, remaining } = batchProgress(state.jobs, state.currentBatchId);
  const speed = jobs.reduce((sum, job) => sum + (job.speed || 0), 0);
  return <main>
    <section className="simple-heading">
      <div className="eyebrow">{finished ? "A PLACE FOR EVERYTHING" : "LET THE QUEUE DO ITS THING"}</div>
      <h1>Downloads, in motion.</h1>
      <p>{finished ? "Completed downloads, newest first. Removing history keeps your files on disk." : `${state.demo ? "Sample queue · no file transfers" : "Direct from Telegram to your computer"}${speed ? ` · ${bytes(speed)}/s` : ""}`}</p>
    </section>
    <DownloadTabs selected={state.downloadTab} onAction={onAction} />
    <div className="queue-summary">
      <div><small>IN QUEUE</small><strong>{pendingDownloadCount(state.jobs)}</strong></div>
      <div><small>{finished ? "COMPLETED" : "BATCH COMPLETED"}</small><strong>{state.jobs.filter(job => job.status === "complete" && (finished || job.batchId === state.currentBatchId)).length}</strong></div>
      <div>{finished ? <><small>SAVED FILE SIZE</small><strong className="size-total">{bytes(jobs.reduce((sum, job) => sum + job.item.size, 0))}</strong></> : <>
        <small>CURRENT BATCH</small><strong className="size-total">{bytes(received)} / {bytes(total)}</strong><small>{bytes(remaining)} remaining</small>
        <progress hidden={!total} className="batch-progress" max={total || 1} value={received} aria-label="Current batch download progress" />
      </>}</div>
    </div>
    <DownloadActions jobs={jobs} finished={finished} onAction={onAction} />
    <section key={state.downloadTab} id="downloads-panel" className="catalogue-panel queue-panel workspace-scroll" tabIndex={0} role="tabpanel" aria-labelledby={`downloads-tab-${state.downloadTab}`} aria-label={finished ? "Finished downloads" : "Ongoing downloads"}>
      {jobs.length ? jobs.map(job => <DownloadRow key={job.id} job={job} onAction={onAction} />) : <div className="empty-state">
        <div className="empty-symbol"><Icon name={finished ? "folder" : "download"} /></div>
        <h3>{finished ? "No finished downloads." : "No ongoing downloads."}</h3><p>Choose episodes from your series library to get started.</p>
        <ActionButton label="Browse your series" glyph="arrow" className="button primary" data-action="nav" data-page="library" onClick={event => { event.stopPropagation(); onBrowse(); }} />
      </div>}
    </section>
  </main>;
}
