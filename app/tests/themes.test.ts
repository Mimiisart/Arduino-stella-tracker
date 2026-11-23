// Every colour theme, light and dark, must keep text readable: WCAG 2 contrast
// >= 4.5:1 for text, >= 3:1 for large icons and selection outlines.
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { THEMES, type Palette } from '../src/theme/themes.ts';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, where it appears]
const pairs = (p: Palette): [string, string, number, string][] => [
  [p.ink, p.ground, 4.5, 'body text on page'],
  [p.ink, p.surface, 4.5, 'body text on cards'],
  [p.muted, p.ground, 4.5, 'secondary text on page'],
  [p.muted, p.surface, 4.5, 'secondary text on cards'],
  [p.link, p.ground, 4.5, 'links / ghost buttons'],
  [p.link, p.surface, 4.5, 'selected theme label'],
  [p.link, p.primarySoft, 4.5, 'soft chip text'],
  [p.link, p.surface, 3, 'selected tracker outline'],
  [p.onPrimary, p.primary, 4.5, 'primary button text'],
  [p.onPrimaryMuted, p.primary, 4.5, 'secondary text on hero'],
  [p.onAccent, p.accent, 4.5, 'Stop button text'],
  [p.primary, p.accent, 3, 'hero icon on accent'],
  [p.disabledInk, p.disabledBg, 4.5, 'unavailable action'],
  [p.dangerInk, p.dangerBg, 4.5, 'Bluetooth warning'],
  [p.sageInk, p.sageBg, 4.5, 'reconnect note icon'],
  [p.garnet, p.surface, 4.5, 'Remove tracker'],
];

for (const [id, theme] of Object.entries(THEMES)) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${id} ${mode} meets contrast targets`, () => {
      const palette = theme[mode];
      assert.equal(palette.mode, mode);
      for (const [fg, bg, min, where] of pairs(palette)) {
        const ratio = contrast(fg, bg);
        assert.ok(ratio >= min, `${id} ${mode}: ${where} ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
      }
    });
  }
}
