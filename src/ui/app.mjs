import { pendingDownloadCount } from "./models/downloads.mjs";
import { escape, friendlyError } from "./format.mjs";
import { chosen, visible, selectedItems, effectiveQuality } from "./models/library.mjs";
import { library } from "./pages/library.mjs";
import { queuePage } from "./pages/downloads.mjs";
import { helpPage } from "./pages/help.mjs";
import { settingsPage, usageTiles } from "./pages/settings.mjs";
import { appShell } from "./components/app-shell.mjs";
import { handleDownloadAction, isDownloadAction } from "./actions/downloads.mjs";
import { missingEpisodes } from "../core/collection.mjs";
import { applyAppearance, appearanceValues, previewAppearance } from "./appearance.mjs";
import { advanceDiscovery } from "./discovery-flow.mjs";
import { icon } from "./icons.mjs";
import { channelCategory, defaultHiddenKeywords, cleanKeywords } from "../core/catalog.mjs";
import { demoCatalogue } from "./demo.mjs";

const $ = (selector) => document.querySelector(selector);
const state = {
  updates: {state:"idle"},
  page: "library",
  downloadTab: "ongoing",
  mode: "archive",
  quality: {},
  libraryTab: "verified",
  channelFilter: "suggested",
  season: 1,
  selected: new Set(),
  query: "",
  catalogue: null,
  channels: [],
  jobs: [],
  usage: {payloadBytes:0,publishedBytes:0,completedFiles:0},
  stagingInfo: null,
  connected: false,
  hasCredentials: false,
  settings: { theme: "dark", concurrency: 2 },
  demo: !window.shelf,
  busy: false,
};
let discoveryVersion = 0, discoveryBusy = false, titleBarColours = "";
let toastTimer, liveSnapshot, libraryViewKey, seasonChannelKey, renderedPage;
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = friendlyError(message);
  el.className = `visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 5500);
}
async function call(method, payload) {
  if (!window.shelf)
    throw new Error("Open the desktop app to use your Telegram account");
  const result = await window.shelf.call(method, payload);
  if (!result.ok) throw new Error(friendlyError(result.error));
  return result.data;
}
function applyTheme() {
  applyAppearance(state.settings);
  document.documentElement.dataset.theme =
    state.settings.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : state.settings.theme;
  if (state.customTitleBar && window.shelf) {
    const light = document.documentElement.dataset.theme === "light";
    const color = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (light ? "#f5f6f4" : "#101113");
    const symbolColor = light ? "#202c27" : "#edf0ef";
    const signature = color + symbolColor;
    if (signature !== titleBarColours) {
      titleBarColours = signature;
      call("window-theme",{color,symbolColor}).catch(()=>{titleBarColours="";});
    }
  }
}
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  applyTheme,
);
function startDemo() {
  if (!state.demo)
    liveSnapshot = {
      catalogue: state.catalogue,
      jobs: state.jobs,
      channels: state.channels,
    };
  state.demo = true;
  state.catalogue = demoCatalogue();
  state.channels = [state.catalogue.channel];
  state.jobs = [];
  state.season = 4;
  state.selected.clear();
  visible(state)
    .slice(0, 3)
    .forEach((item) => state.selected.add(item.id));
  render();
}
function render() {
  const oldPageScroll = $(".workspace-scroll")?.scrollTop || 0;
  const pageKey = state.page === "queue" ? `${state.page}:${state.downloadTab}` : state.page;
  const keepPageScroll = renderedPage === pageKey;
  renderedPage = pageKey;
  const oldTop = $(".episode-table")?.scrollTop || 0;
  const oldLeft = $(".season-tabs")?.scrollLeft || 0;
  const channelKey = state.catalogue?.channel.id;
  const viewKey = JSON.stringify([channelKey, state.libraryTab, state.season, effectiveQuality(state), state.query]);
  applyTheme();
  $("#app").classList.toggle("sidebar-collapsed", !!state.settings.sidebarCollapsed);
  const count = pendingDownloadCount(state.jobs);
  $("#app").classList.toggle("custom-titlebar", !!state.customTitleBar);
  const content = state.page === "library" ? library(state, !!window.shelf) : state.page === "settings" ? settingsPage(state) : state.page === "help" ? helpPage() : queuePage(state);
  $("#app").innerHTML = appShell(state, content, count);
  if (state.page === "library")
    $("#select-all")?.setAttribute("aria-label", "Select all visible episodes");
  if ($(".episode-table") && libraryViewKey === viewKey) $(".episode-table").scrollTop = oldTop;
  if ($(".season-tabs") && seasonChannelKey === channelKey) $(".season-tabs").scrollLeft = oldLeft;
  libraryViewKey = viewKey;
  seasonChannelKey = channelKey;
  if (keepPageScroll && $(".workspace-scroll")) $(".workspace-scroll").scrollTop = oldPageScroll;
  updateSeasonArrows();

}
function refreshQueueBadge() {
  const button=$('[data-page="queue"]');if(!button)return;
  const count=pendingDownloadCount(state.jobs);
  let badge=button.querySelector(".nav-count");if(!count){badge?.remove();return;}
  if(!badge){badge=document.createElement("b");badge.className="nav-count";button.append(badge);}badge.textContent=count;
}
function updateSeasonArrows() {
  const tabs = $(".season-tabs");
  if (!tabs) return;
  const overflow = tabs.scrollWidth > tabs.clientWidth + 1;
  $(".season-prev").disabled = !overflow || tabs.scrollLeft <= 1;
  $(".season-next").disabled = !overflow || tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
}
document.addEventListener("scroll", event => {
  if (event.target.classList?.contains("season-tabs")) updateSeasonArrows();
}, true);
window.addEventListener("resize", updateSeasonArrows);
document.addEventListener("keydown", event => {
  const tab = event.target.closest?.('[data-action="season"]');
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('[data-action="season"]')];
  const index = tabs.indexOf(tab);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : Math.max(0, Math.min(tabs.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
  tabs[next].click();
});
function updatePrompt() {
  if(state.updates?.state!=="ready" || state.updates.deferred || $("#dialog").open) return;
  modal(`<h2>Your update is ready</h2><p>Version ${escape(state.updates.version)} has downloaded. Restart now, or install on your next launch after verification.</p><p id="update-error" role="alert"></p><div class="dialog-actions"><button class="button secondary" data-action="update-later">Not now</button><button class="button primary" data-action="update-install">Restart now</button></div>`);
}
async function dismissDialogExtras() {
  const id=$("#dialog").dataset.confirmationId;
  if(id){delete $("#dialog").dataset.confirmationId;await call("confirmation-reply",{id,response:0}).catch(()=>{});}
  if($("#update-error") && state.updates?.state==="ready" && !state.updates.deferred) state.updates=await call("update-later");
}
function showGuide() { modal(`<h2>Welcome to Season Shelf</h2><p>Your series, organised on your computer.</p><ol class="onboarding-steps"><li><strong>Connect Telegram</strong><p>Use your own API credentials and sign in securely.</p></li><li><strong>Choose a series and folder</strong><p>Select a channel and the show folder. We create season folders inside it.</p></li><li><strong>Choose files and download</strong><p>Verified defaults to 720p HEVC. Unverified files are yours to select manually. Track progress in Downloads.</p></li></ol><p>You can revisit these instructions in How it works.</p><button class="button primary" data-action="finish-onboarding">Get started</button>`); }
function modal(content) {
  $("#dialog").innerHTML =
    `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button>${content}`;
  if (!$("#dialog").open) $("#dialog").showModal();
}
function connectionModal() {
  if (state.demo && window.shelf) {
    state.demo = false;
    if (liveSnapshot) Object.assign(state, liveSnapshot);
    else {
      state.catalogue = null;
      state.jobs = [];
    }
    render();
  }
  if (!window.shelf)
    return modal(
      `<div class="modal-icon">${icon("shield")}</div><h2>This is the interface preview.</h2><p>Telegram sign-in and file access run in the Electron desktop app. Open Season Shelf on your PC to connect your account.</p><button class="button primary" data-action="close-dialog">Got it</button>`,
    );
  if (state.connected) return chooseSeries();
  modal(
    `<div class="modal-icon">${icon("bolt")}</div><div class="eyebrow">YOUR ACCOUNT. YOUR COMPUTER.</div><h2>Connect to Telegram.</h2><p>Use the API ID and hash from my.telegram.org → API development tools. Your session is encrypted locally.</p>${state.hasCredentials ? '<button class="button primary full" data-action="reconnect">Reconnect saved account</button><p class="form-divider">Or connect with your API details</p>' : ""}<div id="login-suggestions" class="login-suggestions"></div><form id="connect-form"><label>API ID<input name="apiId" inputmode="numeric" required placeholder="e.g. 12345678" autocomplete="off"></label><label>API hash<input name="apiHash" type="password" required minlength="32" maxlength="32" autocomplete="off" placeholder="Your 32-character API hash"></label><label>Phone number<input name="phone" type="tel" required placeholder="+94 …" autocomplete="off"></label><button class="button primary full" type="submit">Connect securely ${icon("arrow")}</button></form><small class="modal-note">No bot token, hosting or subscription required.</small>`,
  );
  call("login-suggestions").then(entries=>{const box=$("#login-suggestions");if(box) box.innerHTML=entries.map(entry=>`<button class="button secondary" data-action="use-login" data-id="${escape(entry.id)}">Use ${escape(entry.phone)} &middot; API ${escape(entry.apiId)}</button>`).join("")+(entries.length?'<button class="text-button" data-action="forget-logins">Forget suggestions</button>':"");}).catch(()=>{});
}
function discoveryModal(source = null) {
  modal(`<h2>Find your next series.</h2>${source ? `<p>Your search will be posted in <strong>${escape(source.title)}</strong>${source.linked ? ", the discussion group linked to MovieClubFamily" : ""}. Other members can see it. @MCF_SeriesBot replies in that group.</p><form id="discovery-form"><input type="hidden" name="sourceId" value="${escape(source.id)}"><label>Series name<input name="query" required maxlength="120" placeholder="e.g. Breaking Bad" autocomplete="off"></label><button class="button primary full" type="submit">Post search in this group</button></form>` : `<p>Search in the MovieClubFamily shared chat, then open the series bot's result.</p><button class="button primary full" data-action="discovery-source">Find MovieClubFamily search group</button>`}<details class="message-link-entry"><summary>Already have a Telegram message link?</summary><form id="discovery-link-form"><label>Private message link<input name="link" type="url" required maxlength="2048" placeholder="https://t.me/c/123456/789"></label><button class="button secondary full" type="submit">Read linked message</button></form><p>Reads the message using your account. Nothing is sent and no channel is joined until you choose an action.</p></details><p>One series result opens automatically, starts the bot and joins its channel. When several results appear, choose one. Files are downloaded only after you select episodes.</p>`);
}
async function discoveryRequest(method,payload) {
  const version = ++discoveryVersion;
  discoveryBusy = true;
  const reading = ["discovery-source","discovery-open-message"].includes(method);
  modal(reading ? '<h2>Checking Telegram...</h2><p>Reading chat information through your account. No message is being sent.</p><button class="button secondary" data-action="close-dialog">Stop waiting</button>' : '<h2>Waiting for the result...</h2><p>Collecting replies for up to 30 seconds. Closing this window stops waiting; it does not unsend your message.</p><button class="button secondary" data-action="close-dialog">Stop waiting</button>');
  try {
    const result = method === "discovery-join" ? {joined:await call(method,payload)} : await advanceDiscovery(method,payload,{call,cancelled:()=>version !== discoveryVersion,onStage:stage=>{ const heading = $("#dialog h2"); if (heading) heading.textContent = stage === "discovery-join" ? "Joining series channel..." : stage === "discovery-follow" ? "Opening series result..." : reading ? "Checking Telegram..." : "Waiting for bot replies..."; }});
    if (!result) return;
    if (result.joined) { state.demo = false; state.channels = result.joined.channels; await scan(result.joined.channel.id); return; }
    if (version !== discoveryVersion) return;
    if (result.groups) return modal(`<h2>Choose the search group.</h2><p>MovieClubFamily is an entry channel. Select the joined group where you normally post series names. No message is sent when choosing.</p><label class="modal-search">${icon("search")}<input id="search-group-filter" placeholder="Find a joined group" aria-label="Find a joined group"></label><div class="discovery-results" id="search-group-results">${result.groups.map(group=>`<button class="channel-option" data-action="discovery-group" data-choice="${escape(group.id)}"><span>${escape(group.title)}</span>${icon("arrow")}</button>`).join("") || '<p>No eligible group found in your recent chats. Use a Telegram result link instead.</p>'}</div><button class="text-button" data-action="discover">Use a message link instead</button>`);
    if (result.source) return discoveryModal(result.source);
    if (result.channel) return modal(`<h2>${escape(result.channel.title)}</h2><p>Join this Telegram channel and scan its episodes? Required subscription channels are not joined automatically.</p><button class="button primary" data-action="discovery-join" data-choice="${escape(result.channel.id)}">Join channel and scan</button>`);
    modal(`<h2>Discovery results</h2>${result.notice ? `<p role="status">${escape(result.notice)}</p>` : ""}<div class="discovery-results">${result.messages.map(message=>`<section class="discovery-message"><p>${escape(message.text)}</p>${message.links.map(link=>`<button class="channel-option" data-action="discovery-follow" data-choice="${escape(link.id)}" ${link.kind === "unsupported" ? "disabled" : ""}><span>${escape(link.label)}<small>${link.kind === "unsupported" ? "Open this button in Telegram" : link.kind === "callback" ? "Open bot result" : link.kind === "bot-start" ? "Start bot with this result" : link.kind === "private-message" ? "Read linked message" : "Preview Telegram destination"}</small></span>${icon("arrow")}</button>`).join("")}</section>`).join("") || '<p>No reply arrived. Try again later or open the bot in Telegram.</p>'}</div><p>A single series result continues automatically. Choose a result when there are several. Subscription tasks require your selection.</p><button class="button secondary" data-action="subscription-help">Bot requires channel subscriptions?</button><button class="button secondary" data-action="discover">New search</button>`);
  } catch (error) {
    if (version === discoveryVersion) modal(`<h2>Could not finish opening the series.</h2><p role="alert">${escape(error.message)}</p><p>If Telegram already joined the channel, select it from your channels to load its episodes.</p><button class="button primary" data-action="choose-series">Choose series channel</button><button class="button secondary" data-action="discover">Try search again</button>`);
  } finally { discoveryBusy = false; }
}
async function chooseSeries() {
  if (!state.connected && !state.demo) return connectionModal();
  modal(
    `<h2>Choose a series channel.</h2>${!state.demo ? '<button class="button primary full" data-action="discover">Search MovieClubFamily</button>' : ""}<p>${state.demo ? "Preview uses illustrative sample data." : "Browse up to 300 recent accessible groups and channels. Open or join the series channel in Telegram first."}</p><label class="modal-search">${icon("search")}<input id="channel-search" placeholder="Search your channels…" aria-label="Search your channels"></label><div id="channel-filters"></div><div id="channel-results"></div><button class="button secondary full" data-action="refresh-channels">${icon("refresh")}Refresh channels</button>`,
  );
  renderChannels("");
}
function renderChannels(query) {
  const category = channel => channel.id === state.catalogue?.channel.id && state.catalogue.items.some(i => !i.reason) ? "media" : channelCategory(channel.title, state.settings.hiddenKeywords ?? defaultHiddenKeywords);
  const hidden = state.channels.filter(c => category(c) === "finance").length;
  $("#channel-filters").innerHTML = `<div class="channel-filter-switch" role="group" aria-label="Channel filter">${[["suggested","Suggested"],["all","All channels"]].map(([value,label]) => `<button data-action="channel-filter" data-filter="${value}" aria-pressed="${state.channelFilter === value}">${label}</button>`).join("")}</div><p class="filter-explanation">${state.channelFilter === "suggested" ? `${hidden} ${hidden === 1 ? "channel" : "channels"} hidden by keyword matches. Other names stay visible.` : "All joined groups and channels in your recent list."}</p>`;
  const channels = state.channels.filter(c => (state.channelFilter === "all" || category(c) !== "finance") && c.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => (category(a) === "media" ? 0 : 1) - (category(b) === "media" ? 0 : 1) || a.title.localeCompare(b.title));
  $("#channel-results").innerHTML = channels.map(channel =>
    `<button class="channel-option" data-action="scan-channel" data-channel="${escape(channel.id)}">${icon("film")}<span>${escape(channel.title)}${category(channel) === "media" ? '<small>Series / movies</small>' : ""}</span>${icon("arrow")}</button>`).join("") || '<p class="channel-empty">No matches in this view. Try All channels or refresh your list.</p>';
}
async function connect(payload) {
  modal(
    "<h2>Connecting…</h2><p>Keep this window open. Telegram may ask for a login code or your two-step verification password.</p>",
  );
  const result = await call("connect", payload);
  state.connected = result.connected;
  state.profile = result.profile;
  state.hasCredentials = true;
  state.channels = await call("channels");
  $("#dialog").close();
  render();
  toast("Telegram connected. Choose a series channel.");
  chooseSeries();
}
async function scan(id) {
  $("#dialog").close();
  state.busy = true;
  state.page = "library";
  const channel = state.channels.find(channel=>channel.id === id);
  if (channel) state.catalogue = {channel,items:[],scanned:0};
  state.selected.clear();
  render();
  try {
    state.catalogue = state.demo ? demoCatalogue() : await call("scan", { id });
    state.quality = {};
    state.selected.clear();
    state.query = "";
    state.season = chosen(state)[0]?.season || 1;
  } finally {
    state.busy = false;
    render();
  }
}
async function setSettings(patch) {
  state.settings = state.demo
    ? { ...state.settings, ...patch }
    : await call("settings", patch);
  render();
}

document.addEventListener("click", async (event) => {
  if (!event.target.closest?.(".account-popover, .profile")) {
    const menu = $("#account-popover");
    if (menu) menu.hidden = true;
    $(".profile")?.setAttribute("aria-expanded","false");
  }
  const row = event.target.closest?.("[data-episode-row]");
  if (row && !event.target.closest?.("input, button, a") && !window.getSelection()?.toString()) {
    const id = row.dataset.episodeRow;
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    render();
    return;
  }
  const el = event.target.closest?.("[data-action]");
  if (!el) return;
  event.preventDefault();
  const action = el.dataset.action;
  try {
    if (isDownloadAction(action)) {
      await handleDownloadAction(action, el, {state, call, render, toast, modal, document});
      return;
    }
    if (action === "confirmation-reply") {
      const id=$("#dialog").dataset.confirmationId;delete $("#dialog").dataset.confirmationId;$("#dialog").close();await call("confirmation-reply",{id,response:Number(el.dataset.response)});
    } else if (action === "use-login") {
      const saved=await call("login-suggestion",{id:el.dataset.id});const form=$("#connect-form");if(form)for(const field of ["apiId","apiHash","phone"])form.elements[field].value=saved[field];
    } else if (action === "forget-logins") { await call("forget-login-suggestions");$("#login-suggestions").replaceChildren();
    } else if (action === "update-later") {state.updates=await call("update-later");$("#dialog").close();render();
    } else if (action === "account-menu") {
      const menu = $("#account-popover");
      menu.hidden = !menu.hidden;
      el.setAttribute("aria-expanded",String(!menu.hidden));
      if (!menu.hidden) menu.querySelector("button").focus();
    } else if (action === "toggle-sidebar") {
      await setSettings({sidebarCollapsed: !state.settings.sidebarCollapsed});
      $(".sidebar-toggle").focus();
    } else if (action === "scroll-seasons") {
      const tabs = $(".season-tabs");
      tabs.scrollLeft += Number(el.dataset.direction) * Math.max(180, tabs.clientWidth * 0.75);
      updateSeasonArrows();
    } else if (action === "nav") {
      state.page = el.dataset.page;
      if (state.page === "queue") state.downloadTab = "ongoing";
      render();
      if(state.page === "settings" && window.shelf) {state.updates=await call("update-status");render();}
    } else if (action === "theme")
      await setSettings({
        theme:
          document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      });
    else if (action === "reset-appearance") {
      await setSettings({appearance:{}});
    } else if (action === "reset-keywords") {
      await setSettings({hiddenKeywords:[...defaultHiddenKeywords]});
      toast("Default keywords restored.");
    } else if (action === "set-theme")
      await setSettings({ theme: el.dataset.theme });
    else if (action === "quality") {
      state.quality = { ...effectiveQuality(state), [el.dataset.field]: el.dataset.field === "resolution" ? Number(el.dataset.value) : el.dataset.value };
      state.selected.clear();
      state.season = chosen(state).some(i => i.season === state.season) ? state.season : chosen(state)[0]?.season || 1;
      render();
      document.querySelector(`[data-action="quality"][data-field="${el.dataset.field}"][data-value="${el.dataset.value}"]`)?.focus();
    } else if (action === "channel-filter") {
      state.channelFilter = el.dataset.filter;
      renderChannels($("#channel-search").value);
      document.querySelector(`[data-filter="${state.channelFilter}"]`)?.focus();
    } else if (action === "mode") {
      state.mode = el.dataset.mode;
      state.quality = {};
      state.selected.clear();
      state.query = "";
      state.season = chosen(state).some((i) => i.season === state.season)
        ? state.season
        : chosen(state)[0]?.season || 1;
      render();
    } else if (action === "season") {
      state.season = Number(el.dataset.season);
      state.query = "";
      render();
      const tab = document.getElementById(`season-${state.season}`);
      tab?.focus({preventScroll:true});
      tab?.scrollIntoView?.({block:"nearest",inline:"nearest"});
    } else if (action === "select-season") {
      const items = state.libraryTab === "unverified" ? visible(state) : chosen(state).filter((i) => i.season === state.season);
      items.forEach((i) => state.selected.add(i.id));
      render();
    } else if (action === "connect") connectionModal();
    else if (action === "reconnect") await connect({});
    else if (["update-check","update-download","update-install"].includes(action)) {if(action === "update-check"){if(state.updateChecking)return;state.updateChecking=true;render();}try{state.updates=await call(action);render();}catch(error){if($("#update-error")) $("#update-error").textContent=friendlyError(error.message);else throw error;}finally{state.updateChecking=false;render();}}
    else if (action === "watch-series") {
      const watches=await call("watch-list");const watch=watches.find(w=>w.channel.id===state.catalogue.channel.id && w.mode===state.mode);
      modal(`<h2>Watch for new episodes</h2><p>Check this channel hourly while the app is open. Uses your current quality and ${escape(state.mode)} folder. New uploads only; existing files stay under manual control.</p><form id="watch-form"><label>When new files appear<select name="watchMode"><option value="notify" ${watch && !watch.automatic ? "selected" : ""}>Notify me</option><option value="auto" ${watch?.automatic ? "selected" : ""}>Queue automatically</option><option value="off" ${!watch ? "selected" : ""}>Off</option></select></label><button class="button primary">Save series watch</button></form>${watch?.error ? `<p role="alert">${escape(watch.error)}</p>` : ""}`);
    } else if (action === "find-missing") {
      if(!state.demo) state.jobs=await call("find-missing",{mode:state.mode});
      const missing=missingEpisodes(chosen(state),state.jobs,state.catalogue.channel.id,state.mode).filter(item=>item.season===state.season);
      state.selected=new Set(missing.map(item=>item.id));render();toast(`${missing.length} files selected to fill gaps in this season. Compares app-managed saved files.`);
    } else if (action === "subscription-help") {
      const choices=await call("subscription-choices");
      modal(`<h2>Required channels</h2><p>Select the channels the bot requires. The app will join them and retry the series request.</p><form id="subscriptions-form">${choices.map(choice=>`<label><input type="checkbox" name="subscription" value="${escape(choice.id)}">${escape(choice.label)}</label>`).join("") || "<p>No supported channel links in this reply.</p>"}<button class="button primary" ${choices.length ? "" : "disabled"}>Join selected and continue</button></form>`);
    } else if (action === "choose-series") await chooseSeries();
    else if (action === "refresh-channels") {
      if (!state.demo) state.channels = await call("channels");
      renderChannels($("#channel-search").value);
    } else if (action === "discover") {
      discoveryModal();
    } else if (action === "discovery-source") {
      await discoveryRequest("discovery-source");
    } else if (action === "discovery-group") {
      await discoveryRequest("discovery-source",{groupId:el.dataset.choice});
    } else if (action === "discovery-follow") {
      await discoveryRequest("discovery-follow",{id:el.dataset.choice});
    } else if (action === "discovery-join") {
      await discoveryRequest("discovery-join",{id:el.dataset.choice});
    } else if (action === "scan-channel") await scan(el.dataset.channel);
    else if (action === "rescan") await scan(state.catalogue.channel.id);
    else if (action === "demo") startDemo();
    else if (action === "exit-demo") {
      state.demo = false;
      Object.assign(
        state,
        liveSnapshot || { catalogue: null, channels: [], jobs: [] },
      );
      state.selected.clear();
      render();
    } else if (action === "close-dialog") {
      await dismissDialogExtras();
      discoveryVersion++;
      if (discoveryBusy) await call("discovery-cancel");
      if ($("#dialog").dataset.authId) {
        await call("auth-reply", {
          id: $("#dialog").dataset.authId,
          cancel: true,
        });
        delete $("#dialog").dataset.authId;
      }
      $("#dialog").close();
    } else if (action === "folder") {
      if (state.demo)
        return toast(
          "Folder selection is available in the connected desktop app.",
        );
      state.settings = await call("choose-folder", { mode: el.dataset.mode });
      render();
    } else if (action === "download") {
      if (state.demo) {
        const batchId = state.jobs.find(j => !["complete","cancelled","deleted"].includes(j.status))?.batchId || crypto.randomUUID();
        state.currentBatchId = batchId;
        for (const item of selectedItems(state))
          if (
            !state.jobs.some(
              (j) => j.item.id === item.id && j.mode === state.mode,
            )
          )
            state.jobs.push({
              id: crypto.randomUUID(),
              batchId,
              series: state.catalogue.channel.title,
              item,
              mode: state.mode,
              status: "preview",
              received: 0,
            });
        toast("Preview queue created. No files will be downloaded.");
      } else {
        const ids = await call("enqueue", {
          ids: [...state.selected],
          unverifiedIds: selectedItems(state).filter(item=>item.unverified).map(item=>item.id),
          mode: state.mode,
          quality: effectiveQuality(state),
        });
        toast(`${ids.length} ${ids.length === 1 ? "episode" : "episodes"} added to the queue.`);
      }
      state.page = "queue";
      state.downloadTab = "ongoing";
      state.selected.clear();
      render();
    } else if (action === "disconnect") {
      await call("disconnect");
      state.profile = null;
      state.connected = false;
      state.hasCredentials = false;
      render();
      toast(
        "Local session forgotten. You can also revoke it in Telegram → Devices.",
      );
    } else if (action === "library-tab") {
      state.libraryTab = el.dataset.tab; render();
    } else if (action === "show-guide") { showGuide();
    } else if (action === "clear-app-data") {
      const result=await call("clear-app-data");if(result.cleared){Object.assign(state,result);state.selected.clear();state.libraryTab="verified";state.query="";state.season=1;state.stagingInfo=null;render();toast("App data cleared. Files on disk were kept.");}
    } else if (action === "reset-activity") { state.usage=await call("reset-activity");render();
    } else if (action === "licenses") {
      const licenses=await call("licenses");modal(`<h2>Third-party licenses</h2><div class="license-list">${licenses.map(entry=>`<details><summary>${escape(entry.name)} &middot; ${escape(entry.license)}</summary><pre>${escape(entry.text)}</pre></details>`).join("")}</div>`);
    } else if (action === "finish-onboarding") {
      await call("finish-onboarding"); $("#dialog").close();
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("keydown", event => {
  const menu = $("#account-popover");
  if (event.key === "Escape" && menu && !menu.hidden) {
    menu.hidden = true;
    $(".profile").setAttribute("aria-expanded","false");
    $(".profile").focus();
    event.preventDefault();
  }
});
document.addEventListener("change", async (event) => {
  if (previewAppearance(event,state.settings)) return;
  try {
    if(event.target.name === "scheduled" && event.target.form?.id === "transfer-form") {event.target.form.querySelector(".schedule-times").disabled=!event.target.checked;return;}
    if(event.target.id === "close-behavior") {await setSettings({closeToTray:event.target.value==="tray"});return;}
    if(event.target.id === "automatic-updates") {state.settings=await call("update-preference",{enabled:event.target.checked});return;}
    if (event.target.dataset.episode) {
      const id = event.target.dataset.episode;
      event.target.checked ? state.selected.add(id) : state.selected.delete(id);
      render();
    } else if (event.target.id === "select-all") {
      visible(state).forEach((item) =>
        event.target.checked
          ? state.selected.add(item.id)
          : state.selected.delete(item.id),
      );
      render();
    } else if (event.target.id.startsWith("quality-")) {
      state.quality[event.target.id === "quality-resolution" ? "resolution" : "codec"] = event.target.id === "quality-resolution" ? Number(event.target.value) : event.target.value;
      state.selected.clear();
      state.season = chosen(state).some(i => i.season === state.season) ? state.season : chosen(state)[0]?.season || 1;
      render();
    } else if (event.target.id === "concurrency")
      await setSettings({ concurrency: Number(event.target.value) });
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("input", (event) => {
  if (previewAppearance(event,state.settings)) return;
  if (event.target.id === "search-group-filter") {
    for (const button of document.querySelectorAll("#search-group-results button"))
      button.hidden = !button.textContent.toLowerCase().includes(event.target.value.toLowerCase().trim());
    return;
  }
  if (event.target.id === "episode-search") {
    const cursor = event.target.selectionStart;
    state.query = event.target.value;
    render();
    const input = $("#episode-search");
    input.focus();
    input.setSelectionRange(cursor, cursor);
  } else if (event.target.id === "channel-search")
    renderChannels(event.target.value);
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "discovery-link-form") {
      await discoveryRequest("discovery-open-message",{link:values.link});
    } else if (form.id === "discovery-form") {
      await discoveryRequest("discovery-search",{query:values.query,sourceId:values.sourceId});
    } else if (form.id === "watch-form") {
      await call("watch-set",{mode:state.mode,quality:effectiveQuality(state),automatic:values.watchMode==="off" ? null : values.watchMode==="auto"});$("#dialog").close();toast("Series watch saved.");
    } else if (form.id === "subscriptions-form") {
      await discoveryRequest("complete-subscriptions",{ids:[...form.querySelectorAll("input:checked")].map(input=>input.value)});
    } else if (form.id === "transfer-form") {
      await setSettings({transfer:{speedKiB:Number(values.speedKiB),scheduled:form.elements.scheduled.checked,start:form.elements.start.value,end:form.elements.end.value}});toast("Download preferences saved.");
    } else if (form.id === "appearance-form") {
      await setSettings({appearance:appearanceValues(form)});
      toast("Appearance saved.");
    } else if (form.id === "keyword-form") {
      const keywords = cleanKeywords(values.keywords.split(/[\n,]/));
      await setSettings({hiddenKeywords:keywords});
      toast("Channel filters saved.");
    } else if (form.id === "connect-form") {
      form.reset();
      await connect(values);
    } else if (form.id === "auth-form") {
  const id = $("#dialog").dataset.authId;
      delete $("#dialog").dataset.authId;
      form.reset();
      await call("auth-reply", { id, value: values.value });
      modal("<h2>Verifying…</h2><p>Waiting for Telegram.</p>");
    }
  } catch (error) {
    $("#dialog").close();
    toast(error.message, true);
  }
});
$("#dialog").addEventListener("cancel", async () => {
  await dismissDialogExtras();
  discoveryVersion++;
  if (discoveryBusy) await call("discovery-cancel").catch(()=>{});
  const id = $("#dialog").dataset.authId;
  if (id) {
    delete $("#dialog").dataset.authId;
    await call("auth-reply", { id, cancel: true }).catch(() => {});
  }
});
if (window.shelf) {
  window.shelf.on(({ type, data }) => {
    if(type === "confirmation") {
      modal(`<h2>${escape(data.title)}</h2><p>${escape(data.message)}</p><p class="confirmation-detail">${escape(data.detail)}</p><div class="dialog-actions">${data.buttons.map((label,index)=>`<button class="button ${index ? "primary" : "secondary"}" data-action="confirmation-reply" data-response="${index}">${escape(label)}</button>`).join("")}</div>`);$("#dialog").dataset.confirmationId=data.id;
    } else if(type === "new-episodes") toast(`${data.count} new files in ${data.title}${data.automatic ? " queued." : ". Rescan the channel to view them."}`);
    else if(type === "updates") {state.updates=data;if(state.page==="settings") render();if(data.state==="ready"){updatePrompt();if(!$("#update-error"))toast("Update ready. Open Settings to restart and install.");}}
    else if (type === "connection") {
      Object.assign(state,data);
      render();
      if (data.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.",true);
    } else if (type === "usage") {
      state.usage = data;
      state.currentBatchId = data.currentBatchId;
      if (state.page === "queue") render();
      if ($("#usage-summary")) $("#usage-summary").innerHTML = usageTiles(state.usage);
    } else if (type === "queue") {
      if (state.demo) {
        if (liveSnapshot) liveSnapshot.jobs = data;
      } else {
        state.jobs = data;
        if (state.page === "queue") render();else refreshQueueBadge();
      }
    } else if (type === "scan-progress" && $("#scan-status"))
      $("#scan-status").textContent =
        `Scanning… ${data.scanned} messages checked · ${data.found} episode files found`;
    else if (type === "auth-error") toast(data, true);
    else if (type === "auth-prompt") {
      modal(
        `<div class="modal-icon">${icon("shield")}</div><h2>${escape(data.label)}</h2><p>Enter it here on your computer. It is never saved in your download history.</p><form id="auth-form"><label>${data.kind === "password" ? "Two-step verification password" : data.kind === "code" ? "Verification code" : escape(data.kind)}<input name="value" required autocomplete="off" type="${data.kind === "password" ? "password" : "text"}" autofocus></label><button class="button primary full" type="submit">Continue ${icon("arrow")}</button></form>`,
      );
      $("#dialog").dataset.authId = data.id;
      $("#auth-form input").focus();
    }
  });
  try {
    Object.assign(state, await call("bootstrap"));
    state.season = chosen(state)[0]?.season || 1;
    render();
    if (state.firstRun) showGuide();
    if (state.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.", true);
  } catch (error) {
    render();
    toast(error.message, true);
  }
} else startDemo();
