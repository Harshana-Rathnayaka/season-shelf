import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { DialogButton } from "../shared/ui/DialogButton";
import type { DialogCallbacks } from "../shared/ui/dialog-actions";
import { AccountDialog } from "../features/account/AccountDialog";
import type { AccountDialog as AccountView } from "../features/account/dialog-types";
import { DiscoveryDialog } from "../features/discovery/DiscoveryDialog";
import type { DiscoveryDialog as DiscoveryView } from "../features/discovery/dialog-types";
import { SystemDialog, type SystemDialogView } from "../features/settings/SystemDialog";
import { WatchDialog, type WatchDialogView } from "../features/library/WatchDialog";
import { FileDetailsDialog } from "../features/downloads/components/FileDetailsDialog";
import type { DownloadRecord } from "../features/downloads/types";
import { UiProviders } from "../shared/ui/UiProviders";

export type DialogView = AccountView | DiscoveryView | SystemDialogView | WatchDialogView
  | { kind: "file-details"; job: DownloadRecord }
  | { kind: "message"; title: string; message?: string }
  | { kind: "confirmation"; id: string; title: string; message: string; detail: string; buttons: string[] };

type NavigationView = Extract<DialogView, {kind:"channels" | "discovery-search" | "discovery-groups"}>;
const isNavigation = (view:DialogView | null):view is NavigationView =>
  !!view && ["channels","discovery-search","discovery-groups"].includes(view.kind);
const isDiscovery = (view:DialogView) => view.kind === "channels" || view.kind === "subscriptions" || view.kind.startsWith("discovery-");
type Draft = {query?:string;link?:string;linkOpen?:boolean};
interface NavigationFrame {view:NavigationView;scroll:number;listScroll:number}

function Content({ view, ...callbacks }: DialogCallbacks & { view: DialogView }) {
  switch (view.kind) {
    case "connect": case "auth": case "preview": return <AccountDialog view={view} {...callbacks} />;
    case "channels": case "discovery-search": case "discovery-wait": case "discovery-groups": case "discovery-channel": case "discovery-results": case "discovery-error": case "discovery-expired": case "subscriptions": return <DiscoveryDialog view={view} {...callbacks} />;
    case "guide": case "update": case "licenses": return <SystemDialog view={view} onAction={callbacks.onAction} />;
    case "watch": return <WatchDialog view={view} onSubmit={callbacks.onSubmit} />;
    case "file-details": return <FileDetailsDialog job={view.job} onAction={callbacks.onAction} />;
    case "message": return <><h2>{view.title}</h2>{view.message && <p>{view.message}</p>}</>;
    case "confirmation": return <><h2>{view.title}</h2><p>{view.message}</p><p className="confirmation-detail">{view.detail}</p><div className="dialog-actions">{view.buttons.map((label, index) => <DialogButton key={index} label={label} className={`button ${index ? "primary" : "secondary"}`} action="confirmation-reply" data={{ response: String(index) }} onAction={callbacks.onAction} />)}</div></>;
  }
}

export function createDialogs(element: HTMLDialogElement, callbacks: DialogCallbacks) {
  const root = createRoot(element);
  let current: DialogView | null = null;
  let revision = 0;
  const history:NavigationFrame[]=[],drafts=new Map<string,Draft>();
  function capture(view:NavigationView):NavigationFrame {
    const draft:Draft={...drafts.get(view.kind)};
    const input=element.querySelector<HTMLInputElement>("#channel-search, #search-group-filter, #discovery-form input[name=query]");
    if(input)draft.query=input.value;
    if(view.kind === "discovery-search") {
      draft.link=element.querySelector<HTMLInputElement>("#discovery-link-form input[name=link]")?.value || "";
      draft.linkOpen=element.querySelector<HTMLDetailsElement>(".message-link-entry")?.open || false;
    }
    drafts.set(view.kind,draft);
    return {view:{...view,...draft},scroll:element.scrollTop,
      listScroll:element.querySelector<HTMLElement>("#channel-results, .discovery-results")?.scrollTop || 0};
  }
  function focusInput() {element.querySelector<HTMLInputElement>("#channel-search, #discovery-form input[name=query], #search-group-filter")?.focus();}
  function render() {
    const view = current;
    flushSync(() => root.render(view ? <UiProviders><div key={revision} className="dialog-content"><div className="dialog-navigation">{isNavigation(view) && history.length > 0 && <DialogButton label="Back" glyph="arrow" className="text-button dialog-back" action="dialog-back" onAction={callbacks.onAction} />}<DialogButton label="Close dialog" glyph="close" iconOnly className="dialog-close icon-button" action="close-dialog" onAction={callbacks.onAction} /></div><Content view={view} {...callbacks} /></div></UiProviders> : null));
    const heading = element.querySelector("h2");
    if (heading) { heading.id = "dialog-heading"; element.setAttribute("aria-labelledby", heading.id); }
  }
  const cancel = (event: Event) => { event.preventDefault(); void callbacks.onAction("close-dialog"); };
  element.addEventListener("cancel", cancel);
  return {
    current: () => current,
    generation: () => revision,
    show(view: DialogView) {
      if(!current || !isDiscovery(view) || !isDiscovery(current) || view.kind === "channels") {
        history.length=0;drafts.clear();
      } else if(isNavigation(current) && element.open) {
        history.push(capture(current));if(history.length>20)history.shift();
      } else if(isNavigation(view) && current.kind !== "discovery-wait") {
        // Starting setup again after a bot result must not restore a consumed
        // search source or old Telegram controls from the previous request.
        const picker=history.find(frame=>frame.view.kind === "channels");
        history.length=0;if(picker)history.push(picker);
        if(view.kind === "discovery-search") {
          const draft=drafts.get(view.kind);
          if(draft)drafts.set(view.kind,{...draft,link:"",linkOpen:false});
        }
      }
      current = isNavigation(view) ? {...view,...drafts.get(view.kind)} : view;
      revision++;
      render();
      if (!element.open) element.showModal();
      element.scrollTop=0;
      focusInput();
    },
    back() {
      if(!isNavigation(current))return false;
      capture(current);
      const frame=history.pop();if(!frame)return false;
      current={...frame.view,...drafts.get(frame.view.kind)};revision++;render();focusInput();
      element.scrollTop=frame.scroll;
      const list=element.querySelector<HTMLElement>("#channel-results, .discovery-results");
      if(list)list.scrollTop=frame.listScroll;
      return true;
    },
    update(change: (view: DialogView) => DialogView) {
      if (!current || !element.open) return;
      current = change(current);
      render();
    },
    close() { element.close(); current = null; history.length=0;drafts.clear();revision++; render(); },
    dispose() { element.removeEventListener("cancel", cancel); root.unmount(); },
  };
}
