import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMiniTag } from '@/ble/minitag-context';
import { FIND_DEFAULT_SECONDS } from '@/ble/protocol';
import { Button, Card } from '@/components/minitag/ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Find My ID: sends FIND when opened, shows whether the buzzer is sounding
 * (from the tag's status flag) and offers Stop.
 */
export default function FindScreen() {
  const tag = useMiniTag();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const connected = tag.connection === 'connected';
  const buzzing = connected && !!tag.status?.buzzing;

  // Why the beeping stopped, if the tag ended it. A new FIND produces an
  // "OK FIND" event, which clears this automatically.
  const endedBy =
    tag.lastEvent?.kind === 'button' ? 'button' : tag.lastEvent?.kind === 'findTimeout' ? 'timeout' : null;

  const run = useCallback(
    async (command: 'FIND' | 'STOP') => {
      setBusy(true);
      setError(null);
      try {
        await tag.send(command, command === 'FIND' ? FIND_DEFAULT_SECONDS : undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [tag],
  );

  // Start beeping as soon as the screen opens.
  useEffect(() => {
    if (connected && !started.current) {
      started.current = true;
      run('FIND');
    }
  }, [connected, run]);

  // Stop the buzzer if the user leaves while it is sounding.
  const buzzingRef = useRef(buzzing);
  useEffect(() => {
    buzzingRef.current = buzzing;
  }, [buzzing]);
  useEffect(
    () => () => {
      if (buzzingRef.current) tag.send('STOP').catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const headline = !connected
    ? 'MiniTag is not connected'
    : buzzing
      ? `${tag.tracker?.name ?? 'MiniTag'} is beeping`
      : 'Not beeping';

  const detail = !connected
    ? 'Move closer to where you last had it. The app reconnects automatically.'
    : buzzing
      ? 'Follow the sound. Press the button on the tag, or tap Stop, when you find it.'
      : endedBy === 'button'
        ? 'Stopped from the tag. Found it!'
        : endedBy === 'timeout'
          ? `Stopped after ${FIND_DEFAULT_SECONDS} seconds.`
          : 'Tap Beep to make it sound.';

  return (
    <View style={styles.container}>
      <Card style={styles.statusCard}>
        <View
          style={[styles.indicator, { backgroundColor: buzzing ? theme.accent : theme.backgroundSelected }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <ThemedText type="subtitle" style={styles.center} accessibilityRole="header" accessibilityLiveRegion="polite">
          {headline}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {detail}
        </ThemedText>
      </Card>

      {error && (
        <ThemedText type="small" style={[styles.center, { color: theme.danger }]} accessibilityLiveRegion="assertive">
          {error}
        </ThemedText>
      )}

      {buzzing ? (
        <Button title="Stop" variant="danger" large loading={busy} onPress={() => run('STOP')} />
      ) : (
        <Button title="Beep" large loading={busy} disabled={!connected} onPress={() => run('FIND')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three, justifyContent: 'center' },
  statusCard: { alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.three },
  indicator: { width: 96, height: 96, borderRadius: 48 },
  center: { textAlign: 'center' },
});
