import type { SettingsState, SettingsActionHandler, SaveSettings } from "../types";
import { SettingsButton } from "./SettingsButton";
import { TransferForm } from "./TransferForm";

export function StorageSettings({ state, onSave, onAction }: { state: SettingsState; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  const { settings } = state;
  return <section className="settings-group"><h2>Downloads and storage</h2>
    {(["archive", "watch"] as const).map(mode => <div className="setting-row" key={mode}><div><h3>{mode === "archive" ? "Download folder" : "Watch folder"}</h3><p>{settings[mode === "archive" ? "archiveRoot" : "watchRoot"]?.path || "No folder selected"}</p></div><SettingsButton label="Choose folder" glyph="folder" command={{ action: "folder", mode }} onAction={onAction} /></div>)}
    <TransferForm key={JSON.stringify(settings.transfer)} value={settings.transfer || {}} onSave={onSave} />
    <div className="setting-row"><div><h3>Simultaneous downloads</h3><p>Choose how many files can download at once.</p></div>
      <select id="concurrency" aria-label="Simultaneous downloads" value={settings.concurrency || 2} onChange={event => { event.stopPropagation(); void onSave({ concurrency: Number(event.currentTarget.value) }); }}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select>
    </div>
    <div className="setting-row"><div><h3>When closing the window</h3><p>{state.environment === "development" ? "Development mode exits when the window closes. Tray operation is available in installed builds." : "Downloads pause in both modes. File checks and transfers finish safely."}</p></div>
      <select id="close-behavior" aria-label="When closing the window" disabled={state.environment === "development"} value={settings.closeToTray !== false && state.environment !== "development" ? "tray" : "quit"} onChange={event => { event.stopPropagation(); void onSave({ closeToTray: event.currentTarget.value === "tray" }); }}><option value="tray">Keep in system tray</option><option value="quit">Close the app</option></select>
    </div>
  </section>;
}
