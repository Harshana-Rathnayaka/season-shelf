import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { hashFile, checkRoot } from "./files.mjs";

// Persist the journal before this call. Never replace an existing path.
export async function finishRename(job, save) {
  const { from, to, parts } = job.renamePending;
  await checkRoot(job.root);
  const root = await fs.realpath(job.root.path);
  for (const filename of [from, to]) {
    const parent = await fs.realpath(path.dirname(filename));
    if (!parent.startsWith(root + path.sep)) throw new Error("Unsafe naming destination");
  }
  let targetExists = false;
  try {
    const stat = await fs.lstat(to);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Naming target is not a regular file");
    targetExists = true;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!targetExists) {
    if (await hashFile(from) !== job.sha256) throw new Error("Source changed; filename retained");
    try { await fs.link(from, to); }
    catch (error) {
      if (!["ENOTSUP", "EPERM", "EOPNOTSUPP", "EXDEV", "ENOSYS"].includes(error.code)) throw error;
      await fs.copyFile(from, to, constants.COPYFILE_EXCL);
    }
  }
  if (await hashFile(to) !== job.sha256) throw new Error("Naming collision or incomplete copy; original retained");
  job.finalPath = to;
  job.parts = parts;
  save(); // Record the verified destination before removing the old name.
  try {
    if (await hashFile(from) !== job.sha256) throw new Error("Original changed during naming; both files retained");
    await fs.unlink(from);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  delete job.renamePending;
  delete job.namingError;
  save();
}
