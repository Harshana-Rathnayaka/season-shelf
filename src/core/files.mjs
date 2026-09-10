import fs from "node:fs/promises";
import { createReadStream, constants } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const marker = ".season-shelf-root.json";
export async function registerRoot(root) {
  const real = await fs.realpath(root);
  const filename = path.join(real, marker);
  let identity;
  try {
    identity = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    identity = { id: randomUUID() };
    await fs.writeFile(filename, JSON.stringify(identity), { flag: "wx" });
  }
  if (typeof identity.id !== "string")
    throw new Error("Invalid destination marker");
  return { path: real, id: identity.id };
}
export async function checkRoot(root, needed = 0) {
  try {
    const identity = JSON.parse(
      await fs.readFile(path.join(root.path, marker), "utf8"),
    );
    if (identity.id !== root.id)
      throw new Error("Destination identity changed");
    const stats = await fs.statfs(root.path);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (available < needed + 64 * 1024 ** 2)
      throw new Error("Not enough free space at destination");
    return available;
  } catch (error) {
    throw new Error(`Destination unavailable: ${error.message}`);
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
  if (!final.startsWith(path.resolve(root.path) + path.sep))
    throw new Error("Unsafe destination");
  await fs.mkdir(path.dirname(final), { recursive: true });
  const realParent = await fs.realpath(path.dirname(final));
  if (!realParent.startsWith(path.resolve(root.path) + path.sep))
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
