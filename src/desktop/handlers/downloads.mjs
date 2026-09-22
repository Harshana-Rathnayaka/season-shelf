import fs from "node:fs/promises";
import path from "node:path";
import { pendingEntries, removePending, trashCompleted, orphanedPartials, trashOrphans } from "../../core/maintenance.mjs";

export function registerDownloadHandlers({handle, queue, adapter, shell, confirmInApp}) {
  handle("queue-control", async ({ id, action, all }) => {
    if (action === "resume") adapter.requireClient();
    if (all) queue.controlAll(action);
    else {
      if (action === "remove") {
        const result = await confirmInApp({type:"question",title:"Remove from queue?",message:"Remove this unfinished download and delete its temporary data?",detail:"This cannot be resumed after removal. Completed files and lifetime usage totals stay unchanged.",buttons:["Keep download","Remove and delete temporary data"],defaultId:0,cancelId:0});
        if (result.response !== 1) return queue.snapshot();
        if (!pendingEntries(queue).some(job => job.id === id)) return queue.snapshot();
      }
      await queue.control(id, action);
    }
    return queue.snapshot();
  });
  handle("open-job", async ({ id }) => {
    const job = queue.jobs.find(
      (j) => j.id === id && j.status === "complete",
    );
    if (!job) throw new Error("Completed download not found");
    await fs.access(job.finalPath);
    const error = await shell.openPath(job.finalPath);
    if (error) throw new Error(error);
  });
  handle("reveal-job", async ({ id }) => {
    const job = queue.jobs.find(j => j.id === id && j.status === "complete");
    if (!job?.finalPath) throw new Error("Completed download not found");
    await fs.access(job.finalPath);
    shell.showItemInFolder(job.finalPath);
  });
  handle("remove-history", async ({ id } = {}) => {
    const jobs = queue.jobs.filter(job => job.status === "complete" && (!id || job.id === id));
    if (!jobs.length) return queue.snapshot();
    const result = await confirmInApp({
      type: "question", title: "Remove download history?",
      message: `Remove ${jobs.length} completed ${jobs.length === 1 ? "entry" : "entries"} from the app?`,
      detail: "Your files stay on disk. The app will forget these downloads, so Select missing may offer these episodes again.",
      buttons: ["Keep history", "Remove history; keep files"], defaultId: 0, cancelId: 0,
    });
    if (result.response === 1) {
      if (jobs.some(job => queue.running.has(job.id) || job.renamePending || queue.namingLocks.has(queue.seasonKey(job))))
        throw new Error("Files are still finishing. Wait a moment before removing their history.");
      for (const job of jobs) {
        if (job.status === "complete")
          await queue.control(job.id, "remove");
      }
    }
    return queue.snapshot();
  });
  handle("delete-job", async ({ id }) => {
    const job = queue.jobs.find(
      (j) => j.id === id && j.status === "complete",
    );
    if (!job)
      throw new Error("Only completed downloads can be deleted here");
    if (queue.namingLocks.has(queue.seasonKey(job)) || job.renamePending)
      throw new Error("Season filenames are being finalized; try again shortly");
    const result = await confirmInApp({
      type: "question",
      title: "Delete downloaded file?",
      message: `Move ${path.basename(job.finalPath)} to the Recycle Bin?`,
      detail: `This ${job.mode === "archive" ? "archive" : "viewing"} file will be moved to the Recycle Bin.`,
      buttons: ["Keep file", "Move to Recycle Bin"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return queue.snapshot();
    const outcome = await trashCompleted(queue, [id], file => shell.trashItem(file));
    if (outcome.failures.length) throw new Error(outcome.failures[0].error);
    return queue.snapshot();
  });
  handle("delete-all-queue", async () => {
    const ids = pendingEntries(queue).map(job => job.id);
    if (!ids.length) return {jobs:queue.snapshot(),removed:0};
    const result = await confirmInApp({
      type:"question", title:"Clear queue?",
      message:`Remove ${ids.length} unfinished queue entries?`,
      detail:"These downloads will stop and their temporary data will be permanently deleted. Completed files and lifetime usage totals stay unchanged. Files already checking or transferring will finish safely.",
      buttons:["Keep queue","Clear queue and delete temporary data"],defaultId:0,cancelId:0,
    });
    const removed = result.response === 1 ? await removePending(queue,ids) : 0;
    return {jobs:queue.snapshot(),removed};
  });
  handle("retry-naming", async ({id}) => {
    const job = queue.jobs.find(job => job.id === id && job.status === "complete");
    if (!job) throw new Error("Completed download not found");
    const key = queue.seasonKey(job);
    if (queue.namingLocks.has(key)) throw new Error("This season is already being updated");
    if (queue.jobs.some(other => queue.seasonKey(other) === key && !["complete", "deleted", "cancelled", "missing"].includes(other.status)))
      throw new Error("Finish the other queued episodes in this season before retrying naming");
    await queue.finishSeason(job);
    return queue.snapshot();
  });
  handle("staging-info", async () => {
    const files = await orphanedPartials(queue);
    return {count:files.length,bytes:files.reduce((sum,file)=>sum+file.size,0)};
  });
  handle("cleanup-staging", async () => {
    const files = await orphanedPartials(queue);
    if (!files.length) return {deleted:0,failures:[]};
    const result = await confirmInApp({
      type:"question",title:"Clean up unused partial files?",
      message:`Move ${files.length} unused partial files to the Recycle Bin?`,
      detail:"These partial files have no queue entry. Paused, cancelled, failed and active jobs with queue entries are preserved.",
      buttons:["Keep partials","Move unused partials to Recycle Bin"],defaultId:0,cancelId:0,
    });
    return result.response === 1 ? trashOrphans(queue,files.map(file=>file.id),file=>shell.trashItem(file)) : {deleted:0,failures:[]};
  });
}
