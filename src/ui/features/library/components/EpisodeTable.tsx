import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { bytes } from "../../../shared/lib/format";
import { visible } from "../selectors";
import type { LibraryState, LibraryItem, LibraryActionHandler } from "../types";

const pad = (value: number | null | undefined) => String(value ?? 0).padStart(2, "0");

function EpisodeRow({ item, selected, unverified, onAction }: { item: LibraryItem; selected: boolean; unverified: boolean; onAction: LibraryActionHandler }) {
  function toggle(event: MouseEvent<HTMLTableRowElement>) {
    event.stopPropagation();
    if ((event.target as Element).closest("input, button, a") || window.getSelection()?.toString()) return;
    void onAction({ action: "select-item", id: item.id, selected: !selected });
  }
  return <tr data-episode-row={item.id} className={selected ? "row-selected" : ""} onClick={toggle}>
    <td className="checkbox-cell"><input type="checkbox" data-episode={item.id} checked={selected}
      aria-label={unverified ? `Select unverified file ${item.filename}` : `Select episode ${item.episode}`}
      onChange={event => { event.stopPropagation(); void onAction({ action: "select-item", id: item.id, selected: event.currentTarget.checked }); }} /></td>
    {unverified ? <td colSpan={2}><span className="source-filename">{item.filename}</span><small>{item.reason}</small></td> : <>
      <td><div className="episode-title" title={item.filename}><span className="episode-number">{pad(item.episode)}</span><div className="episode-copy">
        <strong>{item.title}</strong><span className="source-filename">{item.filename}</span>
        <small>S{pad(item.season)}E{pad(item.episode)}{(item.episodeEnd || 0) > (item.episode || 0) ? `-E${pad(item.episodeEnd)} (combined file)` : ""} <span>·</span> {/webrip/i.test(item.filename) ? "WEBRip" : "Video file"}{item.bitDepth ? <> <span>·</span> {item.bitDepth}-bit</> : null}</small>
      </div></div></td>
      <td><span className="quality-tag">{item.resolution}p</span><span className="codec">{item.codec}</span></td>
    </>}
    <td className="file-size right" title={item.alternatives ? `Smallest of ${item.alternatives + 1} matching files` : "Only matching file"}>{bytes(item.size)}</td>
  </tr>;
}

export function EpisodeTable({ state, onAction }: { state: LibraryState; onAction: LibraryActionHandler }) {
  const items = visible(state);
  const unverified = state.libraryTab === "unverified";
  const selected = items.filter(item => state.selected.has(item.id)).length;
  const selectAll = useRef<HTMLInputElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const view = JSON.stringify([state.catalogue?.channel.id, state.libraryTab, state.season, state.quality, state.mode, state.query]);
  useLayoutEffect(() => { if (pane.current) pane.current.scrollTop = 0; }, [view]);
  useLayoutEffect(() => { if (selectAll.current) selectAll.current.indeterminate = selected > 0 && selected < items.length; }, [selected, items.length]);
  return <div className="episode-table" id="episode-list" ref={pane} role={unverified ? "region" : "tabpanel"}
    aria-labelledby={unverified ? undefined : `season-${state.season}`} aria-label={unverified ? "Unverified files" : undefined} tabIndex={0}>
    <table><thead><tr>
      <th className="checkbox-cell"><input type="checkbox" id="select-all" ref={selectAll} aria-label="Select all visible episodes" checked={!!items.length && selected === items.length}
        onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); void onAction({ action: "select-all", selected: event.currentTarget.checked }); }} /></th>
      <th>{unverified ? "FILE" : "EPISODE"}</th><th>{unverified ? "" : "QUALITY"}</th><th className="right">SIZE</th>
    </tr></thead>
      <tbody className={unverified ? "unverified-files" : undefined}>
        {unverified && <tr className="unverified-description"><td colSpan={4}>Choose files manually. Original names are kept in the Unverified folder.</td></tr>}
        {items.map(item => <EpisodeRow key={item.id} item={item} selected={state.selected.has(item.id)} unverified={unverified} onAction={onAction} />)}
      </tbody>
    </table>
    {!items.length && <div className="empty-inline">No matching episodes here. Try another season or quality mode.</div>}
  </div>;
}
