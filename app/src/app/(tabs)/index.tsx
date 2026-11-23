import { Redirect, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BluetoothAvailability } from '@/ble/minitag-client';
import { ONBOARDED_KEY, useMiniTag } from '@/ble/minitag-context';
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
import { useAppData } from '@/features/app-data';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

export default function HomeScreen() {
  const tag = useMiniTag();
  const data = useAppData();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const [onboarded] = useState(() => !!Storage.getItemSync(ONBOARDED_KEY));

  if (!onboarded && !tag.tracker) return <Redirect href="/welcome" />;

  const alertActive = !!data.leftBehind;

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 12 }]}>
      <View style={s.header}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={alertActive ? 'Left-behind alert, active' : 'Alert settings'}
          onPress={() => (alertActive ? router.push('/alert') : router.navigate('/settings'))}
          style={({ pressed }) => [s.roundButton, pressed && { opacity: 0.7 }]}>
          <Icon name="bell" size={20} />
          {alertActive && <View style={s.bellDot} />}
        </Pressable>
      </View>
      <BluetoothBanner bluetooth={tag.bluetooth} />
      {alertActive && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/alert')} style={s.alertBanner}>
          <Icon name="bell.fill" size={18} color="#fff" />
          <Text style={s.alertBannerText}>You may have left your ID behind</Text>
          <Icon name="chevron.right" size={14} color="#fff" weight="semibold" />
        </Pressable>
      )}
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
            <Icon name="plus" size={30} color={p.link} weight="semibold" />
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

      <View style={{ gap: 4 }}>
        <Benefit icon="speaker.wave.2.fill" text="Make it beep when it's nearby" onPress={() => router.push('/find')} />
        <Benefit icon="bell" text="Get warned if you leave it behind" onPress={() => router.navigate('/settings')} />
        <Benefit icon="mappin.and.ellipse" text="See where you last had it" onPress={() => router.navigate('/map')} />
      </View>
    </>
  );
}

function Benefit({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => [s.benefit, pressed && { backgroundColor: p.primarySoft }]}>
      <View style={s.benefitIcon}>
        <Icon name={icon} size={18} color={p.link} />
      </View>
      <T variant="body" style={{ fontFamily: F.bodyMedium, flex: 1 }}>
        {text}
      </T>
      <Icon name="chevron.right" size={14} color={p.muted} weight="semibold" />
    </Pressable>
  );
}

// ---- Paired tracker ----------------------------------------------------------------

