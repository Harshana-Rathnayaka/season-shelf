import path from "node:path";

// Relative paths handle volume roots, UNC shares and case-insensitive Windows paths.
export function isWithin(root, candidate, { allowRoot = false, paths = path } = {}) {
  const relative = paths.relative(paths.resolve(root), paths.resolve(candidate));
  return relative === "" ? allowRoot :
    relative !== ".." && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative);
}
