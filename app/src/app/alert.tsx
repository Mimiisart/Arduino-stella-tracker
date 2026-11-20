import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, Row, Section, SheetHeader, T } from '@/components/minitag/ui';
import { useAppData } from '@/features/app-data';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import { type Palette } from '@/theme/themes';

/** The left-behind alert, opened from the notification or the Home banner. */
export default function AlertScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const data = useAppData();
  const name = tag.tracker?.name ?? 'MiTag';
  const alert = data.leftBehind;
  const reconnected = tag.connection === 'connected';
  const minutes = useMinutesSince(alert?.since ?? null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const iHaveIt = () => {
    data.dismissAlert();
    close();
  };

  const place = alert && alert.label !== 'Unknown place' ? alert.label : null;
  const when = minutes < 1 ? 'just now' : `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const headline = reconnected ? `${name} Is Back` : `${name} Left Behind?`;
  const body = reconnected
    ? 'MiTag reconnected, so your ID is close by again.'
    : alert
      ? `${name} lost its connection ${when} and hasn't reconnected.`
      : `${name} isn't connected right now.`;

  return (
    <View style={[s.screen, { paddingBottom: insets.bottom + 16 }]}>
      <SheetHeader title="" onDone={close} doneLabel="Close" />

      <View style={s.center}>
        <View style={[s.circle, { backgroundColor: reconnected ? p.sageBg : p.dangerBg }]}>
          <Icon
            name={reconnected ? 'checkmark' : 'bell.fill'}
            size={46}
            color={reconnected ? p.sage : p.dangerIcon}
            weight="semibold"
            animationSpec={reconnected ? undefined : { effect: { type: 'bounce' }, repeating: true }}
          />
        </View>
        <T variant="title" accessibilityRole="header" accessibilityLiveRegion="assertive" style={s.centerText}>
          {headline}
        </T>
        <T variant="small" style={[s.centerText, { maxWidth: 320 }]}>
          {body}
        </T>
      </View>

      {!reconnected && place && (
        <Section header="Last seen">
          <Row icon="mappin" iconColor={p.dangerIcon} title={place} subtitle={when} onPress={() => router.navigate('/map')} />
        </Section>
      )}

      <View style={{ gap: 8 }}>
        {!reconnected && <Button title="Show on Map" icon="map" onPress={() => router.navigate('/map')} />}
        <Button title={reconnected ? 'Done' : 'I Have It'} variant={reconnected ? 'primary' : 'outline'} onPress={iHaveIt} />
        {!reconnected && (
          <Button
            title="Snooze for 1 Hour"
            variant="ghost"
            onPress={() => {
              data.snooze();
              close();
            }}
          />
        )}
      </View>
    </View>
  );
}

function useMinutesSince(since: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  return since ? Math.max(0, Math.floor((now - since) / 60_000)) : 0;
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.ground, paddingHorizontal: 16, paddingTop: 8 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    circle: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    centerText: { textAlign: 'center' },
  });
