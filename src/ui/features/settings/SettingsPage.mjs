import { icon } from "../../shared/ui/icons.mjs";
import { escape, bytes } from "../../shared/lib/format.mjs";
import { defaultHiddenKeywords } from "../../../core/catalog.mjs";
import { appearanceForm } from "./appearance.mjs";
export function usageTiles(usage) {
  return `<div>
    <small>Network payload received</small>
    <strong>${bytes(usage.payloadBytes || 0)}</strong>
    </div>
    <div>
    <small>Verified bytes published</small>
    <strong>${bytes(usage.publishedBytes || 0)}</strong>
    </div>
    <div>
    <small>Files completed</small>
    <strong>${usage.completedFiles || 0}</strong>
    </div>`;
}
function updateMessage(updates) {
  const u = updates || {};
  return ({manual:"Download the latest Mac version from GitHub and replace the app in Applications.", idle:"Check for a newer version.", development:"Update checks are disabled in development mode. Use the installed Windows app to check and install updates.", checking:"Checking for updates...", current:"You are up to date.", unpublished:"Updates will appear here when the first release is published.", available:`Version ${u.version} is available.`, downloading:`Downloading update: ${u.percent || 0}%`, ready:"Your update is ready to install.", error:"Could not check for updates. Please try again later."})[u.state] || "Check for updates.";
}
export function settingsPage(state) {
  return `<section class="simple-heading">
    <div class="eyebrow">MAKE YOURSELF AT HOME</div>
    <h1>A workspace that fits.</h1>
    <p>Make it yours. Keep your downloads organised.</p>
    </section>
    <section class="settings-panel settings-groups workspace-scroll" tabindex="0" role="region" aria-label="Settings">${appearanceSettings(state)}
    ${storageSettings(state)}
    ${channelSettings(state)}
    ${activitySettings(state)}
    ${aboutSettings(state)}</section>`;
}


function appearanceSettings(state) {
  return `<section class="settings-group">
    <h2>Appearance</h2>  <div class="setting-row">
    <div>
    <h3>Theme</h3>
    <p>A little easier on the eyes.</p>
    </div>
    <div class="segmented">${["dark", "light", "system"].map((theme) => `<button data-action="set-theme" data-theme="${theme}" class="${state.settings.theme === theme ? "active" : ""}">${theme[0].toUpperCase() + theme.slice(1)}</button>`).join("")}</div>
    </div>${appearanceForm(state.settings)}</section>`;
}

function storageSettings(state) {
  return `<section class="settings-group">
    <h2>Downloads and storage</h2>  ${["archive", "watch"].map((mode) => `<div class="setting-row">
    <div>
    <h3>${mode === "archive" ? "Download folder" : "Watch folder"}</h3>
    <p>${escape(state.settings[`${mode}Root`]?.path || "No folder selected")}</p>
    </div>
    <button class="button secondary" data-action="folder" data-mode="${mode}">${icon("folder")}Choose folder</button>
    </div>`).join("")}  <form id="transfer-form" class="setting-row transfer-settings">
    <div>
    <h3>Download hours and bandwidth</h3>
    <p>Set a shared speed limit and an optional daily schedule.</p>
    <div class="transfer-fields">
    <label class="transfer-field">Speed limit<span class="unit-field">
    <input name="speedKiB" type="number" min="0" max="1048576" value="${state.settings.transfer?.speedKiB || 0}" aria-describedby="speed-help">
    <span>KiB/s</span>
    </span>
    <small id="speed-help">0 means unlimited, across all downloads.</small>
    </label>
    <div class="schedule-field">
    <label class="schedule-toggle">
    <input name="scheduled" type="checkbox" ${state.settings.transfer?.scheduled ? 'checked' : ''}>Use download hours</label>
    <fieldset class="schedule-times" ${state.settings.transfer?.scheduled ? '' : 'disabled'}>
    <legend class="sr-only">Download hours</legend>
    <label>From<input name="start" type="time" value="${state.settings.transfer?.start || '00:00'}">
    </label>
    <label>Until<input name="end" type="time" value="${state.settings.transfer?.end || '00:00'}">
    </label>
    </fieldset>
    <small>Local time. Matching times allow all day.</small>
    </div>
    </div>
    <div class="transfer-footer">
    <button class="button secondary">Save download preferences</button>
    <small>Requests already in progress may finish after the window closes.</small>
    </div>
    </div>
    </form>  <div class="setting-row">
    <div>
    <h3>Simultaneous downloads</h3>
    <p>Choose how many files can download at once.</p>
    </div>
    <select id="concurrency" aria-label="Simultaneous downloads">${[1, 2, 3, 4].map((n) => `<option ${n === state.settings.concurrency ? "selected" : ""}>${n}</option>`).join("")}</select>
    </div>
    <div class="setting-row">
    <div>
    <h3>When closing the window</h3>
    <p>${state.environment === "development" ? "Development mode exits when the window closes. Tray operation is available in installed builds." : "Downloads pause in both modes. File checks and transfers finish safely."}</p>
    </div>
    <select id="close-behavior" aria-label="When closing the window" ${state.environment === "development" ? "disabled" : ""}>
    <option value="tray" ${state.settings.closeToTray !== false && state.environment !== "development" ? "selected" : ""}>Keep in system tray</option>
    <option value="quit" ${state.settings.closeToTray === false || state.environment === "development" ? "selected" : ""}>Close the app</option>
    </select>
    </div>
    </section>`;
}

