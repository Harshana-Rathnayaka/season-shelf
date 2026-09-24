import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { isWithin } from "../src/core/paths.mjs";

test("containment handles volume roots without weakening traversal protection", () => {
  const win = { paths: path.win32 };
  assert.equal(isWithin("D:\\", "D:\\Season 01\\episode.mkv", win), true);
  assert.equal(isWithin("D:\\", "d:\\episode.mkv", win), true);
  assert.equal(isWithin("D:\\", "E:\\episode.mkv", win), false);
  assert.equal(isWithin("D:\\Shows", "D:\\Shows-other\\episode.mkv", win), false);
  assert.equal(isWithin("D:\\Shows", "D:\\Shows\\..\\episode.mkv", win), false);
  assert.equal(isWithin("D:\\", "D:\\", win), false);
  assert.equal(isWithin("D:\\", "D:\\", { ...win, allowRoot: true }), true);
  assert.equal(isWithin("\\\\server\\share\\", "\\\\server\\share\\episode.mkv", win), true);
  assert.equal(isWithin("\\\\server\\share\\", "\\\\server\\other\\episode.mkv", win), false);
  assert.equal(isWithin("/", "/season/episode.mkv", { paths: path.posix }), true);
});
