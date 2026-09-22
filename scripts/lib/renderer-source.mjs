import fs from "node:fs/promises";
import path from "node:path";

// The renderer uses relative named imports and declaration exports only.
// Keep each module in its own scope when producing the standalone preview
// or running it in JSDOM. Normal desktop/browser execution uses native ESM.
export async function rendererSource(entry = "src/ui/app.mjs") {
  const modules = new Map();
  const visiting = new Set();
  const blocks = [];
  async function visit(filename) {
    filename = path.resolve(filename);
    if (visiting.has(filename)) throw new Error(`Circular renderer import: ${filename}`);
    if (modules.has(filename)) return modules.get(filename);
    const id = modules.size;
    modules.set(filename, id);
    visiting.add(filename);
    let source = await fs.readFile(filename, "utf8");
    const imports = [...source.matchAll(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];\r?\n/gm)];
    for (const [statement, names, specifier] of imports) {
      if (!specifier.startsWith(".")) throw new Error(`Non-relative renderer import: ${specifier}`);
      const dependency = await visit(path.resolve(path.dirname(filename), specifier));
      const bindings = names.replace(/\s+as\s+/g, ": ");
      source = source.replace(statement, `const {${bindings}} = rendererModules[${dependency}];\n`);
    }
    const exports = [];
    source = source.replace(/^export ((?:async )?function|const|let|class) (\w+)/gm, (_, kind, name) => {
      exports.push(name);
      return `${kind} ${name}`;
    });
    if (/^(?:import|export)\s/m.test(source)) throw new Error(`Unsupported renderer module syntax: ${filename}`);
    blocks.push(`{\n${source}\nrendererModules[${id}] = {${exports.join(",")}};\n}`);
    visiting.delete(filename);
    return id;
  }
  await visit(entry);
  return `(async () => {\nconst rendererModules = [];\n${blocks.join("\n")}\n})()`;
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
