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

export type DialogView = AccountView | DiscoveryView | SystemDialogView | WatchDialogView
  | { kind: "file-details"; job: DownloadRecord }
  | { kind: "message"; title: string; message?: string }
  | { kind: "confirmation"; id: string; title: string; message: string; detail: string; buttons: string[] };

function Content({ view, ...callbacks }: DialogCallbacks & { view: DialogView }) {
  switch (view.kind) {
    case "connect": case "auth": case "preview": return <AccountDialog view={view} {...callbacks} />;
    case "channels": case "discovery-search": case "discovery-wait": case "discovery-groups": case "discovery-channel": case "discovery-results": case "discovery-error": case "subscriptions": return <DiscoveryDialog view={view} {...callbacks} />;
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
  function render() {
    const view = current;
    flushSync(() => root.render(view ? <div key={revision} className="dialog-content"><DialogButton label="Close dialog" glyph="close" iconOnly className="dialog-close icon-button" action="close-dialog" onAction={callbacks.onAction} /><Content view={view} {...callbacks} /></div> : null));
    const heading = element.querySelector("h2");
    if (heading) { heading.id = "dialog-heading"; element.setAttribute("aria-labelledby", heading.id); }
  }
  const cancel = (event: Event) => { event.preventDefault(); void callbacks.onAction("close-dialog"); };
  element.addEventListener("cancel", cancel);
  return {
    current: () => current,
    generation: () => revision,
    show(view: DialogView) {
      current = view;
      revision++;
      render();
      if (!element.open) element.showModal();
    },
    update(change: (view: DialogView) => DialogView) {
      if (!current || !element.open) return;
      current = change(current);
      render();
    },
    close() { element.close(); current = null; revision++; render(); },
    dispose() { element.removeEventListener("cancel", cancel); root.unmount(); },
  };
}
