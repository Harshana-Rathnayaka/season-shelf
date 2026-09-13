const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  shell,
  Menu,
  powerSaveBlocker,
  Notification,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
let watcher,
  tray,
  win,
  store,
  queue,
  adapter,
  discovery,
  authPrompt,
  sleepBlocker,
  quitting = false;
const uiFile = path.join(__dirname, "../ui/index.html");
const uiUrl = pathToFileURL(uiFile).href;
const runtime = require("./environment.cjs").resolveEnvironment({isPackaged:app.isPackaged,metadata:require('../../package.json'),argv:process.argv});
require("./profile.cjs").configureProfile(app, runtime.environment);
app.setName(runtime.name);
app.setAppUserModelId(runtime.appId);
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  win?.show();
  win?.focus();
});

app
  .whenReady()
  .then(async () => {
    const [
      { Store },
      { DownloadQueue },
      { registerRoot, hashFile },
      { TelegramAdapter },
      { selectEpisodes, defaultHiddenKeywords, cleanKeywords },
    ] = await Promise.all([
      import("../core/store.mjs"),
      import("../core/queue.mjs"),
      import("../core/files.mjs"),
      import("./telegram.mjs"),
      import("../core/catalog.mjs"),
    ]);
    const {pendingEntries, removePending, trashCompleted, orphanedPartials, trashOrphans} = await import("../core/maintenance.mjs");
    const {cleanAppearance} = await import("../core/appearance.mjs");
    await fs.mkdir(app.getPath("userData"), {recursive:true});
    store = new Store(path.join(app.getPath("userData"), "shelf.sqlite"));
    const notify = (type, data) => {
      if(type==="updates" && data.state==="ready" && !data.deferred && Notification.isSupported()){const notice=new Notification({title:"Season Shelf update ready",body:"Open the app to restart now or install on the next launch."});notice.on("click",()=>{win?.show();win?.focus();});notice.show();}
      if (win && !win.isDestroyed())
        win.webContents.send("shelf:event", { type, data });
    };
    const credentials = {
      loadCredentials: () => {
        const encrypted = store.get("credentials", null);
        if (!encrypted) return null;
        if (!safeStorage.isEncryptionAvailable())
          throw new Error("OS credential encryption is unavailable");
        return JSON.parse(
          safeStorage.decryptString(Buffer.from(encrypted, "base64")),
        );
      },
      saveCredentials: (value) => {
        if (
          !safeStorage.isEncryptionAvailable() ||
          (process.platform === "linux" &&
            safeStorage.getSelectedStorageBackend() === "basic_text")
        )
          throw new Error("Secure OS credential storage is unavailable");
        store.set(
          "credentials",
          safeStorage.encryptString(JSON.stringify(value)).toString("base64"),
        );
      },
    };
    adapter = new TelegramAdapter({
      ...credentials,
      notify,
      ask: (kind, label) =>
        new Promise((resolve, reject) => {
          const id = randomUUID();
          const timer = setTimeout(() => {
            authPrompt = null;
            reject(new Error("Sign-in timed out"));
          }, 180000);
          authPrompt = {
            id,
            resolve: (value) => {
              clearTimeout(timer);
              resolve(value);
            },
            reject: (error) => {
              clearTimeout(timer);
              reject(error);
            },
          };
          notify("auth-prompt", { id, kind, label });
        }),
    });
    const {Discovery} = await import("./discovery.mjs");
    discovery = new Discovery(adapter);
    let settings = store.get("settings", {
      theme: "dark",
      concurrency: 2,
      archiveRoot: null,
      watchRoot: null,
    });
    settings.hiddenKeywords ??= defaultHiddenKeywords;
    const {TransferPolicy,cleanTransfer}=await import("../core/transfer-policy.mjs");
    const {unverifiedItems,missingEpisodes}=await import("../core/collection.mjs");
    adapter.transferPolicy=new TransferPolicy(settings.transfer);
    queue = new DownloadQueue({
      store,
      adapter,
      staging: path.join(app.getPath("userData"), "staging"),
      concurrency: settings.concurrency,
    });
    queue.on("change", (jobs) => {
      notify("queue", jobs);
      notify("usage", {...queue.usage,currentBatchId:queue.currentBatchId});
      const active = queue.namingLocks.size > 0 || jobs.some((job) =>
        ["downloading", "checking", "transferring"].includes(job.status),
      );
      if (active && sleepBlocker === undefined)
        sleepBlocker = powerSaveBlocker.start("prevent-app-suspension");
      if (!active && sleepBlocker !== undefined) {
        powerSaveBlocker.stop(sleepBlocker);
        sleepBlocker = undefined;
      }
    });
    const {SeriesWatcher}=await import("./watch-series.mjs");
    watcher=new SeriesWatcher({store,adapter,queue,notify:info=>{notify("new-episodes",info);if(Notification.isSupported())new Notification({title:`New episodes: ${info.title}`,body:`${info.count} matching files ${info.automatic ? "queued" : "available. Open Library and rescan to download."}`}).show();}});
    let channels = store.get("channels", []),
      catalogue = store.get("catalogue", null),
      scanning = false;
    function handle(method, callback) {
      ipcMain.handle(`shelf:${method}`, async (event, payload) => {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url !== uiUrl
        )
          throw new Error("Untrusted caller");
        try {
          return { ok: true, data: await callback(payload || {}) };
        } catch (error) {
          return {
            ok: false,
            error: String(error.message || error).slice(0, 350),
          };
        }
      });
    }
    const confirmInApp=require("./confirmations.cjs").createConfirmations({handle,notify});
    const rememberedLogin=require("./login-memory.cjs").loginMemory(store,safeStorage);
    handle("login-suggestions",()=>rememberedLogin.list());
    handle("login-suggestion",({id})=>rememberedLogin.get(id));
    handle("forget-login-suggestions",()=>{rememberedLogin.forget();return {};});
    handle("licenses",async()=>JSON.parse(await fs.readFile(path.join(__dirname,"assets/licenses.json"),"utf8")));
    let sessionRestore, connectionError = "";
    const {clearWorkspace,freshUsage}=await import("../core/reset.mjs");
    handle("clear-app-data",async()=>{
      const busy=()=>scanning || discovery.operation || authPrompt || adapter.connecting || watcher.checking || queue.running.size || queue.namingLocks.size;
      if(busy()) throw new Error("Pause downloads and finish current operations before clearing app data.");
      const answer=await confirmInApp({type:"warning",title:"Clear app data?",message:"Clear download history and the current library?",detail:"Also clears saved-file history, series watches and lifetime totals. Downloaded media and partial files stay on disk. Your Telegram login, preferences and completed guide are kept. Cleared file history cannot be restored from the app.",buttons:["Keep data","Clear app data"],defaultId:0,cancelId:0});
      if(answer.response!==1) return {cleared:false};
      if(busy()) throw new Error("An operation started. Wait for it to finish and try again.");
      const data=clearWorkspace(queue,store,watcher);channels=[];catalogue=null;discovery.choices.clear();
      return {cleared:true,...data};
    });
    handle("reset-activity",async()=>{
      const answer=await confirmInApp({type:"question",title:"Reset lifetime activity?",message:"Start lifetime counters from zero?",detail:"Download history, queue progress and files are kept.",buttons:["Keep totals","Reset totals"],defaultId:0,cancelId:0});
      if(answer.response===1){queue.usage=freshUsage();queue.save();}
      return queue.usage;
    });
    handle("finish-onboarding", () => { store.set("onboardingComplete", true); return {}; });
    handle("bootstrap", () => {
      if (!adapter.connected && !adapter.connecting && store.get("credentials", null) && !sessionRestore) {
        sessionRestore = adapter.connect(null, {interactive:false})
          .catch(error => { connectionError = String(error.message || error).slice(0,200); })
          .finally(() => notify("connection", {connected:adapter.connected,restoringSession:false,connectionError,profile:adapter.profile}));
      }
      return {
        firstRun: !store.get("onboardingComplete", false),
        settings, channels, catalogue, jobs:queue.snapshot(), usage:queue.usage,
        currentBatchId:queue.currentBatchId, connected:adapter.connected, profile:adapter.profile,
        restoringSession:!!adapter.connecting, connectionError,
        hasCredentials:!!store.get("credentials",null),version:app.getVersion(),appName:runtime.name,environment:runtime.environment,customTitleBar:process.platform === "win32",
      };
    });
    handle("connect", async (payload) => {
      if (discovery.operation) throw new Error("Stop bot discovery first");
      if (queue.running.size)
        throw new Error("Pause current downloads before reconnecting");
      if (!safeStorage.isEncryptionAvailable())
        throw new Error("OS credential encryption is unavailable");
      const result = await adapter.connect(
        payload.apiId
          ? {
              apiId: Number(payload.apiId),
              apiHash: String(payload.apiHash || ""),
              phone: String(payload.phone || ""),
            }
          : null,
      );
      rememberedLogin.save({apiId:Number(payload.apiId),apiHash:String(payload.apiHash || ""),phone:String(payload.phone || "")});
      connectionError = "";
      return result;
    });
    handle("auth-reply", ({ id, value, cancel }) => {
      if (!authPrompt || authPrompt.id !== id)
        throw new Error("Sign-in prompt expired");
      if (cancel) authPrompt.reject(new Error("Sign-in cancelled"));
      else authPrompt.resolve(String(value || "").slice(0, 300));
      authPrompt = null;
    });
    handle("discovery-source", ({groupId}) => discovery.prepareSearch(groupId));
    handle("window-theme", ({color,symbolColor}) => {
      if (!/^#[0-9a-f]{6}$/i.test(color || "") || !/^#[0-9a-f]{6}$/i.test(symbolColor || "")) throw new Error("Invalid title bar colour");
      if (process.platform === "win32") win.setTitleBarOverlay({color,symbolColor,height:32});
      return {};
    });
    handle("discovery-search", ({query,sourceId}) => discovery.search(query,sourceId));
    handle("discovery-open-message", ({link}) => discovery.openMessageLink(link));
    handle("discovery-follow", ({id}) => discovery.follow(id));
    handle("watch-list",()=>watcher.watches);
    handle("watch-set",payload=>watcher.set(catalogue,payload,settings[`${payload.mode}Root`]));
    handle("watch-check",async()=>{await watcher.check();return watcher.watches;});
    handle("subscription-choices",()=>discovery.subscriptionChoices());
    handle("complete-subscriptions",({ids})=>discovery.completeSubscriptions(ids));
    handle("find-missing",async ({mode})=>{
      if(!catalogue || !["archive","watch"].includes(mode)) throw new Error("Choose a series first");
      for(const job of queue.jobs.filter(job=>job.status==="complete" && String(job.item.peer?.id)===String(catalogue.channel.id) && job.mode===mode)) {
        try {await fs.access(job.finalPath);} catch(error) {if(error.code==="ENOENT") job.status="missing";else throw error;}
      }
      queue.save();return queue.snapshot();
    });
    handle("discovery-cancel", () => { discovery.cancel(); return {}; });
    handle("discovery-join", async ({id}) => {
      const channel = await discovery.join(id);
      channels = [channel,...channels.filter(item=>item.id !== channel.id)];
      store.set("channels",channels);
      return {channel,channels};
    });
    handle("channels", async () => {
      channels = await adapter.channels();
      store.set("channels", channels);
      return channels;
    });
    handle("scan", async ({ id }) => {
      if (scanning) throw new Error("A channel scan is already running");
      const channel = channels.find((c) => c.id === id);
      if (!channel) throw new Error("Select a channel from your account");
      scanning = true;
      try {
        catalogue = await adapter.scan(channel);
        store.set("catalogue", catalogue);
        return catalogue;
      } finally {
        scanning = false;
      }
    });
    handle("choose-folder", async ({ mode }) => {
      if (!["archive", "watch"].includes(mode))
        throw new Error("Invalid destination mode");
      const result = await dialog.showOpenDialog(win, {
        title:
          mode === "archive"
            ? "Choose your download folder"
            : "Choose your watch folder",
        properties: ["openDirectory", "createDirectory"],
      });
      if (!result.canceled) {
        const root = await registerRoot(result.filePaths[0]);
        const other =
          settings[mode === "archive" ? "watchRoot" : "archiveRoot"];
        if (
          other &&
          (root.path === other.path ||
            root.path.startsWith(other.path + path.sep) ||
            other.path.startsWith(root.path + path.sep))
        )
          throw new Error(
            "Choose separate, non-overlapping Archive and Watch folders",
          );
        settings[`${mode}Root`] = root;
        store.set("settings", settings);
      }
      return settings;
    });
    handle("settings", (payload) => {
      if (payload.transfer !== undefined) {settings.transfer=cleanTransfer(payload.transfer);adapter.transferPolicy.configure(settings.transfer);}
      if(typeof payload.closeToTray === "boolean") settings.closeToTray=payload.closeToTray;
      if (payload.appearance !== undefined) settings.appearance = cleanAppearance(payload.appearance);
      if (payload.hiddenKeywords !== undefined) settings.hiddenKeywords = cleanKeywords(payload.hiddenKeywords);
      if (typeof payload.sidebarCollapsed === "boolean")
        settings.sidebarCollapsed = payload.sidebarCollapsed;
      if (["dark", "light", "system"].includes(payload.theme))
        settings.theme = payload.theme;
      if ([1, 2, 3, 4].includes(payload.concurrency))
        queue.concurrency = settings.concurrency = payload.concurrency;
      store.set("settings", settings);
      return settings;
    });
    handle("enqueue", async ({ ids, mode, quality, unverifiedIds = [] }) => {
      if (
        !catalogue ||
        !["archive", "watch"].includes(mode) ||
        !Array.isArray(ids)
      )
        throw new Error("Choose episodes first");
      adapter.requireClient();
      const root = settings[`${mode}Root`];
      if (!root) throw new Error("Choose a destination folder first");
      const selected = new Set(ids);
      if(!Array.isArray(unverifiedIds)) throw new Error("Invalid unverified selection");
      const items = selectEpisodes(catalogue.items, mode, quality).filter((item) =>
        selected.has(item.id),
      );
      items.push(...unverifiedItems(catalogue.items).filter(item=>unverifiedIds.includes(item.id)));
      if (!items.length) throw new Error("No matching episodes selected");
      return queue.add({ items, series: catalogue.channel.title, mode, root });
    });
    handle("queue-control", ({ id, action, all }) => {
      if (action === "resume") adapter.requireClient();
      if (all) queue.controlAll(action);
      else queue.control(id, action);
      return queue.snapshot();
    });
    handle("open-job", async ({ id }) => {
      const job = queue.jobs.find(
        (j) => j.id === id && j.status === "complete",
      );
      if (!job) throw new Error("Completed download not found");
      await fs.access(job.finalPath);
      const error = await shell.openPath(job.finalPath);
      if (error) throw new Error(error);
    });
    handle("reveal-job", async ({ id }) => {
      const job = queue.jobs.find(j => j.id === id && j.status === "complete");
      if (!job?.finalPath) throw new Error("Completed download not found");
      await fs.access(job.finalPath);
      shell.showItemInFolder(job.finalPath);
    });
    handle("delete-job", async ({ id }) => {
      const job = queue.jobs.find(
        (j) => j.id === id && j.status === "complete",
      );
      if (!job)
        throw new Error("Only completed downloads can be deleted here");
      if (queue.namingLocks.has(queue.seasonKey(job)) || job.renamePending)
        throw new Error("Season filenames are being finalized; try again shortly");
      const result = await confirmInApp({
        type: "question",
        title: "Delete downloaded file?",
        message: `Move ${path.basename(job.finalPath)} to the Recycle Bin?`,
        detail: `This ${job.mode === "archive" ? "archive" : "viewing"} file will be moved to the Recycle Bin.`,
        buttons: ["Keep file", "Move to Recycle Bin"],
        defaultId: 0,
        cancelId: 0,
      });
      if (result.response !== 1) return queue.snapshot();
      const outcome = await trashCompleted(queue, [id], file => shell.trashItem(file));
      if (outcome.failures.length) throw new Error(outcome.failures[0].error);
      return queue.snapshot();
    });
    handle("delete-all-queue", async () => {
      const ids = pendingEntries(queue).map(job => job.id);
      if (!ids.length) return {jobs:queue.snapshot(),removed:0};
      const result = await confirmInApp({
        type:"question", title:"Delete all pending queue entries?",
        message:`Remove ${ids.length} unfinished queue entries?`,
        detail:"Downloads will stop. Completed files and retained partial files stay on disk. Files already checking or transferring are kept until they finish.",
        buttons:["Keep queue","Delete pending entries"],defaultId:0,cancelId:0,
      });
      const removed = result.response === 1 ? removePending(queue,ids) : 0;
      return {jobs:queue.snapshot(),removed};
    });
    handle("retry-naming", async ({id}) => {
      const job = queue.jobs.find(job => job.id === id && job.status === "complete");
      if (!job) throw new Error("Completed download not found");
      const key = queue.seasonKey(job);
      if (queue.namingLocks.has(key)) throw new Error("This season is already being updated");
      if (queue.jobs.some(other => queue.seasonKey(other) === key && !["complete", "deleted", "cancelled", "missing"].includes(other.status)))
        throw new Error("Finish the other queued episodes in this season before retrying naming");
      await queue.finishSeason(job);
      return queue.snapshot();
    });
    handle("delete-all-saved", async () => {
      const jobs = queue.jobs.filter(job => job.status === "complete");
      if (!jobs.length) return {jobs:queue.snapshot(),deleted:0,failures:[]};
      const result = await confirmInApp({
        type:"warning",title:"Delete all saved files?",
        message:`Move ${jobs.length} saved files to the Recycle Bin?`,
        detail:"Includes BOTH Archive and Watch copies. Changed files and files being renamed will be kept.\n\n" + jobs.slice(0,8).map(job => path.basename(job.finalPath)).join("\n") + (jobs.length > 8 ? "\n...and more" : ""),
        buttons:["Keep files","Move all to Recycle Bin"],defaultId:0,cancelId:0,
      });
      const outcome = result.response === 1 ? await trashCompleted(queue,jobs.map(job => job.id),file => shell.trashItem(file)) : {deleted:0,failures:[]};
      return {jobs:queue.snapshot(),...outcome};
    });
    handle("staging-info", async () => {
      const files = await orphanedPartials(queue);
      return {count:files.length,bytes:files.reduce((sum,file)=>sum+file.size,0)};
    });
    handle("cleanup-staging", async () => {
      const files = await orphanedPartials(queue);
      if (!files.length) return {deleted:0,failures:[]};
      const result = await confirmInApp({
        type:"question",title:"Clean up unused partial files?",
        message:`Move ${files.length} unused partial files to the Recycle Bin?`,
        detail:"These partial files have no queue entry. Paused, cancelled, failed and active jobs with queue entries are preserved.",
        buttons:["Keep partials","Move unused partials to Recycle Bin"],defaultId:0,cancelId:0,
      });
      return result.response === 1 ? trashOrphans(queue,files.map(file=>file.id),file=>shell.trashItem(file)) : {deleted:0,failures:[]};
    });
    handle("disconnect", async () => {
      if (discovery.operation) throw new Error("Stop bot discovery first");
      if (queue.running.size)
        throw new Error("Pause downloads and wait for them to stop first");
      await adapter.disconnect();
      store.set("credentials", null);
      connectionError = "";
      return { connected: false };
    });
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1380,
      height: 920,
      minWidth: 1024,
      minHeight: 720,
      title: runtime.name,
      icon:path.join(__dirname,"assets/icon.ico"),
      ...(process.platform === "win32" ? {titleBarStyle:"hidden",titleBarOverlay:{color:"#101113",symbolColor:"#edf0ef",height:32}} : {}),
      backgroundColor: "#101113",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    win.on('page-title-updated', event => event.preventDefault());
    tray=require("./tray.cjs").installTray({win,queue,settings:()=>settings,isQuitting:()=>quitting});
    require("./updates.cjs").installUpdates({app,runtime,openReleases:()=>shell.openExternal("https://github.com/Harshana-Rathnayaka/season-shelf/releases/latest"),handle,notify,settings:()=>settings,saveSettings:()=>store.set("settings",settings),busy:()=>watcher.checking || queue.running.size || queue.namingLocks.size || scanning || !!discovery.operation || !!authPrompt || adapter.connecting,beforeInstall:async()=>{watcher.stop();await queue.stop();await adapter.disconnect();quitting=true;}});
    await win.loadFile(uiFile);
    if (runtime.liveReload) {
      const { enableDevelopment } = require("./development.cjs");
      enableDevelopment({ app, win, beforeReload: () => {
        authPrompt?.reject(new Error('Sign-in cancelled by development reload'));
        authPrompt = null;
        discovery?.cancel();
      } });
    }
  })
  .catch((error) => {
    dialog.showErrorBox("Season Shelf could not start", error.message);
    app.exit(1);
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  authPrompt?.reject(new Error("App closing"));
  discovery?.cancel();
  watcher?.stop();
  Promise.resolve(queue?.stop())
    .then(() => adapter?.disconnect())
    .finally(() => app.exit(0));
  setTimeout(() => app.exit(0), 5000).unref();
});
