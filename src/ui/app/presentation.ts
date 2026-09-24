import { applyAppearance } from "../features/settings/appearance";
import { friendlyError } from "../shared/lib/format";
import type { AppState } from "./state";
import type { Call } from "./ipc";

/** Document-level effects are kept outside page components and domain actions. */
export function createPresentation(getState: () => AppState, call: Call, toastElement: HTMLElement) {
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let titleBarColours = "";
  const colourScheme = matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    const state = getState();
    applyAppearance(state.settings);
    document.documentElement.dataset.theme = state.settings.theme === "system"
      ? colourScheme.matches ? "dark" : "light" : state.settings.theme || "dark";
    if (!state.customTitleBar || !window.shelf) return;
    const light = document.documentElement.dataset.theme === "light";
    const color = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (light ? "#f5f6f4" : "#101113");
    const symbolColor = light ? "#202c27" : "#edf0ef";
    const signature = color + symbolColor;
    if (signature === titleBarColours) return;
    titleBarColours = signature;
    void call("window-theme", { color, symbolColor }).catch(() => { titleBarColours = ""; });
  }
  colourScheme.addEventListener("change", applyTheme);
  return {
    applyTheme,
    toast(message: unknown, error = false) {
      toastElement.textContent = friendlyError(message);
      toastElement.className = `visible ${error ? "error" : ""}`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastElement.className = ""; }, 5500);
    },
    dispose() {
      colourScheme.removeEventListener("change", applyTheme);
      clearTimeout(toastTimer);
    },
  };
}
