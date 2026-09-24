import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

test("development reloads despite active work and requests one normal restart", async () => {
  let onChange, apply, beforeQuit, cleanups = 0, reloads = 0, restarts = 0, quits = 0;
  let builds = 0, failBuild = false;
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
    rebuild:async()=>{builds++;if(failBuild)throw Error('Invalid TypeScript');},
    app:{once(_event,callback){beforeQuit=callback;},relaunch(){restarts++;},quit(){quits++;beforeQuit();}},
    win:{isDestroyed:()=>false,webContents:{reloadIgnoringCache(){reloads++;}}}});
  onChange("change","ui/styles.css"); await apply();
  assert.equal(reloads,1); assert.equal(restarts,0);
  assert.equal(cleanups,1);
  onChange("change","ui/app/AppShell.tsx"); await apply();
  assert.equal(reloads,2); assert.equal(cleanups,2);
  failBuild = true;
  onChange("change","ui/app/AppShell.tsx"); await apply();
  assert.equal(builds,3); assert.equal(reloads,2); assert.equal(cleanups,2);
  onChange("change","core/queue.mjs"); await apply();
  assert.equal(queue.running.size,1);
  assert.equal(restarts,1); assert.equal(quits,1);
  onChange("change","core/queue.mjs"); await apply();
  assert.equal(restarts,1); assert.equal(quits,1);
});

test('a rejected second instance cannot initialize storage or create a window while quit is pending',async()=>{
  let quits=0;let ready=0;let windows=0;
  const app={isPackaged:false,setName(){},setAppUserModelId(){},requestSingleInstanceLock:()=>false,quit:()=>quits++,whenReady(){ready++;throw Error('Startup must stop');},on(){throw Error('Startup handlers must not register');}};
  const sandbox={__dirname:path.resolve('src/desktop'),process:{argv:[]},require(name){
    if(name==='electron')return {app,BrowserWindow:class{constructor(){windows++;}}};
    if(name==='node:path')return path;
    if(name==='node:url')return {pathToFileURL:()=>({href:'file:///test'})};
    if(name==='./environment.cjs')return {resolveEnvironment:()=>({environment:'development',name:'Season Shelf Dev',appId:'test'})};
    if(name==='./profile.cjs')return {configureProfile(){}};
    if(['node:fs/promises','node:crypto','../../package.json'].includes(name))return {};
    throw Error(name);
  }};
  const source=await fs.readFile('src/desktop/main.cjs','utf8');
  vm.runInNewContext(`(function(){${source}\n})()`,sandbox);
  assert.equal(quits,1);assert.equal(ready,0);assert.equal(windows,0);
});
