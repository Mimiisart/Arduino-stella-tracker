/**
 * MiniTag type and shape tokens from the design canvas. Colours live in
 * src/theme/themes.ts so people can switch colour themes in Settings.
 */
export const F = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

export const R = {
  hero: 30,
  card: 20,
  section: 24,
  tile: 18,
  button: 20,
  iconTile: 12,
  pill: 999,
} as const;
