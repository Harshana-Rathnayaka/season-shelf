import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AppShell, type ShellState } from "./components/AppShell";
import { LegacyPage } from "./components/LegacyPage";

export function createRenderer(container: HTMLElement) {
  const root = createRoot(container);
  let content = "";
  let revision = 0;
  function update(state: ShellState, count: number) {
    // The existing controller restores focus/scroll immediately after rendering.
    flushSync(() => root.render(<AppShell state={state} count={count}><LegacyPage html={content} revision={revision} /></AppShell>));
  }
  return {
    render(state: ShellState, html: string, count: number) {
      content = html;
      revision++;
      update(state, count);
    },
    updateShell: update,
    dispose() { root.unmount(); },
  };
}
