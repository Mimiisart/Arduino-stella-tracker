import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { BatteryLevel } from '@/ble/protocol';
import { F, R } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

// ---- Text --------------------------------------------------------------------

type Variant = 'display' | 'title' | 'body' | 'bodyStrong' | 'small' | 'label' | 'caption';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const p = usePalette();
  const secondary = variant === 'small' || variant === 'label' || variant === 'caption';
  return <Text style={[text[variant], { color: secondary ? p.muted : p.ink }, style]} {...rest} />;
}

const text = StyleSheet.create({
  display: { fontFamily: F.display, fontSize: 40, lineHeight: 42, letterSpacing: -1 },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.9 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: F.bodySemibold, fontSize: 16, lineHeight: 21 },
  small: { fontFamily: F.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: F.bodySemibold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: F.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});

// ---- Icons -------------------------------------------------------------------

export type IconName = SymbolViewProps['name'];

export function Icon({
  name,
  size = 22,
  color,
  weight = 'medium',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  const p = usePalette();
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? p.ink}
      weight={weight}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Rounded soft square holding an icon, used at the start of list rows. */
export function IconTile({ name, size = 40 }: { name: IconName; size?: number }) {
  const p = usePalette();
  return (
    <View style={[shared.center, { width: size, height: size, borderRadius: R.iconTile, backgroundColor: p.primarySoft }]}>
      <Icon name={name} size={size * 0.52} color={p.link} />
    </View>
  );
}

// ---- Brand -------------------------------------------------------------------

export function Logo() {
  const p = usePalette();
  return (
    <View style={shared.logoRow} accessible accessibilityRole="header" accessibilityLabel="MiniTag">
      <View style={[shared.center, shared.logoMark, { backgroundColor: p.primary }]}>
        <Icon name="dot.radiowaves.left.and.right" size={18} color={p.accent} weight="bold" />
      </View>
      <Text style={[shared.logoText, { color: p.ink }]}>MiniTag</Text>
    </View>
  );
}

// ---- Surfaces ----------------------------------------------------------------

export function Card({ style, ...rest }: ViewProps) {
  const p = usePalette();
  return (
    <View
      style={[{ backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: R.card }, style]}
      {...rest}
    />
  );
}

export function Chip({ label, dot, tone = 'onPrimary' }: { label: string; dot: string; tone?: 'onPrimary' | 'soft' }) {
  const p = usePalette();
  const onPrimary = tone === 'onPrimary';
  return (
    <View style={[shared.chip, { backgroundColor: onPrimary ? p.primaryChip : p.primarySoft }]}>
      <View style={[shared.chipDot, { backgroundColor: dot }]} />
      <Text style={[shared.chipText, { color: onPrimary ? p.onPrimaryMuted : p.link }]}>{label}</Text>
    </View>
  );
}

// ---- Buttons -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'remove';

function buttonColors(p: Palette, v: ButtonVariant) {
  switch (v) {
    case 'primary':
      return { bg: p.primary, fg: p.onPrimary, border: p.primary, icon: p.accent };
    case 'accent':
      return { bg: p.accent, fg: p.onAccent, border: p.accent, icon: p.onAccent };
    case 'outline':
      return { bg: p.surface, fg: p.ink, border: p.border, icon: p.link };
    case 'ghost':
      return { bg: 'transparent', fg: p.link, border: 'transparent', icon: p.link };
    case 'remove':
      return { bg: p.surface, fg: p.garnet, border: p.removeBorder, icon: p.garnet };
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const v = buttonColors(p, variant);
  const inactive = disabled || loading;
  const compact = variant === 'ghost' || variant === 'remove';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        shared.button,
        compact && { minHeight: variant === 'ghost' ? 44 : 50 },
        { backgroundColor: v.bg, borderColor: v.border, opacity: inactive ? 0.5 : 1 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={21} color={v.icon} weight="semibold" />}
          <Text style={[shared.buttonText, { color: v.fg }, compact && { fontSize: 16 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** The greyed pill the design uses for an action that needs a connection. */
export function UnavailableAction({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View
      style={[shared.center, shared.unavailable, { backgroundColor: p.disabledBg }]}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ disabled: true }}>
      <Text style={[shared.unavailableText, { color: p.disabledInk }]}>{label}</Text>
    </View>
  );
}

// ---- Status bits -------------------------------------------------------------

export const BATTERY_LABEL: Record<BatteryLevel, string> = {
  usb: 'USB power',
  good: 'Good',
  low: 'Low',
  replace: 'Replace',
  unknown: '—',
};

export function BatteryBars({ level }: { level: BatteryLevel }) {
  const p = usePalette();
  const filled = level === 'good' || level === 'usb' ? 3 : level === 'low' ? 2 : level === 'replace' ? 1 : 0;
  const color = level === 'replace' ? p.garnet : level === 'low' ? p.amber : p.sage;
  return (
    <View style={shared.bars}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[shared.bar, { backgroundColor: i < filled ? color : p.border }]} />
      ))}
    </View>
  );
}

