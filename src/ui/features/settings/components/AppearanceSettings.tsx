import { cleanAppearance } from "../../../../core/appearance.mjs";
import { appearanceValues, previewAppearance } from "../appearance.mjs";
import type { Settings, SaveSettings, SettingsActionHandler, Theme } from "../types";
import { AsyncForm } from "../../../shared/ui/AsyncForm";
import { SettingsButton } from "./SettingsButton";

export function AppearanceSettings({ settings, onSave, onAction }: { settings: Settings; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  const value = cleanAppearance(settings.appearance);
  return <section className="settings-group"><h2>Appearance</h2>
    <div className="setting-row"><div><h3>Theme</h3><p>A little easier on the eyes.</p></div>
      <div className="segmented">{(["dark", "light", "system"] as Theme[]).map(theme => <button key={theme} type="button" data-action="set-theme" data-theme={theme} className={settings.theme === theme ? "active" : ""}
        onClick={event => { event.stopPropagation(); void onSave({ theme }); }}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}</div>
    </div>
    <AsyncForm key={JSON.stringify(value)} id="appearance-form" className="keyword-settings"
      onInput={event => { event.stopPropagation(); previewAppearance(event, settings); }}
      onChange={event => { event.stopPropagation(); previewAppearance(event, settings); }}
      onSave={form => onSave({ appearance: appearanceValues(form) }, "Appearance saved.")}>
      {pending => <><h3>Typography and colours</h3><p>Changes preview immediately. Apply to save them across the app.</p>
        <div className="appearance-grid">
          <label>Text size<select name="size" defaultValue={value.size}>{[90, 100, 110, 120].map(size => <option key={size} value={size}>{size}%</option>)}</select></label>
          <label>Text weight<select name="weight" defaultValue={value.weight}>{[[400, "Regular"], [500, "Medium"], [600, "Semibold"]].map(([weight, label]) => <option key={weight} value={weight}>{label}</option>)}</select></label>
          <label>Accent colour<input name="accent" type="color" defaultValue={value.accent || "#a0e4c6"} /><span><input name="autoAccent" type="checkbox" defaultChecked={!value.accent} /> Automatic</span></label>
          <label>Text colour<input name="text" type="color" defaultValue={value.text || "#edf0ef"} /><span><input name="autoText" type="checkbox" defaultChecked={!value.text} /> Automatic</span></label>
        </div>
        <div className="row-actions"><button className="button primary" type="submit" disabled={pending}>Apply appearance</button><SettingsButton label="Reset appearance" command={{ action: "reset-appearance" }} onAction={onAction} /></div>
        <p>Custom text colour applies to both themes. Reset restores readable defaults.</p>
      </>}
    </AsyncForm>
  </section>;
}
