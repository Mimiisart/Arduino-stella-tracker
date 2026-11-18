/**
 * MiniTag type and shape tokens. The app uses the iOS system font (San
 * Francisco) and Apple's corner radii so it feels like a native app.
 * Spread a font token into a style: `{ ...F.bodySemibold, fontSize: 17 }`.
 * Colours live in src/theme/themes.ts.
 */
export const F = {
  display: { fontWeight: '700' },
  displayMedium: { fontWeight: '600' },
  body: { fontWeight: '400' },
  bodyMedium: { fontWeight: '500' },
  bodySemibold: { fontWeight: '600' },
} as const;

export const R = {
  hero: 14,
  card: 12, // inset grouped lists
  section: 12,
  tile: 12,
  button: 12,
  iconTile: 7, // Settings-style icon squares
  pill: 999,
} as const;
