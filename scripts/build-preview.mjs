// Produce a self-contained, sample-only preview that opens without installing Node.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { rendererSource, rendererStyles } from "./lib/renderer-source.mjs";
const script = await rendererSource();
const style = await rendererStyles();

const hash = (text) => createHash("sha256").update(text).digest("base64");
const html = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>Season Shelf — sample preview</title><style>${style}</style></head><body><div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status" aria-live="polite"></div><script>${script}</script></body></html>`;
await fs.writeFile("docs/preview.html", html);
console.log("Created docs/preview.html (sample data only).");