function channelSettings(state) {
  return `<section class="settings-group">
    <h2>Channel filtering</h2>  <div class="keyword-settings">
    <h3>Channel keyword filter</h3>
    <p>Hide matching words or phrases in Suggested channels. One per line or separate with commas. All channels always shows everything.</p>
    <form id="keyword-form">
    <label for="hidden-keywords">Hidden keywords</label>
    <textarea id="hidden-keywords" name="keywords" rows="5" spellcheck="false">${escape((state.settings.hiddenKeywords ?? defaultHiddenKeywords).join("\n"))}</textarea>
    <div class="row-actions">
    <button class="button primary" type="submit">Save keywords</button>
    <button class="button secondary" data-action="reset-keywords">Restore defaults</button>
    </div>
    </form>
    <small>Media-labelled channels stay visible. Leave the list empty to disable keyword hiding.</small>
    </div>
    </section>`;
}

function activitySettings(state) {
  return `<section class="settings-group">
    <h2>Data and activity</h2>  <div class="keyword-settings">
    <h3>Unused partial files</h3>
    <p>${state.stagingInfo ? `${state.stagingInfo.count} unused ${state.stagingInfo.count === 1 ? "file" : "files"} &middot; ${bytes(state.stagingInfo.bytes)}` : "Check for partial files left behind by removed queue entries."}</p>
    <div class="row-actions">
    <button class="button secondary" data-action="scan-staging">Check storage</button>
    <button class="button secondary" data-action="cleanup-staging" ${!state.stagingInfo?.count ? "disabled" : ""}>${icon("trash")}Clean up unused partials</button>
    </div>
    <p>Current jobs, including paused and cancelled entries, are preserved. Cleanup uses the Recycle Bin.</p>
    </div>  <div class="usage-settings">
    <h3>Lifetime activity</h3>
    <div class="usage-summary" id="usage-summary">${usageTiles(state.usage)}</div>
    <p>Measured since ${state.usage.since ? escape(new Date(state.usage.since).toLocaleString()) : "this update"}. Received data includes retries. Saved data counts successfully completed downloads. These totals remain after deleting files and exclude activity before tracking began.</p>
    <button class="button secondary" data-action="reset-activity">Reset lifetime totals</button>
    </div>
    <div class="setting-row">
    <div>
    <h3>Clear app data</h3>
    <p>Reset history, the selected series, series watches and lifetime totals. Keeps downloaded files, partials, your login and preferences.</p>
    </div>
    <button class="button secondary" data-action="clear-app-data">Clear app data</button>
    </div>
    </section>`;
}

function aboutSettings(state) {
  return `<section class="settings-group">
    <h2>About</h2>
    <div class="setting-row">
    <div>
    <h3>Quick start guide</h3>
    <p>Revisit the steps for connecting, choosing files and downloading.</p>
    </div>
    <button class="button secondary" data-action="show-guide">Watch guide again</button>
    </div>  <div class="setting-row update-settings">
    <div>
    <h3>Season Shelf</h3>
    <p>Version ${escape(state.version || "Preview")}</p>
    <p id="update-status" role="status">${escape(updateMessage(state.updates))}</p>${!["manual","development"].includes(state.updates?.state) ? `<p class="update-last-checked">Last checked: ${state.updates?.lastCheckedAt ? escape(new Date(state.updates.lastCheckedAt).toLocaleString()) : "Never"}</p>` : ""}<p>${state.updates?.state === "manual" ? "Mac updates are installed manually. Quit the app before replacing it; your settings and history are kept." : "Updates download automatically at startup and during daily checks. Choose Restart now or Not now; deferred updates install on the next launch after verification."}</p>
    <div class="queue-actions">
    <button class="button secondary" data-action="update-check" aria-busy="${!!state.updateChecking || state.updates?.state === "checking"}" ${state.updateChecking || ["checking","downloading","ready","development"].includes(state.updates?.state) ? "disabled" : ""}>${state.updateChecking || state.updates?.state === "checking" ? `<span class="update-spinner" aria-hidden="true">
    </span>Checking...` : state.updates?.state === "development" ? "Available in installed app" : state.updates?.state === "manual" ? "Open GitHub releases" : "Check for updates"}</button>${state.updates?.state === "available" ? `<button class="button secondary" data-action="update-download">Download update</button>` : ""}${state.updates?.state === "ready" ? `<button class="button primary" data-action="update-install">Restart and install</button>` : ""}</div>
    <p>Licensed under the MIT License. Copyright &copy; 2026 Harshana Rathnayaka. Third-party components retain their own licenses.</p>
    <button class="text-button" data-action="licenses">Third-party licenses</button>
    </div>
    </div>  <div class="settings-footnote">${icon("shield")} Files download directly from Telegram. Settings and download history stay on your computer. This app uses the Telegram API and is an independent, unofficial client.</div>
    </section>`;
}
