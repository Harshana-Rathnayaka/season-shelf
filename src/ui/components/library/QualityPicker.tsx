import { availableQualities } from "../../../core/catalog.mjs";
import { effectiveQuality } from "../../models/library";
import type { LibraryState, LibraryActionHandler, LibraryCommand } from "../../types/library";
import { Icon } from "../Icon";

export function QualityPicker({ state, onAction }: { state: LibraryState; onAction: LibraryActionHandler }) {
  const options: Array<{ resolution: number; codecs: string[] }> = availableQualities(state.catalogue?.items || []);
  if (!options.length) return <div className="quality-empty">No verified episode qualities found in this channel.</div>;
  const selected = effectiveQuality(state);
  const codecs = options.find(option => option.resolution === selected.resolution)?.codecs || [];
  const preferredResolution = state.quality.resolution ?? (state.mode === "archive" ? 720 : 1080);
  const preferredCodec = state.quality.codec ?? (state.mode === "archive" ? "HEVC" : "any");
  const fallback = selected.resolution !== preferredResolution || (preferredCodec !== "any" && selected.codec !== preferredCodec);
  function chip(command: Extract<LibraryCommand, { action: "quality" }>, label: string) {
    return <button key={command.value} type="button" className="quality-chip" data-action="quality" data-field={command.field} data-value={command.value}
      aria-pressed={selected[command.field] === command.value} disabled={state.busy}
      onClick={event => { event.stopPropagation(); event.currentTarget.focus(); void onAction(command); }}>{label}</button>;
  }
  return <>
    <div className="quality-toolbar">
      <div className="quality-group" role="group" aria-label="Available resolutions"><span className="quality-label">Quality</span><div className="quality-segments">
        {options.map(option => chip({ action: "quality", field: "resolution", value: option.resolution }, `${option.resolution}p`))}
      </div></div>
      <div className="quality-group codec-group" role="group" aria-label="Available codecs"><span className="quality-label">Codec</span><div className="quality-segments">
        {codecs.map(codec => chip({ action: "quality", field: "codec", value: codec }, codec === "HEVC" ? "x265" : "x264"))}
        {codecs.length > 1 && chip({ action: "quality", field: "codec", value: "any" }, "Auto")}
      </div></div>
      <span className="quality-hint" title="Only qualities found in this channel's scanned, valid episode files. Availability may differ by season. Auto prefers HEVC.">From this channel <Icon name="info" /></span>
    </div>
    {fallback && <div className="quality-fallback" role="status">Preferred quality unavailable. Showing {selected.resolution}p · {selected.codec === "any" ? "Auto codec" : selected.codec}. Review your selection before downloading.</div>}
  </>;
}
