import { icon } from "../icons.mjs";
import { availableQualities } from "../../core/catalog.mjs";
import { effectiveQuality } from "../models/library.mjs";
export function qualityPicker(state) {
  if (!state.catalogue) return "";
  const options = availableQualities(state.catalogue.items);
  if (!options.length) return '<div class="quality-empty">No verified episode qualities found in this channel.</div>';
  const selected = effectiveQuality(state);
  const codecs = options.find(o => o.resolution === selected.resolution).codecs;
  const preferredResolution = state.quality.resolution ?? (state.mode === "archive" ? 720 : 1080);
  const preferredCodec = state.quality.codec ?? (state.mode === "archive" ? "HEVC" : "any");
  const fallback = selected.resolution !== preferredResolution || (preferredCodec !== "any" && selected.codec !== preferredCodec);
  const chip = (field, value, label) => `<button class="quality-chip" data-action="quality" data-field="${field}" data-value="${value}" aria-pressed="${selected[field] === value}" ${state.busy ? "disabled" : ""}>${label}</button>`;
  return `<div class="quality-toolbar">
    <div class="quality-group" role="group" aria-label="Available resolutions">
    <span class="quality-label">Quality</span>
    <div class="quality-segments">${options.map(o => chip("resolution", o.resolution, o.resolution + "p")).join("")}</div>
    </div>
    <div class="quality-group codec-group" role="group" aria-label="Available codecs">
    <span class="quality-label">Codec</span>
    <div class="quality-segments">${codecs.map(c => chip("codec", c, c === "HEVC" ? "x265" : "x264")).join("")}${codecs.length > 1 ? chip("codec", "any", "Auto") : ""}</div>
    </div>
    <span class="quality-hint" title="Only qualities found in this channel's scanned, valid episode files. Availability may differ by season. Auto prefers HEVC.">From this channel ${icon("info")}</span>
    </div>${fallback ? `<div class="quality-fallback" role="status">Preferred quality unavailable. Showing ${selected.resolution}p &middot; ${selected.codec === "any" ? "Auto codec" : selected.codec}. Review your selection before downloading.</div>` : ""}`;
}
