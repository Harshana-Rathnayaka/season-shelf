import { Icon } from "../../../shared/ui/Icon";
import type { SettingsState, SettingsActionHandler } from "../types";
import { updateMessage } from "../update-message";
import { SettingsButton } from "./SettingsButton";

export function AboutSettings({ state, onAction }: { state: SettingsState; onAction: SettingsActionHandler }) {
  const update = state.updates || {};
  const checking = !!state.updateChecking || update.state === "checking";
  return <section className="settings-group"><h2>About</h2>
    <div className="setting-row"><div><h3>Quick start guide</h3><p>Revisit the steps for connecting, choosing files and downloading.</p></div><SettingsButton label="Watch guide again" command={{ action: "show-guide" }} onAction={onAction} /></div>
    <div className="setting-row update-settings"><div><h3>Season Shelf</h3><p>Version {state.version || "Preview"}</p>
      <p id="update-status" role="status">{updateMessage(update)}</p>
      {!["manual", "development"].includes(update.state || "") && <p className="update-last-checked">Last checked: {update.lastCheckedAt ? new Date(update.lastCheckedAt).toLocaleString() : "Never"}</p>}
      <p>{update.state === "manual" ? "Mac updates are installed manually. Quit the app before replacing it; your settings and history are kept." : "Updates download automatically at startup and during daily checks. Choose Restart now or Not now; deferred updates install on the next launch after verification."}</p>
      <div className="queue-actions">
        <button type="button" className="button secondary" data-action="update-check" aria-busy={checking} disabled={checking || ["downloading", "ready", "development"].includes(update.state || "")}
          onClick={event => { event.stopPropagation(); void onAction({ action: "update-check" }); }}>
          {checking ? <><span className="update-spinner" aria-hidden="true" />Checking...</> : update.state === "development" ? "Available in installed app" : update.state === "manual" ? "Open GitHub releases" : "Check for updates"}
        </button>
        {update.state === "available" && <SettingsButton label="Download update" command={{ action: "update-download" }} onAction={onAction} />}
        {update.state === "ready" && <SettingsButton label="Restart and install" className="button primary" command={{ action: "update-install" }} onAction={onAction} />}
      </div>
      <p>Licensed under the MIT License. Copyright © 2026 Harshana Rathnayaka. Third-party components retain their own licenses.</p>
      <SettingsButton label="Third-party licenses" className="text-button" command={{ action: "licenses" }} onAction={onAction} />
    </div></div>
    <div className="settings-footnote"><Icon name="shield" /> Files download directly from Telegram. Settings and download history stay on your computer. This app uses the Telegram API and is an independent, unofficial client.</div>
  </section>;
}
