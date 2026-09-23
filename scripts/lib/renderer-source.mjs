import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

// Bundle the same React/TypeScript entry for JSDOM and the offline preview.
export async function rendererSource(entry = "src/ui/app.mjs") {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, format: "iife",
    globalName: "SeasonShelfRenderer", platform: "browser", target: "es2022",
    jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    minify: true, legalComments: "inline",
    footer: { js: "SeasonShelfRenderer.ready;" },
  });
  return result.outputFiles[0].text;
}

export async function rendererStyles(entry = "src/ui/styles.css", ancestors = new Set()) {
  const filename = path.resolve(entry);
  if (ancestors.has(filename)) throw new Error(`Circular stylesheet import: ${filename}`);
  const chain = new Set([...ancestors, filename]);
  let source = await fs.readFile(filename, "utf8");
  for (const [statement, specifier] of source.matchAll(/@import url\(["']([^"']+)["']\);/g)) {
    if (!specifier.startsWith(".")) throw new Error(`Non-relative stylesheet import: ${specifier}`);
    source = source.replace(statement, await rendererStyles(path.resolve(path.dirname(filename), specifier), chain));
  }
  return source;
}
