import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FoundDevice } from '@/ble/minitag-client';
import { useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, IconTile, Radar, T } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { STATUS, type Palette } from '@/theme/themes';

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
      setError(e instanceof Error ? e.message : 'Could not connect to MiniTag.');
    } finally {
      setPairing(false);
    }
  };

  const btProblem =
    tag.bluetooth === 'off'
      ? 'Turn on Bluetooth in Control Centre to find your MiniTag.'
      : tag.bluetooth === 'unauthorized'
        ? 'MiniTag needs Bluetooth access to find your tracker.'
        : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
            <Text style={styles.headerLink}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add MiniTag</Text>
          <View style={styles.headerSide} />
        </View>

        <View>
          <T variant="title">Let&apos;s find your tracker</T>
          <T variant="body" style={{ color: p.muted, marginTop: 8 }}>
            Switch MiniTag on and hold it next to your phone.
          </T>
        </View>

        <View style={styles.radarCard} aria-hidden>
          <Radar size={170} active={scanning} duration={2600} rings={2} ringColor={p.onPrimaryMuted} guideColor={p.primaryGuide}>
            <View style={styles.phoneDot} />
            {found.length > 0 && <View style={styles.tagDot} />}
          </Radar>
        </View>

        {btProblem ? (
          <View style={styles.problem}>
            <T variant="bodyStrong" style={{ fontSize: 15, color: STATUS.dangerInk }}>
              {btProblem}
            </T>
            {tag.bluetooth === 'unauthorized' && (
              <Button title="Open Settings" onPress={() => Linking.openSettings()} style={styles.smallButton} />
            )}
          </View>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Trackers found" style={{ gap: 10 }}>
            {found.length === 0 && (
              <View style={styles.searchRow}>
                <T variant="body" style={{ color: p.muted }}>
                  {scanning ? 'Searching for MiniTag…' : 'No MiniTag found. Is it switched on?'}
                </T>
              </View>
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
                  style={[styles.deviceRow, isSelected && styles.deviceRowSelected]}>
                  <IconTile name="person.text.rectangle.fill" />
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{d.name}</T>
                    <T variant="small" style={{ marginTop: 2 }}>
                      Signal: {signalLabel(d.rssi)}
                    </T>
                  </View>
                  <View style={[styles.check, !isSelected && styles.checkEmpty]}>
                    {isSelected && <Icon name="checkmark" size={13} color="#fff" weight="heavy" />}
                  </View>
                </Pressable>
              );
            })}
            {!scanning && <Button title="Search again" variant="outline" onPress={searchAgain} />}
          </View>
        )}

        <View>
          <Text style={styles.inputLabel} nativeID="tagNameLabel">
            Name it
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="School ID"
            placeholderTextColor={p.muted}
            maxLength={30}
            returnKeyType="done"
            accessibilityLabelledBy="tagNameLabel"
            accessibilityLabel="Tracker name"
            style={styles.input}
          />
        </View>

        {error && (
          <T variant="body" style={{ color: STATUS.dangerInk }} accessibilityLiveRegion="assertive">
            {error}
          </T>
        )}

        <Button title="Connect" onPress={pair} disabled={!selected} loading={pairing} />
        <T variant="caption">MiniTag uses Bluetooth to connect, beep and warn you if you leave it behind.</T>
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
  page: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  headerSide: { width: 64, minHeight: 44, justifyContent: 'center' },
  headerLink: { fontFamily: F.bodySemibold, fontSize: 16, color: p.primary },
  headerTitle: { fontFamily: F.bodySemibold, fontSize: 16, color: p.ink },
  radarCard: {
    backgroundColor: p.primary,
    borderRadius: R.hero,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  phoneDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 7,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tagDot: {
    position: 'absolute',
    top: 24,
    right: 22,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: p.accent,
  },
  searchRow: {
    minHeight: 72,
    borderRadius: R.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: p.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  problem: {
    backgroundColor: STATUS.dangerBg,
    borderColor: STATUS.dangerBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  smallButton: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 14 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: R.card,
    borderWidth: 2,
    borderColor: p.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deviceRowSelected: { borderColor: p.primary },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: p.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: { backgroundColor: 'transparent', borderWidth: 2, borderColor: p.inputBorder },
  inputLabel: { fontFamily: F.bodySemibold, fontSize: 13, color: p.muted, marginBottom: 6 },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: p.inputBorder,
    borderRadius: R.tile,
    paddingHorizontal: 16,
    fontFamily: F.bodyMedium,
    fontSize: 17,
    color: p.ink,
    backgroundColor: p.surface,
  },
});
