import { availableSelection, selectEpisodes } from "../../core/catalog.mjs";
import { unverifiedItems } from "../../core/collection.mjs";
export function effectiveQuality(state) {
  return availableSelection(state.catalogue?.items || [], state.mode, state.quality);
}
export function chosen(state) {
  return selectEpisodes(state.catalogue?.items || [], state.mode, effectiveQuality(state));
}
export function visible(state) {
  if (state.libraryTab === "unverified") return unverifiedItems(state.catalogue?.items || []).filter(item => item.filename.toLowerCase().includes(state.query.toLowerCase()));
  return chosen(state).filter(
    (item) =>
      item.season === state.season &&
      `${item.title} ${item.filename}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
}
export function selectedItems(state) {
  return [...chosen(state),...unverifiedItems(state.catalogue?.items || [])].filter((item) => state.selected.has(item.id));
}
