import { isWithin } from "./paths.mjs";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { relativeDestination, normalizeSeasonNames } from "./catalog.mjs";
import { finishRename } from "./season-naming.mjs";
import { checkRoot, hashFile, publishFile } from "./files.mjs";

const activeStates = new Set(["downloading", "checking", "transferring"]);
export class DownloadQueue extends EventEmitter {
  constructor({ store, adapter, staging, concurrency = 2 }) {
    super();
    Object.assign(this, { store, adapter, staging, concurrency });
    this.running = new Map();
    this.downloading = new Set();
    this.finishing = Promise.resolve();
    this.tasks = new Map();
    this.removals = new Map();
    this.namingLocks = new Set();
    this.usage = store.get("usage", { since: new Date().toISOString(), payloadBytes: 0, publishedBytes: 0, completedFiles: 0 });
    this.jobs = store
      .get("jobs", [])
      .map((job) => ({
        ...job,
        speed: 0,
        status:
          activeStates.has(job.status) || job.status === "removing" ||
          job.status === "queued" ||
          job.status === "retrying"
            ? "paused"
            : job.status,
      }));
    const recoveredBatch = this.jobs.find(job => job.batchId && !["complete", "deleted", "missing", "cancelled"].includes(job.status))?.batchId || randomUUID();
    this.currentBatchId = store.get("currentBatchId", recoveredBatch);
    for (const job of this.jobs) {
      if (!["complete", "deleted", "missing"].includes(job.status)) {
        job.batchId ??= recoveredBatch;
        delete job.item.destinationFilename;
        job.parts = relativeDestination(job.series, job.item);
        job.namingVersion = 2;
      }
    }
    this.recovering = true;
    this.recovery = this.recoverNaming().finally(() => { this.recovering = false; this.pump(); });
    this.timer = setInterval(() => this.pump(), 1000);
    this.timer.unref?.();
  }
  snapshot() {
    return structuredClone(this.jobs);
  }
  save() {
    this.store.setMany({
      currentBatchId: this.currentBatchId,
      usage: this.usage,
      jobs: this.jobs.map((job) => ({ ...job, speed: 0 })),
    });
    this.emit("change", this.snapshot());
  }
  async add({ items, series, mode, root }) {
    if (!["archive", "watch"].includes(mode))
      throw new Error("Unknown download mode");
    await checkRoot(root);
    if (items.some(item => this.namingLocks.has(`${root.id}:${item.peer?.id}:${mode}:${item.season}`)))
      throw new Error("Season filenames are finishing; try adding files again shortly");
    const added = [];
    const batchId = this.workBatch();
    for (const item of items) {
      if (
        (item.reason && !item.unverified) ||
        !item.peer ||
        !Number.isSafeInteger(item.size) ||
        item.size <= 0
      )
        throw new Error("Invalid attachment");
      const key = `${item.peer.id}:${item.id}:${mode}:${root.id}`;
      let existing = this.jobs.find(
        (job) =>
          job.key === key &&
          !["cancelled", "deleted", "missing"].includes(job.status),
      );
      if (existing?.status === "complete") {
        try {
          await fs.access(existing.finalPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          existing.status = "missing";
          existing = null;
        }
      }
      if (existing) continue;
      const sourceItem = { ...item };
      delete sourceItem.destinationFilename;
      const parts = relativeDestination(series, sourceItem);
      if (
        this.jobs.some(
          (job) =>
            job.root.id === root.id &&
            job.parts.join("/") === parts.join("/") &&
            !["cancelled", "deleted", "missing"].includes(job.status),
        )
      )
        continue;
      const job = {
        id: randomUUID(),
        batchId,
        namingVersion: 2,
        key,
        series,
        mode,
        item: sourceItem,
        root,
        parts,
        status: "queued",
        received: 0,
        speed: 0,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      this.jobs.push(job);
      added.push(job.id);
    }
    if (added.length) this.currentBatchId = batchId;
    this.save();
    this.pump();
    return added;
  }
  workBatch() {
    return this.jobs.find(job => !["complete", "cancelled", "deleted", "missing"].includes(job.status))?.batchId || randomUUID();
  }
  seasonKey(job) { return `${job.root.id}:${job.item.peer.id}:${job.mode}:${job.item.season}`; }
  async recoverNaming() {
    for (const job of this.jobs.filter(job => job.renamePending)) {
      try { await finishRename(job, () => this.save()); }
      catch (error) { job.namingError = error.message; this.save(); }
    }
    const seasons = new Set();
    for (const job of this.jobs.filter(job => job.status === "complete" && job.namingVersion === 2)) {
      const key = this.seasonKey(job);
      if (!seasons.has(key)) { seasons.add(key); await this.finishSeason(job); }
    }
  }
  async finishSeason(seed) {
    if (seed.item.unverified) return;
    const key = this.seasonKey(seed);
    if (this.namingLocks.has(key)) return;
    const group = this.jobs.filter(job => this.seasonKey(job) === key && !job.item.unverified && !["cancelled", "deleted", "missing"].includes(job.status));
    if (!group.length || group.some(job => job.status !== "complete")) return;
    this.namingLocks.add(key);
    try {
      const eligible = group.filter(job => job.namingVersion === 2 && !job.item.unverified);
      const names = normalizeSeasonNames(eligible.map(job => job.item));
      for (let index = 0; index < eligible.length; index++) {
        const job = eligible[index];
        try {
          if (job.renamePending) await finishRename(job, () => this.save());
          const parts = relativeDestination(job.series, names[index]);
          const target = path.join(job.root.path, ...parts);
          if (target === job.finalPath) { delete job.namingError; continue; }
          // A pre-existing path is a collision, even if another file has equal bytes.
          try { await fs.lstat(target); throw new Error("Filename already exists; original name retained"); }
          catch (error) { if (error.code !== "ENOENT") throw error; }
          job.renamePending = { from: job.finalPath, to: target, parts };
          this.save();
          await finishRename(job, () => this.save());
        } catch (error) { job.namingError = error.message; this.save(); }
      }
    } finally { this.namingLocks.delete(key); this.save(); }
  }
  control(id, action) {
    const job = this.jobs.find((job) => job.id === id);
    if (!job) throw new Error("Download not found");
    if (this.removals.has(id)) {
      if (action === "remove") return this.removals.get(id);
      throw new Error("Temporary data is being removed; please wait");
    }
    if (action === "remove") {
      if (["checking", "transferring"].includes(job.status) ||
          (this.running.has(id) && job.status === "complete") ||
          job.renamePending || this.namingLocks.has(this.seasonKey(job)))
        throw new Error("Finishing the verified transfer; please wait");
      return this.remove(job);
    } else if (action === "resume") {
      if (this.running.has(id))
        throw new Error("Wait for the current operation to stop");
      if (
        !["paused", "failed", "waiting", "cancelled", "retrying"].includes(
          job.status,
        )
      )
        return;
      job.batchId = this.workBatch();
      job.status = "queued";
      this.currentBatchId = job.batchId;
      job.error = "";
      job.attempts = 0;
      job.retryAt = 0;
    } else if (action === "pause" || action === "cancel") {
      if (["complete", "deleted"].includes(job.status)) return;
      if (["checking", "transferring"].includes(job.status))
        throw new Error("Finishing the verified transfer; please wait");
      job.status = action === "pause" ? "paused" : "cancelled";
      this.running.get(id)?.abort();
      job.speed = 0;
    } else throw new Error("Unknown queue action");
    this.save();
    this.pump();
  }
  remove(job) {
    if (this.removals.has(job.id)) return this.removals.get(job.id);
    const completed = job.status === "complete";
    job.status = "removing";
    this.running.get(job.id)?.abort();
    this.save();
    const task = (async () => {
      try {
        // Wait for the staging writer to close before deleting on Windows.
        await this.tasks.get(job.id);
        const partial = path.resolve(this.staging, `${job.id}.part`);
        if (!isWithin(this.staging, partial))
          throw new Error("Unsafe staging-file destination");
        await fs.rm(partial, {force:true});
        const destination = path.resolve(job.root.path, ...job.parts);
        if (!isWithin(job.root.path, destination))
          throw new Error("Unsafe temporary-file destination");
        const temporary = path.join(path.dirname(destination), `.season-shelf-${job.id}.transfer`);
        try {
          await fs.lstat(temporary);
          await checkRoot(job.root, 0, { requireSpace: false });
          const parent = await fs.realpath(path.dirname(temporary));
          const root = await fs.realpath(job.root.path);
          if (!isWithin(root, parent, { allowRoot: true }))
            throw new Error("Temporary data resolves outside selected folder");
          await fs.unlink(temporary);
        } catch (error) { if (error.code !== "ENOENT") throw error; }
        this.jobs = this.jobs.filter(entry => entry.id !== job.id);
      } catch (error) {
        job.status = completed ? "complete" : "failed";
        job.error = `Could not remove temporary data: ${error.message}`;
        throw error;
      } finally {
        this.removals.delete(job.id);
        this.save();
        this.pump();
      }
    })();
    this.removals.set(job.id, task);
    return task;
  }
  pump() {
    if (this.adapter.transferPolicy && !this.adapter.transferPolicy.allowed()) {
      if(this.jobs.some(job=>job.speed)) {this.jobs.forEach(job=>{job.speed=0;});this.save();}
      return;
    }
    if (this.recovering || this.batching || this.stopped || Date.now() < (this.floodUntil || 0)) return;
    for (const job of this.jobs) {
      if (job.status === "retrying" && Date.now() >= job.retryAt)
        job.status = "queued";
      // Bound staged work when the destination is slower than the network.
      if (this.downloading.size >= this.concurrency || this.running.size >= this.concurrency * 2) break;
      if (job.status !== "queued" || this.running.has(job.id)) continue;
      const controller = new AbortController();
      this.running.set(job.id, controller);
      this.downloading.add(job.id);
      const task = this.run(job, controller.signal).finally(() => {
        this.running.delete(job.id);
        this.downloading.delete(job.id);
        this.tasks.delete(job.id);
        this.pump();
      });
      this.tasks.set(job.id, task);
    }
  }
  controlAll(action) {
    const eligible = {
      pause: ["queued", "downloading", "retrying"],
      cancel: ["queued", "downloading", "paused", "failed", "waiting", "retrying"],
      resume: ["paused", "failed", "waiting", "cancelled", "retrying"],
    }[action];
    if (!eligible) throw new Error("Unknown bulk action");
    this.batching = true;
    try {
      for (const job of this.jobs)
        if (eligible.includes(job.status) && !(action === "resume" && this.running.has(job.id)))
          this.control(job.id, action);
    } finally {
      this.batching = false;
      this.pump();
    }
  }
  async run(job, signal) {
    const partial = path.join(this.staging, `${job.id}.part`);
    let handle;
    try {
      await checkRoot(job.root, job.item.size);
      await fs.mkdir(this.staging, { recursive: true });
      // Windows append handles cannot be truncated. Preserve existing bytes
      // with r+, and create a new partial exclusively when none exists.
      try {
        handle = await fs.open(partial, "r+");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        handle = await fs.open(partial, "wx+");
      }
      const stat = await handle.stat();
      if (stat.size > job.item.size)
        throw new Error("Partial file is larger than its source");
      // Resume at a Telegram request boundary, discarding only the incomplete tail.
      const offset =
        stat.size === job.item.size
          ? stat.size
          : Math.floor(stat.size / 524288) * 524288;
      await handle.truncate(offset);
      job.received = offset;
      const localSpace = await fs.statfs(this.staging);
      if (
        Number(localSpace.bavail) * Number(localSpace.bsize) <
        job.item.size - offset + 64 * 1024 ** 2
      )
        throw new Error("Not enough free staging space");
      if (signal.aborted) throw new Error("Aborted");
      job.status = "downloading";
      job.error = "";
      this.save();
      let tick = Date.now(),
        baseline = offset;
      if (offset < job.item.size) {
        for await (const chunk of this.adapter.download(
          job.item,
          offset,
          signal,
        )) {
          this.usage.payloadBytes += chunk.length;
          if (signal.aborted) throw new Error("Aborted");
          if (job.received + chunk.length > job.item.size)
            throw new Error("Source size changed during download");
          let written = 0;
          while (written < chunk.length) {
            const { bytesWritten } = await handle.write(
              chunk,
              written,
              chunk.length - written,
              job.received + written,
            );
            if (bytesWritten === 0) throw new Error("Staging write made no progress");
            written += bytesWritten;
          }
          job.received += chunk.length;
          if (Date.now() - tick > 1500) {
            job.speed =
              (job.received - baseline) / ((Date.now() - tick) / 1000);
            tick = Date.now();
            baseline = job.received;
            this.save();
          }
        }
      }
      await handle.sync();
      await handle.close();
      handle = null;
      if (signal.aborted) throw new Error("Aborted");
      if ((await fs.stat(partial)).size !== job.item.size)
        throw new Error("Download ended before expected size");
      if (signal.aborted) throw new Error("Aborted");
      job.status = "checking";
      job.speed = 0;
      this.save();
      // Keep lifecycle tracking until publication completes, but release the
      // network slot now. Serialize disk work and retain at most one extra
      // batch of staged files through pump's total-work bound.
      const finishing = this.finishing.then(() => this.finishDownload(job, partial));
      this.finishing = finishing.catch(() => {});
      this.downloading.delete(job.id);
      this.pump();
      await finishing;
    } catch (error) {
      if (signal.aborted) {
        if (!["cancelled", "paused", "removing"].includes(job.status))
          job.status = "paused";
      } else if (job.status === "complete") {
        job.error = "Saved successfully; staged copy could not be removed";
      } else {
        job.error = String(error.message || error).slice(0, 300);
        job.speed = 0;
        if (/Destination unavailable/.test(job.error)) job.status = "waiting";
        else if (
          /FLOOD|TIMEOUT|ECONNRESET|ETIMEDOUT|FILE_REFERENCE|network|disconnected/i.test(
            job.error,
          ) &&
          ++job.attempts <= 5
        ) {
          const seconds = Number(
            error.seconds ||
              job.error.match(/FLOOD(?:_PREMIUM)?_WAIT_?(\d+)/)?.[1] ||
              Math.min(60, 2 ** job.attempts),
          );
          job.retryAt = Date.now() + seconds * 1000;
          job.status = "retrying";
          if (/FLOOD/i.test(job.error)) this.floodUntil = job.retryAt;
        } else job.status = "failed";
      }
      this.save();
    } finally {
      await handle?.close();
    }
  }
  async finishDownload(job, partial) {
    job.sha256 = await hashFile(partial);
    job.status = "transferring";
    this.save();
    job.finalPath = await publishFile({
      source: partial,
      root: job.root,
      parts: job.parts,
      id: job.id,
      expectedHash: job.sha256,
    });
    job.status = "complete";
    this.usage.publishedBytes += job.item.size;
    this.usage.completedFiles++;
    job.completedAt = new Date().toISOString();
    this.save();
    await fs.rm(partial, { force: true });
    await this.finishSeason(job);
  }
  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    for (const job of this.jobs)
      if (job.status === "queued" || job.status === "retrying")
        job.status = "paused";
    for (const [id, controller] of this.running) {
      const job = this.jobs.find((job) => job.id === id);
      if (!job || !["checking", "transferring", "complete"].includes(job.status)) {
        controller.abort();
      }
      if (job?.status === "downloading") {
        job.status = "paused";
        controller.abort();
      }
    }
    this.save();
    await this.recovery;
    await Promise.allSettled([...this.tasks.values()]);
    await Promise.allSettled([...this.removals.values()]);
  }
}
