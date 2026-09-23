import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AppShell, type ShellState } from "./components/AppShell";
import { LegacyPage } from "./components/LegacyPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import type { DownloadsState, DownloadActionHandler } from "./types/downloads";
import { LibraryPage } from "./pages/LibraryPage";
import type { LibraryState, LibraryActionHandler } from "./types/library";

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
