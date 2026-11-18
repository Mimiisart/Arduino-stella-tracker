import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

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
  // iOS text styles: Large Title, Title 2, Body, Headline, Subheadline, Footnote.
  display: { ...F.display, fontSize: 34, lineHeight: 41 },
  title: { ...F.display, fontSize: 28, lineHeight: 34 },
  body: { ...F.body, fontSize: 17, lineHeight: 22 },
  bodyStrong: { ...F.bodySemibold, fontSize: 17, lineHeight: 22 },
  small: { ...F.body, fontSize: 15, lineHeight: 20 },
  label: { ...F.bodySemibold, fontSize: 13, lineHeight: 18 },
  caption: { ...F.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});

// ---- Icons -------------------------------------------------------------------

export type IconName = SymbolViewProps['name'];

export function Icon({
  name,
  size = 22,
  color,
  weight = 'medium',
  animationSpec,
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
  animationSpec?: SymbolViewProps['animationSpec'];
}) {
  const p = usePalette();
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? p.ink}
      weight={weight}
      animationSpec={animationSpec}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Settings-style rounded square with a white symbol, at the start of list rows. */
export function IconTile({ name, size = 30, color }: { name: IconName; size?: number; color?: string }) {
  const p = usePalette();
  return (
    <View
      style={[
        shared.center,
        { width: size, height: size, borderRadius: size * 0.23, backgroundColor: color ?? p.primary },
      ]}>
      <Icon name={name} size={size * 0.6} color="#FFFFFF" />
    </View>
  );
}

// ---- Surfaces ----------------------------------------------------------------

export function Card({ style, ...rest }: ViewProps) {
  const p = usePalette();
  return (
    <View
      style={[{ backgroundColor: p.surface, borderRadius: R.card, borderCurve: 'continuous' }, style]}
      {...rest}
    />
  );
}

// ---- Buttons -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'remove';

function buttonColors(p: Palette, v: ButtonVariant) {
  switch (v) {
    // iOS button styles: filled, tinted (accent/outline), plain (ghost).
    case 'primary':
      return { bg: p.primary, fg: p.onPrimary, icon: p.onPrimary };
    case 'accent':
      return { bg: p.accent, fg: p.onAccent, icon: p.onAccent };
    case 'outline':
      return { bg: p.primarySoft, fg: p.link, icon: p.link };
    case 'ghost':
      return { bg: 'transparent', fg: p.link, icon: p.link };
    case 'remove':
      return { bg: p.surface, fg: p.garnet, icon: p.garnet };
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
        compact && { minHeight: 44 },
        { backgroundColor: v.bg, opacity: inactive ? 0.4 : 1 },
        pressed && { opacity: 0.6 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={19} color={v.icon} weight="semibold" />}
          <Text style={[shared.buttonText, { color: v.fg }, variant === 'ghost' && F.body]}>{title}</Text>
        </>
      )}
    </Pressable>
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
  button: {
    minHeight: 50,
    borderRadius: R.button,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { ...F.bodySemibold, fontSize: 17 },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { width: 6, height: 14, borderRadius: 2 },
});

// ---- Screen header -------------------------------------------------------------

const header = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80, minHeight: 44 },
  link: { ...F.body, fontSize: 17 },
  title: { ...F.bodySemibold, fontSize: 17, flexShrink: 1, textAlign: 'center' },
});

/** The system switch (UISwitch), tinted with the theme colour. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const p = usePalette();
  return <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: p.primary }} />;
}

// ---- Grouped lists (like the Settings app) -------------------------------------------

/**
 * An inset grouped list section: optional small header above, white rounded
 * group, hairline separators between rows, optional footer note below.
 */
export function Section({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useThemedStyles(listStyles);
  const rows = Children.toArray(children).filter((c) => isValidElement(c) || typeof c === 'string');
  return (
    <View style={[s.section, style]}>
      {header && (
        <Text style={s.header} accessibilityRole="header">
          {header.toUpperCase()}
        </Text>
      )}
      <View style={s.group}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={s.separator} />}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Text style={s.footer}>{footer}</Text> : footer}
    </View>
  );
}

/** One row in a Section: icon square, title (+ subtitle), value on the right, chevron. */
export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  right,
  onPress,
  chevron,
  destructive,
  tinted,
  accessibilityHint,
  accessibilityLabel,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  tinted?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const s = useThemedStyles(listStyles);
  const showChevron = chevron ?? (!!onPress && !destructive && !tinted);
  const titleColor = destructive ? p.garnet : tinted ? p.link : p.ink;
  const label = accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join('. ');
  const content = (
    <>
      {icon && <IconTile name={icon} color={iconColor} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: titleColor }]}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {value !== undefined && (
        <Text style={s.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {right}
      {showChevron && <Icon name="chevron.right" size={14} color={p.idle} weight="semibold" />}
    </>
  );
  if (!onPress) {
    return (
      <View style={s.row} accessible={!right} accessibilityLabel={right ? undefined : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: p.disabledBg }]}>
      {content}
    </Pressable>
  );
}

const listStyles = (p: Palette) =>
  StyleSheet.create({
    section: { marginBottom: 28 },
    header: { ...F.body, fontSize: 13, color: p.muted, marginBottom: 7, marginLeft: 16 },
    footer: { ...F.body, fontSize: 13, lineHeight: 18, color: p.muted, marginTop: 7, marginHorizontal: 16 },
    group: { backgroundColor: p.surface, borderRadius: R.card, borderCurve: 'continuous', overflow: 'hidden' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: p.divider, marginLeft: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingVertical: 11,
      paddingHorizontal: 16,
    },
    title: { ...F.body, fontSize: 17, lineHeight: 22 },
    subtitle: { ...F.body, fontSize: 15, lineHeight: 20, color: p.muted, marginTop: 1 },
    value: { ...F.body, fontSize: 17, color: p.muted, maxWidth: '55%' },
  });

// ---- Large title (tab screens) ---------------------------------------------------------

/** iOS large title at the top of a tab screen, with an optional button on the right. */
export function LargeTitle({ title, right }: { title: string; right?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={largeTitle.row}>
      <Text style={[largeTitle.text, { color: p.ink }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const largeTitle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 14 },
  text: { ...F.display, fontSize: 34, lineHeight: 41, flexShrink: 1 },
});

// ---- Sheet header (modal screens) ---------------------------------------------------------

/** Title in the middle, "Done" on the right (bold), optional action on the left. */
export function SheetHeader({
  title,
  onDone,
  doneLabel = 'Done',
  left,
}: {
  title: string;
  onDone?: () => void;
  doneLabel?: string;
  left?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={header.row}>
      <View style={header.side}>{left}</View>
      <Text style={[header.title, { color: p.ink }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {onDone ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDone}
          hitSlop={8}
          style={({ pressed }) => [header.side, { justifyContent: 'flex-end' }, pressed && { opacity: 0.5 }]}>
          <Text style={[header.link, F.bodySemibold, { color: p.link }]}>{doneLabel}</Text>
        </Pressable>
      ) : (
        <View style={header.side} />
      )}
    </View>
  );
}

/** A plain "Cancel" text button for the left of a SheetHeader. */
export function CancelButton({ onPress, label = 'Cancel' }: { onPress: () => void; label?: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
      <Text style={[header.link, { color: p.link }]}>{label}</Text>
    </Pressable>
  );
}
