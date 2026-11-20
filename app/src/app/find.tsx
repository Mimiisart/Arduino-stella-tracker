import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { FIND_DEFAULT_SECONDS } from '@/ble/protocol';
import { Button, Icon, SheetHeader, T } from '@/components/minitag/ui';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

/**
 * Play Sound (a sheet, like Find My): sends FIND when opened, shows the
 * speaker animating while the tag beeps. Stop works here or from the tag's button.
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
  const name = tag.tracker?.name ?? 'MiTag';

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

  // Start beeping as soon as the sheet opens.
  useEffect(() => {
    if (connected && !started.current) {
      started.current = true;
      run('FIND');
    }
  }, [connected, run]);

  // Stop the buzzer if the user closes the sheet while it is sounding.
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

  const noTracker = !tag.tracker;
  const headline = noTracker
    ? 'Set Up MiTag First'
    : !connected
      ? 'Not Connected'
      : buzzing
        ? 'Playing Sound…'
        : endedBy
          ? 'Sound Stopped'
          : 'Ready';
  const detail = noTracker
    ? 'Pair the MiTag on your ID-card holder. Then you can make it beep and follow the sound.'
    : !connected
      ? 'Move closer to where you last had it. MiTag reconnects by itself.'
      : buzzing
        ? `${name} is beeping. Press the button on the tag, or tap Stop Sound, when you find it.`
        : endedBy === 'button'
          ? 'Stopped from the tag, so you found it.'
          : endedBy === 'timeout'
            ? `It stopped after ${FIND_DEFAULT_SECONDS} seconds. Play it again if you still can't see it.`
            : `Play a sound on ${name} to find it nearby.`;

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 16 }]}>
      <SheetHeader title="Play Sound" onDone={() => router.back()} />

      <View style={styles.center}>
        <View style={[styles.circle, { backgroundColor: buzzing ? p.primary : p.primarySoft }]}>
          <Icon
            name={buzzing ? 'speaker.wave.3.fill' : 'speaker.wave.2.fill'}
            size={50}
            color={buzzing ? p.onPrimary : p.link}
            animationSpec={
              buzzing ? { repeating: true, variableAnimationSpec: { iterative: true, dimInactiveLayers: true } } : undefined
            }
          />
        </View>
        <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.centerText}>
          {headline}
        </T>
        <T variant="small" style={[styles.centerText, styles.detail]}>
          {detail}
        </T>
        {error && (
          <T variant="small" style={[styles.centerText, { color: p.dangerInk }]} accessibilityLiveRegion="assertive">
            {error}
          </T>
        )}
      </View>

      {buzzing ? (
        <Button title="Stop Sound" icon="stop.fill" loading={busy} onPress={() => run('STOP')} />
      ) : noTracker ? (
        <Button title="Set Up MiTag" onPress={() => router.replace('/pair')} />
      ) : (
        <Button
          title="Play Sound"
          icon="speaker.wave.2.fill"
          loading={busy}
          disabled={!connected}
          onPress={() => run('FIND')}
        />
      )}
      {!noTracker && (
        <Button title="Can't Hear It? Try Precision Find" variant="ghost" onPress={() => router.push('/precision')} />
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: 20, paddingTop: 8, backgroundColor: p.ground, gap: 8 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    circle: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    centerText: { textAlign: 'center' },
    detail: { maxWidth: 320 },
  });
