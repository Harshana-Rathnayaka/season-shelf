import { icon } from "../icons.mjs";
import { escape, bytes } from "../format.mjs";
import { pad } from "../../core/catalog.mjs";
import { unverifiedItems } from "../../core/collection.mjs";
import { chosen, visible, selectedItems } from "../models/library.mjs";
import { qualityPicker } from "../components/quality-picker.mjs";
export function library(state, hasDesktop = false) {
  const all = chosen(state),
    items = state.libraryTab === "verified" ? visible(state) : [],
    selected = selectedItems(state);
  const seasons = [...new Set(all.map((item) => item.season))];
  const root = state.settings[`${state.mode}Root`];
  const needsReview = (state.catalogue?.items || []).filter(
    (item) => item.reason,
  ).length;
  return `<section class="page-heading">
    <div>
    <div class="eyebrow">A HOME FOR EVERY EPISODE</div>
    <h1>Your next watch,<br>
    <span>beautifully organised.</span>
    </h1>
    <p>Pick a series. Choose your quality. We’ll take it from here.</p>
    </div>
    <div class="orbit-art" aria-hidden="true">
    <div class="orbit orbit-one">
    </div>
    <div class="orbit orbit-two">
    </div>
    <div class="orbit orbit-three">
    </div>
    <div class="orbit-core">${icon("shelf")}</div>
    <span class="orbit-point point-one">
    </span>
    <span class="orbit-point point-two">
    </span>
    <span class="orbit-caption">COLLECT. WATCH. REPEAT.</span>
    </div>
    </section>
  <div class="library-preferences">
    <div class="mode-switch" role="group" aria-label="Download destination mode">${[["archive","drive","Archive"],["watch","play","Watch"]].map(([mode,glyph,label]) => `<button data-action="mode" data-mode="${mode}" aria-pressed="${state.mode === mode}" class="${state.mode === mode ? "active" : ""}">${icon(glyph)}${label}</button>`).join("")}</div>
    <span class="mode-description">${state.mode === "archive" ? "Keep a permanent copy on your HDD" : "A viewing copy in your Watch folder"}</span>
    </div>
  <section class="catalogue-panel library-panel">
    <div class="panel-heading">
    <div class="panel-title">
    <span class="series-icon">${icon("film")}</span>
    <div>
    <h2>${escape(state.catalogue?.channel.title || "Choose your first series")}</h2>
    <p>${state.catalogue ? `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"} found <span>·</span> ${all.length} matching ${all.length === 1 ? "episode" : "episodes"} ${state.demo ? "<span>·</span> Illustrative sample" : ""}` : "Select a Telegram channel to find its episodes"}</p>
    </div>
    </div>
    <div class="row-actions">
    <button class="button secondary" data-action="choose-series">${icon("folder")}Change series${icon("down")}</button>
    <button class="icon-button" data-action="rescan" aria-label="Rescan channel" title="Rescan channel" ${state.busy || !state.catalogue ? "disabled" : ""}>${icon("refresh", state.busy ? "spin" : "")}</button>
    </div>
    </div>
  ${state.busy ? '<div class="notice" role="status" id="scan-status">Scanning channel metadata…</div>' : ""}
  ${state.demo ? `<div class="sample-note">${icon("info")} Sample data lets you explore the interface. No files are downloaded.${hasDesktop ? '<button data-action="exit-demo">Exit preview</button>' : ""}</div>` : ""}
  ${state.catalogue?.truncated ? '<div class="notice">Scan limited to 10,000 messages. Earlier episodes may not be included.</div>' : ""}
  ${
    state.catalogue
      ? `<div class="library-controls">
    <div class="quality-area">${qualityPicker(state)}</div>
    <div class="library-list-switch" role="group" aria-label="File verification">
    <button class="text-button" data-action="library-tab" data-tab="verified" aria-pressed="${state.libraryTab === "verified"}">Verified <span>${all.length}</span>
    </button>
    <button class="text-button" data-action="library-tab" data-tab="unverified" aria-pressed="${state.libraryTab === "unverified"}" title="Metadata could not be verified. Select files manually to download their original names into Unverified.">Unverified <span>${needsReview}</span>
    </button>
    </div>
    <div class="catalogue-tools" ${state.libraryTab === "unverified" ? 'data-unverified="true"' : ""}>
    <div class="season-navigation" ${seasons.length ? "" : 'data-empty="true"'}>
    <button class="icon-button season-prev" data-action="scroll-seasons" data-direction="-1" aria-label="Earlier seasons">${icon("chevron")}</button>
    <div class="season-tabs" id="season-tabs" role="tablist" aria-label="Seasons">${seasons.map((season) => `<button role="tab" aria-controls="episode-list" id="season-${season}" tabindex="${state.season === season ? 0 : -1}" aria-selected="${state.season === season}" class="season-tab ${state.season === season ? "active" : ""}" data-action="season" data-season="${season}">Season ${pad(season)}<span>${all.filter((item) => item.season === season).length}</span>
    </button>`).join("")}</div>
    <button class="icon-button season-next" data-action="scroll-seasons" data-direction="1" aria-label="Later seasons">${icon("chevron")}</button>
    </div>
    <label class="table-search">${icon("search")}<input id="episode-search" placeholder="Find an episode…" aria-label="Find an episode" value="${escape(state.query)}">
    </label>
    </div>
    </div>
  <div class="episode-table" id="episode-list" role="tabpanel" aria-labelledby="season-${state.season}" tabindex="0">
    <table>
    <thead>
    <tr>
    <th class="checkbox-cell">
    <input type="checkbox" id="select-all" ${visible(state).length && visible(state).every((item) => state.selected.has(item.id)) ? "checked" : ""}>
    </th>
    <th>${state.libraryTab === "unverified" ? "FILE" : "EPISODE"}</th>
    <th>${state.libraryTab === "unverified" ? "" : "QUALITY"}</th>
    <th class="right">SIZE</th>
    </tr>
    </thead>
    <tbody>${items.map((item) => `<tr data-episode-row="${escape(item.id)}" class="${state.selected.has(item.id) ? "row-selected" : ""}">
    <td class="checkbox-cell">
    <input type="checkbox" data-episode="${escape(item.id)}" aria-label="Select episode ${item.episode}" ${state.selected.has(item.id) ? "checked" : ""}>
    </td>
    <td>
    <div class="episode-title" title="${escape(item.filename)}">
    <span class="episode-number">${pad(item.episode)}</span>
    <div class="episode-copy">
    <strong>${escape(item.title)}</strong>
    <span class="source-filename">${escape(item.filename)}</span>
    <small>S${pad(item.season)}E${pad(item.episode)}${item.episodeEnd > item.episode ? `-E${pad(item.episodeEnd)} (combined file)` : ""} <span>·</span> ${/webrip/i.test(item.filename) ? "WEBRip" : "Video file"}${item.bitDepth ? ` <span>·</span> ${item.bitDepth}-bit` : ""}</small>
    </div>
    </div>
    </td>
    <td>
    <span class="quality-tag">${item.resolution}p</span>
    <span class="codec">${item.codec}</span>
    </td>
    <td class="file-size right" title="${item.alternatives ? `Smallest of ${item.alternatives + 1} matching files` : "Only matching file"}">${bytes(item.size)}</td>
    </tr>`).join("")}</tbody>${state.libraryTab === "unverified" ? `<tbody class="unverified-files">
    <tr class="unverified-description">
    <td colspan="4">Choose files manually. Original names are kept in the Unverified folder.</td>
    </tr>${unverifiedItems(state.catalogue?.items || []).filter(item=> item.filename.toLowerCase().includes(state.query.toLowerCase())).map(item=>`<tr data-episode-row="${escape(item.id)}">
    <td>
    <input type="checkbox" data-episode="${escape(item.id)}" aria-label="Select unverified file ${escape(item.filename)}" ${state.selected.has(item.id)?"checked":""}>
    </td>
    <td colspan="2">
    <span class="source-filename">${escape(item.filename)}</span>
    <small>${escape(item.reason)}</small>
    </td>
    <td class="file-size right">${bytes(item.size)}</td>
    </tr>`).join("")}</tbody>` : ""}</table>${!visible(state).length ? '<div class="empty-inline">No matching episodes here. Try another season or quality mode.</div>' : ""}</div>
  <div class="selection-bar">
    <div>
    <strong>${selected.length} ${state.libraryTab === "unverified" || selected.some(item=>item.unverified) ? (selected.length === 1 ? "file" : "files") : (selected.length === 1 ? "episode" : "episodes")} selected</strong>
    <span>${bytes(selected.reduce((n, item) => n + item.size, 0))} total ${new Set(selected.map((item) => item.season)).size > 1 ? "across seasons" : ""}</span>
    </div>
    <div class="selection-actions">
    <button class="text-button" data-action="watch-series">Watch series</button>
    <button class="text-button" data-action="find-missing" ${state.libraryTab === "unverified" ? "hidden" : ""}>Select missing</button>
    <button class="text-button" data-action="select-season">${state.libraryTab === "unverified" ? "Select visible" : "Select season"}</button>
    <button class="button primary" data-action="download" ${!selected.length || state.busy ? "disabled" : ""}>${icon("download")}${state.demo ? "Preview download queue" : "Download selected"}${icon("arrow")}</button>
    </div>
    </div>`
      : `<div class="empty-state">
    <div class="empty-symbol">${icon("shelf")}</div>
    <h3>A tidy collection starts here.</h3>
    <p>Connect your account to browse the series channels you can access.</p>
    <div>
    <button class="button primary" data-action="connect">Connect Telegram ${icon("arrow")}</button>
    <button class="text-button" data-action="demo">Explore the interface</button>
    </div>
    </div>`
  }</section>
  <div class="destination-strip">
    <span class="destination-icon">${icon(state.mode === "archive" ? "drive" : "folder")}</span>
    <div>
    <span class="destination-label">${state.mode === "archive" ? "DOWNLOAD FOLDER" : "WATCH FOLDER"}</span>
    <strong>${escape(root?.path || "Choose a folder before downloading")}</strong>
    </div>
    <span class="destination-hint">${state.mode === "archive" ? "Sorted into season folders" : "Stays separate from your archive"}</span>
    <button class="text-button" data-action="folder" data-mode="${state.mode}">${root ? "Change" : "Choose folder"}${icon("arrow")}</button>
    </div>`;
}
