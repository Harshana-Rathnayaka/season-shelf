import { chosen, seasonsFor } from "./selectors";
import type { LibraryState, LibraryActionHandler } from "./types";
import { Icon } from "../../shared/ui/Icon";
import { LibraryButton } from "./components/LibraryButton";
import { QualityPicker } from "./components/QualityPicker";
import { SeasonTabs } from "./components/SeasonTabs";
import { EpisodeTable } from "./components/EpisodeTable";
import { SelectionBar } from "./components/SelectionBar";

interface Props { state: LibraryState; hasDesktop: boolean; onAction: LibraryActionHandler }

export function LibraryPage({ state, hasDesktop, onAction }: Props) {
  const all = chosen(state);
  const seasons = seasonsFor(state);
  const root = state.settings[state.mode === "archive" ? "archiveRoot" : "watchRoot"];
  const needsReview = state.catalogue?.items.filter(item => item.reason).length || 0;
  return <main>
    <section className="page-heading">
      <div><div className="eyebrow">A HOME FOR EVERY EPISODE</div><h1>Your next watch,<br /><span>beautifully organised.</span></h1><p>Pick a series. Choose your quality. We’ll take it from here.</p></div>
      <div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="orbit-core"><Icon name="shelf" /></div><span className="orbit-point point-one" /><span className="orbit-point point-two" /><span className="orbit-caption">COLLECT. WATCH. REPEAT.</span></div>
    </section>
    <div className="library-preferences">
      <div className="mode-switch" role="group" aria-label="Download destination mode">
        {(["archive", "watch"] as const).map(mode => <button key={mode} type="button" data-action="mode" data-mode={mode} aria-pressed={state.mode === mode} className={state.mode === mode ? "active" : ""}
          onClick={event => { event.stopPropagation(); void onAction({ action: "mode", mode }); }}><Icon name={mode === "archive" ? "drive" : "play"} />{mode === "archive" ? "Archive" : "Watch"}</button>)}
      </div><span className="mode-description">{state.mode === "archive" ? "Keep a permanent copy on your HDD" : "A viewing copy in your Watch folder"}</span>
    </div>
    <section className="catalogue-panel library-panel">
      <div className="panel-heading"><div className="panel-title"><span className="series-icon"><Icon name="film" /></span><div>
        <h2>{state.catalogue?.channel.title || "Choose your first series"}</h2>
        <p>{state.catalogue ? <>{seasons.length} {seasons.length === 1 ? "season" : "seasons"} found <span>·</span> {all.length} matching {all.length === 1 ? "episode" : "episodes"}{state.demo && <> <span>·</span> Illustrative sample</>}</> : "Select a Telegram channel to find its episodes"}</p>
      </div></div><div className="row-actions">
        <LibraryButton label="Change series" glyph="folder" command={{ action: "choose-series" }} onAction={onAction} />
        <LibraryButton label="Rescan channel" glyph="refresh" iconOnly command={{ action: "rescan" }} onAction={onAction} disabled={state.busy || !state.catalogue} />
      </div></div>
      {state.busy && <div className="notice" role="status" id="scan-status">Scanning channel metadata…</div>}
      {state.demo && <div className="sample-note"><Icon name="info" /> Sample data lets you explore the interface. No files are downloaded.{hasDesktop && <LibraryButton label="Exit preview" command={{ action: "exit-demo" }} onAction={onAction} />}</div>}
      {state.catalogue?.truncated && <div className="notice">Scan limited to 10,000 messages. Earlier episodes may not be included.</div>}
      {state.catalogue ? <>
        <div className="library-controls">
          <div className="quality-area"><QualityPicker state={state} onAction={onAction} /></div>
          <div className="library-list-switch" role="group" aria-label="File verification">
            {(["verified", "unverified"] as const).map(tab => <button key={tab} type="button" className="text-button" data-action="library-tab" data-tab={tab} aria-pressed={state.libraryTab === tab}
              title={tab === "unverified" ? "Metadata could not be verified. Select files manually to download their original names into Unverified." : undefined}
              onClick={event => { event.stopPropagation(); void onAction({ action: "library-tab", tab }); }}>{tab === "verified" ? "Verified" : "Unverified"} <span>{tab === "verified" ? all.length : needsReview}</span></button>)}
          </div>
          <div className="catalogue-tools" data-unverified={state.libraryTab === "unverified" || undefined}>
            <SeasonTabs key={state.catalogue.channel.id} seasons={seasons} selected={state.season} items={all} onAction={onAction} />
            <label className="table-search"><Icon name="search" /><input id="episode-search" placeholder="Find an episode…" aria-label="Find an episode" value={state.query}
              onInput={event => { event.stopPropagation(); void onAction({ action: "search", query: event.currentTarget.value }); }} /></label>
          </div>
        </div>
        <EpisodeTable state={state} onAction={onAction} />
        <SelectionBar state={state} onAction={onAction} />
      </> : <div className="empty-state"><div className="empty-symbol"><Icon name="shelf" /></div><h3>A tidy collection starts here.</h3><p>Connect your account to browse the series channels you can access.</p><div>
        <LibraryButton label="Connect Telegram" glyph="arrow" className="button primary" command={{ action: "connect" }} onAction={onAction} />
        <LibraryButton label="Explore the interface" className="text-button" command={{ action: "demo" }} onAction={onAction} />
      </div></div>}
    </section>
    <div className="destination-strip"><span className="destination-icon"><Icon name={state.mode === "archive" ? "drive" : "folder"} /></span><div>
      <span className="destination-label">{state.mode === "archive" ? "DOWNLOAD FOLDER" : "WATCH FOLDER"}</span><strong>{root?.path || "Choose a folder before downloading"}</strong>
    </div><span className="destination-hint">{state.mode === "archive" ? "Sorted into season folders" : "Stays separate from your archive"}</span>
      <LibraryButton label={root ? "Change" : "Choose folder"} glyph="arrow" className="text-button" command={{ action: "folder", mode: state.mode }} onAction={onAction} />
    </div>
  </main>;
}
