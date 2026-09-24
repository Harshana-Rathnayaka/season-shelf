import { createInitialState, reduceBackgroundEvent } from "./state.ts";
import { pendingDownloadCount } from "../features/downloads/selectors.ts";
import { friendlyError } from "../shared/lib/format.mjs";
import { chosen, visible, selectedItems, effectiveQuality } from "../features/library/selectors.ts";
import { updateLibrary } from "../features/library/actions.ts";
import { createRenderer } from "./renderer.tsx";
import { handleDownloadCommand } from "../features/downloads/actions.ts";
import { missingEpisodes } from "../../core/collection.mjs";
import { applyAppearance } from "../features/settings/appearance.mjs";
import { advanceDiscovery } from "../features/discovery/flow.mjs";
import { createDialogs } from "./dialogs.tsx";
import { defaultHiddenKeywords } from "../../core/catalog.mjs";
import { demoCatalogue } from "../features/library/demo.mjs";

const $ = (selector) => document.querySelector(selector);
const renderer = createRenderer(document.getElementById("app"), {
  onDownloadAction: dispatchDownload,
  onLibraryAction: dispatchLibrary,
  onShellAction: command => dispatchAction(command.action, "page" in command ? {page:command.page} : {}),
  onSettingsAction: command => command.action === "scan-staging" || command.action === "cleanup-staging"
    ? dispatchDownload(command) : dispatchAction(command.action, "mode" in command ? {mode:command.mode} : {}),
  onHelpAction: command => dispatchAction(command.action, "page" in command ? {page:command.page} : {}),
  onSaveSettings: saveSettings,
  hasDesktop: !!window.shelf,
  onBrowse: () => { state.page = "library"; render(); },
});
const dialogs = createDialogs(document.querySelector("#dialog"), {onAction:dispatchDialog,onSubmit:dispatchForm});
let state = createInitialState(!!window.shelf);
let discoveryVersion = 0, discoveryBusy = false, titleBarColours = "";
let toastTimer, liveSnapshot, renderedPage;
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = friendlyError(message);
  el.className = `visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 5500);
}
async function call(method, payload) {
  if (!window.shelf)
    throw new Error("Open the desktop app to use your Telegram account");
  const result = await window.shelf.call(method, payload);
  if (!result.ok) throw new Error(friendlyError(result.error));
  return result.data;
}
function applyTheme() {
  applyAppearance(state.settings);
  document.documentElement.dataset.theme =
    state.settings.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : state.settings.theme;
  if (state.customTitleBar && window.shelf) {
    const light = document.documentElement.dataset.theme === "light";
    const color = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (light ? "#f5f6f4" : "#101113");
    const symbolColor = light ? "#202c27" : "#edf0ef";
    const signature = color + symbolColor;
    if (signature !== titleBarColours) {
      titleBarColours = signature;
      call("window-theme",{color,symbolColor}).catch(()=>{titleBarColours="";});
    }
  }
}
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  applyTheme,
);
function startDemo() {
  if (!state.demo)
    liveSnapshot = {
      catalogue: state.catalogue,
      jobs: state.jobs,
      channels: state.channels,
    };
  state.demo = true;
  state.catalogue = demoCatalogue();
  state.channels = [state.catalogue.channel];
  state.jobs = [];
  state.season = 4;
  state.selected.clear();
  visible(state)
    .slice(0, 3)
    .forEach((item) => state.selected.add(item.id));
  render();
}
function render() {
  const oldPageScroll = $(".workspace-scroll")?.scrollTop || 0;
  const pageKey = state.page === "queue" ? `${state.page}:${state.downloadTab}` : state.page;
  const keepPageScroll = renderedPage === pageKey;
  renderedPage = pageKey;
  applyTheme();
  $("#app").classList.toggle("sidebar-collapsed", !!state.settings.sidebarCollapsed);
  const count = pendingDownloadCount(state.jobs);
  $("#app").classList.toggle("custom-titlebar", !!state.customTitleBar);
  renderer.render(state, count);
  if (keepPageScroll && $(".workspace-scroll")) $(".workspace-scroll").scrollTop = oldPageScroll;

}
function refreshQueueBadge() {
  renderer.updateShell(state, pendingDownloadCount(state.jobs));
}
function updatePrompt() {
  if(state.updates?.state!=="ready" || state.updates.deferred || $("#dialog").open) return;
  dialogs.show({kind:"update",version:state.updates.version});
}
async function closeActiveDialog() {
  const view=dialogs.current();
  if(!view)return;
  const cancellingDiscovery=discoveryBusy;
  discoveryVersion++;
  discoveryBusy=false;
  dialogs.close();
  if(view.kind==="confirmation")await call("confirmation-reply",{id:view.id,response:0});
  if(view.kind==="auth")await call("auth-reply",{id:view.id,cancel:true});
  if(view.kind==="update" && state.updates?.state==="ready" && !state.updates.deferred)state.updates=await call("update-later");
  if(cancellingDiscovery)await call("discovery-cancel");
}
function showGuide() { dialogs.show({kind:"guide"}); }
function connectionModal() {
  if (state.demo && window.shelf) {
    state.demo = false;
    if (liveSnapshot) Object.assign(state, liveSnapshot);
    else {state.catalogue=null;state.jobs=[];}
    render();
  }
  if (!window.shelf) return dialogs.show({kind:"preview"});
  if (state.connected) return chooseSeries();
  dialogs.show({kind:"connect",hasCredentials:state.hasCredentials,suggestions:[]});
  const generation = dialogs.generation();
  call("login-suggestions").then(suggestions=>{
    if(dialogs.generation()===generation) dialogs.update(view=>view.kind==="connect"?{...view,suggestions}:view);
  }).catch(()=>{});
}
function discoveryModal(source = null) { dialogs.show({kind:"discovery-search",source}); }
async function discoveryRequest(method,payload) {
  const version=++discoveryVersion;
  discoveryBusy=true;
  const reading=["discovery-source","discovery-open-message"].includes(method);
  dialogs.show({kind:"discovery-wait",reading});
  try {
    const result=method==="discovery-join"?{joined:await call(method,payload)}:await advanceDiscovery(method,payload,{call,cancelled:()=>version!==discoveryVersion,onStage:stage=>{
      if(version!==discoveryVersion)return;
      dialogs.update(view=>view.kind!=="discovery-wait"?view:{...view,heading:stage==="discovery-join"?"Joining series channel...":stage==="discovery-follow"?"Opening series result...":reading?"Checking Telegram...":"Waiting for bot replies..."});
    }});
    if(!result || version!==discoveryVersion)return;
    if(result.joined){state.demo=false;state.channels=result.joined.channels;await scan(result.joined.channel.id);return;}
    if(result.groups)return dialogs.show({kind:"discovery-groups",groups:result.groups});
    if(result.source)return discoveryModal(result.source);
    if(result.channel)return dialogs.show({kind:"discovery-channel",channel:result.channel});
    dialogs.show({kind:"discovery-results",notice:result.notice,messages:result.messages});
  } catch(error) {
    if(version===discoveryVersion)dialogs.show({kind:"discovery-error",error:error.message});
  } finally {if(version===discoveryVersion)discoveryBusy=false;}
}
async function chooseSeries() {
  if(!state.connected && !state.demo)return connectionModal();
  dialogs.show({kind:"channels",channels:state.channels,demo:state.demo,filter:state.channelFilter,keywords:state.settings.hiddenKeywords??defaultHiddenKeywords,selectedMediaChannel:state.catalogue?.items.some(item=>!item.reason)?state.catalogue.channel.id:undefined});
}
async function connect(payload) {
  dialogs.show({kind:"message",title:"Connecting...",message:"Keep this window open. Telegram may ask for a login code or your two-step verification password."});
  const result = await call("connect", payload);
  state.connected = result.connected;
  state.profile = result.profile;
  state.hasCredentials = true;
  state.channels = await call("channels");
  dialogs.close();
  render();
  toast("Telegram connected. Choose a series channel.");
  chooseSeries();
}
async function scan(id) {
  dialogs.close();
  state.busy = true;
  state.scanProgress = undefined;
  state.page = "library";
  const channel = state.channels.find(channel=>channel.id === id);
  if (channel) state.catalogue = {channel,items:[],scanned:0};
  state.selected.clear();
  render();
  try {
    state.catalogue = state.demo ? demoCatalogue() : await call("scan", { id });
    state.quality = {};
    state.selected.clear();
    state.query = "";
    state.season = chosen(state)[0]?.season || 1;
  } finally {
    state.busy = false;
    state.scanProgress = undefined;
    render();
  }
}
async function setSettings(patch) {
  state.settings = state.demo
    ? { ...state.settings, ...patch }
    : await call("settings", patch);
  render();
}

async function saveSettings(patch, message) {
  try { await setSettings(patch); if (message) toast(message); }
  catch (error) { toast(error.message, true); }
}

async function dispatchLibrary(command) {
  if (updateLibrary(state, command)) { render(); return; }
  await dispatchAction(command.action, "mode" in command ? { mode: command.mode } : {});
}

async function dispatchDownload(command) {
  try {
    await handleDownloadCommand(command, { state, call, render, toast, showFileDetails: job => dialogs.show({kind:"file-details",job}), closeDialog: () => dialogs.close() });
  } catch (error) {
    toast(error.message, true);
  }
}

async function dispatchDialog(action, data = {}) {
  if (action === "retry-naming" || action === "reveal-job" || action === "delete-job") {
    if (data.job) await dispatchDownload({action,job:data.job});
    return;
  }
  await dispatchAction(action,data);
}

async function dispatchAction(action, data = {}) {
  try {
    if (action === "confirmation-reply") {
      const view=dialogs.current();if(view?.kind!=="confirmation")return;dialogs.close();await call("confirmation-reply",{id:view.id,response:Number(data.response)});
    } else if (action === "use-login") {
      const generation=dialogs.generation();const saved=await call("login-suggestion",{id:data.id});if(dialogs.generation()===generation)dialogs.update(view=>view.kind==="connect"?{...view,saved}:view);
    } else if (action === "forget-logins") { await call("forget-login-suggestions");dialogs.update(view=>view.kind==="connect"?{...view,suggestions:[]}:view);
    } else if (action === "update-later") {state.updates=await call("update-later");dialogs.close();render();
    } else if (action === "toggle-sidebar") {
      await setSettings({sidebarCollapsed: !state.settings.sidebarCollapsed});
      $(".sidebar-toggle").focus();
    } else if (action === "nav") {
      state.page = data.page;
      if (state.page === "queue") state.downloadTab = "ongoing";
      render();
      if(state.page === "settings" && window.shelf) {state.updates=await call("update-status");render();}
    } else if (action === "theme")
      await setSettings({
        theme:
          document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      });
    else if (action === "reset-appearance") {
      await setSettings({appearance:{}});
    } else if (action === "reset-keywords") {
      await setSettings({hiddenKeywords:[...defaultHiddenKeywords]});
      toast("Default keywords restored.");
    } else if (action === "set-theme")
      await setSettings({ theme: data.theme });
    else if (action === "channel-filter") {
      state.channelFilter = data.filter;
      dialogs.update(view=>view.kind==="channels"?{...view,filter:state.channelFilter}:view);
    } else if (action === "connect") connectionModal();
    else if (action === "reconnect") await connect({});
    else if (["update-check","update-download","update-install"].includes(action)) {if(action === "update-check"){if(state.updateChecking)return;state.updateChecking=true;render();}try{state.updates=await call(action);render();}catch(error){if(dialogs.current()?.kind==="update")dialogs.update(view=>view.kind==="update"?{...view,error:friendlyError(error.message)}:view);else throw error;}finally{state.updateChecking=false;render();}}
    else if (action === "watch-series") {
      const watches=await call("watch-list");const watch=watches.find(w=>w.channel.id===state.catalogue.channel.id && w.mode===state.mode);
      dialogs.show({kind:"watch",mode:state.mode,watch});
    } else if (action === "find-missing") {
      if(!state.demo) state.jobs=await call("find-missing",{mode:state.mode});
      const missing=missingEpisodes(chosen(state),state.jobs,state.catalogue.channel.id,state.mode).filter(item=>item.season===state.season);
      state.selected=new Set(missing.map(item=>item.id));render();toast(`${missing.length} files selected to fill gaps in this season. Compares app-managed saved files.`);
    } else if (action === "subscription-help") {
      const choices=await call("subscription-choices");
      dialogs.show({kind:"subscriptions",choices});
    } else if (action === "choose-series") await chooseSeries();
    else if (action === "refresh-channels") {
      if (!state.demo) state.channels = await call("channels");
      dialogs.update(view=>view.kind==="channels"?{...view,channels:state.channels}:view);
    } else if (action === "discover") {
      discoveryModal();
    } else if (action === "discovery-source") {
      await discoveryRequest("discovery-source");
    } else if (action === "discovery-group") {
      await discoveryRequest("discovery-source",{groupId:data.choice});
    } else if (action === "discovery-follow") {
      await discoveryRequest("discovery-follow",{id:data.choice});
    } else if (action === "discovery-join") {
      await discoveryRequest("discovery-join",{id:data.choice});
    } else if (action === "scan-channel") await scan(data.channel);
    else if (action === "rescan") await scan(state.catalogue.channel.id);
    else if (action === "demo") startDemo();
    else if (action === "exit-demo") {
      state.demo = false;
      Object.assign(
        state,
        liveSnapshot || { catalogue: null, channels: [], jobs: [] },
      );
      state.selected.clear();
      render();
    } else if (action === "close-dialog") {
      await closeActiveDialog();
    } else if (action === "folder") {
      if (state.demo)
        return toast(
          "Folder selection is available in the connected desktop app.",
        );
      state.settings = await call("choose-folder", { mode: data.mode });
      render();
    } else if (action === "download") {
      if (state.demo) {
        const batchId = state.jobs.find(j => !["complete","cancelled","deleted"].includes(j.status))?.batchId || crypto.randomUUID();
        state.currentBatchId = batchId;
        for (const item of selectedItems(state))
          if (
            !state.jobs.some(
              (j) => j.item.id === item.id && j.mode === state.mode,
            )
          )
            state.jobs.push({
              id: crypto.randomUUID(),
              batchId,
              series: state.catalogue.channel.title,
              item,
              mode: state.mode,
              status: "preview",
              received: 0,
            });
        toast("Preview queue created. No files will be downloaded.");
      } else {
        const ids = await call("enqueue", {
          ids: [...state.selected],
          unverifiedIds: selectedItems(state).filter(item=>item.unverified).map(item=>item.id),
          mode: state.mode,
          quality: effectiveQuality(state),
        });
        toast(`${ids.length} ${ids.length === 1 ? "episode" : "episodes"} added to the queue.`);
      }
      state.page = "queue";
      state.downloadTab = "ongoing";
      state.selected.clear();
      render();
    } else if (action === "disconnect") {
      await call("disconnect");
      state.profile = null;
      state.connected = false;
      state.hasCredentials = false;
      render();
      toast(
        "Local session forgotten. You can also revoke it in Telegram → Devices.",
      );
    } else if (action === "show-guide") { showGuide();
    } else if (action === "clear-app-data") {
      const result=await call("clear-app-data");if(result.cleared){Object.assign(state,result);state.selected.clear();state.libraryTab="verified";state.query="";state.season=1;state.stagingInfo=null;render();toast("App data cleared. Files on disk were kept.");}
    } else if (action === "reset-activity") { state.usage=await call("reset-activity");render();
    } else if (action === "licenses") {
      const entries=await call("licenses");dialogs.show({kind:"licenses",entries});
    } else if (action === "finish-onboarding") {
      await call("finish-onboarding"); dialogs.close();
    }
  } catch (error) {
    toast(error.message, true);
  }
}
async function dispatchForm(submission) {
  const {form,values}=submission;
  try {
    if(form==="discovery-link-form")await discoveryRequest("discovery-open-message",{link:values.link});
    else if(form==="discovery-form")await discoveryRequest("discovery-search",{query:values.query,sourceId:values.sourceId});
    else if(form==="watch-form"){
      await call("watch-set",{mode:state.mode,quality:effectiveQuality(state),automatic:values.watchMode==="off"?null:values.watchMode==="auto"});dialogs.close();toast("Series watch saved.");
    } else if(form==="subscriptions-form")await discoveryRequest("complete-subscriptions",{ids:values.ids});
    else if(form==="connect-form")await connect(values);
    else if(form==="auth-form"){
      if(dialogs.current()?.kind!=="auth")return;
      dialogs.show({kind:"message",title:"Verifying...",message:"Waiting for Telegram."});
      await call("auth-reply",{id:values.id,value:values.value});
    }
  } catch(error){dialogs.close();toast(error.message,true);}
}
async function initialize() {
if (window.shelf) {
  window.shelf.on(({ type, data }) => {
    if(type === "confirmation") {
      dialogs.show({kind:"confirmation",...data});
    } else if(type === "new-episodes") toast(`${data.count} new files in ${data.title}${data.automatic ? " queued." : ". Rescan the channel to view them."}`);
    else if(type === "updates") {state=reduceBackgroundEvent(state,{type,data});if(state.page==="settings") render();if(data.state==="ready"){updatePrompt();if(!$("#update-error"))toast("Update ready. Open Settings to restart and install.");}}
    else if (type === "connection") {
      state=reduceBackgroundEvent(state,{type,data});
      render();
      if (data.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.",true);
    } else if (type === "usage") {
      state=reduceBackgroundEvent(state,{type,data});
      if (state.page === "queue" || state.page === "settings") render();
    } else if (type === "queue") {
      if (state.demo) {
        if (liveSnapshot) liveSnapshot.jobs = data;
      } else {
        state=reduceBackgroundEvent(state,{type,data});
        if (state.page === "queue") render();else refreshQueueBadge();
      }
    } else if (type === "scan-progress") {
      state=reduceBackgroundEvent(state,{type,data});
      if(state.busy && state.page==="library")render();
    }
    else if (type === "auth-error") toast(data, true);
    else if (type === "auth-prompt") {
      dialogs.show({kind:"auth",id:data.id,label:data.label,authKind:data.kind});
      $("#auth-form input").focus();
    }
  });
  try {
    Object.assign(state, await call("bootstrap"));
    state.season = chosen(state)[0]?.season || 1;
    render();
    if (state.firstRun) showGuide();
    if (state.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.", true);
  } catch (error) {
    render();
    toast(error.message, true);
  }
} else startDemo();
}
export const ready = initialize();
