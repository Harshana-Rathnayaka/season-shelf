// Local, sample-only UI preview. No account access or download endpoints.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../src/", import.meta.url));
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const target = path.resolve(
      root,
      "." + (pathname === "/" ? "/ui/index.html" : pathname),
    );
    if (
      !target.startsWith(root) ||
      (!target.startsWith(path.join(root, "ui") + path.sep) &&
        !["core/catalog.mjs", "core/collection.mjs", "core/progress.mjs", "core/appearance.mjs"].some(file => target === path.join(root, file)))
    ) {
      res.writeHead(403);
      return res.end();
    }
    const content = await fs.readFile(target);
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "text/plain",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log("Sample preview: http://127.0.0.1:4173/ui/index.html"),
);
