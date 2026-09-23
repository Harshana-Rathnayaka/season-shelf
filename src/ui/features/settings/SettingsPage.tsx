import type { SettingsState, SettingsActionHandler, SaveSettings } from "./types";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { StorageSettings } from "./components/StorageSettings";
import { ChannelSettings } from "./components/ChannelSettings";
import { ActivitySettings } from "./components/ActivitySettings";
import { AboutSettings } from "./components/AboutSettings";

export function SettingsPage({ state, onSave, onAction }: { state: SettingsState; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  return <main><section className="simple-heading"><div className="eyebrow">MAKE YOURSELF AT HOME</div><h1>A workspace that fits.</h1><p>Make it yours. Keep your downloads organised.</p></section>
    <section className="settings-panel settings-groups workspace-scroll" tabIndex={0} role="region" aria-label="Settings">
      <AppearanceSettings settings={state.settings} onSave={onSave} onAction={onAction} />
      <StorageSettings state={state} onSave={onSave} onAction={onAction} />
      <ChannelSettings settings={state.settings} onSave={onSave} onAction={onAction} />
      <ActivitySettings state={state} onAction={onAction} />
      <AboutSettings state={state} onAction={onAction} />
    </section>
  </main>;
}
