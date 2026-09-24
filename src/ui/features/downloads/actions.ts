import { canPauseDownload, canResumeDownload, canRemoveDownload } from "./selectors";
import type { DownloadCommand, DownloadCall, DownloadsState, DownloadRecord } from "./types";

interface Context {
  state: DownloadsState;
  call: DownloadCall;
  render: () => void;
  toast: (message: string, error?: boolean) => void;
  showFileDetails: (job: DownloadRecord) => void;
  closeDialog: () => void;
}

export async function handleDownloadCommand(command: DownloadCommand, { state, call, render, toast, showFileDetails, closeDialog }: Context): Promise<void> {
  switch (command.action) {
    case "download-tab":
      state.downloadTab = command.tab;
      render();
      return;
    case "bulk-job":
      if (state.demo) {
        state.jobs = state.jobs.map(job => (command.control === "pause" ? canPauseDownload(job) : canResumeDownload(job))
          ? { ...job, status: command.control === "pause" ? "paused" : "preview" } : job);
      } else state.jobs = await call("queue-control", { all: true, action: command.control });
      break;
    case "job":
      if (state.demo) {
        if (command.control === "remove") state.jobs = state.jobs.filter(job => job.id !== command.job || !canRemoveDownload(job));
        else state.jobs = state.jobs.map(job => job.id === command.job && (command.control === "pause" ? canPauseDownload(job) : canResumeDownload(job))
          ? { ...job, status: command.control === "pause" ? "paused" : "preview" } : job);
      } else state.jobs = await call("queue-control", { id: command.job, action: command.control });
      break;
    case "open-job":
    case "reveal-job":
      await call(command.action, { id: command.job });
      return;
    case "file-details": {
      const job = state.jobs.find(job => job.id === command.job);
      if (!job) throw new Error("Download no longer exists.");
      showFileDetails(job);
      return;
    }
    case "retry-naming": {
      state.jobs = await call("retry-naming", { id: command.job });
      const job = state.jobs.find(job => job.id === command.job);
      if (!job) throw new Error("Download no longer exists.");
      showFileDetails(job);
      toast(job.namingError || "Season filenames updated.", !!job.namingError);
      break;
    }
    case "remove-history":
      if (state.demo) state.jobs = state.jobs.filter(job => job.status !== "complete" || (command.job && job.id !== command.job));
      else state.jobs = await call("remove-history", { id: command.job });
      break;
    case "delete-job":
      state.jobs = await call("delete-job", { id: command.job });
      closeDialog();
      break;
    case "delete-all-queue":
      if (state.demo) {
        state.jobs = state.jobs.filter(job => !canRemoveDownload(job));
        toast("Sample entries removed. Completed files stay on disk.");
      } else {
        const result = await call("delete-all-queue", undefined);
        state.jobs = result.jobs;
        toast(result.removed ? `${result.removed} queue entries removed and their temporary data deleted. Completed files stay on disk.` : "No queue entries removed.");
      }
      break;
    case "scan-staging":
    case "cleanup-staging":
      if (state.demo) { toast("Storage cleanup is available in the desktop app."); return; }
      if (command.action === "cleanup-staging") {
        const result = await call("cleanup-staging", undefined);
        toast(`${result.deleted} partial files moved to the Recycle Bin. ${result.failures.length} kept.`, !!result.failures.length);
      }
      state.stagingInfo = await call("staging-info", undefined);
      break;
    default: {
      const unreachable: never = command;
      throw new Error(`Unknown download command: ${unreachable}`);
    }
  }
  render();
}
