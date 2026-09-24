import type { ShellState } from "./AppShell";
import type { DownloadsState } from "../features/downloads/types";
import type { LibraryState } from "../features/library/types";
import type { SettingsState, Usage, UpdateStatus } from "../features/settings/types";
import type { Channel } from "../features/discovery/dialog-types";

export type AppState = ShellState & DownloadsState & LibraryState & SettingsState & {
  channels: Channel[];
  channelFilter: "suggested" | "all";
  hasCredentials: boolean;
  firstRun?: boolean;
  connectionError?: string | null;
};

export type BackgroundEvent =
  | { type: "queue"; data: DownloadsState["jobs"] }
  | { type: "usage"; data: Usage }
  | { type: "updates"; data: UpdateStatus }
  | { type: "scan-progress"; data: NonNullable<LibraryState["scanProgress"]> }
  | { type: "connection"; data: Pick<AppState, "connected" | "profile" | "restoringSession" | "connectionError"> };

export function createInitialState(hasDesktop: boolean): AppState {
  return {
    updates: { state: "idle" }, page: "library", downloadTab: "ongoing",
    mode: "archive", quality: {}, libraryTab: "verified", channelFilter: "suggested",
    season: 1, selected: new Set<string>(), query: "", catalogue: null,
    channels: [], jobs: [], usage: { payloadBytes: 0, publishedBytes: 0, completedFiles: 0 },
    stagingInfo: null, connected: false, hasCredentials: false,
    settings: { theme: "dark", concurrency: 2 }, demo: !hasDesktop, busy: false,
  };
}

/** Background updates never replace local selection, drafts or lifetime totals indirectly. */
export function reduceBackgroundEvent(state: AppState, event: BackgroundEvent): AppState {
  switch (event.type) {
    case "queue": return state.demo ? state : { ...state, jobs: event.data };
    case "usage": return { ...state, usage: event.data, currentBatchId: event.data.currentBatchId };
    case "updates": return { ...state, updates: event.data };
    case "scan-progress": return state.busy ? { ...state, scanProgress: event.data } : state;
    case "connection": return { ...state, ...event.data };
  }
}
