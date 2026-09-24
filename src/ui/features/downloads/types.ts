export type DownloadStatus =
  | "queued" | "downloading" | "retrying" | "checking" | "transferring"
  | "paused" | "failed" | "waiting" | "cancelled" | "removing"
  | "complete" | "deleted" | "missing" | "preview";

export interface DownloadItem {
  id?: string;
  filename: string;
  size: number;
  unverified?: boolean;
  season?: number | null;
  episode?: number | null;
  episodeEnd?: number | null;
  resolution?: number | string | null;
  codec?: string | null;
}

export interface DownloadRecord {
  id: string;
  status: DownloadStatus;
  series: string;
  mode: "archive" | "watch";
  item: DownloadItem;
  received?: number;
  speed?: number;
  createdAt?: string;
  completedAt?: string;
  batchId?: string;
  finalPath?: string;
  error?: string;
  namingError?: string;
}

export type DownloadTab = "ongoing" | "finished";
export type QueueControl = "pause" | "resume" | "remove";

export interface DownloadsState {
  jobs: DownloadRecord[];
  downloadTab: DownloadTab;
  currentBatchId?: string;
  demo: boolean;
  stagingInfo?: { count: number; bytes: number } | null;
}

export type DownloadCommand =
  | { action: "download-tab"; tab: DownloadTab }
  | { action: "bulk-job"; control: "pause" | "resume" }
  | { action: "job"; job: string; control: QueueControl }
  | { action: "remove-history"; job?: string }
  | { action: "open-job" | "file-details" | "retry-naming" | "reveal-job" | "delete-job"; job: string }
  | { action: "delete-all-queue" | "scan-staging" | "cleanup-staging" };

export type DownloadActionHandler = (command: DownloadCommand) => Promise<void>;

/** Contracts for the existing download IPC endpoints; main still validates input. */
export interface DownloadRequests {
  "queue-control": { id?: string; all?: boolean; action: QueueControl };
  "open-job": { id: string };
  "reveal-job": { id: string };
  "retry-naming": { id: string };
  "remove-history": { id?: string };
  "delete-job": { id: string };
  "delete-all-queue": undefined;
  "staging-info": undefined;
  "cleanup-staging": undefined;
}
export interface DownloadResponses {
  "queue-control": DownloadRecord[];
  "open-job": void;
  "reveal-job": void;
  "retry-naming": DownloadRecord[];
  "remove-history": DownloadRecord[];
  "delete-job": DownloadRecord[];
  "delete-all-queue": { jobs: DownloadRecord[]; removed: number };
  "staging-info": { count: number; bytes: number };
  "cleanup-staging": { deleted: number; failures: { error: string }[] };
}
export type DownloadCall = <K extends keyof DownloadRequests>(
  method: K, payload: DownloadRequests[K],
) => Promise<DownloadResponses[K]>;
