import { cleanAppearance, contrastInk } from "../../../core/appearance.mjs";
import type { Settings } from "./types";

export function applyAppearance(settings: Settings) {
  const appearance = cleanAppearance(settings.appearance);
  const style = document.documentElement.style;
  style.setProperty("--font-scale", String(appearance.size / 100));
  style.setProperty("--font-weight", String(appearance.weight));
  style.setProperty("--strong-weight", String(Math.min(700, appearance.weight + 150)));
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

function input(form: HTMLFormElement, name: string): HTMLInputElement {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) throw new Error(`Missing appearance input: ${name}`);
  return field;
}
export function appearanceValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return cleanAppearance({size:Number(data.get("size")),weight:Number(data.get("weight")),
    accent:input(form,"autoAccent").checked ? "" : input(form,"accent").value,
    text:input(form,"autoText").checked ? "" : input(form,"text").value});
}

export function previewAppearance(event: { target: EventTarget | null }, settings: Settings) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return false;
  const form = target.closest<HTMLFormElement>("#appearance-form");
  if (!form || !["size","weight","accent","text","autoAccent","autoText"].includes(target.name)) return false;
  if (["accent","text"].includes(target.name))
    input(form,target.name === "accent" ? "autoAccent" : "autoText").checked = false;
  applyAppearance({...settings,appearance:appearanceValues(form)});
  return true;
}
