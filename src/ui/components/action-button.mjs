import { icon } from "../icons.mjs";
import { escape } from "../format.mjs";

// Callers supply labels and data values, never unescaped button markup.
export function actionButton({action, label, glyph, data = {}, title = label, disabled = false, iconOnly = false, className = "button secondary"}) {
  const attributes = Object.entries(data)
    .map(([key, value]) => `data-${key}="${escape(value)}"`).join(" ");
  return `<button class="${escape(iconOnly ? "icon-button" : className)}"
    data-action="${escape(action)}" ${attributes}
    title="${escape(title)}" aria-label="${escape(label)}" ${disabled ? "disabled" : ""}>
    ${glyph ? icon(glyph) : ""}${iconOnly ? "" : escape(label)}</button>`;
}
