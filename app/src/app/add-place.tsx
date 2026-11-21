import Slider from '@react-native-community/slider';
import { AppleMaps } from 'expo-maps';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, CancelButton, T, type IconName, SheetHeader } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import type { LatLon, PlaceKind } from '@/features/geo';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

type Spot = LatLon & { accuracy: number | null };

/** Save the phone's current location as a safe or watched place. */
export default function AddPlaceScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const data = useAppData();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [locating, setLocating] = useState(true);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(60);
  const [kind, setKind] = useState<PlaceKind>('safe');

  const { currentLocation, requestLocation, locationPermission } = data;
  const locate = async () => {
    setLocating(true);
    if (locationPermission !== 'granted') await requestLocation();
    setSpot(await currentLocation());
    setLocating(false);
  };
  // Find the phone's location once when the screen opens (locating starts true).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (locationPermission !== 'granted') await requestLocation();
      const found = await currentLocation();
      if (!alive) return;
      setSpot(found);
      setLocating(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    if (!spot) return;
    data.addPlace({
      name: name.trim() || (kind === 'safe' ? 'Safe place' : 'Watched place'),
      latitude: spot.latitude,
      longitude: spot.longitude,
      radius,
      kind,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <SheetHeader title="Add Place" left={<CancelButton onPress={() => router.back()} />} />

        <View style={s.mapBox}>
          {spot && Platform.OS === 'ios' ? (
            <AppleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={{ coordinates: spot, zoom: 17 }}
              circles={[
                {
                  id: 'new-place',
                  center: spot,
                  radius,
                  color: kind === 'safe' ? 'rgba(62,123,92,0.18)' : 'rgba(142,47,68,0.14)',
                  lineColor: kind === 'safe' ? p.sage : p.link,
                  lineWidth: 2,
                },
              ]}
              colorScheme={p.mode === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
              properties={{ isMyLocationEnabled: true }}
              uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false }}
            />
          ) : (
            <View style={s.mapEmpty}>
              <T variant="body" style={{ color: p.muted, textAlign: 'center' }}>
                {locating
                  ? 'Finding where you are…'
                  : locationPermission === 'denied'
                    ? 'Location is off for MiTag. Turn it on to save places.'
                    : "Couldn't find your location. Step outside or near a window and try again."}
              </T>
              {!locating && (
                <Button
                  title={locationPermission === 'denied' ? 'Open Settings' : 'Try again'}
                  variant="outline"
                  onPress={() => (locationPermission === 'denied' ? Linking.openSettings() : locate())}
                  style={{ minHeight: 44 }}
                />
              )}
            </View>
          )}
        </View>
        {spot?.accuracy != null && (
          <T variant="caption">Accurate to about {Math.round(spot.accuracy)} m</T>
        )}

        <View>
          <Text style={s.label} nativeID="placeNameLabel">
            Place name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Library study room"
            placeholderTextColor={p.muted}
            keyboardAppearance={p.mode}
            maxLength={30}
            returnKeyType="done"
            accessibilityLabelledBy="placeNameLabel"
            accessibilityLabel="Place name"
            style={s.input}
          />
        </View>

        <View>
          <View style={s.sizeRow}>
            <Text style={s.label}>Size of the place</Text>
            <Text style={s.sizeValue} accessibilityLiveRegion="polite">
              {radius} m
            </Text>
          </View>
          <Slider
            value={radius}
            onValueChange={(v) => setRadius(Math.round(v))}
            minimumValue={20}
            maximumValue={200}
            step={10}
            minimumTrackTintColor={p.primary}
            maximumTrackTintColor={p.border}
            thumbTintColor={p.primary}
            accessibilityLabel="Size of the place in metres"
            style={{ height: 44 }}
          />
        </View>

        <Text style={s.label}>What should MiTag do here?</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Place type" style={{ gap: 10 }}>
          <KindOption
            icon="checkmark.shield"
            iconBg={p.sageBg}
            iconFg={p.sageInk}
            title="Safe place"
            body="No alerts while I'm here"
            selected={kind === 'safe'}
            onPress={() => setKind('safe')}
          />
          <KindOption
            icon="bell"
            iconBg={p.primarySoft}
            iconFg={p.link}
            title="Watched place"
            body="Alert me if I walk away from my ID"
            selected={kind === 'watch'}
            onPress={() => setKind('watch')}
          />
        </View>

        <Button title="Save place" onPress={save} disabled={!spot} style={{ marginTop: 6 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function KindOption({
  icon,
  iconBg,
  iconFg,
  title,
  body,
  selected,
  onPress,
}: {
  icon: IconName;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.kind, { borderColor: selected ? p.link : p.border, backgroundColor: selected ? p.primarySoft : p.surface }]}>
      <View style={[s.kindIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={19} color={iconFg} weight="semibold" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kindTitle}>{title}</Text>
        <Text style={s.kindBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    mapBox: {
      height: 180,
      borderRadius: 12,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: p.disabledBg,
    },
    mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
    label: { ...F.body, fontSize: 13, color: p.muted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 7 },
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
    sizeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    sizeValue: { ...F.bodySemibold, fontSize: 17, color: p.ink },
    kind: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 62,
      borderRadius: 12,
      borderCurve: 'continuous',
      borderWidth: 2,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    kindIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    kindTitle: { ...F.bodySemibold, fontSize: 17, color: p.ink },
    kindBody: { ...F.body, fontSize: 15, color: p.muted, marginTop: 1 },
  });
