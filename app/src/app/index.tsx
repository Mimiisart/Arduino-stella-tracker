import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BluetoothAvailability } from '@/ble/minitag-client';
import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import {
  BATTERY_LABEL,
  BatteryBars,
  Button,
  Card,
  Chip,
  Icon,
  Logo,
  Radar,
  StatTile,
  T,
  UnavailableAction,
  formatWhen,
  type IconName,
} from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { STATUS, type Palette } from '@/theme/themes';

export default function HomeScreen() {
  const tag = useMiniTag();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.header}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [s.roundButton, pressed && { opacity: 0.7 }]}>
          <Icon name="slider.horizontal.3" size={20} />
        </Pressable>
      </View>
      <BluetoothBanner bluetooth={tag.bluetooth} />
      {!tag.tracker ? <FirstLaunch /> : <TrackerHome now={now} />}
    </ScrollView>
  );
}

// ---- No tracker yet ------------------------------------------------------------

function FirstLaunch() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <>
      <Card style={s.emptyHero}>
        <Radar size={170} active={false} ringColor={p.border} guideColor={p.inputBorder} dashed>
          <View style={[s.core, { width: 72, height: 72, backgroundColor: p.primarySoft }]}>
            <Icon name="plus" size={30} color={p.primary} weight="semibold" />
          </View>
        </Radar>
      </Card>

      <View>
        <T variant="display">Never lose your ID</T>
        <T variant="body" style={{ color: p.muted, marginTop: 10 }}>
          Pair the MiniTag on your ID-card holder. You can then make it beep when it&apos;s nearby and see
          where it was last connected.
        </T>
      </View>

      <Button title="Set up MiniTag" onPress={() => router.push('/pair')} />

      <View style={{ gap: 10 }}>
        <Benefit icon="speaker.wave.2.fill" text="Make it beep when it's nearby" />
        <Benefit icon="bell" text="Get warned if you leave it behind" />
        <Benefit icon="mappin.and.ellipse" text="See where you last had it" />
      </View>
    </>
  );
}

function Benefit({ icon, text }: { icon: IconName; text: string }) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.benefit}>
      <View style={s.benefitIcon}>
        <Icon name={icon} size={18} color={p.primary} />
      </View>
      <T variant="body" style={{ fontFamily: F.bodyMedium }}>
        {text}
      </T>
    </View>
  );
}

// ---- Paired tracker ----------------------------------------------------------------

function TrackerHome({ now }: { now: number }) {
  const tag = useMiniTag();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const name = tag.tracker?.name ?? 'MiniTag';
  const btOff = tag.bluetooth === 'off' || tag.bluetooth === 'unauthorized';
  const nearby = !btOff && (tag.connection === 'connected' || tag.connection === 'connecting');

  if (!nearby) {
    return (
      <>
        <Card style={s.awayHero}>
          <Chip tone="soft" dot={p.idle} label={btOff ? 'Bluetooth is off' : 'Out of range'} />
          <Radar size={150} active={false} ringColor={p.border} guideColor={p.inputBorder} dashed>
            <View style={[s.core, { width: 72, height: 72, backgroundColor: p.primarySoft }]}>
              <Icon name="person.text.rectangle" size={34} color={p.idle} />
            </View>
          </Radar>
          <T variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center' }}>
            {name}
          </T>
          <T variant="small" style={{ fontSize: 14, textAlign: 'center' }}>
            Last connected {formatWhen(tag.lastConnectedAt, now).toLowerCase()}
          </T>
        </Card>

        {!btOff && (
          <Card style={s.noteRow}>
            <View style={[s.noteIcon, { backgroundColor: STATUS.sageBg }]}>
              <Icon name="arrow.clockwise" size={18} color={STATUS.sageInk} weight="semibold" />
            </View>
            <T variant="body" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              MiniTag will reconnect by itself when you&apos;re close to it.
            </T>
          </Card>
        )}

        <UnavailableAction label="Find My ID · needs a connection" />
      </>
    );
  }

  const connected = tag.connection === 'connected';
  const level = batteryLevel(tag.status);

  return (
    <>
      <View style={s.hero} accessible accessibilityLabel={`${name}, ${connected ? 'connected' : 'connecting'}`}>
        <Chip dot={connected ? STATUS.sageDot : p.accent} label={connected ? 'With you · connected' : 'Connecting…'} />
        <Radar size={200} active ringColor={p.onPrimaryMuted} guideColor={p.primaryGuide}>
          <View style={[s.core, s.coreGlow, { width: 88, height: 88, backgroundColor: p.accent }]}>
            <Icon name="person.text.rectangle.fill" size={42} color={p.primary} />
          </View>
        </Radar>
        <T variant="display" numberOfLines={1} adjustsFontSizeToFit style={{ color: p.onPrimary, textAlign: 'center' }}>
          {name}
        </T>
      </View>

      <View style={s.stats}>
        <StatTile label="Battery" value={BATTERY_LABEL[level]} leading={<BatteryBars level={level} />} />
        <StatTile label="Connected" value={connected ? 'Now' : '…'} />
        <StatTile label="Firmware" value={tag.status?.firmware ?? '—'} />
      </View>

      <Button
        title="Find My ID"
        icon="speaker.wave.2.fill"
        disabled={!connected}
        onPress={() => router.push('/find')}
        accessibilityHint="Makes your MiniTag beep so you can find it"
      />
    </>
  );
}

// ---- Bluetooth problems ------------------------------------------------------------

function BluetoothBanner({ bluetooth }: { bluetooth: BluetoothAvailability }) {
  const s = useThemedStyles(makeStyles);
  const copy =
    bluetooth === 'off'
      ? { title: 'Bluetooth is off', body: 'Turn it on in Control Centre so MiniTag can reconnect.' }
      : bluetooth === 'unauthorized'
        ? { title: 'Bluetooth access is off', body: 'Allow Bluetooth for MiniTag in Settings.' }
        : bluetooth === 'unsupported'
          ? { title: 'Bluetooth not supported', body: 'This device cannot use Bluetooth Low Energy.' }
          : null;
  if (!copy) return null;
  return (
    <View style={s.banner} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={s.bannerIcon}>
          <Icon name="antenna.radiowaves.left.and.right.slash" size={18} color="#fff" weight="semibold" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" style={{ fontSize: 15, color: STATUS.dangerInk }}>
            {copy.title}
          </T>
          <T variant="small" style={{ color: STATUS.dangerInk, marginTop: 2 }}>
            {copy.body}
          </T>
        </View>
      </View>
      {bluetooth === 'unauthorized' && (
        <Button title="Open Settings" onPress={() => Linking.openSettings()} style={s.bannerButton} />
      )}
    </View>
  );
}

/** Re-render periodically so relative times ("5 min ago") stay fresh. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 14 },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  coreGlow: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  emptyHero: { borderRadius: R.hero, height: 230, alignItems: 'center', justifyContent: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: p.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: p.primary,
    borderRadius: R.hero,
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  awayHero: {
    borderRadius: R.hero,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
  },
  stats: { flexDirection: 'row', gap: 10 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  noteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  banner: {
    backgroundColor: STATUS.dangerBg,
    borderWidth: 1,
    borderColor: STATUS.dangerBorder,
    borderRadius: 22,
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: STATUS.dangerIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerButton: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 14 },
  });
