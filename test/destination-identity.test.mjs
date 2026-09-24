import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerRoot, checkRoot, migrateDestinationRoots } from "../src/core/files.mjs";

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shelf-identity-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const destination = path.join(dir, "shows");
  await fs.mkdir(destination);
  return { dir, destination, marker: path.join(destination, ".season-shelf-root.json") };
}
function storeFor(data) {
  return { get: (key, fallback) => structuredClone(data[key] ?? fallback),
    setMany: entries => Object.assign(data, structuredClone(entries)) };
}

test("destination registration leaves no marker and retains identity across registrations", async t => {
  const f = await fixture(t);
  const root = await registerRoot(f.destination);
  assert.deepEqual(await fs.readdir(f.destination), []);
  assert.deepEqual(await registerRoot(f.destination), root);
  await checkRoot(root);
  await fs.rename(f.destination, path.join(f.dir, "original"));
  await fs.mkdir(f.destination);
  await assert.rejects(checkRoot(root), /identity changed/);
});

test("legacy migration preserves all root references and lifetime counters before deleting marker", async t => {
  const f = await fixture(t), root = { path: f.destination, id: "legacy" };
  await fs.writeFile(f.marker, JSON.stringify({ id: root.id }));
  const data = { settings: { archiveRoot: root }, jobs: [{ root }], watches: [{ root }], usage: { payloadBytes: 456 } };
  await migrateDestinationRoots(storeFor(data));
  assert.deepEqual(await fs.readdir(f.destination), []);
  for (const upgraded of [data.settings.archiveRoot, data.jobs[0].root, data.watches[0].root]) {
    assert.equal(upgraded.id, "legacy");
    assert.ok(upgraded.identity);
    await checkRoot(upgraded);
  }
  assert.equal((await registerRoot(f.destination, [data.jobs[0].root])).id, "legacy");
  assert.deepEqual(data.usage, { payloadBytes: 456 });
});

test("failed checkpoint leaves the legacy marker intact", async t => {
  const f = await fixture(t), root = { path: f.destination, id: "legacy" };
  await fs.writeFile(f.marker, JSON.stringify({ id: root.id }));
  const store = storeFor({ settings: { archiveRoot: root } });
  store.setMany = () => { throw new Error("storage unavailable"); };
  await assert.rejects(migrateDestinationRoots(store), /storage unavailable/);
  await checkRoot(root);
});

test("migration refuses a changed destination and does not delete its marker", async t => {
  const f = await fixture(t);
  await fs.writeFile(f.marker, JSON.stringify({ id: "different-drive" }));
  const data = { jobs: [{ root: { path: f.destination, id: "original-drive" } }] };
  await migrateDestinationRoots(storeFor(data));
  assert.equal(data.jobs[0].root.identity, undefined);
  assert.equal(JSON.parse(await fs.readFile(f.marker)).id, "different-drive");
});
