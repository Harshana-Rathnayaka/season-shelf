import type { SettingsState, SettingsActionHandler, SaveSettings } from "../types";
import { SettingsButton } from "./SettingsButton";
import { TransferForm } from "./TransferForm";
import { Switch } from '../../../shared/ui/Switch';
import { RadioChoices } from '../../../shared/ui/RadioChoices';

export function StorageSettings({ state, onSave, onAction }: { state: SettingsState; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  const { settings } = state;
  return <section className="settings-group"><h2>Downloads and storage</h2>
    {(["archive", "watch"] as const).map(mode => <div className="setting-row" key={mode}><div><h3>{mode === "archive" ? "Download folder" : "Watch folder"}</h3><p>{settings[mode === "archive" ? "archiveRoot" : "watchRoot"]?.path || "No folder selected"}</p></div><SettingsButton label="Choose folder" glyph="folder" command={{ action: "folder", mode }} onAction={onAction} /></div>)}
    <TransferForm key={JSON.stringify(settings.transfer)} value={settings.transfer || {}} onSave={onSave} />
    <div className="setting-row"><div><h3>Simultaneous downloads</h3><p>Choose how many files can download at once.</p></div>
      <RadioChoices label="Simultaneous downloads" hideLabel name="concurrency" value={String(settings.concurrency || 2)} options={[1,2,3,4].map(n=>({value:String(n),label:String(n)}))} onValueChange={async value=>onSave({concurrency:Number(value)})} />
    </div>
    <div className="setting-row"><div><h3>Download complete notifications</h3><p>Show a desktop notification when downloads finish.</p></div>
      <Switch id="download-complete-notifications" label="Download complete notifications" checked={settings.downloadCompleteNotifications !== false} onCheckedChange={async checked=>onSave({downloadCompleteNotifications:checked})} />
    </div>
    <div className="setting-row"><div><h3>Keep app in system tray</h3><p>{state.environment === "development" ? "Development mode exits when the window closes. Tray operation is available in installed builds." : "When closing the window, keep the app in the tray. Turn off to quit. Downloads pause either way; file checks and transfers finish safely."}</p></div>
      <Switch id="close-behavior" label="Keep app in system tray" disabled={state.environment === "development"} checked={settings.closeToTray !== false && state.environment !== "development"} onCheckedChange={async checked=>onSave({closeToTray:checked})} />
    </div>
  </section>;
}
