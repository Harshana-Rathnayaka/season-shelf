import { missingEpisodes, unverifiedItems } from "../core/collection.mjs";
import { applyAppearance, appearanceForm, appearanceValues, previewAppearance } from "./appearance.mjs";
import { advanceDiscovery } from "./discovery-flow.mjs";
import { icon } from "./icons.mjs";
import { selectEpisodes, pad, availableQualities, availableSelection, channelCategory, defaultHiddenKeywords, cleanKeywords } from "../core/catalog.mjs";
import { batchProgress } from "../core/progress.mjs";
import { demoCatalogue } from "./demo.mjs";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const bytes = (number) =>
  number >= 1024 ** 3
    ? `${(number / 1024 ** 3).toFixed(2)} GB`
    : `${(number / 1024 ** 2).toFixed(1)} MB`;
const state = {
  updates: {state:"idle"},
  page: "library",
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
function friendlyError(message) {
  return /ENOENT|no such file or directory/i.test(String(message)) ? "This file is no longer available. Check its drive or remove it from Saved files." : /EACCES|EPERM/i.test(String(message)) ? "Windows could not access this file. Check its permissions and whether another app is using it." : message;
}
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
function effectiveQuality() {
  return availableSelection(state.catalogue?.items || [], state.mode, state.quality);
}
function chosen() {
  return selectEpisodes(state.catalogue?.items || [], state.mode, effectiveQuality());
}
function visible() {
  if (state.libraryTab === "unverified") return unverifiedItems(state.catalogue?.items || []).filter(item => item.filename.toLowerCase().includes(state.query.toLowerCase()));
  return chosen().filter(
    (item) =>
      item.season === state.season &&
      `${item.title} ${item.filename}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
}
function selectedItems() {
  return [...chosen(),...unverifiedItems(state.catalogue?.items || [])].filter((item) => state.selected.has(item.id));
}
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
  visible()
    .slice(0, 3)
    .forEach((item) => state.selected.add(item.id));
  render();
}
function render() {
  const oldPageScroll = $(".workspace-scroll")?.scrollTop || 0;
  const keepPageScroll = renderedPage === state.page;
  renderedPage = state.page;
  const oldTop = $(".episode-table")?.scrollTop || 0;
  const oldLeft = $(".season-tabs")?.scrollLeft || 0;
  const channelKey = state.catalogue?.channel.id;
  const viewKey = JSON.stringify([channelKey, state.libraryTab, state.season, effectiveQuality(), state.query]);
  applyTheme();
  $("#app").classList.toggle("sidebar-collapsed", !!state.settings.sidebarCollapsed);
  const count = state.jobs.filter(
    (job) => !["complete", "deleted", "missing", "cancelled"].includes(job.status),
  ).length;
  $("#app").classList.toggle("custom-titlebar", !!state.customTitleBar);
  $("#app").innerHTML = `${state.customTitleBar ? `<div class="app-titlebar"><span>${icon("shelf")} ${escape(state.appName || "Season Shelf")}</span></div>` : ""}<aside class="sidebar" id="workspace-sidebar"><button class="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-controls="workspace-sidebar" aria-expanded="${!state.settings.sidebarCollapsed}" aria-label="${state.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}" title="${state.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}">${icon("sidebar")}</button>
    <a class="brand" href="#" data-action="nav" data-page="library"><span class="brand-mark">${icon("shelf")}</span><span>season<span class="brand-light">shelf</span><small>YOUR SERIES, SORTED.</small></span></a>
    <div class="nav-label">WORKSPACE</div>
    <nav aria-label="Main navigation">
      ${[
        ["library", "grid", "Series library"],
        ["queue", "download", "Downloads"],
        ["saved", "folder", "Saved files"],
        ["help", "info", "How it works"],
      ]
        .map(
          ([page, glyph, label]) =>
            `<button class="nav-item ${state.page === page ? "active" : ""}" data-action="nav" data-page="${page}" aria-label="${label}" title="${label}">${icon(glyph)}<span>${label}</span>${page === "queue" && count ? `<b class="nav-count">${count}</b>` : ""}</button>`,
        )
        .join("")}
    </nav>
    <div class="sidebar-note"><span class="tiny-mark">${icon("shield")}</span><strong>A little less clicking.</strong><p>More time for the next episode.</p><span class="local-label"><i></i> Runs on your computer</span></div>
    <div class="sidebar-bottom"><button class="nav-item ${state.page === "settings" ? "active" : ""}" data-action="nav" data-page="settings" aria-label="Settings" title="Settings">${icon("settings")}<span>Settings</span></button><button class="profile" data-action="account-menu" aria-expanded="false" aria-controls="account-popover" aria-label="Telegram account" title="Telegram account"><span class="avatar">${icon("bolt")}</span><span><strong>${state.connected ? escape(state.profile?.name || "Telegram connected") : "Your workspace"}</strong><small>${state.demo ? "Exploring sample data" : state.connected ? escape(state.profile?.username ? "@" + state.profile.username : "Local account session") : "Connect to get started"}</small></span>${icon("chevron")}</button><div class="account-popover" id="account-popover" role="dialog" aria-label="Telegram account" hidden><div class="account-heading"><span class="avatar">${icon("bolt")}</span><div><strong>${escape(state.profile?.name || "Your workspace")}</strong><small>${state.profile?.username ? "@" + escape(state.profile.username) : state.connected ? "Telegram account" : "Not connected"}</small></div></div><p>${state.connected ? "Connected. Your session is encrypted on this computer." : "Connect Telegram to browse your channels."}</p><button class="nav-item" data-action="${state.connected ? "disconnect" : "connect"}">${icon("arrow")}${state.connected ? "Log out and forget session" : "Connect Telegram"}</button></div></div>
  </aside>
  <div class="main-shell workspace-shell ${state.page === "library" ? "library-shell" : ""}"><header class="topbar"><span class="breadcrumb">Workspace ${icon("chevron")} <strong>${{ library: "Series library", queue: "Downloads", saved: "Saved files", settings: "Settings", help: "How it works" }[state.page]}</strong></span><div class="top-actions">${state.demo ? '<span class="demo-pill">SAMPLE PREVIEW</span>' : ""}<button class="icon-button" data-action="theme" title="Toggle colour theme" aria-label="Toggle colour theme">${icon("moon")}</button><button class="connection" data-action="connect"><i class="${state.connected ? "online" : ""}"></i>${state.connected ? "Connected" : state.restoringSession ? "Reconnecting..." : "Connect Telegram"}${icon("arrow")}</button></div></header>
  <main>${state.page === "library" ? library() : state.page === "settings" ? settingsPage() : state.page === "help" ? helpPage() : queuePage(state.page === "saved")}</main>
  <footer class="app-footer"><span>${icon("shield")} Local by design. Yours to control.</span><span>${escape(state.appName || "Season Shelf")} <b>${escape(state.version || "0.1")}</b></span></footer></div>`;
  if (state.page === "library")
    $("#select-all")?.setAttribute("aria-label", "Select all visible episodes");
  if ($(".episode-table") && libraryViewKey === viewKey) $(".episode-table").scrollTop = oldTop;
  if ($(".season-tabs") && seasonChannelKey === channelKey) $(".season-tabs").scrollLeft = oldLeft;
  libraryViewKey = viewKey;
  seasonChannelKey = channelKey;
  if (keepPageScroll && $(".workspace-scroll")) $(".workspace-scroll").scrollTop = oldPageScroll;
  updateSeasonArrows();

}
function qualityPicker() {
  if (!state.catalogue) return "";
  const options = availableQualities(state.catalogue.items);
  if (!options.length) return '<div class="quality-empty">No verified episode qualities found in this channel.</div>';
  const selected = effectiveQuality();
  const codecs = options.find(o => o.resolution === selected.resolution).codecs;
  const preferredResolution = state.quality.resolution ?? (state.mode === "archive" ? 720 : 1080);
  const preferredCodec = state.quality.codec ?? (state.mode === "archive" ? "HEVC" : "any");
  const fallback = selected.resolution !== preferredResolution || (preferredCodec !== "any" && selected.codec !== preferredCodec);
  const chip = (field, value, label) => `<button class="quality-chip" data-action="quality" data-field="${field}" data-value="${value}" aria-pressed="${selected[field] === value}" ${state.busy ? "disabled" : ""}>${label}</button>`;
  return `<div class="quality-toolbar"><div class="quality-group" role="group" aria-label="Available resolutions"><span class="quality-label">Quality</span><div class="quality-segments">${options.map(o => chip("resolution", o.resolution, o.resolution + "p")).join("")}</div></div><div class="quality-group codec-group" role="group" aria-label="Available codecs"><span class="quality-label">Codec</span><div class="quality-segments">${codecs.map(c => chip("codec", c, c === "HEVC" ? "x265" : "x264")).join("")}${codecs.length > 1 ? chip("codec", "any", "Auto") : ""}</div></div><span class="quality-hint" title="Only qualities found in this channel's scanned, valid episode files. Availability may differ by season. Auto prefers HEVC.">From this channel ${icon("info")}</span></div>${fallback ? `<div class="quality-fallback" role="status">Preferred quality unavailable. Showing ${selected.resolution}p &middot; ${selected.codec === "any" ? "Auto codec" : selected.codec}. Review your selection before downloading.</div>` : ""}`;
}
function library() {
  const all = chosen(),
    items = state.libraryTab === "verified" ? visible() : [],
    selected = selectedItems();
  const seasons = [...new Set(all.map((item) => item.season))];
  const root = state.settings[`${state.mode}Root`];
  const needsReview = (state.catalogue?.items || []).filter(
    (item) => item.reason,
  ).length;
  return `<section class="page-heading"><div><div class="eyebrow">A HOME FOR EVERY EPISODE</div><h1>Your next watch,<br><span>beautifully organised.</span></h1><p>Pick a series. Choose your quality. We’ll take it from here.</p></div><div class="orbit-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="orbit-core">${icon("shelf")}</div><span class="orbit-point point-one"></span><span class="orbit-point point-two"></span><span class="orbit-caption">COLLECT. WATCH. REPEAT.</span></div></section>
  <div class="library-preferences"><div class="mode-switch" role="group" aria-label="Download destination mode">${[["archive","drive","Archive"],["watch","play","Watch"]].map(([mode,glyph,label]) => `<button data-action="mode" data-mode="${mode}" aria-pressed="${state.mode === mode}" class="${state.mode === mode ? "active" : ""}">${icon(glyph)}${label}</button>`).join("")}</div><span class="mode-description">${state.mode === "archive" ? "Keep a permanent copy on your HDD" : "A viewing copy in your Watch folder"}</span></div>
  <section class="catalogue-panel library-panel"><div class="panel-heading"><div class="panel-title"><span class="series-icon">${icon("film")}</span><div><h2>${escape(state.catalogue?.channel.title || "Choose your first series")}</h2><p>${state.catalogue ? `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"} found <span>·</span> ${all.length} matching ${all.length === 1 ? "episode" : "episodes"} ${state.demo ? "<span>·</span> Illustrative sample" : ""}` : "Select a Telegram channel to find its episodes"}</p></div></div><div class="row-actions"><button class="button secondary" data-action="choose-series">${icon("folder")}Change series${icon("down")}</button><button class="icon-button" data-action="rescan" aria-label="Rescan channel" title="Rescan channel" ${state.busy || !state.catalogue ? "disabled" : ""}>${icon("refresh", state.busy ? "spin" : "")}</button></div></div>
  ${state.busy ? '<div class="notice" role="status" id="scan-status">Scanning channel metadata…</div>' : ""}
  ${state.demo ? `<div class="sample-note">${icon("info")} Sample data lets you explore the interface. No files are downloaded.${window.shelf ? '<button data-action="exit-demo">Exit preview</button>' : ""}</div>` : ""}
  ${state.catalogue?.truncated ? '<div class="notice">Scan limited to 10,000 messages. Earlier episodes may not be included.</div>' : ""}
  ${
    state.catalogue
      ? `<div class="library-controls"><div class="quality-area">${qualityPicker()}</div><div class="library-list-switch" role="group" aria-label="File verification"><button class="text-button" data-action="library-tab" data-tab="verified" aria-pressed="${state.libraryTab === "verified"}">Verified <span>${all.length}</span></button><button class="text-button" data-action="library-tab" data-tab="unverified" aria-pressed="${state.libraryTab === "unverified"}" title="Metadata could not be verified. Select files manually to download their original names into Unverified.">Unverified <span>${needsReview}</span></button></div><div class="catalogue-tools" ${state.libraryTab === "unverified" ? 'data-unverified="true"' : ""}><div class="season-navigation" ${seasons.length ? "" : 'data-empty="true"'}><button class="icon-button season-prev" data-action="scroll-seasons" data-direction="-1" aria-label="Earlier seasons">${icon("chevron")}</button><div class="season-tabs" id="season-tabs" role="tablist" aria-label="Seasons">${seasons.map((season) => `<button role="tab" aria-controls="episode-list" id="season-${season}" tabindex="${state.season === season ? 0 : -1}" aria-selected="${state.season === season}" class="season-tab ${state.season === season ? "active" : ""}" data-action="season" data-season="${season}">Season ${pad(season)}<span>${all.filter((item) => item.season === season).length}</span></button>`).join("")}</div><button class="icon-button season-next" data-action="scroll-seasons" data-direction="1" aria-label="Later seasons">${icon("chevron")}</button></div><label class="table-search">${icon("search")}<input id="episode-search" placeholder="Find an episode…" aria-label="Find an episode" value="${escape(state.query)}"></label></div></div>
  <div class="episode-table" id="episode-list" role="tabpanel" aria-labelledby="season-${state.season}" tabindex="0"><table><thead><tr><th class="checkbox-cell"><input type="checkbox" id="select-all" ${visible().length && visible().every((item) => state.selected.has(item.id)) ? "checked" : ""}></th><th>${state.libraryTab === "unverified" ? "FILE" : "EPISODE"}</th><th>${state.libraryTab === "unverified" ? "" : "QUALITY"}</th><th class="right">SIZE</th></tr></thead><tbody>${items.map((item) => `<tr data-episode-row="${escape(item.id)}" class="${state.selected.has(item.id) ? "row-selected" : ""}"><td class="checkbox-cell"><input type="checkbox" data-episode="${escape(item.id)}" aria-label="Select episode ${item.episode}" ${state.selected.has(item.id) ? "checked" : ""}></td><td><div class="episode-title" title="${escape(item.filename)}"><span class="episode-number">${pad(item.episode)}</span><div class="episode-copy"><strong>${escape(item.title)}</strong><span class="source-filename">${escape(item.filename)}</span><small>S${pad(item.season)}E${pad(item.episode)}${item.episodeEnd > item.episode ? `-E${pad(item.episodeEnd)} (combined file)` : ""} <span>·</span> ${/webrip/i.test(item.filename) ? "WEBRip" : "Video file"}${item.bitDepth ? ` <span>·</span> ${item.bitDepth}-bit` : ""}</small></div></div></td><td><span class="quality-tag">${item.resolution}p</span><span class="codec">${item.codec}</span></td><td class="file-size right" title="${item.alternatives ? `Smallest of ${item.alternatives + 1} matching files` : "Only matching file"}">${bytes(item.size)}</td></tr>`).join("")}</tbody>${state.libraryTab === "unverified" ? `<tbody class="unverified-files"><tr class="unverified-description"><td colspan="4">Choose files manually. Original names are kept in the Unverified folder.</td></tr>${unverifiedItems(state.catalogue?.items || []).filter(item=> item.filename.toLowerCase().includes(state.query.toLowerCase())).map(item=>`<tr data-episode-row="${escape(item.id)}"><td><input type="checkbox" data-episode="${escape(item.id)}" aria-label="Select unverified file ${escape(item.filename)}" ${state.selected.has(item.id)?"checked":""}></td><td colspan="2"><span class="source-filename">${escape(item.filename)}</span><small>${escape(item.reason)}</small></td><td class="file-size right">${bytes(item.size)}</td></tr>`).join("")}</tbody>` : ""}</table>${!visible().length ? '<div class="empty-inline">No matching episodes here. Try another season or quality mode.</div>' : ""}</div>
  <div class="selection-bar"><div><strong>${selected.length} ${state.libraryTab === "unverified" || selected.some(item=>item.unverified) ? (selected.length === 1 ? "file" : "files") : (selected.length === 1 ? "episode" : "episodes")} selected</strong><span>${bytes(selected.reduce((n, item) => n + item.size, 0))} total ${new Set(selected.map((item) => item.season)).size > 1 ? "across seasons" : ""}</span></div><div class="selection-actions"><button class="text-button" data-action="watch-series">Watch series</button><button class="text-button" data-action="find-missing" ${state.libraryTab === "unverified" ? "hidden" : ""}>Select missing</button><button class="text-button" data-action="select-season">${state.libraryTab === "unverified" ? "Select visible" : "Select season"}</button><button class="button primary" data-action="download" ${!selected.length || state.busy ? "disabled" : ""}>${icon("download")}${state.demo ? "Preview download queue" : "Download selected"}${icon("arrow")}</button></div></div>`
      : `<div class="empty-state"><div class="empty-symbol">${icon("shelf")}</div><h3>A tidy collection starts here.</h3><p>Connect your account to browse the series channels you can access.</p><div><button class="button primary" data-action="connect">Connect Telegram ${icon("arrow")}</button><button class="text-button" data-action="demo">Explore the interface</button></div></div>`
  }</section>
  <div class="destination-strip"><span class="destination-icon">${icon(state.mode === "archive" ? "drive" : "folder")}</span><div><span class="destination-label">${state.mode === "archive" ? "DOWNLOAD FOLDER" : "WATCH FOLDER"}</span><strong>${escape(root?.path || "Choose a folder before downloading")}</strong></div><span class="destination-hint">${state.mode === "archive" ? "Sorted into season folders" : "Stays separate from your archive"}</span><button class="text-button" data-action="folder" data-mode="${state.mode}">${root ? "Change" : "Choose folder"}${icon("arrow")}</button></div>`;
}
function fileDetails(job) {
  const name = job.finalPath?.split(/[\\/]/).pop() || job.item.filename;
  return `<h2>File details</h2><dl class="file-details"><dt>Saved filename</dt><dd>${escape(name)}</dd><dt>Original Telegram filename</dt><dd>${escape(job.item.filename)}</dd><dt>Location</dt><dd>${escape(job.finalPath || "Not saved yet")}</dd></dl>${job.namingError ? `<p class="job-error">${escape(job.namingError)}</p><button class="button secondary" data-action="retry-naming" data-job="${job.id}">${icon("refresh")}Retry season naming</button>` : ""}${job.status === "complete" ? `<button class="button secondary" data-action="reveal-job" data-job="${job.id}">${icon("folder")}Show in folder</button>` : ""}<p>Earlier downloads may use the old naming format. This is the recorded file location; existing files have not been renamed or moved.</p>`;
}
function refreshQueueBadge() {
  const button=$('[data-page="queue"]');if(!button)return;
  const count=state.jobs.filter(job=>!["complete","deleted","missing","cancelled"].includes(job.status)).length;
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
function queuePage(saved) {
  const jobs = saved
    ? state.jobs.filter((job) => job.status === "complete")
    : state.jobs.filter(job => !["deleted", "missing"].includes(job.status));
  const {total,received,remaining} = batchProgress(jobs, state.currentBatchId);
  const speed = jobs.reduce((n, job) => n + (job.speed || 0), 0);
  return `<section class="simple-heading"><div class="eyebrow">${saved ? "A PLACE FOR EVERYTHING" : "LET THE QUEUE DO ITS THING"}</div><h1>${saved ? "Your saved files." : "Downloads, in motion."}</h1><p>${saved ? "Your archive and viewing copies, kept comfortably separate." : `${state.demo ? "Sample queue · no file transfers" : "Direct from Telegram to your computer"}${speed ? ` · ${bytes(speed)}/s` : ""}`}</p></section>
  <div class="queue-summary"><div><small>IN QUEUE</small><strong>${jobs.filter((j) => !["complete", "deleted", "cancelled"].includes(j.status)).length}</strong></div><div><small>${saved ? "COMPLETED" : "BATCH COMPLETED"}</small><strong>${jobs.filter(j => j.status === "complete" && (saved || j.batchId === state.currentBatchId)).length}</strong></div><div>${saved ? `<small>SAVED FILE SIZE</small><strong class="size-total">${bytes(jobs.filter(j => j.status === "complete").reduce((n,j) => n+j.item.size,0))}</strong>` : `<small>CURRENT BATCH</small><strong class="size-total">${bytes(received)} / ${bytes(total)}</strong><small>${bytes(remaining)} remaining</small><progress ${total ? "" : "hidden"} class="batch-progress" max="${total || 1}" value="${received}" aria-label="Current batch download progress"></progress>`}</div></div>
  ${jobs.length ? `<div class="queue-actions" role="group" aria-label="${saved ? "Saved file actions" : "Queue actions"}">${!saved ? [["pause", "Pause all"], ["resume", "Resume all"], ["cancel", "Cancel all"]].map(([action,label])=>`<button class="button secondary" data-action="bulk-job" data-control="${action}" title="${action === "cancel" ? "Cancel keeps partial files for resume." : "Checking and transferring files finish first."}">${label}</button>`).join("") : ""}<button class="button secondary queue-delete" data-action="${saved ? "delete-all-saved" : "delete-all-queue"}" title="${saved ? "Move saved files to the Recycle Bin after confirmation." : "Remove pending entries; keep completed media and partial files."}">${icon("trash")}${saved ? "Delete all saved files" : "Delete all pending"}</button></div>` : ""}
  <section class="catalogue-panel queue-panel workspace-scroll" tabindex="0" role="region" aria-label="${saved ? "Saved files" : "Downloads"}">${jobs.length ? jobs.map((job) => `<article class="queue-item"><span class="queue-glyph">${icon(job.mode === "archive" ? "drive" : "play")}</span><div class="queue-content"><div class="queue-title"><strong>${escape(job.series)} <span>${job.item.unverified ? "Unverified file" : `S${pad(job.item.season)}E${pad(job.item.episode)}${job.item.episodeEnd > job.item.episode ? `-E${pad(job.item.episodeEnd)}` : ""}`}</span></strong><span class="status status-${job.status}">${escape(job.status)}</span></div><span class="source-filename queue-filename" title="${escape(job.finalPath ? job.finalPath.split(/[\\/]/).pop() : job.item.filename)}">${escape(job.finalPath ? job.finalPath.split(/[\\/]/).pop() : job.item.filename)}</span><p>${job.item.unverified ? "Unverified" : `${job.item.resolution}p ${job.item.codec}`} <span>·</span> ${job.mode === "archive" ? "Archive" : "Watch"} <span>·</span> ${bytes(job.received || 0)} / ${bytes(job.item.size)}${job.speed ? ` <span>·</span> ${bytes(job.speed)}/s` : ""}</p><progress max="${job.item.size}" value="${job.received || 0}" aria-label="Download progress"></progress>${job.error ? `<small class="job-error">${escape(friendlyError(job.error))}</small>` : ""}${job.namingError ? `<small class="job-error">Filename normalization: ${escape(job.namingError)}</small>` : ""}${job.finalPath ? `<button class="text-button file-details-link" data-action="file-details" data-job="${job.id}">File details ${icon("info")}</button>` : ""}</div><div class="job-controls">${!["checking", "transferring", "complete", "deleted"].includes(job.status) ? `<button class="icon-button" data-action="job" data-job="${job.id}" data-control="remove" aria-label="Remove from queue" title="Remove from queue; partial file retained">${icon("trash")}</button>` : ""}${["queued", "downloading", "retrying", "preview"].includes(job.status) ? `<button class="icon-button" data-action="job" data-job="${job.id}" data-control="pause" aria-label="Pause download">${icon("pause")}</button>` : ""}${["paused", "failed", "waiting", "cancelled"].includes(job.status) ? `<button class="icon-button" data-action="job" data-job="${job.id}" data-control="resume" aria-label="Resume download">${icon("play")}</button>` : ""}${["queued", "downloading", "paused", "retrying", "preview"].includes(job.status) ? `<button class="icon-button" data-action="job" data-job="${job.id}" data-control="cancel" aria-label="Cancel download">${icon("close")}</button>` : ""}${job.status === "complete" ? `<button class="icon-button" data-action="open-job" data-job="${job.id}" aria-label="Open video">${icon("play")}</button><button class="icon-button" data-action="delete-job" data-job="${job.id}" aria-label="Move downloaded file to Recycle Bin" title="Move to Recycle Bin">${icon("trash")}</button>` : ""}</div></article>`).join("") : `<div class="empty-state"><div class="empty-symbol">${icon(saved ? "folder" : "download")}</div><h3>${saved ? "Your collection is waiting." : "Nothing in the queue. Yet."}</h3><p>Choose episodes from your series library to get started.</p><button class="button primary" data-action="nav" data-page="library">Browse your series ${icon("arrow")}</button></div>`}</section>`;
}
function helpPage() {
  const steps = [
    ['search', 'Find your series', 'Connect Telegram, then choose a joined channel or follow a supported bot result.', 'Missing a channel? Switch to All channels.'],
    ['film', 'Choose your episodes', 'Pick a quality and codec. Select a whole season or just the episodes you want.', 'Unverified lets you choose files with uncertain metadata.'],
    ['download', 'Start your collection', 'Choose your Download or Watch folder, then download. Open completed files from Saved files.', 'Pause and resume from Downloads whenever you need.'],
  ];
  const questions = [
    ['How are my files organised?', 'Recognised episodes go into season folders. After all queued files for a season finish, filenames follow the majority separator style: dots, spaces, underscores or dashes. Extensions and tags such as WEB-DL stay intact. Ties keep the original style; paused or failed jobs delay naming. Unverified files keep original names in an Unverified folder. Filename collisions offer a retry in File details.'],
    ['What do Verified and Unverified mean?', 'Verified means the episode and quality metadata were recognised; it does not guarantee language, subtitles or content. Archive defaults to 720p HEVC and Watch prefers 1080p. Choose from formats actually found in the channel; Auto codec prefers HEVC. Check source filenames and play a sample for audio and subtitles.'],
    ['How does bot discovery work?', 'Use Change series to find the supported MovieClubFamily search group. Search for a title or paste a private message link. A single series result continues automatically; choose when several appear. The app follows supported bot buttons, sends Start and joins the series channel. Subscription help lets you select required channels and retry. Unsupported buttons and approval-only invites may still need Telegram.'],
    ['What if I pause, cancel or close the app?', 'Pause and Cancel retain partial files for resuming. Removing a queue entry keeps its partial file, but adding it again starts a new job. Closing pauses downloads even when the app stays in the tray; file verification and transfers finish safely. After a restart, resume paused jobs. Your saved Telegram session reconnects when valid; sign in again if it expires. Reconnect missing drives at their original location. Downloads need the computer awake.'],
    ['Can I clear history without deleting videos?', 'Yes. Clear app data in Settings removes history and the selected series while keeping downloaded media and partial files. Delete media separately from Saved files with confirmation. Delete all pending only removes unfinished queue entries. Settings can clean up unused partial files. Different existing media files are never overwritten; staging and the destination both need free space.'],
    ['Can I follow new episodes automatically?', 'Watch series checks new posts hourly while the app runs. Choose notifications or automatic queuing with your selected quality and folder. Select missing compares the channel against app-managed saved files in the current mode. Set download hours, bandwidth and simultaneous downloads in Settings. Requests already in flight can finish after scheduled hours end.'],
  ];
  return `<section class="simple-heading"><div class="eyebrow">HOW IT WORKS</div><h1>From channel to collection.</h1><p>Your next season, a few simple steps away.</p></section>
  <section class="help-guide workspace-scroll" tabindex="0" role="region" aria-label="How it works">
    <div class="help-hero">
      <div class="help-hero-copy"><span class="help-kicker">${icon('shelf')} A HOME FOR EVERY EPISODE</span><h2>Less sorting.<br>More watching.</h2><p>Find a series, choose your files and let Season Shelf organise the download.</p><div class="help-actions"><button class="button primary" data-action="nav" data-page="library">Open series library ${icon('arrow')}</button><button class="button secondary" data-action="show-guide">Replay welcome guide</button></div></div>
      <div class="help-illustration" role="img" aria-label="Example: downloaded episodes organised in a Season 01 folder"><div class="help-folder-label">${icon('folder')} Your collection <span>EXAMPLE</span></div><div class="help-folder-body"><div class="help-season">${icon('folder')} Season 01</div><div class="help-file">${icon('film')}<span>Episode 01<small>Saved to your folder</small></span><span class="help-file-check">${icon('check')}</span></div><div class="help-file">${icon('film')}<span>Episode 02<small>Ready to watch</small></span><span class="help-file-check">${icon('check')}</span></div></div><span class="help-folder-note">${icon('shield')} Your files. Your folders.</span></div>
    </div>
    <div class="help-section-heading"><div><span class="help-kicker">THE BASICS</span><h2>How to use Season Shelf</h2></div><span class="help-section-note">Three steps to get started</span></div>
    <ol class="help-steps">${steps.map(([glyph,title,description,tip],index)=>`<li class="help-step"><div class="help-step-top"><span class="help-step-icon">${icon(glyph)}</span><span class="help-step-number">0${index+1}</span></div><h3>${title}</h3><p>${description}</p><div class="help-step-tip">${icon('info')}<span>${tip}</span></div></li>`).join('')}</ol>
    <div class="help-folder-choices"><div>${icon('drive')}<span><strong>Download folder</strong><small>Keep your collection, organised by season.</small></span></div><div>${icon('play')}<span><strong>Watch folder</strong><small>Keep viewing copies in a separate location.</small></span></div></div>
    <div class="help-section-heading"><div><span class="help-kicker">GOOD TO KNOW</span><h2>A little more detail, when you need it.</h2></div></div>
    <div class="help-faq">${questions.map(([title,answer])=>`<details><summary><span>${title}</span>${icon('plus')}</summary><p>${answer}</p></details>`).join('')}</div>
    <div class="help-bottom-note">${icon('refresh')}<p>Installed apps download available updates automatically. Restart now, or leave installation until your next launch.</p><button class="text-button" data-action="nav" data-page="settings">Open settings ${icon('arrow')}</button></div>
  </section>`;
}

function usageTiles() {
  return `<div><small>Network payload received</small><strong>${bytes(state.usage.payloadBytes || 0)}</strong></div><div><small>Verified bytes published</small><strong>${bytes(state.usage.publishedBytes || 0)}</strong></div><div><small>Files completed</small><strong>${state.usage.completedFiles || 0}</strong></div>`;
}
function updateMessage() {
  const u = state.updates || {};
  return ({idle:"Check for a newer version.", development:"Updates are available in the installed app.", checking:"Checking for updates...", current:"You are up to date.", unpublished:"Updates will appear here when the first release is published.", available:`Version ${u.version} is available.`, downloading:`Downloading update: ${u.percent || 0}%`, ready:"Your update is ready to install.", error:"Could not check for updates. Please try again later."})[u.state] || "Check for updates.";
}
function settingsPage() {
  return `<section class="simple-heading"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h1>A workspace that fits.</h1><p>Make it yours. Keep your downloads organised.</p></section><section class="settings-panel settings-groups workspace-scroll" tabindex="0" role="region" aria-label="Settings"><section class="settings-group"><h2>Appearance</h2>  <div class="setting-row"><div><h3>Theme</h3><p>A little easier on the eyes.</p></div><div class="segmented">${["dark", "light", "system"].map((theme) => `<button data-action="set-theme" data-theme="${theme}" class="${state.settings.theme === theme ? "active" : ""}">${theme[0].toUpperCase() + theme.slice(1)}</button>`).join("")}</div></div>${appearanceForm(state.settings)}</section><section class="settings-group"><h2>Downloads and storage</h2>  ${["archive", "watch"].map((mode) => `<div class="setting-row"><div><h3>${mode === "archive" ? "Download folder" : "Watch folder"}</h3><p>${escape(state.settings[`${mode}Root`]?.path || "No folder selected")}</p></div><button class="button secondary" data-action="folder" data-mode="${mode}">${icon("folder")}Choose folder</button></div>`).join("")}  <form id="transfer-form" class="setting-row transfer-settings"><div><h3>Download hours and bandwidth</h3><p>Set a shared speed limit and an optional daily schedule.</p><div class="transfer-fields"><label class="transfer-field">Speed limit<span class="unit-field"><input name="speedKiB" type="number" min="0" max="1048576" value="${state.settings.transfer?.speedKiB || 0}" aria-describedby="speed-help"><span>KiB/s</span></span><small id="speed-help">0 means unlimited, across all downloads.</small></label><div class="schedule-field"><label class="schedule-toggle"><input name="scheduled" type="checkbox" ${state.settings.transfer?.scheduled ? 'checked' : ''}>Use download hours</label><fieldset class="schedule-times" ${state.settings.transfer?.scheduled ? '' : 'disabled'}><legend class="sr-only">Download hours</legend><label>From<input name="start" type="time" value="${state.settings.transfer?.start || '00:00'}"></label><label>Until<input name="end" type="time" value="${state.settings.transfer?.end || '00:00'}"></label></fieldset><small>Local time. Matching times allow all day.</small></div></div><div class="transfer-footer"><button class="button secondary">Save download preferences</button><small>Requests already in progress may finish after the window closes.</small></div></div></form>  <div class="setting-row"><div><h3>Simultaneous downloads</h3><p>Choose how many files can download at once.</p></div><select id="concurrency" aria-label="Simultaneous downloads">${[1, 2, 3, 4].map((n) => `<option ${n === state.settings.concurrency ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="setting-row"><div><h3>When closing the window</h3><p>Downloads pause in both modes. File checks and transfers finish safely.</p></div><select id="close-behavior" aria-label="When closing the window"><option value="tray" ${state.settings.closeToTray !== false ? "selected" : ""}>Keep in system tray</option><option value="quit" ${state.settings.closeToTray === false ? "selected" : ""}>Close the app</option></select></div></section><section class="settings-group"><h2>Channel filtering</h2>  <div class="keyword-settings"><h3>Channel keyword filter</h3><p>Hide matching words or phrases in Suggested channels. One per line or separate with commas. All channels always shows everything.</p><form id="keyword-form"><label for="hidden-keywords">Hidden keywords</label><textarea id="hidden-keywords" name="keywords" rows="5" spellcheck="false">${escape((state.settings.hiddenKeywords ?? defaultHiddenKeywords).join("\n"))}</textarea><div class="row-actions"><button class="button primary" type="submit">Save keywords</button><button class="button secondary" data-action="reset-keywords">Restore defaults</button></div></form><small>Media-labelled channels stay visible. Leave the list empty to disable keyword hiding.</small></div></section><section class="settings-group"><h2>Data and activity</h2>  <div class="keyword-settings"><h3>Unused partial files</h3><p>${state.stagingInfo ? `${state.stagingInfo.count} unused ${state.stagingInfo.count === 1 ? "file" : "files"} &middot; ${bytes(state.stagingInfo.bytes)}` : "Check for partial files left behind by removed queue entries."}</p><div class="row-actions"><button class="button secondary" data-action="scan-staging">Check storage</button><button class="button secondary" data-action="cleanup-staging" ${!state.stagingInfo?.count ? "disabled" : ""}>${icon("trash")}Clean up unused partials</button></div><p>Current jobs, including paused and cancelled entries, are preserved. Cleanup uses the Recycle Bin.</p></div>  <div class="usage-settings"><h3>Lifetime activity</h3><div class="usage-summary" id="usage-summary">${usageTiles()}</div><p>Measured since ${state.usage.since ? escape(new Date(state.usage.since).toLocaleString()) : "this update"}. Received data includes retries. Saved data counts successfully completed downloads. These totals remain after deleting files and exclude activity before tracking began.</p><button class="button secondary" data-action="reset-activity">Reset lifetime totals</button></div><div class="setting-row"><div><h3>Clear app data</h3><p>Reset history, the selected series, series watches and lifetime totals. Keeps downloaded files, partials, your login and preferences.</p></div><button class="button secondary" data-action="clear-app-data">Clear app data</button></div></section><section class="settings-group"><h2>About</h2><div class="setting-row"><div><h3>Quick start guide</h3><p>Revisit the steps for connecting, choosing files and downloading.</p></div><button class="button secondary" data-action="show-guide">Watch guide again</button></div>  <div class="setting-row update-settings"><div><h3>Season Shelf</h3><p>Version ${escape(state.version || "0.1.0")}</p><p id="update-status" role="status">${escape(updateMessage())}</p><p>Updates download automatically at startup and during daily checks. Choose Restart now or Not now; deferred updates install on the next launch after verification.</p><div class="queue-actions"><button class="button secondary" data-action="update-check">Check for updates</button>${state.updates?.state === "available" ? `<button class="button secondary" data-action="update-download">Download update</button>` : ""}${state.updates?.state === "ready" ? `<button class="button primary" data-action="update-install">Restart and install</button>` : ""}</div><p>No project license has been selected yet. Third-party components retain their own licenses.</p><button class="text-button" data-action="licenses">Third-party licenses</button></div></div>  <div class="settings-footnote">${icon("shield")} Files download directly from Telegram. Settings and download history stay on your computer. This app uses the Telegram API and is an independent, unofficial client.</div></section></section>`;
}

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
    state.season = chosen()[0]?.season || 1;
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
      state.quality = { ...effectiveQuality(), [el.dataset.field]: el.dataset.field === "resolution" ? Number(el.dataset.value) : el.dataset.value };
      state.selected.clear();
      state.season = chosen().some(i => i.season === state.season) ? state.season : chosen()[0]?.season || 1;
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
      state.season = chosen().some((i) => i.season === state.season)
        ? state.season
        : chosen()[0]?.season || 1;
      render();
    } else if (action === "season") {
      state.season = Number(el.dataset.season);
      state.query = "";
      render();
      const tab = document.getElementById(`season-${state.season}`);
      tab?.focus({preventScroll:true});
      tab?.scrollIntoView?.({block:"nearest",inline:"nearest"});
    } else if (action === "select-season") {
      const items = state.libraryTab === "unverified" ? visible() : chosen().filter((i) => i.season === state.season);
      items.forEach((i) => state.selected.add(i.id));
      render();
    } else if (action === "connect") connectionModal();
    else if (action === "reconnect") await connect({});
    else if (["update-check","update-download","update-install"].includes(action)) {try{state.updates=await call(action);render();}catch(error){if($("#update-error")) $("#update-error").textContent=friendlyError(error.message);else throw error;}}
    else if (action === "watch-series") {
      const watches=await call("watch-list");const watch=watches.find(w=>w.channel.id===state.catalogue.channel.id && w.mode===state.mode);
      modal(`<h2>Watch for new episodes</h2><p>Check this channel hourly while the app is open. Uses your current quality and ${escape(state.mode)} folder. New uploads only; existing files stay under manual control.</p><form id="watch-form"><label>When new files appear<select name="watchMode"><option value="notify" ${watch && !watch.automatic ? "selected" : ""}>Notify me</option><option value="auto" ${watch?.automatic ? "selected" : ""}>Queue automatically</option><option value="off" ${!watch ? "selected" : ""}>Off</option></select></label><button class="button primary">Save series watch</button></form>${watch?.error ? `<p role="alert">${escape(watch.error)}</p>` : ""}`);
    } else if (action === "find-missing") {
      if(!state.demo) state.jobs=await call("find-missing",{mode:state.mode});
      const missing=missingEpisodes(chosen(),state.jobs,state.catalogue.channel.id,state.mode).filter(item=>item.season===state.season);
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
        for (const item of selectedItems())
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
          unverifiedIds: selectedItems().filter(item=>item.unverified).map(item=>item.id),
          mode: state.mode,
          quality: effectiveQuality(),
        });
        toast(`${ids.length} ${ids.length === 1 ? "episode" : "episodes"} added to the queue.`);
      }
      state.page = "queue";
      state.selected.clear();
      render();
    } else if (action === "bulk-job") {
      if (state.demo) {
        for (const job of state.jobs) {
          if (["complete", "deleted"].includes(job.status)) continue;
          if (el.dataset.control === "pause" && job.status === "cancelled") continue;
          job.status = { pause: "paused", resume: "preview", cancel: "cancelled" }[el.dataset.control];
        }
      } else state.jobs = await call("queue-control", { all: true, action: el.dataset.control });
      render();
    } else if (action === "job") {
      if (state.demo) {
        if (el.dataset.control === "remove") state.jobs = state.jobs.filter(j => j.id !== el.dataset.job);
        else state.jobs.find((j) => j.id === el.dataset.job).status = { pause: "paused", resume: "preview", cancel: "cancelled" }[el.dataset.control];
      } else
        state.jobs = await call("queue-control", {
          id: el.dataset.job,
          action: el.dataset.control,
        });
      render();
    } else if (action === "open-job")
      await call("open-job", { id: el.dataset.job });
    else if (action === "file-details") {
      const job = state.jobs.find(j => j.id === el.dataset.job);
      modal(fileDetails(job));
    } else if (action === "retry-naming") {
      state.jobs = await call("retry-naming", {id:el.dataset.job});
      const job = state.jobs.find(j => j.id === el.dataset.job);
      modal(fileDetails(job));
      render();
      toast(job.namingError || "Season filenames updated.", !!job.namingError);
    } else if (action === "reveal-job") {
      await call("reveal-job", {id:el.dataset.job});
    } else if (action === "delete-job") {
      state.jobs = await call("delete-job", { id: el.dataset.job });
      render();
    } else if (action === "delete-all-queue" || action === "delete-all-saved") {
      if (state.demo) {
        if (action === "delete-all-queue") state.jobs = state.jobs.filter(job => ["complete","deleted"].includes(job.status));
        else state.jobs.filter(job=>job.status === "complete").forEach(job=>job.status="deleted");
        toast("Sample entries updated. No files were deleted.");
      } else {
        const result = await call(action);
        state.jobs = result.jobs;
        toast(action === "delete-all-queue" ? `${result.removed} queue entries removed.` : `${result.deleted} files moved to the Recycle Bin. ${result.failures.length} kept.`, !!result.failures?.length);
      }
      render();
    } else if (action === "scan-staging" || action === "cleanup-staging") {
      if (state.demo) return toast("Storage cleanup is available in the desktop app.");
      if (action === "cleanup-staging") {
        const result = await call("cleanup-staging");
        toast(`${result.deleted} partial files moved to the Recycle Bin. ${result.failures.length} kept.`, !!result.failures.length);
      }
      state.stagingInfo = await call("staging-info");
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
      visible().forEach((item) =>
        event.target.checked
          ? state.selected.add(item.id)
          : state.selected.delete(item.id),
      );
      render();
    } else if (event.target.id.startsWith("quality-")) {
      state.quality[event.target.id === "quality-resolution" ? "resolution" : "codec"] = event.target.id === "quality-resolution" ? Number(event.target.value) : event.target.value;
      state.selected.clear();
      state.season = chosen().some(i => i.season === state.season) ? state.season : chosen()[0]?.season || 1;
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
      await call("watch-set",{mode:state.mode,quality:effectiveQuality(),automatic:values.watchMode==="off" ? null : values.watchMode==="auto"});$("#dialog").close();toast("Series watch saved.");
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
      if ($("#usage-summary")) $("#usage-summary").innerHTML = usageTiles();
    } else if (type === "queue") {
      if (state.demo) {
        if (liveSnapshot) liveSnapshot.jobs = data;
      } else {
        state.jobs = data;
        if (state.page === "queue" || state.page === "saved") render();else refreshQueueBadge();
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
    state.season = chosen()[0]?.season || 1;
    render();
    if (state.firstRun) showGuide();
    if (state.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.", true);
  } catch (error) {
    render();
    toast(error.message, true);
  }
} else startDemo();
