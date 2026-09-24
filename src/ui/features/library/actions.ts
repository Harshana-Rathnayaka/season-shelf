import { chosen, effectiveQuality, visible } from "./selectors";
import type { LibraryCommand, LibraryState } from "./types";

/** Local selection changes; account and disk operations remain in the controller. */
export function updateLibrary(state: LibraryState, command: LibraryCommand): boolean {
  switch (command.action) {
    case "mode":
      state.mode = command.mode;
      state.quality = {};
      state.selected = new Set();
      state.query = "";
      break;
    case "quality":
      state.quality = { ...effectiveQuality(state), [command.field]: command.value };
      state.selected = new Set();
      break;
    case "season":
      state.season = command.season;
      state.query = "";
      return true;
    case "library-tab": state.libraryTab = command.tab; return true;
    case "search": state.query = command.query; return true;
    case "select-item":
      state.selected = new Set(state.selected);
      if (command.selected) state.selected.add(command.id);
      else state.selected.delete(command.id);
      return true;
    case "select-all":
      state.selected = new Set(state.selected);
      for (const item of visible(state)) {
        if (command.selected) state.selected.add(item.id);
        else state.selected.delete(item.id);
      }
      return true;
    case "select-season":
      state.selected = new Set(state.selected);
      for (const item of state.libraryTab === "unverified" ? visible(state) : chosen(state).filter(item => item.season === state.season)) state.selected.add(item.id);
      return true;
    default: return false;
  }
  const available = chosen(state);
  if (!available.some(item => item.season === state.season)) state.season = available[0]?.season || 1;
  return true;
}
