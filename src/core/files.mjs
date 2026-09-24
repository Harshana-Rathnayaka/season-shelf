import { isWithin } from "./paths.mjs";
import fs from "node:fs/promises";
import { createReadStream, constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const marker = ".season-shelf-root.json";
async function directoryIdentity(root) {
  const stat = await fs.stat(root, { bigint: true });
  if (!stat.isDirectory() || stat.ino === 0n)
    throw new Error("Destination does not provide a stable directory identity");
  return { device: String(stat.dev), inode: String(stat.ino), created: String(stat.birthtimeNs) };
}
export async function registerRoot(root, knownRoots = []) {
  const real = await fs.realpath(root);
  const fingerprint = await directoryIdentity(real);
  const filename = path.join(real, marker);
  let identity;
  try {
    identity = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const known = knownRoots.find(entry => entry?.identity &&
      ["device", "inode", "created"].every(key => entry.identity[key] === fingerprint[key]));
    identity = { id: known?.id || createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex") };
  }
  if (typeof identity.id !== "string")
    throw new Error("Invalid destination marker");
  return { path: real, id: identity.id, identity: fingerprint };
}
export async function checkRoot(root, needed = 0, { requireSpace = true } = {}) {
  try {
    if (root.identity) {
      const actual = await directoryIdentity(root.path);
      if (["device", "inode", "created"].some(key => actual[key] !== root.identity[key]))
        throw new Error("Destination identity changed");
    } else {
      const identity = JSON.parse(await fs.readFile(path.join(root.path, marker), "utf8"));
      if (identity.id !== root.id) throw new Error("Destination identity changed");
    }
    const stats = await fs.statfs(root.path);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (requireSpace && available < needed + 64 * 1024 ** 2)
      throw new Error("Not enough free space at destination");
    return available;
  } catch (error) {
    throw new Error(`Destination unavailable: ${error.message}`);
  }
}

/** Persist every reference before retiring legacy markers. Offline roots retry next startup. */
export async function migrateDestinationRoots(store) {
  const settings = store.get("settings", null), jobs = store.get("jobs", []), watches = store.get("watches", []);
  const roots = [settings?.archiveRoot, settings?.watchRoot, ...jobs.map(job => job.root), ...watches.map(watch => watch.root)].filter(Boolean);
  const migrated = new Map();
  for (const root of roots) {
    const key = `${root.path}\0${root.id}`;
    if (migrated.has(key)) { root.identity = migrated.get(key).identity; continue; }
    try {
      await checkRoot(root);
      root.identity = await directoryIdentity(root.path);
      migrated.set(key, root);
    } catch { /* Keep the marker requirement for unavailable or changed destinations. */ }
  }
  if (!migrated.size) return;
  store.setMany({ ...(settings ? { settings } : {}), jobs, watches });
  for (const root of migrated.values()) {
    try {
      const filename = path.join(root.path, marker);
      const legacy = JSON.parse(await fs.readFile(filename, "utf8"));
      if (legacy.id === root.id) await fs.unlink(filename);
    } catch { /* A locked marker can be retried safely on the next startup. */ }
  }
}
export async function hashFile(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}
export async function publishFile({ source, root, parts, id, expectedHash }) {
  await checkRoot(root, (await fs.stat(source)).size);
  const final = path.resolve(root.path, ...parts);
  if (!isWithin(root.path, final))
    throw new Error("Unsafe destination");
  await fs.mkdir(path.dirname(final), { recursive: true });
  const realParent = await fs.realpath(path.dirname(final));
  if (!isWithin(root.path, realParent, { allowRoot: true }))
    throw new Error("Destination resolves outside selected folder");
  try {
    await fs.access(final);
    if ((await hashFile(final)) === expectedHash) return final;
    throw new Error("A different file already exists at the destination");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = path.join(
    path.dirname(final),
    `.season-shelf-${id}.transfer`,
  );
  await fs.copyFile(source, temporary);
  if ((await hashFile(temporary)) !== expectedHash)
    throw new Error("Transfer verification failed; original retained");
  await checkRoot(root);
  try {
    // Exclusive link publishes atomically on NTFS and standard Unix filesystems.
    await fs.link(temporary, final);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Destination appeared during transfer; original retained",
      );
    if (
      !["ENOTSUP", "EPERM", "EOPNOTSUPP", "EXDEV", "ENOSYS"].includes(
        error.code,
      )
    )
      throw error;
    // exFAT lacks hard links. COPYFILE_EXCL preserves the no-overwrite guarantee.
    await fs.copyFile(temporary, final, constants.COPYFILE_EXCL);
    if ((await hashFile(final)) !== expectedHash)
      throw new Error("Final copy verification failed; original retained");
  }
  await fs.rm(temporary, { force: true });
  return final;
}
