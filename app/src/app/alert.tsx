import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { Icon, Radar } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import { usePalette } from '@/theme/theme-context';

// The alarm screen keeps the design's red in every theme: it has to read as an
// alarm. White on #C2273F is 5.3:1; white on #6B1F2E is 11:1.
const RED = '#C2273F';
const DEEP = '#6B1F2E';
const ROSE = '#F2D9D9';

export default function AlertScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const data = useAppData();
  const name = tag.tracker?.name ?? 'MiniTag';
  const alert = data.leftBehind;
  const reconnected = tag.connection === 'connected';
  const minutes = useMinutesSince(alert?.since ?? null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const iHaveIt = () => {
    data.dismissAlert();
    close();
  };

  const place = alert && alert.label !== 'Unknown place' ? alert.label : null;
  const headline = reconnected ? `${name} is back` : 'You may have left your ID behind';
  const body = reconnected
    ? 'MiniTag reconnected, so your ID is close by again.'
    : alert
      ? `${name} lost its connection${place ? ` at ${place}` : ''} ${minutes < 1 ? 'just now' : `${minutes} minute${minutes === 1 ? '' : 's'} ago`} and hasn't reconnected.`
      : `${name} isn't connected right now.`;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="light" />

      <View style={s.card} accessible accessibilityLabel={`${name} left behind? ${place ? `You walked away from ${place}.` : ''}`}>
        <View style={[s.cardIcon, { backgroundColor: p.primary }]}>
          <Icon name="dot.radiowaves.left.and.right" size={20} color={p.accent} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={s.cardMeta}>MINITAG</Text>
            <Text style={s.cardMeta}>{minutes < 1 ? 'now' : `${minutes} min ago`}</Text>
          </View>
          <Text style={s.cardTitle}>{name} left behind?</Text>
          <Text style={s.cardBody}>{place ? `You walked away from ${place}.` : 'You walked away from your ID.'}</Text>
        </View>
      </View>

      <View style={s.center}>
        <Radar size={150} active={!reconnected} duration={2000} rings={2} ringColor={ROSE} guideColor="transparent">
          <View style={s.bell}>
            <Icon name={reconnected ? 'checkmark' : 'bell.fill'} size={48} color={RED} />
          </View>
        </Radar>
        <View>
          <Text style={s.headline} accessibilityRole="header" accessibilityLiveRegion="assertive">
            {headline}
          </Text>
          <Text style={s.body}>{body}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {!reconnected && (
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/map')} style={({ pressed }) => [s.btn, { backgroundColor: DEEP }, pressed && s.pressed]}>
            <Icon name="mappin.and.ellipse" size={21} color={p.accent} weight="semibold" />
            <Text style={[s.btnText, { color: '#fff' }]}>Show on map</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={iHaveIt} style={({ pressed }) => [s.btn, { backgroundColor: '#fff', minHeight: 54 }, pressed && s.pressed]}>
          <Text style={[s.btnText, { color: '#2A1418', fontSize: 16 }]}>{reconnected ? 'Done' : 'I have it'}</Text>
        </Pressable>
        {!reconnected && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              data.snooze();
              close();
            }}
            style={({ pressed }) => [s.link, pressed && s.pressed]}>
            <Text style={s.linkText}>Snooze for 1 hour</Text>
          </Pressable>
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RED, paddingHorizontal: 20, gap: 16 },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    paddingHorizontal: 16,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { fontFamily: F.body, fontSize: 12, color: '#6E5A5E' },
  cardTitle: { fontFamily: F.bodySemibold, fontSize: 15, color: '#2A1418', marginTop: 2 },
  cardBody: { fontFamily: F.body, fontSize: 14, color: '#6E5A5E', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  bell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: F.display,
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1,
    color: '#fff',
    textAlign: 'center',
  },
  body: { fontFamily: F.body, fontSize: 16, lineHeight: 23, color: '#fff', textAlign: 'center', marginTop: 14, maxWidth: 320, alignSelf: 'center' },
  btn: {
    minHeight: 58,
    borderRadius: R.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { fontFamily: F.bodySemibold, fontSize: 17 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: F.bodySemibold, fontSize: 15, color: '#fff' },
  pressed: { opacity: 0.85 },
});
