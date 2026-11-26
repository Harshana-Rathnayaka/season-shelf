import { cleanAppearance } from "../../../../core/appearance.mjs";
import { appearanceValues, previewAppearance } from "../appearance";
import type { Settings, SaveSettings, SettingsActionHandler, Theme } from "../types";
import { AsyncForm } from "../../../shared/ui/AsyncForm";
import { SettingsButton } from "./SettingsButton";
import { Switch } from '../../../shared/ui/Switch';
import { RadioChoices } from '../../../shared/ui/RadioChoices';

export function AppearanceSettings({ settings, onSave, onAction }: { settings: Settings; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  const value = cleanAppearance(settings.appearance);
  const light = settings.theme === "light" || (settings.theme === "system" && !matchMedia("(prefers-color-scheme: dark)").matches);
  return <section className="settings-group"><h2>Appearance</h2>
    <div className="setting-row"><div><h3>Theme</h3><p>GitHub-inspired light and dark colours. System follows your device.</p></div>
      <div className="segmented">{(["dark", "light", "system"] as Theme[]).map(theme => <button key={theme} type="button" data-action="set-theme" data-theme={theme} className={settings.theme === theme ? "active" : ""}
        onClick={event => { event.stopPropagation(); void onSave({ theme }); }}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}</div>
    </div>
    <AsyncForm key={`${JSON.stringify(value)}:${light}`} id="appearance-form" className="keyword-settings"
      onInput={event => { event.stopPropagation(); previewAppearance(event, settings); }}
      onChange={event => { event.stopPropagation(); previewAppearance(event, settings); }}
      onSave={form => onSave({ appearance: appearanceValues(form) }, "Appearance saved.")}>
      {pending => <><h3>Typography and colours</h3><p>Changes preview immediately. Apply to save them across the app.</p>
        <div className="appearance-grid">
          <RadioChoices label="Text size" name="size" defaultValue={String(value.size)} options={[90,100,110,120].map(size=>({value:String(size),label:`${size}%`}))} />
          <RadioChoices label="Text weight" name="weight" defaultValue={String(value.weight)} options={[{value:'400',label:'Regular'},{value:'500',label:'Medium'},{value:'600',label:'Semibold'}]} />
          <div className="appearance-field"><label htmlFor="accent-colour">Accent colour</label><input id="accent-colour" name="accent" type="color" defaultValue={value.accent || (light ? "#0969da" : "#4493f8")} /><Switch name="autoAccent" label="Automatic accent colour" text="Automatic" defaultChecked={!value.accent} /></div>
          <div className="appearance-field"><label htmlFor="text-colour">Text colour</label><input id="text-colour" name="text" type="color" defaultValue={value.text || (light ? "#1f2328" : "#f0f6fc")} /><Switch name="autoText" label="Automatic text colour" text="Automatic" defaultChecked={!value.text} /></div>
        </div>
        <div className="row-actions"><button className="button primary" type="submit" disabled={pending}>Apply appearance</button><SettingsButton label="Reset appearance" command={{ action: "reset-appearance" }} onAction={onAction} /></div>
        <p>Custom text colour applies to both themes. Reset restores readable defaults.</p>
      </>}
    </AsyncForm>
  </section>;
}
