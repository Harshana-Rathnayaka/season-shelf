import { cleanAppearance, contrastInk } from "../../../core/appearance.mjs";

export function applyAppearance(settings) {
  const appearance = cleanAppearance(settings.appearance);
  const style = document.documentElement.style;
  style.setProperty("--font-scale", appearance.size / 100);
  style.setProperty("--font-weight", appearance.weight);
  style.setProperty("--strong-weight", Math.min(700, appearance.weight + 150));
  for (const name of ["--accent", "--accent-ink", "--accent-soft", "--accent-border", "--row-selected", "--orbit", "--text"])
    style.removeProperty(name);
  if (appearance.accent) {
    style.setProperty("--accent", appearance.accent);
    style.setProperty("--accent-ink", contrastInk(appearance.accent));
    style.setProperty("--accent-soft", appearance.accent + "16");
    style.setProperty("--accent-border", appearance.accent + "88");
    style.setProperty("--row-selected", appearance.accent + "0d");
    style.setProperty("--orbit", appearance.accent + "55");
  }
  if (appearance.text) style.setProperty("--text", appearance.text);
}

export function appearanceValues(form) {
  const fields = form.elements;
  return cleanAppearance({size:fields.namedItem("size").value,weight:fields.namedItem("weight").value,
    accent:fields.namedItem("autoAccent").checked ? "" : fields.namedItem("accent").value,
    text:fields.namedItem("autoText").checked ? "" : fields.namedItem("text").value});
}

export function previewAppearance(event, settings) {
  const form = event.target.closest?.("#appearance-form");
  if (!form || !["size","weight","accent","text","autoAccent","autoText"].includes(event.target.name)) return false;
  if (["accent","text"].includes(event.target.name))
    form.elements.namedItem(event.target.name === "accent" ? "autoAccent" : "autoText").checked = false;
  applyAppearance({...settings,appearance:appearanceValues(form)});
  return true;
}
