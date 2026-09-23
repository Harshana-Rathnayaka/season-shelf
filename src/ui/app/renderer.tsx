import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AppShell, type ShellState } from "./AppShell";
import { LegacyPage } from "./LegacyPage";
import { DownloadsPage } from "../features/downloads/DownloadsPage";
import type { DownloadsState, DownloadActionHandler } from "../features/downloads/types";
import { LibraryPage } from "../features/library/LibraryPage";
import type { LibraryState, LibraryActionHandler } from "../features/library/types";

type RendererState = ShellState & DownloadsState & LibraryState;
interface Callbacks {
  onDownloadAction: DownloadActionHandler;
  onLibraryAction: LibraryActionHandler;
  onBrowse: () => void;
  hasDesktop: boolean;
}

export function createRenderer(container: HTMLElement, callbacks: Callbacks) {
  const root = createRoot(container);
  let content = "";
  let revision = 0;
  function update(state: RendererState, count: number) {
    // The existing controller restores focus/scroll immediately after rendering.
    flushSync(() => root.render(<AppShell state={state} count={count}>
      {state.page === "queue"
        ? <DownloadsPage state={state} onAction={callbacks.onDownloadAction} onBrowse={callbacks.onBrowse} />
        : state.page === "library"
          ? <LibraryPage state={state} onAction={callbacks.onLibraryAction} hasDesktop={callbacks.hasDesktop} />
          : <LegacyPage html={content} revision={revision} />}
    </AppShell>));
  }
  return {
    render(state: RendererState, html: string, count: number) {
      content = html;
      revision++;
      update(state, count);
    },
    updateShell: update,
    dispose() { root.unmount(); },
  };
}
