import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AppShell, type ShellActionHandler } from "./AppShell";
import { DownloadsPage } from "../features/downloads/DownloadsPage";
import type { DownloadActionHandler } from "../features/downloads/types";
import { LibraryPage } from "../features/library/LibraryPage";
import type { LibraryActionHandler } from "../features/library/types";
import { SettingsPage } from "../features/settings/SettingsPage";
import type { SettingsActionHandler, SaveSettings } from "../features/settings/types";
import { HelpPage, type HelpCommand } from "../features/help/HelpPage";

import type { AppState } from "./state";
interface Callbacks {
  onDownloadAction: DownloadActionHandler;
  onLibraryAction: LibraryActionHandler;
  onBrowse: () => void;
  hasDesktop: boolean;
  onShellAction: ShellActionHandler;
  onSettingsAction: SettingsActionHandler;
  onSaveSettings: SaveSettings;
  onHelpAction: (command: HelpCommand) => Promise<void>;
}

export function createRenderer(container: HTMLElement, callbacks: Callbacks) {
  const root = createRoot(container);
  function update(state: AppState, count: number) {
    // The existing controller restores focus/scroll immediately after rendering.
    flushSync(() => root.render(<AppShell state={state} count={count} onAction={callbacks.onShellAction}>
      {state.page === "queue"
        ? <DownloadsPage state={state} onAction={callbacks.onDownloadAction} onBrowse={callbacks.onBrowse} />
        : state.page === "library"
          ? <LibraryPage state={state} onAction={callbacks.onLibraryAction} hasDesktop={callbacks.hasDesktop} />
          : state.page === "settings"
            ? <SettingsPage state={state} onSave={callbacks.onSaveSettings} onAction={callbacks.onSettingsAction} />
            : <HelpPage onAction={callbacks.onHelpAction} />}
    </AppShell>));
  }
  return {
    render(state: AppState, count: number) {
      update(state, count);
    },
    updateShell: update,
    dispose() { root.unmount(); },
  };
}
