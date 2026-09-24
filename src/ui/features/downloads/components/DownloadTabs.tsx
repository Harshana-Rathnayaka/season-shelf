import { useRef } from "react";
import type { DownloadTab, DownloadActionHandler } from "../types";

const tabs = [{ id: "ongoing", label: "Ongoing" }, { id: "finished", label: "Finished" }] as const;

export function DownloadTabs({ selected, onAction }: { selected: DownloadTab; onAction: DownloadActionHandler }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="segmented download-tabs" role="tablist" aria-label="Download views">
    {tabs.map((tab, index) => <button key={tab.id} type="button" ref={element => { buttons.current[index] = element; }}
      id={`downloads-tab-${tab.id}`} role="tab" aria-selected={selected === tab.id} aria-controls="downloads-panel"
      tabIndex={selected === tab.id ? 0 : -1} data-action="download-tab" data-tab={tab.id} className={selected === tab.id ? "active" : ""}
      onClick={event => { event.stopPropagation(); void onAction({ action: "download-tab", tab: tab.id }); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        buttons.current[next]?.focus();
        void onAction({ action: "download-tab", tab: tabs[next].id });
      }}>{tab.label}</button>)}
  </div>;
}
