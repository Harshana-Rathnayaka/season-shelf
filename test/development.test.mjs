import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

test("development reloads despite active work and requests one normal restart", async () => {
  let onChange, apply, beforeQuit, cleanups = 0, reloads = 0, restarts = 0, quits = 0;
  const exported = {};
  const queue = {running:new Map([["download",{}]]),namingLocks:new Set()};
  const sandbox = {
    exports:exported, __dirname:path.resolve("src/desktop"), console:{log(){},error(){}},
    setTimeout(callback){apply=callback;return 1;}, clearTimeout(){},
    setInterval(){return 1;}, clearInterval(){},
    require(name) {
      if(name === "node:fs") return {watch(_root,_options,callback){onChange=callback;return {on(){},close(){}};}};
      if(name === "node:path") return path;
      if(name === "electron") return {Menu:{buildFromTemplate(value){return value;},setApplicationMenu(){}}};
      throw new Error(name);
    },
  };
  vm.runInNewContext(await fs.readFile("src/desktop/development.cjs","utf8"),sandbox);
  exported.enableDevelopment({queue,isAuthenticating:()=>true,beforeReload:()=>cleanups++,
    app:{once(_event,callback){beforeQuit=callback;},relaunch(){restarts++;},quit(){quits++;beforeQuit();}},
    win:{isDestroyed:()=>false,webContents:{reloadIgnoringCache(){reloads++;}}}});
  onChange("change","ui/styles.css"); apply();
  assert.equal(reloads,1); assert.equal(restarts,0);
  assert.equal(cleanups,1);
  onChange("change","ui/app.mjs"); apply();
  assert.equal(reloads,2); assert.equal(cleanups,2);
  onChange("change","core/queue.mjs"); apply();
  assert.equal(queue.running.size,1);
  assert.equal(restarts,1); assert.equal(quits,1);
  onChange("change","core/queue.mjs"); apply();
  assert.equal(restarts,1); assert.equal(quits,1);
});
