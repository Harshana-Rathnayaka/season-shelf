export const defaultAppearance = Object.freeze({ size: 100, weight: 400, accent: "", text: "" });

export function cleanAppearance(value = {}) {
  const color = (input) => /^#[0-9a-f]{6}$/i.test(input || "") ? input.toLowerCase() : "";
  return {
    size: [90, 100, 110, 120].includes(Number(value?.size)) ? Number(value.size) : 100,
    weight: [400, 500, 600].includes(Number(value?.weight)) ? Number(value.weight) : 400,
    accent: color(value?.accent),
    text: color(value?.text),
  };
}

export function contrastInk(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return luminance > .179 ? "#101113" : "#ffffff";
}
