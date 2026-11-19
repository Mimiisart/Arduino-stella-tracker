import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { FIND_DEFAULT_SECONDS } from '@/ble/protocol';
import { Button, Icon, Radar, T } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { STATUS, type Palette } from '@/theme/themes';

/**
 * Find My ID: sends FIND when opened. While the tag beeps the whole screen
 * turns wine with pulsing rings; Stop works here or from the tag's button.
 */
export default function FindScreen() {
  const p = usePalette();
  const styles = useThemedStyles(makeStyles);
  const tag = useMiniTag();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const connected = tag.connection === 'connected';
  const buzzing = connected && !!tag.status?.buzzing;
  const name = tag.tracker?.name ?? 'MiniTag';

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

  const on = buzzing;
  const fg = on ? p.onPrimary : p.ink;
  const sub = on ? p.onPrimaryMuted : p.muted;

  const headline = !connected ? 'Not connected' : on ? `${name} is beeping` : endedBy ? 'Stopped. Found it?' : 'Ready to beep';
  const detail = !connected
    ? 'Move closer to where you last had it. MiniTag reconnects by itself.'
    : on
      ? 'Follow the sound. Press the button on the tag, or tap Stop, when you find it.'
      : endedBy === 'button'
        ? 'Stopped from the tag. Nice, you found it.'
        : endedBy === 'timeout'
          ? `It stopped after ${FIND_DEFAULT_SECONDS} seconds. Tap Beep again if you still can't see it.`
          : 'Tap Beep again if you still can’t see it.';

  return (
    <View style={[styles.screen, { backgroundColor: on ? p.primary : p.ground, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style={on ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Icon name="chevron.left" size={17} color={fg} weight="semibold" />
          <Text style={[styles.headerText, { color: fg }]}>Home</Text>
        </Pressable>
        <Text style={[styles.headerText, { color: fg }]}>Find My ID</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.center}>
        <Radar
          size={290}
          active={on}
          duration={2400}
          ringColor={on ? p.onPrimaryMuted : p.border}
          guideColor={on ? 'rgba(242,217,217,0.28)' : p.border}>
          <View
            style={[
              styles.core,
              { backgroundColor: on ? p.accent : p.primarySoft },
              on && styles.coreGlow,
            ]}>
            <Icon name="speaker.wave.2.fill" size={52} color={on ? p.primary : p.muted} />
          </View>
        </Radar>

        <View style={{ alignItems: 'center' }}>
          <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.centerText, { color: fg }]}>
            {headline}
          </T>
          <T variant="body" style={[styles.centerText, styles.detail, { color: sub }]}>
            {detail}
          </T>
        </View>
      </View>

      {error && (
        <T variant="body" style={[styles.centerText, { color: on ? p.accent : STATUS.dangerInk, marginBottom: 12 }]} accessibilityLiveRegion="assertive">
          {error}
        </T>
      )}

      {on ? (
        <View style={{ gap: 10 }}>
          <Button title="Stop" variant="accent" loading={busy} onPress={() => run('STOP')} />
          <T variant="small" style={[styles.centerText, { color: p.onPrimaryMuted }]}>
            The tag stops by itself after {FIND_DEFAULT_SECONDS} seconds.
          </T>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button title="Beep again" icon="speaker.wave.2.fill" loading={busy} disabled={!connected} onPress={() => run('FIND')} />
          <Button title="Done" variant="outline" onPress={() => router.back()} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 72, minHeight: 44 },
  headerText: { fontFamily: F.bodySemibold, fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  core: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center' },
  coreGlow: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } },
  centerText: { textAlign: 'center' },
  detail: { marginTop: 10, maxWidth: 310 },
});
