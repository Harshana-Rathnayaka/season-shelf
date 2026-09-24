export type Theme = "dark" | "light" | "system";
export interface Appearance { size: number; weight: number; accent: string; text: string }
export interface TransferPreferences { speedKiB: number; scheduled: boolean; start: string; end: string }
export interface Settings {
  theme?: Theme;
  concurrency?: number;
  closeToTray?: boolean;
  sidebarCollapsed?: boolean;
  archiveRoot?: { path: string } | null;
  watchRoot?: { path: string } | null;
  appearance?: Partial<Appearance>;
  transfer?: Partial<TransferPreferences>;
  hiddenKeywords?: string[];
}
export interface Usage { payloadBytes?: number; publishedBytes?: number; completedFiles?: number; since?: string; currentBatchId?: string }
export interface UpdateStatus {
  state?: "manual" | "idle" | "development" | "checking" | "current" | "unpublished" | "available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  lastCheckedAt?: string | null;
  deferred?: boolean;
}
export interface SettingsState {
  settings: Settings;
  usage: Usage;
  stagingInfo?: { count: number; bytes: number } | null;
  updates?: UpdateStatus;
  updateChecking?: boolean;
  environment?: string;
  version?: string;
}
export type SettingsCommand =
  | { action: "folder"; mode: "archive" | "watch" }
  | { action: "reset-appearance" | "reset-keywords" | "scan-staging" | "cleanup-staging" | "reset-activity" | "clear-app-data" | "show-guide" | "update-check" | "update-download" | "update-install" | "licenses" };
export type SettingsActionHandler = (command: SettingsCommand) => Promise<void>;
export type SaveSettings = (patch: Partial<Settings>, message?: string) => Promise<void>;
