import { Redirect, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BluetoothAvailability } from '@/ble/minitag-client';
import { ONBOARDED_KEY, useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import {
  BATTERY_LABEL,
  BatteryBars,
  Button,
  Card,
  Icon,
  Row,
  Section,
  T,
  formatWhen,
} from '@/components/minitag/ui';
import { TrackerCard } from '@/components/minitag/tracker-card';
import { F } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

export default function HomeScreen() {
  const tag = useMiniTag();
  const data = useAppData();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const now = useNow(30_000);
  const [onboarded] = useState(() => !!Storage.getItemSync(ONBOARDED_KEY));

  if (!onboarded && !tag.tracker) return <Redirect href="/welcome" />;

  const alertActive = !!data.leftBehind;

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={s.page}>
      <View style={s.header}>
        <View style={s.logoRow} accessible accessibilityRole="header" accessibilityLabel="MiTag">
          <View style={s.logoMark}>
            <Icon name="dot.radiowaves.left.and.right" size={18} color={p.accent} weight="bold" />
          </View>
          <Text style={s.logoText}>MiTag</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={alertActive ? 'Left-behind alert, active' : 'Alert settings'}
          onPress={() => (alertActive ? router.push('/alert') : router.navigate('/settings'))}
          style={({ pressed }) => [s.bellButton, pressed && { opacity: 0.6 }]}>
          <Icon name="bell" size={20} color={p.ink} />
          {alertActive && <View style={s.bellDot} />}
        </Pressable>
      </View>
      <BluetoothBanner bluetooth={tag.bluetooth} />
      {alertActive && (
        <Section>
          <Row
            icon="exclamationmark.triangle.fill"
            iconColor={p.dangerIcon}
            title="You may have left your ID behind"
            onPress={() => router.push('/alert')}
          />
        </Section>
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
      <Card style={s.intro}>
        <View style={[s.introIcon, { backgroundColor: p.primarySoft }]}>
          <Icon name="person.text.rectangle" size={34} color={p.link} />
        </View>
        <T variant="title" style={{ textAlign: 'center', fontSize: 22, lineHeight: 28 }}>
          Never lose your ID
        </T>
        <T variant="small" style={{ textAlign: 'center' }}>
          Pair the MiTag on your ID-card holder to make it beep, get warned if you leave it behind, and see where you
          last had it.
        </T>
        <Button title="Set Up MiTag" onPress={() => router.push('/pair')} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      </Card>

      <Section header="What MiTag does">
        <Row icon="speaker.wave.2.fill" title="Play a sound when it's nearby" onPress={() => router.push('/find')} />
        <Row icon="bell.fill" iconColor={p.dangerIcon} title="Warn you if you leave it behind" onPress={() => router.navigate('/settings')} />
        <Row icon="map.fill" iconColor={p.sage} title="Show where you last had it" onPress={() => router.navigate('/map')} />
      </Section>
    </>
  );
}

// ---- Paired tracker ----------------------------------------------------------------

function TrackerHome({ now }: { now: number }) {
  const tag = useMiniTag();
  const data = useAppData();
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const name = tag.tracker?.name ?? 'MiTag';
  const btOff = tag.bluetooth === 'off' || tag.bluetooth === 'unauthorized';
  const connected = !btOff && tag.connection === 'connected';
  const connecting = !btOff && tag.connection === 'connecting';
  const lastSeen = data.lastSeen;
  const level = batteryLevel(tag.status);
  const safeCount = data.places.filter((pl) => pl.kind === 'safe').length;

  const status = connected
    ? { dot: p.sageDot, text: 'With you' }
    : connecting
      ? { dot: p.amber, text: 'Connecting…' }
      : { dot: p.idle, text: btOff ? 'Bluetooth is off' : 'Out of range' };

  return (
    <>
      <TrackerCard
        name={name}
        active={connected || connecting}
        statusDot={status.dot}
        statusText={status.text}
        detail={
          connected
            ? lastSeen
              ? `Here · ${lastSeen.label}`
              : 'Connected now'
            : btOff
              ? 'Turn on Bluetooth to reconnect'
              : `Last connected ${formatWhen(tag.lastConnectedAt, now).toLowerCase()}`
        }
      />
      {!connected && !connecting && !btOff && (
        <T variant="caption" style={s.cardNote}>
          MiTag reconnects by itself when you are close to it.
        </T>
      )}

      {connected ? (
        <View style={s.actions}>
          <Button
            title="Play Sound"
            icon="speaker.wave.2.fill"
            onPress={() => router.push('/find')}
            accessibilityHint="Makes your MiTag beep so you can find it"
            style={{ flex: 1 }}
          />
          <Button title="Precision" icon="scope" variant="accent" onPress={() => router.push('/precision')} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={s.actions}>
          <Button title="Show Last Seen" icon="map" onPress={() => router.navigate('/map')} style={{ flex: 1 }} />
        </View>
      )}

      <Section header="Status">
        <Row
          icon="battery.75"
          iconColor={level === 'replace' ? p.dangerIcon : level === 'low' ? p.amber : p.sage}
          title="Battery"
          value={connected ? BATTERY_LABEL[level] : '—'}
          right={connected ? <BatteryBars level={level} /> : undefined}
          onPress={() => router.push('/battery')}
          accessibilityHint="Opens battery details"
        />
        <Row
          icon="mappin"
          iconColor={p.dangerIcon}
          title="Last seen"
          subtitle={lastSeen ? `${lastSeen.label} · ${formatWhen(lastSeen.at, now)}` : 'Nothing saved yet'}
          onPress={() => router.navigate('/map')}
        />
        <Row
          icon="bell.fill"
          iconColor={p.amber}
          title="Leave-behind alerts"
          value={data.prefs.alertsEnabled ? 'On' : 'Off'}
          onPress={() => router.navigate('/settings')}
        />
        <Row
          icon="house.fill"
          iconColor={p.sage}
          title="Safe places"
          value={String(safeCount)}
          onPress={() => router.navigate('/places')}
        />
      </Section>
    </>
  );
}

// ---- Bluetooth problems ------------------------------------------------------------

function BluetoothBanner({ bluetooth }: { bluetooth: BluetoothAvailability }) {
  const p = usePalette();
  const copy =
    bluetooth === 'off'
      ? { title: 'Bluetooth Is Off', body: 'Turn it on in Control Centre so MiTag can reconnect.' }
      : bluetooth === 'unauthorized'
        ? { title: 'Bluetooth Access Is Off', body: 'Allow Bluetooth for MiTag in Settings.' }
        : bluetooth === 'unsupported'
          ? { title: 'Bluetooth Not Supported', body: 'This device cannot use Bluetooth Low Energy.' }
          : null;
  if (!copy) return null;
  return (
    <Section footer={copy.body}>
      <Row
        icon="antenna.radiowaves.left.and.right.slash"
        iconColor={p.dangerIcon}
        title={copy.title}
        onPress={bluetooth === 'unauthorized' ? () => Linking.openSettings() : undefined}
        value={bluetooth === 'unauthorized' ? 'Settings' : undefined}
      />
    </Section>
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
    page: { paddingHorizontal: 16, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 18 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
    logoText: { ...F.display, fontSize: 30, lineHeight: 36, color: p.ink },
    bellButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellDot: {
      position: 'absolute',
      top: 10,
      right: 12,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: p.dangerIcon,
      borderWidth: 2,
      borderColor: p.surface,
    },
    intro: { padding: 20, alignItems: 'center', gap: 8, marginBottom: 28 },
    introIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 28 },
    cardNote: { marginTop: 10, marginBottom: -4 },
  });
