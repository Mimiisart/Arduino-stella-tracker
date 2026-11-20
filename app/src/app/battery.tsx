import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel, type BatteryLevel } from '@/ble/protocol';
import { BatteryBars, Icon, Row, Section, SheetHeader, T, type IconName } from '@/components/minitag/ui';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

const COPY: Record<BatteryLevel, { value: string; title: string; body: string; icon: IconName }> = {
  good: {
    value: 'Good',
    title: 'Battery Is Fine',
    body: 'The coin cell has plenty left. MiTag will tell you here when it gets low.',
    icon: 'battery.100',
  },
  low: {
    value: 'Low',
    title: 'Battery Is Getting Low',
    body: "Replace the coin cell soon so MiTag doesn't switch off when you need it.",
    icon: 'battery.25',
  },
  replace: {
    value: 'Replace',
    title: 'Replace the Battery Now',
    body: 'The coin cell is nearly empty. MiTag may stop working at any moment.',
    icon: 'battery.0',
  },
  usb: {
    value: 'USB power',
    title: 'Running on USB',
    body: "MiTag is powered by its USB cable, so there's no battery level to show right now.",
    icon: 'powerplug.fill',
  },
  unknown: {
    value: 'Unknown',
    title: 'Battery Level Unknown',
    body: 'Connect to your MiTag to read its battery.',
    icon: 'battery.0',
  },
};

const STEPS = [
  'Unplug the USB cable if it is connected.',
  'Slide the old CR2032 coin cell out of the back.',
  'Insert a new one with the + side facing up.',
  'MiTag chirps when it powers on.',
];

export default function BatteryScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const level = batteryLevel(tag.connection === 'connected' ? tag.status : null);
  const copy = COPY[level];
  const voltage = tag.status && tag.status.millivolts > 0 ? `${(tag.status.millivolts / 1000).toFixed(2)} V` : '—';
  const color = level === 'replace' ? p.garnet : level === 'low' ? p.amber : level === 'good' ? p.sage : p.idle;

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}>
      <SheetHeader title="Battery" onDone={() => router.back()} />

      <View style={s.center}>
        <Icon name={copy.icon} size={64} color={color} />
        <T variant="title" accessibilityRole="header" style={s.centerText}>
          {copy.title}
        </T>
        <T variant="small" style={[s.centerText, { maxWidth: 330 }]}>
          {copy.body}
        </T>
      </View>

      <Section footer="MiTag shows a rough level, not a percentage. Coin cells drop quickly near the end.">
        <Row title="Level" value={copy.value} right={<BatteryBars level={level} />} />
        <Row title="Voltage" value={voltage} />
        <Row title="Battery type" value="CR2032" />
      </Section>

      <Section header="How to replace it" footer="Don't power the tag from USB and a battery at the same time.">
        {STEPS.map((step, i) => (
          <Row key={step} icon={`${i + 1}.circle.fill` as IconName} title={step} />
        ))}
      </Section>
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: p.ground },
    center: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    centerText: { textAlign: 'center' },
  });
