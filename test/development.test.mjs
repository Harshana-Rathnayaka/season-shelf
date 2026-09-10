import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

test("development reloads UI during downloads but defers backend restart and sign-in reload", async () => {
  let onChange, apply, authenticating = false, reloads = 0, restarts = 0, quits = 0;
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
  exported.enableDevelopment({queue,isAuthenticating:()=>authenticating,
    app:{once(){},relaunch(){restarts++;},quit(){quits++;}},
    win:{isDestroyed:()=>false,webContents:{reloadIgnoringCache(){reloads++;}}}});
  onChange("change","ui/styles.css"); apply();
  assert.equal(reloads,1); assert.equal(restarts,0);
  onChange("change","core/queue.mjs"); apply();
  assert.equal(restarts,0);
  queue.running.clear(); apply();
  assert.equal(restarts,1); assert.equal(quits,1);
  authenticating=true; onChange("change","ui/app.mjs"); apply();
  assert.equal(reloads,1);
  authenticating=false; apply(); assert.equal(reloads,2);
});
