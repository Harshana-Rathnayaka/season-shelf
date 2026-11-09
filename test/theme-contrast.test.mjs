import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const css = await readFile(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
function luminance(hex) {
  const rgb = hex.slice(1, 7).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a,b) {
  const values = [luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (values[0]+.05)/(values[1]+.05);
}
for (const [selector, declarations] of [...css.matchAll(/(:root[^{}]*)\{([^}]+)\}/g)].map(m=>[m[1].trim(),m[2]])) {
  test(`${selector} default text and semantic foregrounds meet AA contrast`, () => {
    const tokens = Object.fromEntries([...declarations.matchAll(/--([\w-]+):\s*(#[\da-f]+);/gi)].map(m=>[m[1],m[2]]));
    for (const foreground of ['text','secondary','muted','accent','success','warning','danger']) {
      for (const background of ['bg','surface','subtle','sidebar']) {
        const ratio = contrast(tokens[foreground],tokens[background]);
        assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrast(tokens['primary-ink'], tokens.primary) >= 4.5, 'Primary button text');
    assert.ok(contrast(tokens['primary-ink'], tokens['primary-hover']) >= 4.5, 'Hovered primary button text');
  });
}
