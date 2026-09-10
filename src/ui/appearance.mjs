import { cleanAppearance, contrastInk } from "../core/appearance.mjs";

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

export function appearanceForm(settings) {
  const value = cleanAppearance(settings.appearance);
  return `<form id="appearance-form" class="keyword-settings"><h3>Typography and colours</h3>
    <p>Changes preview immediately. Apply to save them across the app.</p>
    <div class="appearance-grid">
    <label>Text size<select name="size">${[90,100,110,120].map(size => `<option value="${size}" ${value.size === size ? "selected" : ""}>${size}%</option>`).join("")}</select></label>
    <label>Text weight<select name="weight">${[[400,"Regular"],[500,"Medium"],[600,"Semibold"]].map(([weight,label]) => `<option value="${weight}" ${value.weight === weight ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <label>Accent colour<input name="accent" type="color" value="${value.accent || "#a0e4c6"}"><span><input name="autoAccent" type="checkbox" ${value.accent ? "" : "checked"}> Automatic</span></label>
    <label>Text colour<input name="text" type="color" value="${value.text || "#edf0ef"}"><span><input name="autoText" type="checkbox" ${value.text ? "" : "checked"}> Automatic</span></label>
    </div><div class="row-actions"><button class="button primary" type="submit">Apply appearance</button><button class="button secondary" data-action="reset-appearance" type="button">Reset appearance</button></div>
    <p>Custom text colour applies to both themes. Reset restores readable defaults.</p></form>`;
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