function TrackerHome({ now }: { now: number }) {
  const tag = useMiniTag();
  const data = useAppData();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const name = tag.tracker?.name ?? 'MiniTag';
  const btOff = tag.bluetooth === 'off' || tag.bluetooth === 'unauthorized';
  const nearby = !btOff && (tag.connection === 'connected' || tag.connection === 'connecting');
  const safeCount = data.places.filter((pl) => pl.kind === 'safe').length;
  const lastSeen = data.lastSeen;

  const lastSeenRow = (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.navigate('/map')}
      style={({ pressed }) => [s.lastSeen, pressed && { opacity: 0.85 }]}>
      <View style={s.lastSeenIcon}>
        <Icon name="mappin.and.ellipse" size={21} color={p.link} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.lastSeenTitle} numberOfLines={1}>
          {lastSeen ? `Last seen: ${lastSeen.label}` : 'Last seen map'}
        </Text>
        <Text style={s.lastSeenSub} numberOfLines={1}>
          {[
            lastSeen ? formatWhen(lastSeen.at, now) : 'Nothing saved yet',
            data.prefs.alertsEnabled ? 'alerts on' : 'alerts off',
            `${safeCount} safe place${safeCount === 1 ? '' : 's'}`,
          ].join(' · ')}
        </Text>
      </View>
      <Icon name="chevron.right" size={15} color={p.muted} weight="semibold" />
    </Pressable>
  );

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
            {lastSeen ? ` at ${lastSeen.label}` : ''}
          </T>
        </Card>

        {!btOff && (
          <Card style={s.noteRow}>
            <View style={[s.noteIcon, { backgroundColor: p.sageBg }]}>
              <Icon name="arrow.clockwise" size={18} color={p.sageInk} weight="semibold" />
            </View>
            <T variant="body" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              MiniTag will reconnect by itself when you&apos;re close to it.
            </T>
          </Card>
        )}

        <Button title="Show last seen" icon="mappin.and.ellipse" onPress={() => router.navigate('/map')} />
        <UnavailableAction label="Find My ID · needs a connection" />
      </>
    );
  }

  const connected = tag.connection === 'connected';
  const level = batteryLevel(tag.status);
  const lowBattery = connected && (level === 'low' || level === 'replace');

  return (
    <>
      <View style={s.hero} accessible accessibilityLabel={`${name}, ${connected ? 'connected' : 'connecting'}`}>
        <Chip dot={connected ? p.sageDot : p.accent} label={connected ? 'With you · connected' : 'Connecting…'} />
        <Radar size={200} active ringColor={p.onPrimaryMuted} guideColor={p.primaryGuide}>
          <View style={[s.core, s.coreGlow, { width: 88, height: 88, backgroundColor: p.accent }]}>
            <Icon name="person.text.rectangle.fill" size={42} color={p.primary} />
          </View>
        </Radar>
        <T variant="display" numberOfLines={1} adjustsFontSizeToFit style={{ color: p.onPrimary, textAlign: 'center' }}>
          {name}
        </T>
      </View>

      {lowBattery && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/battery')} style={s.batteryBanner}>
          <Icon name="battery.25" size={20} color={p.onAccent} />
          <Text style={s.batteryBannerText}>
            {level === 'replace' ? 'Replace the battery now' : 'Battery is getting low'}
          </Text>
          <Icon name="chevron.right" size={14} color={p.onAccent} weight="semibold" />
        </Pressable>
      )}

      <View style={s.stats}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Battery: ${BATTERY_LABEL[level]}`}
          accessibilityHint="Opens battery details"
          onPress={() => router.push('/battery')}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
          <StatTile label="Battery" value={BATTERY_LABEL[level]} leading={<BatteryBars level={level} />} />
        </Pressable>
        <StatTile label="Connected" value={connected ? 'Now' : '…'} />
        <StatTile label="Firmware" value={tag.status?.firmware ?? '—'} />
      </View>

      <View style={s.actions}>
        <Button
          title="Find My ID"
          icon="speaker.wave.2.fill"
          disabled={!connected}
          onPress={() => router.push('/find')}
          accessibilityHint="Makes your MiniTag beep so you can find it"
          style={{ flex: 1.5 }}
        />
        <Button title="Precision" icon="scope" variant="accent" onPress={() => router.push('/precision')} style={{ flex: 1 }} />
      </View>

      {lastSeenRow}
    </>
  );
}

// ---- Bluetooth problems ------------------------------------------------------------

function BluetoothBanner({ bluetooth }: { bluetooth: BluetoothAvailability }) {
  const p = usePalette();
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
          <T variant="bodyStrong" style={{ fontSize: 15, color: p.dangerInk }}>
            {copy.title}
          </T>
          <T variant="small" style={{ color: p.dangerInk, marginTop: 2 }}>
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
    page: { paddingHorizontal: 20, gap: 14, paddingBottom: 24 },
    header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
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
    bellDot: {
      position: 'absolute',
      top: 9,
      right: 11,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: p.dangerIcon,
      borderWidth: 2,
      borderColor: p.surface,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: '#C2273F',
      borderRadius: R.tile,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    alertBannerText: { fontFamily: F.bodySemibold, fontSize: 15, color: '#fff', flex: 1 },
    core: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    coreGlow: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
    emptyHero: { borderRadius: R.hero, height: 230, alignItems: 'center', justifyContent: 'center' },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      borderRadius: 14,
      paddingHorizontal: 4,
    },
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
    batteryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: p.accent,
      borderRadius: R.tile,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    batteryBannerText: { fontFamily: F.bodySemibold, fontSize: 15, color: p.onAccent, flex: 1 },
    stats: { flexDirection: 'row', gap: 10 },
    actions: { flexDirection: 'row', gap: 10 },
    lastSeen: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: R.card,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 64,
    },
    lastSeenIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lastSeenTitle: { fontFamily: F.bodySemibold, fontSize: 15, color: p.ink },
    lastSeenSub: { fontFamily: F.body, fontSize: 13, color: p.muted, marginTop: 2 },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    noteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    banner: {
      backgroundColor: p.dangerBg,
      borderWidth: 1,
      borderColor: p.dangerBorder,
      borderRadius: 22,
      padding: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    bannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.dangerIcon,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerButton: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 14 },
  });
