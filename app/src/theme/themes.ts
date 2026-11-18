/**
 * MiniTag colour themes, each in a light and a dark variant. The layout follows
 * iOS (grouped lists, system font), but the colours keep MiniTag's warmth: a
 * tinted ground, a deep primary for the ID card and filled buttons, a soft tint
 * for icon tiles, and a warm cream accent (the Precision button, the card chip).
 *
 * `primary` is a FILL (always carries white text). Where the brand colour is
 * used as text or an icon on the page or a card, use `link` instead: in dark
 * mode it is a lighter shade so it stays readable.
 *
 * Every text pair is contrast-checked in tests/themes.test.ts (>= 4.5:1).
 */

export type ThemeId = 'burgundy' | 'navy' | 'forest' | 'plum';
export type ColorMode = 'light' | 'dark';
export type ModePreference = ColorMode | 'system';

export type Palette = {
  mode: ColorMode;

  ground: string; // page background
  surface: string; // cards
  ink: string; // body text
  muted: string; // secondary text
  border: string;
  divider: string;
  inputBorder: string;

  primary: string; // hero cards, primary buttons (fill)
  link: string; // brand colour as text/icons on ground, surface or primarySoft
  primarySoft: string; // icon tiles, soft chips
  accent: string; // pop colour on primary (Stop button, hero icon)
  onAccent: string; // text on accent (stays dark in both modes)
  onPrimary: string; // text on primary
  onPrimaryMuted: string; // secondary text and rings on primary
  primaryGuide: string; // faint guide rings on primary
  primaryChip: string; // translucent chip on primary

  idle: string; // greyed-out dot / icon
  disabledBg: string;
  disabledInk: string;

  // Status colours: the same meaning in every theme, tuned per mode.
  sage: string; // battery good
  sageDot: string; // "with you" dot
  sageBg: string;
  sageInk: string;
  amber: string; // battery low
  garnet: string; // remove / replace battery
  dangerBg: string;
  dangerBorder: string;
  dangerInk: string;
  dangerIcon: string;
  removeBorder: string;
};

type Base = Omit<Palette, keyof typeof STATUS_LIGHT | 'mode' | 'onPrimary' | 'primaryChip'>;