export function StatTile({ label, value, leading }: { label: string; value: string; leading?: ReactNode }) {
  const s = useThemedStyles(statStyles);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <T variant="small" style={{ fontSize: 12 }}>
        {label}
      </T>
      <View style={s.row}>
        {leading}
        <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

const statStyles = (p: Palette) =>
  StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: R.tile,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  value: { fontFamily: F.bodySemibold, fontSize: 16, color: p.ink, flexShrink: 1 },
  });

// ---- Radar rings -------------------------------------------------------------

/**
 * Concentric "ping" rings from the design. Static guide rings are always
 * drawn; animated rings only when `active` and the user allows motion.
 */
export function Radar({
  size,
  active,
  ringColor,
  guideColor,
  dashed,
  duration = 3000,
  rings = 3,
  children,
}: {
  size: number;
  active: boolean;
  ringColor: string;
  guideColor: string;
  dashed?: boolean;
  duration?: number;
  rings?: number;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const guide: ViewStyle = {
    borderColor: guideColor,
    borderStyle: dashed ? 'dashed' : 'solid',
    borderWidth: dashed ? 2 : 1,
  };
  return (
    <View style={[shared.center, { width: size, height: size }]} aria-hidden>
      <View style={[StyleSheet.absoluteFill, shared.ring, guide]} />
      <View style={[shared.ring, guide, { position: 'absolute', width: size * 0.7, height: size * 0.7 }]} />
      {active &&
        !reduceMotion &&
        Array.from({ length: rings }, (_, i) => (
          <PingRing key={i} color={ringColor} duration={duration} delay={(duration / rings) * i} />
        ))}
      {children}
    </View>
  );
}

function PingRing({ color, duration, delay }: { color: string; duration: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, duration, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - t.value),
    transform: [{ scale: 0.55 + 0.6 * t.value }],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, shared.ring, { borderColor: color, borderWidth: 2 }, style]} />;
}

// ---- Time --------------------------------------------------------------------

/** "Just now", "5 min ago", "2:15 PM", "Mon 9:03 AM". */
export function formatWhen(ts: number | null, now = Date.now()): string {
  if (!ts) return 'Never';
  const diff = now - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`;
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (new Date(now).toDateString() === d.toDateString()) return time;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

const shared = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 34, height: 34, borderRadius: 17 },
  logoText: { fontFamily: F.display, fontSize: 24, letterSpacing: -0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: F.bodySemibold, fontSize: 13 },
  button: {
    minHeight: 58,
    borderRadius: R.button,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { fontFamily: F.bodySemibold, fontSize: 17 },
  unavailable: { minHeight: 54, borderRadius: R.button },
  unavailableText: { fontFamily: F.bodySemibold, fontSize: 16 },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { width: 6, height: 14, borderRadius: 2 },
  ring: { borderRadius: 9999 },
});

// ---- Screen header -------------------------------------------------------------

/** "‹ Home    Title    " row used at the top of pushed and modal screens. */
export function ScreenHeader({
  title,
  backLabel,
  onBack,
  chevron = true,
  color,
  right,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  chevron?: boolean;
  color?: string;
  right?: ReactNode;
}) {
  const p = usePalette();
  const c = color ?? p.link;
  return (
    <View style={header.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} hitSlop={8} style={header.side}>
        {chevron && <Icon name="chevron.left" size={17} color={c} weight="semibold" />}
        <Text style={[header.link, { color: c }]}>{backLabel}</Text>
      </Pressable>
      <Text style={[header.title, { color: color ?? p.ink }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={[header.side, { justifyContent: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const header = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80, minHeight: 44 },
  link: { fontFamily: F.bodySemibold, fontSize: 16 },
  title: { fontFamily: F.bodySemibold, fontSize: 16, flexShrink: 1, textAlign: 'center' },
});

/** A switch styled like the design (wine track, white knob). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      hitSlop={6}
      style={[toggle.track, { backgroundColor: value ? p.primary : p.idle }]}>
      <View style={[toggle.knob, { left: value ? 23 : 3 }]} />
    </Pressable>
  );
}

const toggle = StyleSheet.create({
  track: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
});

/** Tappable row with a soft icon tile, title, subtitle and chevron. */
export function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityHint,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        linkRow.row,
        { backgroundColor: p.surface, borderColor: p.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}>
      <IconTile name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={[linkRow.title, { color: p.ink }]}>{title}</Text>
        {subtitle && <Text style={[linkRow.sub, { color: p.muted }]}>{subtitle}</Text>}
      </View>
      <Icon name="chevron.right" size={15} color={p.muted} weight="semibold" />
    </Pressable>
  );
}

const linkRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: R.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  title: { fontFamily: F.bodySemibold, fontSize: 15 },
  sub: { fontFamily: F.body, fontSize: 13, marginTop: 2 },
});
