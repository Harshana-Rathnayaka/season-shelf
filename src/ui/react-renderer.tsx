import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AppShell, type ShellState } from "./components/AppShell";
import { LegacyPage } from "./components/LegacyPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import type { DownloadsState, DownloadActionHandler } from "./types/downloads";

export function createRenderer(container: HTMLElement, callbacks: { onDownloadAction: DownloadActionHandler; onBrowse: () => void }) {
  const root = createRoot(container);
  let content = "";
  let revision = 0;
  function update(state: ShellState & DownloadsState, count: number) {
    // The existing controller restores focus/scroll immediately after rendering.
    flushSync(() => root.render(<AppShell state={state} count={count}>
      {state.page === "queue"
        ? <DownloadsPage state={state} onAction={callbacks.onDownloadAction} onBrowse={callbacks.onBrowse} />
        : <LegacyPage html={content} revision={revision} />}
    </AppShell>));
  }
  return {
    render(state: ShellState & DownloadsState, html: string, count: number) {
      content = html;
      revision++;
      update(state, count);
    },
    updateShell: update,
    dispose() { root.unmount(); },
  };
}
