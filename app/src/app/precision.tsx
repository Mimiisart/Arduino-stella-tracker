import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, LinkRow, Radar, ScreenHeader } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { describeBearing, usePrecision } from '@/features/precision';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

export default function PrecisionScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const name = tag.tracker?.name ?? 'MiniTag';
  const precision = usePrecision(tag.connection === 'connected');

  return (
    <ScrollView
      style={{ backgroundColor: p.primarySoft }}
      contentContainerStyle={[s.page, { paddingTop: 12, paddingBottom: insets.bottom + 24 }]}>
      <ScreenHeader title="Precision Find" backLabel="Close" onBack={() => router.back()} />

      {precision.kind === 'unavailable' ? (
        <>
          <View style={s.center}>
            <View style={s.dial} aria-hidden>
              <View style={[s.ring, { width: 196, height: 196, borderStyle: 'dashed', borderColor: p.inputBorder, borderWidth: 3 }]} />
              <View style={[s.ring, { width: 124, height: 124, borderColor: p.border, borderWidth: 2 }]} />
              <View style={{ transform: [{ rotate: '-20deg' }] }}>
                <Icon name="location.north.fill" size={80} color={p.idle} />
              </View>
              {precision.reason !== 'not-connected' && <View style={[s.slash, { backgroundColor: p.primary }]} />}
            </View>
            <Text style={s.title} accessibilityRole="header">
              {precision.reason === 'not-connected'
                ? `Connect to ${name} first`
                : precision.reason === 'no-uwb'
                  ? "Precision Find isn't available on this phone"
                  : 'Precision Find is on its way'}
            </Text>
            <Text style={s.body}>
              {precision.reason === 'not-connected'
                ? 'Precision Find needs a Bluetooth connection to start. Move closer to where you last had your ID.'
                : precision.reason === 'no-uwb'
                  ? 'It uses Ultra-Wideband (UWB) to show the distance and direction to your tag. Phones like iPhone 11 or later have it.'
                  : 'Your iPhone and your MiniTag both have Ultra-Wideband (UWB). The part of the app that shows distance and direction with it is still being built.'}
            </Text>
          </View>

          <Text style={s.label}>Try this instead</Text>
          <Button title="Make it beep" icon="speaker.wave.2.fill" onPress={() => router.replace('/find')} />
          <LinkRow
            icon="mappin.and.ellipse"
            title="See where you last had it"
            subtitle="Open the last-seen map"
            onPress={() => {
              router.back();
              router.navigate('/map');
            }}
          />
        </>
      ) : (
        <>
          <View style={s.lockChip}>
            <View style={[s.dot, { backgroundColor: p.sageDot }]} />
            <Text style={s.lockText}>{precision.kind === 'ranging' ? `UWB locked on ${name}` : 'Looking for UWB signal…'}</Text>
          </View>
          <View style={s.center}>
            <View style={[s.dial, { width: 280, height: 280, borderRadius: 140 }]} aria-hidden>
              <Radar size={168} active ringColor={p.link} guideColor={p.border} rings={1} duration={2400}>
                <View style={{ transform: [{ rotate: `${precision.kind === 'ranging' ? (precision.bearingDeg ?? 0) : 0}deg` }] }}>
                  <Icon name="arrow.up" size={110} color={p.link} weight="semibold" />
                </View>
              </Radar>
            </View>
            {precision.kind === 'ranging' && (
              <View style={{ alignItems: 'center' }} accessible accessibilityLiveRegion="polite">
                <Text style={s.distance}>
                  {precision.metres.toFixed(1)}
                  <Text style={s.unit}> m</Text>
                </Text>
                <Text style={s.direction}>{describeBearing(precision.bearingDeg)}</Text>
                <Text style={s.hint}>Walk slowly and keep your phone upright.</Text>
              </View>
            )}
          </View>
          <Button title="Beep as well" icon="speaker.wave.2.fill" onPress={() => router.replace('/find')} />
        </>
      )}

      <Text style={s.footnote}>Needs a phone with UWB, such as iPhone 11 or later.</Text>
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { flexGrow: 1, paddingHorizontal: 20, gap: 16 },
    center: { alignItems: 'center', gap: 22, paddingTop: 8 },
    dial: {
      width: 210,
      height: 210,
      borderRadius: 105,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4E1420',
      shadowOpacity: p.mode === 'dark' ? 0 : 0.12,
      shadowRadius: 17,
      shadowOffset: { width: 0, height: 14 },
    },
    ring: { position: 'absolute', borderRadius: 999 },
    slash: { position: 'absolute', width: 150, height: 7, borderRadius: 4, transform: [{ rotate: '45deg' }] },
    title: {
      fontFamily: F.display,
      fontSize: 32,
      lineHeight: 35,
      letterSpacing: -0.8,
      color: p.ink,
      textAlign: 'center',
    },
    body: {
      fontFamily: F.body,
      fontSize: 15,
      lineHeight: 22,
      color: p.muted,
      textAlign: 'center',
      maxWidth: 320,
      marginTop: -10,
    },
    label: { fontFamily: F.bodySemibold, fontSize: 13, color: p.muted, marginTop: 8 },
    lockChip: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: p.primary,
      borderRadius: R.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    lockText: { fontFamily: F.bodySemibold, fontSize: 13, color: p.onPrimary },
    distance: { fontFamily: F.display, fontSize: 76, lineHeight: 80, letterSpacing: -2, color: p.ink },
    unit: { fontFamily: F.display, fontSize: 34, color: p.link, letterSpacing: 0 },
    direction: { fontFamily: F.bodySemibold, fontSize: 18, color: p.ink, marginTop: 10 },
    hint: { fontFamily: F.body, fontSize: 14, color: p.muted, marginTop: 6 },
    footnote: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: p.muted, textAlign: 'center' },
  });
