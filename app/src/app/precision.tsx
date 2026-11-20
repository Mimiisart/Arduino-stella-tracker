import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, Row, Section, SheetHeader, T } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { describeBearing, usePrecision } from '@/features/precision';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

export default function PrecisionScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const name = tag.tracker?.name ?? 'MiTag';
  const precision = usePrecision(tag.connection === 'connected');

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}>
      <SheetHeader title="Precision Find" onDone={() => router.back()} />

      {precision.kind === 'unavailable' ? (
        <>
          <View style={s.center}>
            <View style={s.circle}>
              <Icon name="location.north.line.fill" size={44} color={p.link} />
            </View>
            <T variant="title" accessibilityRole="header" style={s.centerText}>
              {precision.reason === 'not-connected'
                ? `Connect to ${name} First`
                : precision.reason === 'no-uwb'
                  ? 'Not Available on This iPhone'
                  : 'Coming Soon'}
            </T>
            <T variant="small" style={[s.centerText, { maxWidth: 330 }]}>
              {precision.reason === 'not-connected'
                ? 'Precision Find needs a Bluetooth connection to start. Move closer to where you last had your ID.'
                : precision.reason === 'no-uwb'
                  ? 'It uses Ultra-Wideband (UWB) to show the distance and direction to your tag. iPhone 11 and later have it.'
                  : 'Your iPhone and your MiTag both have Ultra-Wideband (UWB). Showing distance and direction with it is still being built.'}
            </T>
          </View>

          <Section header="Try this instead">
            <Row icon="speaker.wave.2.fill" title="Play Sound" onPress={() => router.replace('/find')} />
            <Row
              icon="map.fill"
              iconColor={p.sage}
              title="Show Last Seen"
              onPress={() => {
                router.back();
                router.navigate('/map');
              }}
            />
          </Section>
        </>
      ) : (
        <>
          <View style={s.center}>
            <T variant="small" style={s.centerText}>
              {precision.kind === 'ranging' ? `Connected to ${name} with UWB` : 'Looking for UWB signal…'}
            </T>
            <View style={{ transform: [{ rotate: `${precision.kind === 'ranging' ? (precision.bearingDeg ?? 0) : 0}deg` }] }}>
              <Icon name="arrow.up" size={150} color={p.link} weight="semibold" />
            </View>
            {precision.kind === 'ranging' && (
              <View style={{ alignItems: 'center' }} accessible accessibilityLiveRegion="polite">
                <Text style={s.distance}>
                  {precision.metres.toFixed(1)}
                  <Text style={[s.distance, { fontSize: 34, color: p.muted }]}> m</Text>
                </Text>
                <Text style={s.direction}>{describeBearing(precision.bearingDeg)}</Text>
                <T variant="small" style={{ marginTop: 4 }}>
                  Walk slowly and keep your phone upright.
                </T>
              </View>
            )}
          </View>
          <Button title="Play Sound as Well" icon="speaker.wave.2.fill" variant="accent" onPress={() => router.replace('/find')} />
        </>
      )}

      <T variant="caption" style={{ marginTop: 4 }}>
        Needs an iPhone with UWB (iPhone 11 or later).
      </T>
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 8 },
    center: { alignItems: 'center', gap: 10, paddingVertical: 28 },
    circle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    centerText: { textAlign: 'center' },
    distance: { ...F.bodySemibold, fontSize: 64, lineHeight: 72, color: p.ink, fontVariant: ['tabular-nums'] },
    direction: { ...F.bodySemibold, fontSize: 20, color: p.ink, marginTop: 4 },
  });
