import { icon } from "../icons.mjs";
import { escape } from "../format.mjs";

export function appShell(state, content, count) {
  return `${state.customTitleBar ? `<div class="app-titlebar">
    <span>${icon("shelf")} ${escape(state.appName || "Season Shelf")}</span>
    </div>` : ""}<aside class="sidebar" id="workspace-sidebar">
    <button class="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-controls="workspace-sidebar" aria-expanded="${!state.settings.sidebarCollapsed}" aria-label="${state.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}" title="${state.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}">${icon("sidebar")}</button>
    <a class="brand" href="#" data-action="nav" data-page="library">
    <span class="brand-mark">${icon("shelf")}</span>
    <span>season<span class="brand-light">shelf</span>
    <small>YOUR SERIES, SORTED.</small>
    </span>
    </a>
    <div class="nav-label">WORKSPACE</div>
    <nav aria-label="Main navigation">
      ${[
        ["library", "grid", "Series library"],
        ["queue", "download", "Downloads"],
        ["help", "info", "How it works"],
      ]
        .map(
          ([page, glyph, label]) =>
            `<button class="nav-item ${state.page === page ? "active" : ""}" data-action="nav" data-page="${page}" aria-label="${label}" title="${label}">${icon(glyph)}<span>${label}</span>${page === "queue" && count ? `<b class="nav-count">${count}</b>` : ""}</button>`,
        )
        .join("")}
    </nav>
    <div class="sidebar-note">
    <span class="tiny-mark">${icon("shield")}</span>
    <strong>A little less clicking.</strong>
    <p>More time for the next episode.</p>
    <span class="local-label">
    <i>
    </i> Runs on your computer</span>
    </div>
    <div class="sidebar-bottom">
    <button class="nav-item ${state.page === "settings" ? "active" : ""}" data-action="nav" data-page="settings" aria-label="Settings" title="Settings">${icon("settings")}<span>Settings</span>
    </button>
    <button class="profile" data-action="account-menu" aria-expanded="false" aria-controls="account-popover" aria-label="Telegram account" title="Telegram account">
    <span class="avatar">${icon("bolt")}</span>
    <span>
    <strong>${state.connected ? escape(state.profile?.name || "Telegram connected") : "Your workspace"}</strong>
    <small>${state.demo ? "Exploring sample data" : state.connected ? escape(state.profile?.username ? "@" + state.profile.username : "Local account session") : "Connect to get started"}</small>
    </span>${icon("chevron")}</button>
    <div class="account-popover" id="account-popover" role="dialog" aria-label="Telegram account" hidden>
    <div class="account-heading">
    <span class="avatar">${icon("bolt")}</span>
    <div>
    <strong>${escape(state.profile?.name || "Your workspace")}</strong>
    <small>${state.profile?.username ? "@" + escape(state.profile.username) : state.connected ? "Telegram account" : "Not connected"}</small>
    </div>
    </div>
    <p>${state.connected ? "Connected. Your session is encrypted on this computer." : "Connect Telegram to browse your channels."}</p>
    <button class="nav-item" data-action="${state.connected ? "disconnect" : "connect"}">${icon("arrow")}${state.connected ? "Log out and forget session" : "Connect Telegram"}</button>
    </div>
    </div>
  </aside>
  <div class="main-shell workspace-shell ${state.page === "library" ? "library-shell" : ""}">
    <header class="topbar">
    <span class="breadcrumb">Workspace ${icon("chevron")} <strong>${{ library: "Series library", queue: "Downloads", settings: "Settings", help: "How it works" }[state.page]}</strong>
    </span>
    <div class="top-actions">${state.demo ? '<span class="demo-pill">SAMPLE PREVIEW</span>' : ""}<button class="icon-button" data-action="theme" title="Toggle colour theme" aria-label="Toggle colour theme">${icon("moon")}</button>
    <button class="connection" data-action="connect">
    <i class="${state.connected ? "online" : ""}">
    </i>${state.connected ? "Connected" : state.restoringSession ? "Reconnecting..." : "Connect Telegram"}${icon("arrow")}</button>
    </div>
    </header>
  <main>${content}</main>
  <footer class="app-footer">
    <span>${icon("shield")} Local by design. Yours to control.</span>
    <span>${escape(state.appName || "Season Shelf")} <b>${escape(state.version || "0.1")}</b>
    </span>
    </footer>
    </div>`;
}
