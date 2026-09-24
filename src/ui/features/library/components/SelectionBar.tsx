import { bytes } from "../../../shared/lib/format";
import { selectedItems } from "../selectors";
import type { LibraryState, LibraryActionHandler } from "../types";
import { LibraryButton } from "./LibraryButton";

export function SelectionBar({ state, onAction }: { state: LibraryState; onAction: LibraryActionHandler }) {
  const selected = selectedItems(state);
  const noun = state.libraryTab === "unverified" || selected.some(item => item.unverified) ? "file" : "episode";
  return <div className="selection-bar">
    <div><strong>{selected.length} {noun}{selected.length === 1 ? "" : "s"} selected</strong>
      <span>{bytes(selected.reduce((sum, item) => sum + item.size, 0))} total {new Set(selected.map(item => item.season)).size > 1 ? "across seasons" : ""}</span>
    </div>
    <div className="selection-actions">
      <LibraryButton label="Watch series" className="text-button" command={{ action: "watch-series" }} onAction={onAction} />
      <LibraryButton label="Select missing" className="text-button" command={{ action: "find-missing" }} onAction={onAction} hidden={state.libraryTab === "unverified"} />
      <LibraryButton label={state.libraryTab === "unverified" ? "Select visible" : "Select season"} className="text-button" command={{ action: "select-season" }} onAction={onAction} />
      <LibraryButton label={state.demo ? "Preview download queue" : "Download selected"} glyph="download" className="button primary" command={{ action: "download" }} onAction={onAction} disabled={!selected.length || state.busy} />
    </div>
  </div>;
}
