// Produce a self-contained, sample-only preview that opens without installing Node.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "src/ui/icons.mjs",
    "src/ui/discovery-flow.mjs",
    "src/core/appearance.mjs",
    "src/ui/appearance.mjs",
  "src/core/catalog.mjs",
    "src/core/collection.mjs",
    "src/core/progress.mjs",
  "src/ui/demo.mjs",
  "src/ui/app.mjs",
];
const scripts = [];
for (const file of files)
  scripts.push(
    (await fs.readFile(file, "utf8"))
      .replace(/^import .*;\n/gm, "")
      .replace(/^export /gm, ""),
  );
const script = `(async () => {\n${scripts.join("\n")}\n})()`;
let style =
  (await fs.readFile("src/ui/tokens.css", "utf8")) +
  "\n" +
  (await fs.readFile("src/ui/styles.css", "utf8")).replace(/^@import.*\n/, "");

const hash = (text) => createHash("sha256").update(text).digest("base64");
const html = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>Season Shelf — sample preview</title><style>${style}</style></head><body><div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status" aria-live="polite"></div><script>${script}</script></body></html>`;
await fs.writeFile("docs/preview.html", html);
console.log("Created docs/preview.html (sample data only).");
