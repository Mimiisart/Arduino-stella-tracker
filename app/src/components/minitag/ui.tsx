import { ActivityIndicator, Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ConnectionState } from '@/ble/minitag-client';
import type { BatteryLevel } from '@/ble/protocol';

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]} {...rest} />;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
  accessibilityHint?: string;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, large, accessibilityHint }: ButtonProps) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.accent : variant === 'danger' ? theme.danger : theme.backgroundSelected;
  const fg = variant === 'secondary' ? theme.text : theme.onAccent;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        { backgroundColor: bg, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText style={[styles.buttonText, large && styles.buttonTextLarge, { color: fg }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const CONNECTION_LABEL: Record<ConnectionState, { text: string; color: ThemeColor }> = {
  connected: { text: 'Connected', color: 'success' },
  connecting: { text: 'Connecting…', color: 'warning' },
  reconnecting: { text: 'Out of range', color: 'danger' },
  idle: { text: 'Not set up', color: 'textSecondary' },
};

export function ConnectionPill({ connection }: { connection: ConnectionState }) {
  const theme = useTheme();
  const { text, color } = CONNECTION_LABEL[connection];
  return (
    <View
      accessible
      accessibilityLabel={`Connection: ${text}`}
      style={[styles.pill, { borderColor: theme[color] }]}>
      <View style={[styles.dot, { backgroundColor: theme[color] }]} />
      <ThemedText type="smallBold" style={{ color: theme[color] }}>
        {text}
      </ThemedText>
    </View>
  );
}

export const BATTERY_LABEL: Record<BatteryLevel, string> = {
  usb: 'USB power',
  good: 'Good',
  low: 'Low',
  replace: 'Replace battery',
  unknown: '—',
};

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/** "just now", "5 min ago", "2:15 PM", "Mon 9:03 AM". */
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    minHeight: 64,
    borderRadius: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 600,
  },
  buttonTextLarge: {
    fontSize: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
