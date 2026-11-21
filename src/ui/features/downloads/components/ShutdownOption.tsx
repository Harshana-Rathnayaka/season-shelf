import type {DownloadsState,DownloadActionHandler} from '../types';
import {AsyncActionButton} from '../../../shared/ui/AsyncActionButton';

export function ShutdownOption({state,onAction}:{state:DownloadsState;onAction:DownloadActionHandler}) {
  const status=state.shutdown,enabled=!!status?.enabled;
  const pending=state.jobs.some(job=>!['complete','deleted','missing','cancelled','preview'].includes(job.status));
  const message=state.demo?'Available for real downloads in the Windows desktop app.'
    : !status?.available?'Available on Windows.'
    : status.message || 'Off by default. Enable for this queue; you get 60 seconds to cancel after every file is saved. Resets when the app exits.';
  return <section className="shutdown-option" aria-label="After downloads finish">
    <div><strong>Shut down when downloads finish</strong><p id="shutdown-description">{message}</p></div>
    <AsyncActionButton label={enabled?'On':'Off'} aria-label="Shut down when downloads finish" role="switch" aria-checked={enabled}
      aria-describedby="shutdown-description" className="button secondary shutdown-switch" data-action="shutdown-toggle"
      disabled={state.demo || !status?.available || status.phase==='requested' || (!enabled && !pending)}
      onAction={()=>onAction({action:'shutdown-toggle',enabled:!enabled})} />
  </section>;
}
