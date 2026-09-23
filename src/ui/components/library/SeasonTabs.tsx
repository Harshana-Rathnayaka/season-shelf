import { useLayoutEffect, useRef, useState } from "react";
import type { LibraryItem, LibraryActionHandler } from "../../types/library";
import { Icon } from "../Icon";

interface Props { seasons: number[]; selected: number; items: LibraryItem[]; onAction: LibraryActionHandler }

export function SeasonTabs({ seasons, selected, items, onAction }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState({ previous: false, next: false });
  function updateArrows() {
    const el = container.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setArrows({ previous: overflow && el.scrollLeft > 1, next: overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }
  useLayoutEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [seasons.join(",")]);
  function move(direction: number) {
    const el = container.current;
    if (el) el.scrollLeft += direction * Math.max(180, el.clientWidth * 0.75);
    updateArrows();
  }
  function select(season: number) {
    void onAction({ action: "season", season });
    const tab = container.current?.querySelector<HTMLButtonElement>(`#season-${season}`);
    tab?.focus({ preventScroll: true });
    tab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    updateArrows();
  }
  return <div className="season-navigation" data-empty={!seasons.length || undefined}>
    <button type="button" className="icon-button season-prev" data-action="scroll-seasons" data-direction="-1" aria-label="Earlier seasons" disabled={!arrows.previous} onClick={event => { event.stopPropagation(); move(-1); }}><Icon name="chevron" /></button>
    <div className="season-tabs" id="season-tabs" ref={container} role="tablist" aria-label="Seasons" onScroll={updateArrows}>
      {seasons.map((season, index) => <button key={season} type="button" role="tab" aria-controls="episode-list" id={`season-${season}`} tabIndex={selected === season ? 0 : -1} aria-selected={selected === season}
        className={`season-tab ${selected === season ? "active" : ""}`} data-action="season" data-season={season}
        onClick={event => { event.stopPropagation(); select(season); }}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const next = event.key === "Home" ? 0 : event.key === "End" ? seasons.length - 1 : Math.max(0, Math.min(seasons.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
          select(seasons[next]);
        }}>Season {String(season).padStart(2, "0")}<span>{items.filter(item => item.season === season).length}</span></button>)}
    </div>
    <button type="button" className="icon-button season-next" data-action="scroll-seasons" data-direction="1" aria-label="Later seasons" disabled={!arrows.next} onClick={event => { event.stopPropagation(); move(1); }}><Icon name="chevron" /></button>
  </div>;
}
