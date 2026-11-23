import { AppleMaps } from 'expo-maps';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { Button, T, formatWhen } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import type { LatLon } from '@/features/geo';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

const MAP_HEIGHT = 390;

export default function MapScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const data = useAppData();
  const [here, setHere] = useState<LatLon | null>(null);
  const now = useNow();

  const last = data.lastSeen;
  const connected = tag.connection === 'connected';

  // Without a last-seen point yet, centre on the phone so the map isn't blank.
  const { currentLocation } = data;
  useEffect(() => {
    if (!last && data.locationPermission === 'granted') currentLocation().then(setHere);
  }, [last, data.locationPermission, currentLocation]);

  const center = last ?? here ?? data.places[0] ?? null;

  const circles: AppleMaps.Circle[] = [
    ...data.places.map((pl) => ({
      id: `place-${pl.id}`,
      center: { latitude: pl.latitude, longitude: pl.longitude },
      radius: pl.radius,
      color: pl.kind === 'safe' ? 'rgba(62,123,92,0.18)' : 'rgba(142,47,68,0.12)',
      lineColor: pl.kind === 'safe' ? p.sage : p.link,
      lineWidth: 1.5,
    })),
    ...(last
      ? [{ id: 'last-seen', center: last, radius: Math.max(30, last.accuracy ?? 30), color: 'rgba(142,47,68,0.14)', lineColor: p.link, lineWidth: 2 }]
      : []),
  ];
  const markers: AppleMaps.Marker[] = last
    ? [{ id: 'last-seen-pin', coordinates: last, title: tag.tracker?.name ?? 'MiniTag', tintColor: p.primary, systemImage: 'person.text.rectangle.fill' }]
    : [];

  const permissionBlocked = data.locationPermission === 'denied';

  return (
    <View style={{ flex: 1, backgroundColor: p.ground }}>
      <View style={{ height: MAP_HEIGHT }}>
        {Platform.OS === 'ios' && center ? (
          <AppleMaps.View
            key={center ? `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)}` : 'none'}
            style={StyleSheet.absoluteFill}
            cameraPosition={{ coordinates: center, zoom: 16 }}
            circles={circles}
            markers={markers}
            colorScheme={p.mode === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
            properties={{ isMyLocationEnabled: data.locationPermission === 'granted' }}
            uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.mapPlaceholder]}>
            <T variant="body" style={{ color: p.muted, textAlign: 'center' }}>
              {permissionBlocked
                ? 'Location is off for MiniTag, so there is nothing to show on the map yet.'
                : 'The map appears after MiniTag has seen your tag at least once with location on.'}
            </T>
          </View>
        )}
        <View style={[s.mapPill, { top: insets.top + 8 }]}>
          <Text style={s.mapPillText}>Last seen map</Text>
        </View>
      </View>

      <ScrollView style={s.sheet} contentContainerStyle={s.sheetContent}>
        {last ? (
          <>
            <View>
              <View style={s.timeChip}>
                <Text style={s.timeChipText}>{connected ? 'Connected now' : formatWhen(last.at, now)}</Text>
              </View>
              <Text style={s.title} numberOfLines={2}>
                {last.label}
              </Text>
            </View>
            <Text style={s.note}>
              This is where your phone was when MiniTag last had a connection. The tag has no GPS of its own.
            </Text>
            <Button
              title={connected ? 'Make it beep' : "Beep when I'm in range"}
              icon="speaker.wave.2.fill"
              onPress={() => router.push('/find')}
              style={{ minHeight: 54 }}
            />
            {data.history.length > 1 && (
              <View>
                {data.history.slice(1, 6).map((h) => (
                  <View key={`${h.at}`} style={s.historyRow}>
                    <Text style={s.historyName} numberOfLines={1}>
                      {h.label}
                    </Text>
                    <Text style={s.historyWhen}>{formatWhen(h.at, now)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={s.title}>No last-seen place yet</Text>
            <Text style={s.note}>
              {!tag.tracker
                ? 'Set up your MiniTag first. MiniTag then remembers where your phone was each time the tag connects or drops out.'
                : !data.prefs.rememberLastSeen
                  ? 'Remember last seen is turned off in Settings.'
                  : 'MiniTag saves where your phone is while the tag is connected, and the spot where it drops out.'}
            </Text>
            {!tag.tracker ? (
              <Button title="Set up MiniTag" onPress={() => router.push('/pair')} />
            ) : data.locationPermission !== 'granted' ? (
              <Button
                title="Turn on location"
                icon="location.fill"
                onPress={() => (permissionBlocked ? Linking.openSettings() : data.requestLocation())}
              />
            ) : !data.prefs.rememberLastSeen ? (
              <Button title="Open Settings" variant="outline" onPress={() => router.navigate('/settings')} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    mapPlaceholder: {
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    mapPill: {
      position: 'absolute',
      left: 20,
      backgroundColor: p.surface,
      borderRadius: R.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      shadowColor: '#4E1420',
      shadowOpacity: 0.14,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 4 },
    },
    mapPillText: { fontFamily: F.bodySemibold, fontSize: 14, color: p.ink },
    sheet: {
      marginTop: -28,
      backgroundColor: p.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
    },
    sheetContent: { padding: 20, gap: 12, paddingBottom: 24 },
    timeChip: {
      alignSelf: 'flex-start',
      backgroundColor: p.accent,
      borderRadius: R.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    timeChipText: { fontFamily: F.bodySemibold, fontSize: 12, color: p.onAccent },
    title: { fontFamily: F.display, fontSize: 32, lineHeight: 35, letterSpacing: -0.8, color: p.ink, marginTop: 6 },
    note: {
      fontFamily: F.body,
      fontSize: 13,
      lineHeight: 19,
      color: p.muted,
      backgroundColor: p.ground,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: p.divider,
    },
    historyName: { fontFamily: F.bodyMedium, fontSize: 14, color: p.ink, flex: 1 },
    historyWhen: { fontFamily: F.body, fontSize: 14, color: p.muted },
  });
