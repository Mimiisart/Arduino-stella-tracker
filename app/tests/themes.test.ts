// Every colour theme must keep text readable: WCAG 2 contrast >= 4.5:1 for text,
// >= 3:1 for large icons. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STATUS, THEMES, type Palette } from '../src/theme/themes.ts';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, where it appears]
const pairs = (p: Palette): [string, string, number, string][] => [
  [p.ink, p.ground, 4.5, 'body text on page'],
  [p.ink, p.surface, 4.5, 'body text on cards'],
  [p.muted, p.ground, 4.5, 'secondary text on page'],
  [p.muted, p.surface, 4.5, 'secondary text on cards'],
  [p.primary, p.ground, 4.5, 'links / ghost buttons'],
  [p.primary, p.surface, 4.5, 'selected theme label'],
  [p.onPrimary, p.primary, 4.5, 'primary button text'],
  [p.onPrimaryMuted, p.primary, 4.5, 'secondary text on hero'],
  [p.ink, p.accent, 4.5, 'Stop button text'],
  [p.primary, p.primarySoft, 4.5, 'soft chip text'],
  [p.primary, p.accent, 3, 'hero icon on accent'],
  [p.disabledInk, p.disabledBg, 4.5, 'unavailable action'],
  [STATUS.dangerInk, STATUS.dangerBg, 4.5, 'Bluetooth warning'],
  [STATUS.garnet, p.surface, 4.5, 'Remove tracker'],
];

for (const [id, { palette }] of Object.entries(THEMES)) {
  test(`${id} theme meets contrast targets`, () => {
    for (const [fg, bg, min, where] of pairs(palette)) {
      const ratio = contrast(fg, bg);
      assert.ok(ratio >= min, `${id}: ${where} ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
    }
  });
}
