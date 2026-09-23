import { availableSelection, selectEpisodes } from "../../core/catalog.mjs";
import { unverifiedItems } from "../../core/collection.mjs";
import type { LibraryState, LibraryItem, QualitySelection } from "../types/library";

export function effectiveQuality(state: LibraryState): QualitySelection {
  return availableSelection(state.catalogue?.items || [], state.mode, state.quality);
}
export function chosen(state: LibraryState): LibraryItem[] {
  return selectEpisodes(state.catalogue?.items || [], state.mode, effectiveQuality(state));
}
export function visible(state: LibraryState): LibraryItem[] {
  if (state.libraryTab === "unverified") {
    const items: LibraryItem[] = unverifiedItems(state.catalogue?.items || []);
    return items.filter(item => item.filename.toLowerCase().includes(state.query.toLowerCase()));
  }
  return chosen(state).filter(item => item.season === state.season && `${item.title} ${item.filename}`.toLowerCase().includes(state.query.toLowerCase()));
}
export function selectedItems(state: LibraryState): LibraryItem[] {
  const unverified: LibraryItem[] = unverifiedItems(state.catalogue?.items || []);
  return [...chosen(state), ...unverified].filter(item => state.selected.has(item.id));
}
export function seasonsFor(state: LibraryState): number[] {
  return [...new Set(chosen(state).map(item => item.season).filter((season): season is number => season != null))];
}
