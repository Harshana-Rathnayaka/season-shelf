export type DestinationMode = "archive" | "watch";
export type LibraryTab = "verified" | "unverified";
export interface QualitySelection { resolution: number; codec: string }
export interface LibraryItem {
  id: string;
  filename: string;
  size: number;
  title?: string;
  season?: number | null;
  episode?: number | null;
  episodeEnd?: number | null;
  resolution?: number | null;
  codec?: string | null;
  reason?: string | null;
  bitDepth?: number | null;
  alternatives?: number;
  unverified?: boolean;
}
export interface LibraryState {
  catalogue: { channel: { id: string; title: string }; items: LibraryItem[]; truncated?: boolean } | null;
  mode: DestinationMode;
  quality: Partial<QualitySelection>;
  libraryTab: LibraryTab;
  selected: Set<string>;
  season: number;
  query: string;
  busy: boolean;
  scanProgress?: { scanned: number; found: number };
  demo: boolean;
  settings: { archiveRoot?: { path: string }; watchRoot?: { path: string } };
}
export type LibraryCommand =
  | { action: "mode"; mode: DestinationMode }
  | { action: "quality"; field: "resolution"; value: number }
  | { action: "quality"; field: "codec"; value: string }
  | { action: "season"; season: number }
  | { action: "library-tab"; tab: LibraryTab }
  | { action: "search"; query: string }
  | { action: "select-item"; id: string; selected: boolean }
  | { action: "select-all"; selected: boolean }
  | { action: "folder"; mode: DestinationMode }
  | { action: "select-season" | "choose-series" | "rescan" | "exit-demo" | "watch-series" | "find-missing" | "download" | "connect" | "demo" };
export type LibraryActionHandler = (command: LibraryCommand) => Promise<void>;
