import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FoundDevice } from '@/ble/minitag-client';
import { useMiniTag } from '@/ble/minitag-context';
import { Button, CancelButton, Icon, IconTile, Row, Section, SheetHeader, T } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

export default function PairScreen() {
  const p = usePalette();
  const styles = useThemedStyles(makeStyles);
  const tag = useMiniTag();
  const insets = useSafeAreaInsets();
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [scanRunning, setScanRunning] = useState(true); // the first scan starts on mount
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('School ID');
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const scanning = scanRunning && tag.bluetooth === 'on';
  const { scan } = tag;

  // Pre-select the only tracker found, so most people just tap Connect.
  const selected = found.find((d) => d.id === selectedId) ?? (found.length === 1 ? found[0] : null);

  const beginScan = useCallback(() => {
    stopScan.current?.();
    stopScan.current = scan(
      (d) =>
        setFound((list) => {
          const others = list.filter((x) => x.id !== d.id);
          return [...others, d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        }),
      () => setScanRunning(false),
    );
  }, [scan]);

  // Pairing needs Bluetooth, so start it if Welcome was skipped.
  const { startBluetooth } = tag;
  useEffect(() => {
    startBluetooth();
  }, [startBluetooth]);

  // Scan as soon as Bluetooth is ready; stop when leaving the screen.
  useEffect(() => {
    if (tag.bluetooth === 'on') beginScan();
    return () => stopScan.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag.bluetooth]);

  const searchAgain = () => {
    beginScan(); // stopping any old scan reports "done", so mark running afterwards
    setFound([]);
    setSelectedId(null);
    setError(null);
    setScanRunning(true);
  };

  const pair = async () => {
    if (!selected) return;
    stopScan.current?.();
    setPairing(true);
    setError(null);
    try {
      await tag.pair(selected, name);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to MiTag.');
    } finally {
      setPairing(false);
    }
  };

  const btProblem =
    tag.bluetooth === 'off'
      ? 'Turn on Bluetooth in Control Centre to find your MiTag.'
      : tag.bluetooth === 'unauthorized'
        ? 'MiTag needs Bluetooth access to find your tracker.'
        : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <SheetHeader title="Add MiTag" left={<CancelButton onPress={() => router.back()} />} />

        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Icon name="dot.radiowaves.left.and.right" size={30} color={p.link} />
          </View>
          <T variant="small" style={{ textAlign: 'center' }}>
            Switch MiTag on and hold it next to your phone.
          </T>
        </View>

        {btProblem ? (
          <Section
            footer={tag.bluetooth === 'unauthorized' ? 'Turn on Bluetooth for MiTag in Settings.' : undefined}>
            <Row
              icon="antenna.radiowaves.left.and.right.slash"
              iconColor={p.dangerIcon}
              title={btProblem}
              onPress={tag.bluetooth === 'unauthorized' ? () => Linking.openSettings() : undefined}
            />
          </Section>
        ) : (
          <Section header="Nearby">
            {found.length === 0 && (
              <Row
                title={scanning ? 'Searching…' : 'No MiTag found'}
                subtitle={scanning ? undefined : 'Is it switched on and close by?'}
                right={scanning ? <ActivityIndicator /> : undefined}
              />
            )}
            {found.map((d) => {
              const isSelected = selected?.id === d.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${d.name}, signal ${signalLabel(d.rssi)}`}
                  onPress={() => setSelectedId(d.id)}
                  style={({ pressed }) => [styles.deviceRow, pressed && { backgroundColor: p.disabledBg }]}>
                  <IconTile name="person.text.rectangle.fill" />
                  <View style={styles.flex}>
                    <T variant="body">{d.name}</T>
                    <T variant="small">Signal: {signalLabel(d.rssi)}</T>
                  </View>
                  {isSelected && <Icon name="checkmark" size={17} color={p.link} weight="semibold" />}
                </Pressable>
              );
            })}
            {!scanning && <Row title="Search Again" tinted onPress={searchAgain} />}
          </Section>
        )}

        <Section header="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="School ID"
            placeholderTextColor={p.idle}
            keyboardAppearance={p.mode}
            maxLength={30}
            returnKeyType="done"
            clearButtonMode="while-editing"
            accessibilityLabel="Tracker name"
            style={styles.input}
          />
        </Section>

        {error && (
          <T variant="small" style={{ color: p.dangerInk, marginTop: -16, marginBottom: 16, marginHorizontal: 16 }} accessibilityLiveRegion="assertive">
            {error}
          </T>
        )}

        <Button title="Connect" onPress={pair} disabled={!selected} loading={pairing} />
        <T variant="caption" style={{ marginTop: 10 }}>
          MiTag uses Bluetooth to connect, beep and warn you if you leave it behind.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function signalLabel(rssi: number | null): string {
  if (rssi == null) return 'unknown';
  if (rssi >= -60) return 'strong · right next to you';
  if (rssi >= -80) return 'good';
  return 'weak · move closer';
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { paddingHorizontal: 16, paddingTop: 8 },
    intro: { alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 24, paddingHorizontal: 20 },
    introIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16 },
    input: { minHeight: 44, paddingHorizontal: 16, ...F.body, fontSize: 17, color: p.ink },
  });
