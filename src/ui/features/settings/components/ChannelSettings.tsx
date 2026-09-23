import { defaultHiddenKeywords, cleanKeywords } from "../../../../core/catalog.mjs";
import type { Settings, SettingsActionHandler, SaveSettings } from "../types";
import { AsyncForm } from "../../../shared/ui/AsyncForm";
import { SettingsButton } from "./SettingsButton";

export function ChannelSettings({ settings, onSave, onAction }: { settings: Settings; onSave: SaveSettings; onAction: SettingsActionHandler }) {
  const keywords = settings.hiddenKeywords ?? defaultHiddenKeywords;
  return <section className="settings-group"><h2>Channel filtering</h2><div className="keyword-settings"><h3>Channel keyword filter</h3><p>Hide matching words or phrases in Suggested channels. One per line or separate with commas. All channels always shows everything.</p>
    <AsyncForm key={JSON.stringify(keywords)} id="keyword-form" onSave={form => onSave({ hiddenKeywords: cleanKeywords((form.elements.namedItem("keywords") as HTMLTextAreaElement).value.split(/[\n,]/)) }, "Channel filters saved.")}>
      {pending => <><label htmlFor="hidden-keywords">Hidden keywords</label><textarea id="hidden-keywords" name="keywords" rows={5} spellCheck={false} defaultValue={keywords.join("\n")} /><div className="row-actions"><button className="button primary" type="submit" disabled={pending}>Save keywords</button><SettingsButton label="Restore defaults" command={{ action: "reset-keywords" }} onAction={onAction} /></div></>}
    </AsyncForm><small>Media-labelled channels stay visible. Leave the list empty to disable keyword hiding.</small>
  </div></section>;
}