const STATUS_LIGHT = {
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

const STATUS_DARK = {
  sage: '#6FC197',
  sageDot: '#9AD7B5',
  sageBg: '#1C3327',
  sageInk: '#A9DEC0',
  amber: '#F0A43A',
  garnet: '#FF9A9A',
  dangerBg: '#3A1518',
  dangerBorder: '#6B2A2E',
  dangerInk: '#FFC2BC',
  dangerIcon: '#E0475D',
  removeBorder: '#6B2A2E',
} as const;

function light(base: Base): Palette {
  return { mode: 'light', onPrimary: '#FFFFFF', primaryChip: 'rgba(255,255,255,0.14)', ...STATUS_LIGHT, ...base };
}
function dark(base: Base): Palette {
  return { mode: 'dark', onPrimary: '#FFFFFF', primaryChip: 'rgba(255,255,255,0.14)', ...STATUS_DARK, ...base };
}

export const THEMES: Record<ThemeId, { name: string; light: Palette; dark: Palette }> = {
  burgundy: {
    name: 'Burgundy',
    light: light({
      ground: '#F8F3F1',
      surface: '#FFFFFF',
      ink: '#2A1418',
      muted: '#6E5A5E',
      border: '#E8DCD9',
      divider: '#EFE4E1',
      inputBorder: '#D9C8C4',
      primary: '#8E2F44',
      link: '#8E2F44',
      primarySoft: '#F2E3E2',
      accent: '#EBD3AE',
      onAccent: '#2A1418',
      onPrimaryMuted: '#F2D9D9',
      primaryGuide: 'rgba(242,217,217,0.3)',
      idle: '#8F7B80',
      disabledBg: '#EADFDC',
      disabledInk: '#5A474B',
    }),
    dark: dark({
      ground: '#1A1013',
      surface: '#251719',
      ink: '#F6ECEC',
      muted: '#BFA9AD',
      border: '#3A2629',
      divider: '#2F1F22',
      inputBorder: '#4A3236',
      primary: '#8E2F44',
      link: '#F0A9B7',
      primarySoft: '#3A1C24',
      accent: '#EBD3AE',
      onAccent: '#2A1418',
      onPrimaryMuted: '#F2D9D9',
      primaryGuide: 'rgba(242,217,217,0.3)',
      idle: '#8F7B80',
      disabledBg: '#2E2124',
      disabledInk: '#B8A5A9',
    }),
  },
  navy: {
    name: 'Navy',
    light: light({
      ground: '#F3F5F9',
      surface: '#FFFFFF',
      ink: '#151C2C',
      muted: '#566175',
      border: '#DDE3EC',
      divider: '#E7EBF1',
      inputBorder: '#C8D0DD',
      primary: '#24406E',
      link: '#24406E',
      primarySoft: '#E2E8F3',
      accent: '#F0CD94',
      onAccent: '#151C2C',
      onPrimaryMuted: '#D9E2F0',
      primaryGuide: 'rgba(217,226,240,0.3)',
      idle: '#7D879A',
      disabledBg: '#E1E5EC',
      disabledInk: '#4A5366',
    }),
    dark: dark({
      ground: '#0F141F',
      surface: '#182030',
      ink: '#EDF1F8',
      muted: '#A6B0C2',
      border: '#263248',
      divider: '#1F2A3D',
      inputBorder: '#34425C',
      primary: '#2B4C82',
      link: '#9DBCF0',
      primarySoft: '#1D2B45',
      accent: '#F0CD94',
      onAccent: '#151C2C',
      onPrimaryMuted: '#D9E2F0',
      primaryGuide: 'rgba(217,226,240,0.3)',
      idle: '#7D879A',
      disabledBg: '#1F2735',
      disabledInk: '#A0AABB',
    }),
  },
  forest: {
    name: 'Forest',
    light: light({
      ground: '#F3F6F2',
      surface: '#FFFFFF',
      ink: '#15241B',
      muted: '#55665A',
      border: '#DCE5DC',
      divider: '#E6ECE5',
      inputBorder: '#C7D4C8',
      primary: '#2E5B43',
      link: '#2E5B43',
      primarySoft: '#E1ECE3',
      accent: '#E9D9A6',
      onAccent: '#15241B',
      onPrimaryMuted: '#D8E8DD',
      primaryGuide: 'rgba(216,232,221,0.3)',
      idle: '#7B8C80',
      disabledBg: '#E1E7E0',
      disabledInk: '#4A5A4F',
    }),
    dark: dark({
      ground: '#0F1712',
      surface: '#17221B',
      ink: '#EAF2EC',
      muted: '#A3B5A8',
      border: '#263A2D',
      divider: '#1F3025',
      inputBorder: '#34503E',
      primary: '#2E5B43',
      link: '#96D3AE',
      primarySoft: '#1B3326',
      accent: '#E9D9A6',
      onAccent: '#15241B',
      onPrimaryMuted: '#D8E8DD',
      primaryGuide: 'rgba(216,232,221,0.3)',
      idle: '#7B8C80',
      disabledBg: '#1E2A22',
      disabledInk: '#9EB0A3',
    }),
  },
  plum: {
    name: 'Plum',
    light: light({
      ground: '#F7F3F8',
      surface: '#FFFFFF',
      ink: '#26162C',
      muted: '#6B5A72',
      border: '#E7DDEA',
      divider: '#EEE6F0',
      inputBorder: '#D7C9DB',
      primary: '#5E2B70',
      link: '#5E2B70',
      primarySoft: '#EFE3F3',
      accent: '#F1D0AA',
      onAccent: '#26162C',
      onPrimaryMuted: '#EBDCF1',
      primaryGuide: 'rgba(235,220,241,0.3)',
      idle: '#8D7D93',
      disabledBg: '#E9E1EB',
      disabledInk: '#54465A',
    }),
    dark: dark({
      ground: '#171019',
      surface: '#221825',
      ink: '#F4ECF6',
      muted: '#BCA9C2',
      border: '#382A3D',
      divider: '#2D2131',
      inputBorder: '#4A3851',
      primary: '#6A3380',
      link: '#D7A9EA',
      primarySoft: '#34203D',
      accent: '#F1D0AA',
      onAccent: '#26162C',
      onPrimaryMuted: '#EBDCF1',
      primaryGuide: 'rgba(235,220,241,0.3)',
      idle: '#8D7D93',
      disabledBg: '#2A2030',
      disabledInk: '#B5A6BB',
    }),
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'burgundy';
export const DEFAULT_MODE: ModePreference = 'system';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}

export function isModePreference(value: unknown): value is ModePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
