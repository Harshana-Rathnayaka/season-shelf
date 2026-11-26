import { useState } from "react";
import { channelCategory } from "../../../core/catalog.mjs";
import { Icon } from "../../shared/ui/Icon";
import { DialogButton } from "../../shared/ui/DialogButton";
import type { DialogActionHandler } from "../../shared/ui/dialog-actions";
import type { DiscoveryDialog, Channel } from "./dialog-types";

export function ChannelPicker({ view, onAction }: { view: Extract<DiscoveryDialog, { kind: "channels" }>; onAction: DialogActionHandler }) {
  const [query, setQuery] = useState(view.query || "");
  const category = (channel: Channel) => channel.source === "bot" || channel.id === view.selectedMediaChannel ? "media" : channelCategory(channel.title, view.keywords);
  const hidden = view.channels.filter(channel => category(channel) === "finance").length;
  const channels = view.channels.filter(channel => (view.filter === "all" || category(channel) !== "finance") && channel.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (category(a) === "media" ? 0 : 1) - (category(b) === "media" ? 0 : 1) || a.title.localeCompare(b.title));
  return <><h2>Choose a series source.</h2>
    {!view.demo && !!view.recentSeries?.length && <section className="recent-series" aria-labelledby="recent-series-heading">
      <h3 id="recent-series-heading">Recent series</h3><p>Pick up a series and choose another season. Expired menus can be searched again here.</p>
      <div className="recent-series-list">{view.recentSeries.map(series=><button key={series.id} type="button" className="channel-option" data-action="discovery-resume" data-choice={series.id} onClick={event=>{event.stopPropagation();void onAction('discovery-resume',{choice:series.id});}}>
        <Icon name="film" /><span>{series.title}<small>{series.season!=null ? `Last requested: Season ${series.season}` : 'Previously requested'}{series.resolution ? ` · ${series.resolution}p` : ''}</small><small>Choose another season</small></span><Icon name="arrow" />
      </button>)}</div>
    </section>}
    {!view.demo && <DialogButton label="Search MovieClubFamily" className="button primary full" action="discover" onAction={onAction} />}
    <p>{view.demo ? "Preview uses illustrative sample data." : "Browse up to 300 recent groups, channels and supported MCF bot chats. Choose a helper chat to read its existing episode files."}</p>
    <label className="modal-search"><Icon name="search" /><input id="channel-search" placeholder="Search your channels…" aria-label="Search your channels" value={query} onInput={event => { event.stopPropagation(); setQuery(event.currentTarget.value); }} /></label>
    <div id="channel-filters"><div className="channel-filter-switch" role="group" aria-label="Channel filter">{(["suggested", "all"] as const).map(filter => <button key={filter} type="button" data-action="channel-filter" data-filter={filter} aria-pressed={view.filter === filter} onClick={event => { event.stopPropagation(); void onAction("channel-filter", { filter }); }}>{filter === "suggested" ? "Suggested" : "All channels"}</button>)}</div>
      <p className="filter-explanation">{view.filter === "suggested" ? `${hidden} ${hidden === 1 ? "channel" : "channels"} hidden by keyword matches. Other names stay visible.` : "Joined groups, channels and supported MCF bot chats in your recent list."}</p>
    </div>
    <div id="channel-results">{channels.length ? channels.map(channel => <button key={channel.id} type="button" className="channel-option" data-action="scan-channel" data-channel={channel.id} onClick={event => { event.stopPropagation(); void onAction("scan-channel", { channel: channel.id }); }}><Icon name="film" /><span>{channel.title}{category(channel) === "media" && <small>{channel.source === "bot" ? "MCF bot · Existing episode files" : "Series / movies"}</small>}</span><Icon name="arrow" /></button>) : <p className="channel-empty">No matches in this view. Try All channels or refresh your list.</p>}</div>
    <DialogButton label="Refresh channels" glyph="refresh" className="button secondary full" action="refresh-channels" onAction={onAction} />
  </>;
}
