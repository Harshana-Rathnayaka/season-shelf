import { createPresentation } from "./presentation";
import { createDiscovery } from "./discovery";
import type { LibraryItem } from "../features/library/types";
import { call, subscribe } from "./ipc";
import type { LibraryCommand } from "../features/library/types";
import type { DownloadCommand } from "../features/downloads/types";
import type { Settings } from "../features/settings/types";
import type { DialogAction, DialogActionData, DialogSubmission } from "../shared/ui/dialog-actions";
import type { Page } from "./AppShell";
import { createInitialState, reduceBackgroundEvent } from "./state";
import { pendingDownloadCount } from "../features/downloads/selectors";
import { friendlyError } from "../shared/lib/format";
import { chosen, visible, selectedItems, effectiveQuality } from "../features/library/selectors";
import { updateLibrary } from "../features/library/actions";
import { createRenderer } from "./renderer";
import { handleDownloadCommand } from "../features/downloads/actions";
import { missingEpisodes } from "../../core/collection.mjs";
import { createDialogs } from "./dialogs";
import { defaultHiddenKeywords } from "../../core/catalog.mjs";
import { demoCatalogue } from "../features/library/demo";

const appElement = document.getElementById("app")!;
const dialogElement = document.querySelector<HTMLDialogElement>("#dialog")!;
const toastElement = document.getElementById("toast")!;
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const renderer = createRenderer(appElement, {
  onDownloadAction: dispatchDownload,
  onLibraryAction: dispatchLibrary,
  onShellAction: command => dispatchAction(command.action, "page" in command ? {page:command.page} : {}),
  onSettingsAction: command => command.action === "scan-staging" || command.action === "cleanup-staging"
    ? dispatchDownload({action:command.action}) : dispatchAction(command.action, "mode" in command ? {mode:command.mode} : {}),
  onHelpAction: command => dispatchAction(command.action, "page" in command ? {page:command.page} : {}),
  onSaveSettings: saveSettings,
  hasDesktop: !!window.shelf,
  onBrowse: () => { state.page = "library"; render(); },
});
const dialogs = createDialogs(dialogElement, {onAction:dispatchDialog,onSubmit:dispatchForm});
let state = createInitialState(!!window.shelf);
const presentation = createPresentation(() => state, call, toastElement);
const {toast, applyTheme} = presentation;
const discovery = createDiscovery({call,dialogs,onJoined:async joined => {
  state.demo=false;state.channels=joined.channels;await scan(joined.channel.id);
}});
let unsubscribe: (() => void) | undefined;
window.addEventListener("pagehide", () => {
  unsubscribe?.();
  discovery.invalidate();
  presentation.dispose();
  dialogs.dispose();
  renderer.dispose();
}, {once:true});
let liveSnapshot: Pick<typeof state, "catalogue" | "jobs" | "channels"> | undefined;
let renderedPage: string | undefined;
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
  appElement.classList.toggle("sidebar-collapsed", !!state.settings.sidebarCollapsed);
  const count = pendingDownloadCount(state.jobs);
  appElement.classList.toggle("custom-titlebar", !!state.customTitleBar);
  renderer.render(state, count);
  if (keepPageScroll && $(".workspace-scroll")) $(".workspace-scroll")!.scrollTop = oldPageScroll;

}
function refreshQueueBadge() {
  renderer.updateShell(state, pendingDownloadCount(state.jobs));
}
function updatePrompt() {
  if(state.updates?.state!=="ready" || state.updates.deferred || dialogElement.open) return;
  dialogs.show({kind:"update",version:state.updates.version || ""});
}
async function closeActiveDialog() {
  const view=dialogs.current();
  if(!view)return;
  const cancellingDiscovery=discovery.invalidate();
  dialogs.close();
  if(view.kind==="confirmation")await call("confirmation-reply",{id:view.id,response:0});
  if(view.kind==="auth")await call("auth-reply",{id:view.id,cancel:true});
  if(view.kind==="update" && state.updates?.state==="ready" && !state.updates.deferred)state.updates=await call("update-later");
  if(cancellingDiscovery)await call("discovery-cancel");
}
function showGuide() { dialogs.show({kind:"guide"}); }
function connectionModal(): void | Promise<void> {
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
async function chooseSeries(): Promise<void> {
  if(!state.connected && !state.demo)return connectionModal();
  dialogs.show({kind:"channels",channels:state.channels,demo:state.demo,filter:state.channelFilter,keywords:state.settings.hiddenKeywords??defaultHiddenKeywords,selectedMediaChannel:state.catalogue?.items.some(item=>!item.reason)?state.catalogue.channel.id:undefined});
}
async function connect(payload: {apiId?:string;apiHash?:string;phone?:string}) {
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
async function scan(id: string) {
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
async function setSettings(patch: Partial<Settings>) {
  state.settings = state.demo
    ? { ...state.settings, ...patch }
    : await call("settings", patch);
  render();
}

async function saveSettings(patch: Partial<Settings>, message?: string) {
  try { await setSettings(patch); if (message) toast(message); }
  catch (error) { toast(error instanceof Error ? error.message : String(error), true); }
}

async function dispatchLibrary(command: LibraryCommand) {
  if (updateLibrary(state, command)) { render(); return; }
  await dispatchAction(command.action, "mode" in command ? { mode: command.mode } : {});
}

async function dispatchDownload(command: DownloadCommand) {
  try {
    await handleDownloadCommand(command, { state, call, render, toast, showFileDetails: job => dialogs.show({kind:"file-details",job}), closeDialog: () => dialogs.close() });
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), true);
  }
}

async function dispatchDialog(action: DialogAction, data: DialogActionData = {}) {
  if (action === "retry-naming" || action === "reveal-job" || action === "delete-job") {
    if (data.job) await dispatchDownload({action,job:data.job});
    return;
  }
  await dispatchAction(action,data);
}

function required(value: string | undefined): string { if(!value)throw new Error("This action is no longer available. Please reopen it.");return value; }

async function dispatchAction(action: string, data: DialogActionData & {page?: Page;mode?: "archive" | "watch"} = {}) {
  try {
    if (action === "confirmation-reply") {
      const view=dialogs.current();if(view?.kind!=="confirmation")return;dialogs.close();await call("confirmation-reply",{id:view.id,response:Number(data.response)});
    } else if (action === "use-login") {
      const generation=dialogs.generation();const saved=await call("login-suggestion",{id:required(data.id)});if(dialogs.generation()===generation)dialogs.update(view=>view.kind==="connect"?{...view,saved}:view);
    } else if (action === "forget-logins") { await call("forget-login-suggestions");dialogs.update(view=>view.kind==="connect"?{...view,suggestions:[]}:view);
    } else if (action === "update-later") {state.updates=await call("update-later");dialogs.close();render();
    } else if (action === "toggle-sidebar") {
      await setSettings({sidebarCollapsed: !state.settings.sidebarCollapsed});
      $(".sidebar-toggle")?.focus();
    } else if (action === "nav") {
      if (!data.page) return;
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
    } else if (action === "channel-filter") {
      if(data.filter!=="all" && data.filter!=="suggested")return;
      state.channelFilter = data.filter;
      dialogs.update(view=>view.kind==="channels"?{...view,filter:state.channelFilter}:view);
    } else if (action === "connect") connectionModal();
    else if (action === "reconnect") await connect({});
    else if ((action==="update-check" || action==="update-download" || action==="update-install")) {if(action === "update-check"){if(state.updateChecking)return;state.updateChecking=true;render();}try{state.updates=await call(action);render();}catch(error){if(dialogs.current()?.kind==="update")dialogs.update(view=>view.kind==="update"?{...view,error:friendlyError(error instanceof Error ? error.message : String(error))}:view);else throw error;}finally{state.updateChecking=false;render();}}
    else if (action === "watch-series") {
      if(!state.catalogue)return;
      const channelId=state.catalogue.channel.id;
      const watches=await call("watch-list");const watch=watches.find(w=>w.channel.id===channelId && w.mode===state.mode);
      dialogs.show({kind:"watch",mode:state.mode,watch});
    } else if (action === "find-missing") {
      if(!state.catalogue)return;
      if(!state.demo) state.jobs=await call("find-missing",{mode:state.mode});
      const missing: LibraryItem[]=missingEpisodes(chosen(state),state.jobs,state.catalogue.channel.id,state.mode).filter((item: LibraryItem)=>item.season===state.season);
      state.selected=new Set(missing.map(item=>item.id));render();toast(`${missing.length} files selected to fill gaps in this season. Compares app-managed saved files.`);
    } else if (action === "subscription-help") {
      const choices=await call("subscription-choices");
      dialogs.show({kind:"subscriptions",choices});
    } else if (action === "choose-series") await chooseSeries();
    else if (action === "refresh-channels") {
      if (!state.demo) state.channels = await call("channels");
      dialogs.update(view=>view.kind==="channels"?{...view,channels:state.channels}:view);
    } else if (action === "discover") {
      discovery.showSearch();
    } else if (action === "discovery-source") {
      await discovery.run("discovery-source");
    } else if (action === "discovery-group") {
      await discovery.run("discovery-source",{groupId:data.choice});
    } else if (action === "discovery-follow") {
      await discovery.run("discovery-follow",{id:required(data.choice)});
    } else if (action === "discovery-join") {
      await discovery.run("discovery-join",{id:required(data.choice)});
    } else if (action === "scan-channel") await scan(required(data.channel));
    else if (action === "rescan") {if(state.catalogue)await scan(state.catalogue.channel.id);}
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
      if(!data.mode)return;
      state.settings = await call("choose-folder", { mode: data.mode });
      render();
    } else if (action === "download") {
      if(!state.catalogue)return;
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
    toast(error instanceof Error ? error.message : String(error), true);
  }
}
async function dispatchForm(submission: DialogSubmission) {
  const {form,values}=submission;
  try {
    if(form==="discovery-link-form")await discovery.run("discovery-open-message",{link:values.link});
    else if(form==="discovery-form")await discovery.run("discovery-search",{query:values.query,sourceId:values.sourceId});
    else if(form==="watch-form"){
      await call("watch-set",{mode:state.mode,quality:effectiveQuality(state),automatic:values.watchMode==="off"?null:values.watchMode==="auto"});dialogs.close();toast("Series watch saved.");
    } else if(form==="subscriptions-form")await discovery.run("complete-subscriptions",{ids:values.ids});
    else if(form==="connect-form")await connect(values);
    else if(form==="auth-form"){
      if(dialogs.current()?.kind!=="auth")return;
      dialogs.show({kind:"message",title:"Verifying...",message:"Waiting for Telegram."});
      await call("auth-reply",{id:values.id,value:values.value});
    }
  } catch(error){dialogs.close();toast(error instanceof Error ? error.message : String(error),true);}
}
async function initialize() {
if (window.shelf) {
  unsubscribe = subscribe(({ type, data }) => {
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
      $("#auth-form input")?.focus();
    }
  }, error => toast(error.message,true));
  try {
    Object.assign(state, await call("bootstrap"));
    state.season = chosen(state)[0]?.season || 1;
    render();
    if (state.firstRun) showGuide();
    if (state.connectionError) toast("Saved session could not reconnect. Use Connect Telegram to retry.", true);
  } catch (error) {
    render();
    toast(error instanceof Error ? error.message : String(error), true);
  }
} else startDemo();
}
export const ready = initialize();
