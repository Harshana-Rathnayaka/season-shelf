import { bytes } from "../../../shared/lib/format";
import type { Usage, SettingsState, SettingsActionHandler } from "../types";
import { SettingsButton } from "./SettingsButton";

function UsageSummary({ usage }: { usage: Usage }) {
  return <div className="usage-summary" id="usage-summary">
    <div><small>Network payload received</small><strong>{bytes(usage.payloadBytes || 0)}</strong></div>
    <div><small>Verified bytes published</small><strong>{bytes(usage.publishedBytes || 0)}</strong></div>
    <div><small>Files completed</small><strong>{usage.completedFiles || 0}</strong></div>
  </div>;
}

export function ActivitySettings({ state, onAction }: { state: SettingsState; onAction: SettingsActionHandler }) {
  return <section className="settings-group"><h2>Data and activity</h2>
    <div className="keyword-settings"><h3>Unused partial files</h3><p>{state.stagingInfo ? `${state.stagingInfo.count} unused ${state.stagingInfo.count === 1 ? "file" : "files"} · ${bytes(state.stagingInfo.bytes)}` : "Check for partial files left behind by removed queue entries."}</p>
      <div className="row-actions"><SettingsButton label="Check storage" command={{ action: "scan-staging" }} onAction={onAction} /><SettingsButton label="Clean up unused partials" glyph="trash" disabled={!state.stagingInfo?.count} command={{ action: "cleanup-staging" }} onAction={onAction} /></div>
      <p>Current jobs, including paused and cancelled entries, are preserved. Cleanup uses the Recycle Bin.</p>
    </div>
    <div className="usage-settings"><h3>Lifetime activity</h3><UsageSummary usage={state.usage} /><p>Measured since {state.usage.since ? new Date(state.usage.since).toLocaleString() : "this update"}. Received data includes retries. Saved data counts successfully completed downloads. These totals remain after deleting files and exclude activity before tracking began.</p><SettingsButton label="Reset lifetime totals" command={{ action: "reset-activity" }} onAction={onAction} /></div>
    <div className="setting-row"><div><h3>Clear app data</h3><p>Reset history, the selected series, series watches and lifetime totals. Keeps downloaded files, partials, your login and preferences.</p></div><SettingsButton label="Clear app data" command={{ action: "clear-app-data" }} onAction={onAction} /></div>
  </section>;
}
