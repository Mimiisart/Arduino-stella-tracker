import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { usePalette } from '@/theme/theme-context';

/** Standard ID-1 card proportions (85.6 × 54 mm), the size of a student ID. */
const CARD_RATIO = 85.6 / 54;
/** Size of the ring area, centred on the card's top-right corner. */
const RINGS = 280;
const PING_MS = 3200;

/** Lighten (amount > 0) or darken (amount < 0) a '#RRGGBB' colour. */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/**
 * The tracker drawn as the ID card it is clipped to: theme colour when the tag
 * is with you, grey when it is out of range.
 */
export function TrackerCard({
  name,
  active,
  statusDot,
  statusText,
  detail,
}: {
  name: string;
  active: boolean;
  statusDot: string;
  statusText: string;
  detail: string;
}) {
  const p = usePalette();
  const reduceMotion = useReducedMotion();
  const base = active ? p.primary : p.mode === 'dark' ? '#3A3A3C' : '#8E8E93';
  const gradient = `linear-gradient(135deg, ${shade(base, 0.12)} 0%, ${base} 55%, ${shade(base, -0.22)} 100%)`;

  return (
    <View
      style={[s.card, { backgroundColor: base, experimental_backgroundImage: gradient }]}
      accessible
      accessibilityLabel={`${name}. ${statusText}. ${detail}`}>
      {/* Signal rings from the tag's corner: they pulse while it is with you */}
      <View style={s.rings} pointerEvents="none">
        <View style={[s.ring, { transform: [{ scale: 0.95 }] }]} />
        <View style={[s.ring, { transform: [{ scale: 0.62 }] }]} />
        <View style={[s.ring, { transform: [{ scale: 0.3 }] }]} />
        {active && !reduceMotion && [0, 1, 2].map((i) => <PingRing key={i} delay={(PING_MS / 3) * i} />)}
      </View>

      <View style={s.top}>
        <View style={s.brand}>
          <Icon name="dot.radiowaves.left.and.right" size={14} color="rgba(255,255,255,0.85)" weight="bold" />
          <Text style={s.brandText}>MINITAG</Text>
        </View>
        <View style={s.pill}>
          <View style={[s.dot, { backgroundColor: statusDot }]} />
          <Text style={s.pillText} numberOfLines={1}>
            {statusText}
          </Text>
        </View>
      </View>

      <View style={s.middle}>
        <View style={s.photo}>
          <Icon name="person.fill" size={34} color="rgba(255,255,255,0.75)" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit>
            {name}
          </Text>
          <View style={[s.line, { width: '80%' }]} />
          <View style={[s.line, { width: '55%' }]} />
        </View>
      </View>

      <View style={s.bottom}>
        <View style={[s.chip, { backgroundColor: p.accent }]}>
          <View style={s.chipLine} />
          <View style={[s.chipLine, { top: 15 }]} />
          <View style={s.chipMid} />
        </View>
        <Text style={s.detail} numberOfLines={1}>
          {detail}
        </Text>
        <Icon name="wave.3.right" size={20} color="rgba(255,255,255,0.7)" weight="semibold" />
      </View>
    </View>
  );
}

/** One ring growing out from the corner and fading, on a loop. */
function PingRing({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: PING_MS, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 0.15 + 0.9 * t.value }],
  }));
  return <Animated.View style={[s.ring, s.ping, style]} />;
}

const s = StyleSheet.create({
  card: {
    aspectRatio: CARD_RATIO,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: 18,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  rings: { position: 'absolute', width: RINGS, height: RINGS, right: -RINGS / 2 + 30, top: -RINGS / 2 + 30 },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RINGS / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  ping: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { ...F.bodySemibold, fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.85)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { ...F.bodySemibold, fontSize: 12, color: '#FFFFFF', flexShrink: 1 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: {
    width: 60,
    height: 72,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...F.display, fontSize: 26, lineHeight: 31, color: '#FFFFFF' },
  line: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { width: 38, height: 28, borderRadius: 6, overflow: 'hidden' },
  chipLine: { position: 'absolute', left: 0, right: 0, top: 9, height: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  chipMid: {
    position: 'absolute',
    left: 13,
    top: 6,
    width: 12,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  detail: { ...F.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', flex: 1 },
});
