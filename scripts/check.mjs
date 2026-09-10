import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const folder of ["src", "scripts", "test"]) {
  for (const filename of await fs.readdir(folder, { recursive: true })) {
    if (!/\.(mjs|cjs)$/.test(filename)) continue;
    const result = spawnSync(
      process.execPath,
      ["--check", `${folder}/${filename}`],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stderr);
      process.exit(1);
    }
  }
}
console.log("JavaScript syntax checks passed.");
