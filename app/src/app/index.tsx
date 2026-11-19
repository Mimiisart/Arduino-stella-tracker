import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import { BATTERY_LABEL, Button, Card, ConnectionPill, InfoRow, formatWhen } from '@/components/minitag/ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const tag = useMiniTag();
  const now = useNow(30_000);

  if (!tag.tracker) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Card>
          <ThemedText type="subtitle">Never lose your ID</ThemedText>
          <ThemedText themeColor="textSecondary">
            Pair the MiniTag on your ID-card holder. You can then make it beep when it&apos;s nearby and
            see where it was last connected.
          </ThemedText>
          <Button title="Set up MiniTag" onPress={() => router.push('/pair')} large />
        </Card>
        <BluetoothNotice bluetooth={tag.bluetooth} />
      </ScrollView>
    );
  }

  const connected = tag.connection === 'connected';
  const lastSeen = connected ? 'Now' : formatWhen(tag.lastConnectedAt, now);

  const confirmForget = () =>
    Alert.alert(`Remove ${tag.tracker?.name}?`, 'You can pair it again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => tag.forget() },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <BluetoothNotice bluetooth={tag.bluetooth} />

      <Card>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.flex}>
            {tag.tracker.name}
          </ThemedText>
        </View>
        <ConnectionPill connection={tag.connection} />
        <View style={styles.rows}>
          <InfoRow label="Last connected" value={lastSeen} />
          <InfoRow label="Battery" value={BATTERY_LABEL[batteryLevel(tag.status)]} />
          {tag.status && <InfoRow label="Firmware" value={tag.status.firmware} />}
        </View>
      </Card>

      <Button
        title="Find My ID"
        large
        disabled={!connected}
        onPress={() => router.push('/find')}
        accessibilityHint="Makes your MiniTag beep so you can find it"
      />
      {!connected && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {tag.connection === 'reconnecting'
            ? 'MiniTag is out of range. It will reconnect when you are close to it.'
            : 'Connecting to MiniTag…'}
        </ThemedText>
      )}

      <Card>
        <ThemedText type="smallBold">Coming next</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Leave-behind alerts, last-seen location, campus map and Precision Find.
        </ThemedText>
      </Card>

      <Button title="Remove tracker" variant="secondary" onPress={confirmForget} />
    </ScrollView>
  );
}

function BluetoothNotice({ bluetooth }: { bluetooth: ReturnType<typeof useMiniTag>['bluetooth'] }) {
  const theme = useTheme();
  const message =
    bluetooth === 'off'
      ? 'Bluetooth is off. Turn it on in Control Centre to use MiniTag.'
      : bluetooth === 'unauthorized'
        ? 'MiniTag needs Bluetooth access. Allow it in Settings › MiniTag.'
        : bluetooth === 'unsupported'
          ? 'This device does not support Bluetooth Low Energy.'
          : null;
  if (!message) return null;
  return (
    <Card style={{ borderColor: theme.danger, borderWidth: 1 }}>
      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        {message}
      </ThemedText>
    </Card>
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

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  rows: { gap: Spacing.two, marginTop: Spacing.one },
  center: { textAlign: 'center' },
});
