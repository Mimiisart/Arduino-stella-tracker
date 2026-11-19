/**
 * MiniTag colour themes. Burgundy is the original canvas design; the others
 * follow the same recipe: a lightly tinted ground, a deep primary, a soft tint
 * of it for icon tiles and chips, and a warm accent that pops on the primary.
 * Every text pair is contrast-checked in tests/themes.test.ts (>= 4.5:1).
 */

export type ThemeId = 'burgundy' | 'navy' | 'forest' | 'plum';

export type Palette = {
  ground: string; // page background
  surface: string; // cards
  ink: string; // body text
  muted: string; // secondary text
  border: string;
  divider: string;
  inputBorder: string;

  primary: string; // hero cards, primary buttons
  primarySoft: string; // icon tiles, soft chips
  accent: string; // pop colour on primary (Stop button, hero icon)
  onPrimary: string; // text on primary
  onPrimaryMuted: string; // secondary text and rings on primary
  primaryGuide: string; // faint guide rings on primary
  primaryChip: string; // translucent chip on primary

  idle: string; // greyed-out dot / icon
  disabledBg: string;
  disabledInk: string;
};

/** Status colours shared by every theme, so "good" and "danger" always mean the same. */
export const STATUS = {
  sage: '#3E7B5C',
  sageDot: '#9AD7B5',
  sageBg: '#E3EEE7',
  sageInk: '#2F5E45',
  amber: '#B26A00',
  garnet: '#9B2235',
  dangerBg: '#FBE4E1',
  dangerBorder: '#F0B8B0',
  dangerInk: '#7A1620',
  dangerIcon: '#C2273F',
  removeBorder: '#E6B9B9',
} as const;

const onPrimaryOverlays = {
  onPrimary: '#FFFFFF',
  primaryChip: 'rgba(255,255,255,0.14)',
} as const;

export const THEMES: Record<ThemeId, { name: string; palette: Palette }> = {
  burgundy: {
    name: 'Burgundy',
    palette: {
      ground: '#F8F3F1',
      surface: '#FFFFFF',
      ink: '#2A1418',
      muted: '#6E5A5E',
      border: '#E8DCD9',
      divider: '#EFE4E1',
      inputBorder: '#D9C8C4',
      primary: '#8E2F44',
      primarySoft: '#F2E3E2',
      accent: '#EBD3AE',
      onPrimaryMuted: '#F2D9D9',
      primaryGuide: 'rgba(242,217,217,0.3)',
      idle: '#8F7B80',
      disabledBg: '#EADFDC',
      disabledInk: '#5A474B',
      ...onPrimaryOverlays,
    },
  },
  navy: {
    name: 'Navy',
    palette: {
      ground: '#F3F5F9',
      surface: '#FFFFFF',
      ink: '#151C2C',
      muted: '#566175',
      border: '#DDE3EC',
      divider: '#E7EBF1',
      inputBorder: '#C8D0DD',
      primary: '#24406E',
      primarySoft: '#E2E8F3',
      accent: '#F0CD94',
      onPrimaryMuted: '#D9E2F0',
      primaryGuide: 'rgba(217,226,240,0.3)',
      idle: '#7D879A',
      disabledBg: '#E1E5EC',
      disabledInk: '#4A5366',
      ...onPrimaryOverlays,
    },
  },
  forest: {
    name: 'Forest',
    palette: {
      ground: '#F3F6F2',
      surface: '#FFFFFF',
      ink: '#15241B',
      muted: '#55665A',
      border: '#DCE5DC',
      divider: '#E6ECE5',
      inputBorder: '#C7D4C8',
      primary: '#2E5B43',
      primarySoft: '#E1ECE3',
      accent: '#E9D9A6',
      onPrimaryMuted: '#D8E8DD',
      primaryGuide: 'rgba(216,232,221,0.3)',
      idle: '#7B8C80',
      disabledBg: '#E1E7E0',
      disabledInk: '#4A5A4F',
      ...onPrimaryOverlays,
    },
  },
  plum: {
    name: 'Plum',
    palette: {
      ground: '#F7F3F8',
      surface: '#FFFFFF',
      ink: '#26162C',
      muted: '#6B5A72',
      border: '#E7DDEA',
      divider: '#EEE6F0',
      inputBorder: '#D7C9DB',
      primary: '#5E2B70',
      primarySoft: '#EFE3F3',
      accent: '#F1D0AA',
      onPrimaryMuted: '#EBDCF1',
      primaryGuide: 'rgba(235,220,241,0.3)',
      idle: '#8D7D93',
      disabledBg: '#E9E1EB',
      disabledInk: '#54465A',
      ...onPrimaryOverlays,
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'burgundy';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}
