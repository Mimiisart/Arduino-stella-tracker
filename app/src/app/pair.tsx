import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { FoundDevice } from '@/ble/minitag-client';
import { useMiniTag } from '@/ble/minitag-context';
import { Button, Card } from '@/components/minitag/ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PairScreen() {
  const tag = useMiniTag();
  const theme = useTheme();
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [scanRunning, setScanRunning] = useState(true); // the first scan starts on mount
  const [selected, setSelected] = useState<FoundDevice | null>(null);
  const [name, setName] = useState('School ID');
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const scanning = scanRunning && tag.bluetooth === 'on';
  const { scan } = tag;

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
    setSelected(null);
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

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tag.bluetooth !== 'on' && (
        <Card>
          <ThemedText type="smallBold">
            {tag.bluetooth === 'unauthorized'
              ? 'Allow Bluetooth for MiniTag in Settings, then come back.'
              : tag.bluetooth === 'off'
                ? 'Turn Bluetooth on to find your MiniTag.'
                : 'Waiting for Bluetooth…'}
          </ThemedText>
        </Card>
      )}

      <ThemedText type="smallBold">1. Choose your tracker</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Make sure the MiniTag is powered on and close to your phone.
      </ThemedText>

      <Card>
        {found.length === 0 && (
          <View style={styles.emptyRow}>
            {scanning && <ActivityIndicator />}
            <ThemedText type="small" themeColor="textSecondary">
              {scanning ? 'Searching for MiniTag…' : 'No MiniTag found.'}
            </ThemedText>
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
              onPress={() => setSelected(d)}
              style={[
                styles.deviceRow,
                { borderColor: isSelected ? theme.accent : theme.backgroundSelected },
              ]}>
              <ThemedText type="smallBold">{d.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Signal: {signalLabel(d.rssi)}
              </ThemedText>
            </Pressable>
          );
        })}
        {!scanning && (
          <Button title="Search again" variant="secondary" onPress={searchAgain} disabled={tag.bluetooth !== 'on'} />
        )}
      </Card>

      <ThemedText type="smallBold">2. Name it</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="School ID"
        placeholderTextColor={theme.textSecondary}
        maxLength={30}
        accessibilityLabel="Tracker name"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}

      <Button title="Connect" onPress={pair} disabled={!selected} loading={pairing} large />
    </ScrollView>
  );
}

function signalLabel(rssi: number | null): string {
  if (rssi == null) return 'unknown';
  if (rssi >= -60) return 'strong';
  if (rssi >= -80) return 'good';
  return 'weak';
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48 },
  deviceRow: {
    borderWidth: 2,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
