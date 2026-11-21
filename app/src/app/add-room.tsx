import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/backend/supabase';
import { Button, Icon, CancelButton, T, SheetHeader } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useCampus } from '@/features/campus';
import { floorName } from '@/features/indoor';
import { useIndoor } from '@/features/indoor-context';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

const KINDS = ['Classroom', 'Lab', 'Office', 'Library', 'Hall', 'Other'];
const SAMPLE_MS = 15_000;

/** Admins: record a room at the phone's position (averaged GPS) on a floor. */
export default function AddRoomScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const campus = useCampus();
  const indoor = useIndoor();
  const params = useLocalSearchParams<{ building?: string }>();
  const building = campus.buildings.find((b) => String(b.id) === params.building) ?? indoor.here?.building ?? null;
  const detectedFloor = indoor.here?.building?.id === building?.id ? (indoor.here?.floor?.floor ?? null) : null;

  const [name, setName] = useState('');
  const [kind, setKind] = useState('Classroom');
  const [floor, setFloor] = useState(detectedFloor ?? 0);
  const [spot, setSpot] = useState<{ latitude: number; longitude: number; accuracy: number; samples: number } | null>(null);
  const [sampling, setSampling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  // Average GPS fixes for a few seconds, weighting better fixes more.
  const record = async () => {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Location is needed to record where the room is.');
      return;
    }
    setSampling(true);
    const fixes: { lat: number; lon: number; acc: number }[] = [];
    const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (pos) => {
      fixes.push({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: Math.max(3, pos.coords.accuracy ?? 30) });
    });
    const done = () => {
      sub.remove();
      setSampling(false);
      if (!fixes.length) {
        setError('No GPS readings. Stand near a window and try again.');
        return;
      }
      const w = fixes.map((f) => 1 / (f.acc * f.acc));
      const sw = w.reduce((a, b) => a + b, 0);
      setSpot({
        latitude: fixes.reduce((a, f, i) => a + f.lat * w[i], 0) / sw,
        longitude: fixes.reduce((a, f, i) => a + f.lon * w[i], 0) / sw,
        accuracy: Math.round(Math.sqrt(1 / sw)),
        samples: fixes.length,
      });
    };
    const t = setTimeout(done, SAMPLE_MS);
    stop.current = () => {
      clearTimeout(t);
      sub.remove();
    };
  };

  const save = async () => {
    if (!building || !spot || !name.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('campus_rooms').insert({
      building_id: building.id,
      name: name.trim(),
      floor,
      kind,
      latitude: spot.latitude,
      longitude: spot.longitude,
      verified: true,
    });
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? 'There is already a room with that name on this floor.' : 'Couldn’t save the room. Are you signed in as an admin?');
      return;
    }
    await campus.refresh();
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <SheetHeader title="Add Room" left={<CancelButton onPress={() => router.back()} />} />

        <View style={s.card}>
          <Text style={s.label}>Building</Text>
          <Text style={s.value}>{building?.name ?? (building ? 'Campus building' : 'Stand inside a building first')}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Floor</Text>
          <View style={s.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="Floor down" onPress={() => setFloor((f) => Math.max(-1, f - 1))} style={s.stepBtn}>
              <Icon name="minus" size={16} color={p.link} weight="bold" />
            </Pressable>
            <Text style={s.value} accessibilityLiveRegion="polite">
              {floorName(floor)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Floor up" onPress={() => setFloor((f) => Math.min(20, f + 1))} style={s.stepBtn}>
              <Icon name="plus" size={16} color={p.link} weight="bold" />
            </Pressable>
          </View>
          <Text style={s.hint}>
            {detectedFloor != null ? `The barometer suggests ${floorName(detectedFloor).toLowerCase()}. Correct it if needed.` : 'Set the floor by hand.'}
          </Text>
        </View>

        <View>
          <Text style={s.label} nativeID="roomNameLabel">
            Room name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Classroom 2"
            placeholderTextColor={p.muted}
            keyboardAppearance={p.mode}
            maxLength={80}
            accessibilityLabelledBy="roomNameLabel"
            accessibilityLabel="Room name"
            style={s.input}
          />
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Room type" style={s.kinds}>
          {KINDS.map((k) => {
            const on = k === kind;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setKind(k)}
                style={[s.kind, on && { backgroundColor: p.primary, borderColor: p.primary }]}>
                <Text style={[s.kindText, { color: on ? p.onPrimary : p.ink }]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.card}>
          <Text style={s.label}>Room position</Text>
          <Text style={s.value}>
            {sampling ? 'Recording… stay in the middle of the room' : spot ? `Recorded (±${spot.accuracy} m from ${spot.samples} readings)` : 'Not recorded yet'}
          </Text>
          <Button
            title={sampling ? 'Recording for 15 seconds…' : spot ? 'Record again' : 'Record room position'}
            variant="outline"
            icon="location.fill"
            loading={sampling}
            onPress={record}
            style={{ minHeight: 46, marginTop: 6 }}
          />
        </View>

        {error && (
          <T variant="body" style={{ color: p.dangerInk }} accessibilityLiveRegion="assertive">
            {error}
          </T>
        )}

        <Button title="Save room" onPress={save} loading={busy} disabled={!building || !spot || !name.trim() || sampling} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    card: { backgroundColor: p.surface, borderRadius: 12, borderCurve: 'continuous', padding: 16, gap: 4 },
    label: { ...F.body, fontSize: 13, color: p.muted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 7 },
    value: { ...F.bodySemibold, fontSize: 17, color: p.ink },
    hint: { ...F.body, fontSize: 13, color: p.muted, marginTop: 4 },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      minHeight: 44,
      borderRadius: 10,
      borderCurve: 'continuous',
      paddingHorizontal: 16,
      ...F.body,
      fontSize: 17,
      color: p.ink,
      backgroundColor: p.surface,
    },
    kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kind: { borderRadius: R.pill, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', backgroundColor: p.surface },
    kindText: { ...F.bodySemibold, fontSize: 14 },
  });
