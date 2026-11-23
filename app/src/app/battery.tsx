import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel, type BatteryLevel } from '@/ble/protocol';
import { Button, Icon, ScreenHeader } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

const COPY: Record<BatteryLevel, { chip: string; title: string; body: string }> = {
  good: {
    chip: 'Good',
    title: 'Battery is fine',
    body: 'The coin cell has plenty left. MiniTag will tell you here when it gets low.',
  },
  low: {
    chip: 'Low',
    title: 'Battery is getting low',
    body: "Replace the coin cell soon so MiniTag doesn't switch off when you need it.",
  },
  replace: {
    chip: 'Replace',
    title: 'Replace the battery now',
    body: 'The coin cell is nearly empty. MiniTag may stop working at any moment.',
  },
  usb: {
    chip: 'USB power',
    title: 'Running on USB',
    body: "MiniTag is powered by its USB cable, so there's no battery level to show right now.",
  },
  unknown: {
    chip: 'Unknown',
    title: 'Battery level unknown',
    body: 'Connect to your MiniTag to read its battery.',
  },
};

export default function BatteryScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const level = batteryLevel(tag.connection === 'connected' ? tag.status : null);
  const copy = COPY[level];
  const voltage = tag.status && tag.status.millivolts > 0 ? (tag.status.millivolts / 1000).toFixed(2) : null;

  const steps = [
    'Unplug the USB cable if it is connected.',
    'Slide out the old CR2032 coin cell from the back.',
    'Insert a new one with the + side facing up.',
    'MiniTag chirps when it powers on.',
  ];

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <ScreenHeader title="Battery" backLabel="Home" onBack={() => router.back()} />

      <View style={s.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={s.cell} aria-hidden>
            <Icon name="plus" size={18} color={p.primary} weight="bold" />
            <Text style={s.cellText}>CR2032</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.chip}>
              <Text style={s.chipText}>{copy.chip}</Text>
            </View>
            <Text style={s.title} accessibilityRole="header">
              {copy.title}
            </Text>
          </View>
        </View>
        <Text style={s.heroBody}>{copy.body}</Text>
      </View>

      <View style={s.card} accessible accessibilityLabel={`Battery level: ${copy.chip}`}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Segment label="Good" color={p.sage} active={level === 'good'} />
          <Segment label="Low" color={p.amber} active={level === 'low'} />
          <Segment label="Replace" color={p.garnet} active={level === 'replace'} />
        </View>
        <Text style={s.small}>
          MiniTag shows a rough level, not a percentage. Coin cells drop quickly near the end.
          {voltage ? ` Reading now: ${voltage} V.` : ''}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>How to replace it</Text>
        {steps.map((step, i) => (
          <View key={step} style={[s.step, i > 0 && { borderTopWidth: 1, borderTopColor: p.divider }]}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Text style={s.tip}>
        <Text style={{ fontFamily: F.bodySemibold }}>Tip: </Text>
        don&apos;t power the tag from USB and a battery at the same time.
      </Text>

      <Button title="Done" onPress={() => router.back()} />
    </ScrollView>
  );
}

function Segment({ label, color, active }: { label: string; color: string; active: boolean }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.bar, { backgroundColor: color, opacity: active ? 1 : 0.3 }]} />
      <Text style={[s.segLabel, active && s.segLabelActive]}>{active ? `${label} · now` : label}</Text>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 20, gap: 14 },
    hero: { backgroundColor: p.accent, borderRadius: R.hero, padding: 18, gap: 12 },
    cell: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 3,
      borderColor: p.onAccent,
      backgroundColor: '#F8F3F1',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    cellText: { fontFamily: F.bodySemibold, fontSize: 13, color: '#2A1418' },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: p.onAccent,
      borderRadius: R.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: { fontFamily: F.bodySemibold, fontSize: 12, color: '#fff' },
    title: { fontFamily: F.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.8, color: p.onAccent, marginTop: 6 },
    heroBody: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: p.onAccent },
    card: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    bar: { height: 10, borderRadius: 5 },
    segLabel: { fontFamily: F.body, fontSize: 12, color: p.muted, marginTop: 6 },
    segLabelActive: { fontFamily: F.bodySemibold, fontSize: 13, color: p.ink },
    small: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: p.muted },
    cardTitle: { fontFamily: F.bodySemibold, fontSize: 14, color: p.ink },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { fontFamily: F.bodySemibold, fontSize: 13, color: p.link },
    stepText: { fontFamily: F.body, fontSize: 14, color: p.ink, flex: 1 },
    tip: {
      fontFamily: F.body,
      fontSize: 13,
      lineHeight: 19,
      color: p.ink,
      backgroundColor: p.primarySoft,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      overflow: 'hidden',
    },
  });
