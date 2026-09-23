import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { Icon } from "../shared/ui/Icon";

export type Page = "library" | "queue" | "settings" | "help";
export type ShellCommand = { action: "nav"; page: Page } | { action: "theme" | "connect" | "disconnect" | "toggle-sidebar" };
export type ShellActionHandler = (command: ShellCommand) => Promise<void>;
export interface ShellState {
  page: Page;
  settings: { sidebarCollapsed?: boolean };
  customTitleBar?: boolean;
  appName?: string;
  version?: string;
  connected: boolean;
  restoringSession?: boolean;
  demo: boolean;
  profile?: { name?: string; username?: string };
}
const labels: Record<Page, string> = { library: "Series library", queue: "Downloads", settings: "Settings", help: "How it works" };

function NavButton({ page, glyph, current, count = 0, onAction }: { page: Page; glyph: string; current: Page; count?: number; onAction: ShellActionHandler }) {
  return <button className={`nav-item ${current === page ? "active" : ""}`} data-action="nav" data-page={page} aria-label={labels[page]} title={labels[page]} onClick={() => void onAction({ action: "nav", page })}>
    <Icon name={glyph} /><span>{labels[page]}</span>{count > 0 && <b className="nav-count">{count}</b>}
  </button>;
}

export function AppShell({ state, count, children, onAction }: { state: ShellState; count: number; children: ReactNode; onAction: ShellActionHandler }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const profile = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const navigate: ShellActionHandler = command => { setMenuOpen(false); return onAction(command); };
  useLayoutEffect(() => { if (menuOpen) menu.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: MouseEvent) => { if (!account.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); profile.current?.focus(); event.preventDefault(); } };
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", outside, true); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  const sidebarLabel = state.settings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const name = state.appName || "Season Shelf";
  return <>
    {state.customTitleBar && <div className="app-titlebar"><span><Icon name="shelf" /> {name}</span></div>}
    <aside className="sidebar" id="workspace-sidebar">
      <button className="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-controls="workspace-sidebar" aria-expanded={!state.settings.sidebarCollapsed} aria-label={sidebarLabel} title={sidebarLabel} onClick={() => void onAction({ action: "toggle-sidebar" })}><Icon name="sidebar" /></button>
      <a className="brand" href="#" data-action="nav" data-page="library" onClick={event => { event.preventDefault(); void onAction({ action: "nav", page: "library" }); }}>
        <span className="brand-mark"><Icon name="shelf" /></span><span>season<span className="brand-light">shelf</span><small>YOUR SERIES, SORTED.</small></span>
      </a>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <NavButton page="library" glyph="grid" current={state.page} onAction={onAction} />
        <NavButton page="queue" glyph="download" current={state.page} count={count} onAction={onAction} />
        <NavButton page="help" glyph="info" current={state.page} onAction={onAction} />
      </nav>
      <div className="sidebar-note"><span className="tiny-mark"><Icon name="shield" /></span><strong>A little less clicking.</strong><p>More time for the next episode.</p><span className="local-label"><i /> Runs on your computer</span></div>
      <div className="sidebar-bottom" ref={account}>
        <NavButton page="settings" glyph="settings" current={state.page} onAction={navigate} />
        <button className="profile" ref={profile} data-action="account-menu" aria-expanded={menuOpen} aria-controls="account-popover" aria-label="Telegram account" title="Telegram account" onClick={() => setMenuOpen(open => !open)}>
          <span className="avatar"><Icon name="bolt" /></span><span><strong>{state.connected ? state.profile?.name || "Telegram connected" : "Your workspace"}</strong><small>{state.demo ? "Exploring sample data" : state.connected ? state.profile?.username ? `@${state.profile.username}` : "Local account session" : "Connect to get started"}</small></span><Icon name="chevron" />
        </button>
        <div className="account-popover" ref={menu} id="account-popover" role="dialog" aria-label="Telegram account" hidden={!menuOpen}>
          <div className="account-heading"><span className="avatar"><Icon name="bolt" /></span><div><strong>{state.profile?.name || "Your workspace"}</strong><small>{state.profile?.username ? `@${state.profile.username}` : state.connected ? "Telegram account" : "Not connected"}</small></div></div>
          <p>{state.connected ? "Connected. Your session is encrypted on this computer." : "Connect Telegram to browse your channels."}</p>
          <button className="nav-item" data-action={state.connected ? "disconnect" : "connect"} onClick={() => { setMenuOpen(false); void onAction({ action: state.connected ? "disconnect" : "connect" }); }}><Icon name="arrow" />{state.connected ? "Log out and forget session" : "Connect Telegram"}</button>
        </div>
      </div>
    </aside>
    <div className={`main-shell workspace-shell ${state.page === "library" ? "library-shell" : ""}`}>
      <header className="topbar"><span className="breadcrumb">Workspace <Icon name="chevron" /> <strong>{labels[state.page]}</strong></span>
        <div className="top-actions">{state.demo && <span className="demo-pill">SAMPLE PREVIEW</span>}<button className="icon-button" data-action="theme" title="Toggle colour theme" aria-label="Toggle colour theme" onClick={() => void onAction({ action: "theme" })}><Icon name="moon" /></button>
          <button className="connection" data-action="connect" onClick={() => void onAction({ action: "connect" })}><i className={state.connected ? "online" : ""} />{state.connected ? "Connected" : state.restoringSession ? "Reconnecting..." : "Connect Telegram"}<Icon name="arrow" /></button>
        </div>
      </header>
      {children}
      <footer className="app-footer"><span><Icon name="shield" /> Local by design. Yours to control.</span><span>{name} <b>{state.version || "0.1"}</b></span></footer>
    </div>
  </>;
}
