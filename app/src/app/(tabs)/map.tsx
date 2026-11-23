import { AppleMaps } from 'expo-maps';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/backend/auth-context';
import { useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, T, formatWhen } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import { campusIcon, searchCampus, useCampus, type SearchHit } from '@/features/campus';
import type { LatLon } from '@/features/geo';
import { floorName, polygonCentre, type Building } from '@/features/indoor';
import { useIndoor } from '@/features/indoor-context';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

type AppleMapsPolygon = NonNullable<AppleMaps.MapProps['polygons']>[number];

const MAP_HEIGHT = 420;

export default function MapScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const data = useAppData();
  const campus = useCampus();
  const indoor = useIndoor();
  const auth = useAuth();
  const mapRef = useRef<AppleMaps.MapView>(null);
  const [phone, setPhone] = useState<LatLon | null>(null);
  const [query, setQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const now = useNow();

  const last = data.lastSeen;
  const connected = tag.connection === 'connected';
  const building = campus.buildings.find((b) => b.id === selectedBuilding) ?? null;
  const results = useMemo(() => searchCampus(campus, query), [campus, query]);

  const { currentLocation } = data;
  useEffect(() => {
    if (!last && data.locationPermission === 'granted') currentLocation().then(setPhone);
  }, [last, data.locationPermission, currentLocation]);

  const campusCentre = useMemo(() => campus.campus?.centre ?? centreOf(campus.buildings), [campus.campus, campus.buildings]);
  const initial = last ?? phone ?? campusCentre ?? data.places[0] ?? null;

  // Switching university moves the map to that campus.
  const campusSlug = campus.campus?.slug;
  const campusPoint = campus.campus?.centre;
  const shownCampus = useRef(campusSlug);
  useEffect(() => {
    if (!campusSlug || shownCampus.current === campusSlug || !campusPoint) return;
    shownCampus.current = campusSlug;
    mapRef.current?.setCameraPosition({ coordinates: campusPoint, zoom: 16 });
  }, [campusSlug, campusPoint]);

  const focusPoint = (pt: LatLon, zoom = 18) => mapRef.current?.setCameraPosition({ coordinates: pt, zoom });
  const focusHit = (hit: SearchHit) => {
    setQuery('');
    Keyboard.dismiss();
    setSelectedBuilding(hit.buildingId);
    setSelectedRoom(hit.kind === 'room' ? hit.id : null);
    focusPoint(hit.point, hit.kind === 'room' ? 19 : 18);
  };
  const focusBuilding = (b: Building) => {
    setSelectedBuilding(b.id);
    setSelectedRoom(null);
    focusPoint(polygonCentre(b.footprint));
  };

  const polygons: AppleMapsPolygon[] = campus.buildings.map((b) => {
    const on = b.id === selectedBuilding;
    const here = indoor.here?.inside && indoor.here.building?.id === b.id;
    return {
      id: `b${b.id}`,
      coordinates: (b.footprint[0] ?? []).map(([longitude, latitude]) => ({ latitude, longitude })),
      color: on ? withAlpha(p.primary, 0.3) : here ? withAlpha(p.sage, 0.25) : 'rgba(142,142,147,0.14)',
      lineColor: on ? p.primary : here ? p.sage : 'rgba(142,142,147,0.55)',
      lineWidth: on ? 2.5 : 1,
    };
  });
  const circles: AppleMaps.Circle[] = [
    ...data.places.map((pl) => ({
      id: `place-${pl.id}`,
      center: { latitude: pl.latitude, longitude: pl.longitude },
      radius: pl.radius,
      color: pl.kind === 'safe' ? withAlpha(p.sage, 0.18) : withAlpha(p.amber, 0.15),
      lineColor: pl.kind === 'safe' ? p.sage : p.amber,
      lineWidth: 1.5,
    })),
    ...(last
      ? [{ id: 'last-seen', center: last, radius: Math.max(15, last.accuracy ?? 15), color: withAlpha(p.primary, 0.14), lineColor: p.link, lineWidth: 2 }]
      : []),
  ];
  const markers: AppleMaps.Marker[] = [
    ...campus.buildings
      .filter((b) => b.name)
      .map((b) => ({
        id: `bm${b.id}`,
        coordinates: polygonCentre(b.footprint),
        title: b.name!,
        systemImage: campusIcon(b.category),
        tintColor: b.id === selectedBuilding ? p.primary : p.idle,
      })),
    ...campus.rooms
      .filter((r) => r.buildingId === selectedBuilding)
      .map((r) => ({
        id: `rm${r.id}`,
        coordinates: { latitude: r.latitude, longitude: r.longitude },
        title: `${r.name} · ${floorName(r.floor)}`,
        systemImage: campusIcon(r.kind),
        tintColor: r.id === selectedRoom ? p.primary : p.link,
      })),
    ...campus.places.map((c) => ({
      id: `pm${c.id}`,
      coordinates: { latitude: c.latitude, longitude: c.longitude },
      title: c.name,
      systemImage: campusIcon(c.category),
      tintColor: p.idle,
    })),
    ...(last
      ? [{ id: 'last-seen-pin', coordinates: last, title: tag.tracker?.name ?? 'MiTag', tintColor: p.primary, systemImage: 'person.text.rectangle.fill' }]
      : []),
  ];

  const onMarker = (id?: string) => {
    if (!id) return;
    if (id.startsWith('bm')) {
      const b = campus.buildings.find((x) => x.id === Number(id.slice(2)));
      if (b) focusBuilding(b);
    } else if (id.startsWith('rm')) {
      setSelectedRoom(Number(id.slice(2)));
    }
  };

  const permissionBlocked = data.locationPermission === 'denied';
  const roomsByFloor = useMemo(() => {
    const rooms = campus.rooms.filter((r) => r.buildingId === selectedBuilding);
    const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    return floors.map((f) => ({ floor: f, rooms: rooms.filter((r) => r.floor === f) }));
  }, [campus.rooms, selectedBuilding]);

  return (
    <View style={{ flex: 1, backgroundColor: p.ground }}>
      <View style={{ height: MAP_HEIGHT }}>
        {Platform.OS === 'ios' && initial ? (
          <AppleMaps.View
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            cameraPosition={{ coordinates: initial, zoom: 17 }}
            polygons={polygons}
            circles={circles}
            markers={markers}
            onMarkerClick={(m) => onMarker(m.id)}
            colorScheme={p.mode === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
            properties={{ isMyLocationEnabled: data.locationPermission === 'granted' }}
            uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.mapPlaceholder]}>
            <T variant="body" style={{ color: p.muted, textAlign: 'center' }}>
              {permissionBlocked
                ? 'Location is off for MiTag, so there is nothing to show on the map yet.'
                : 'The campus map is loading. It needs the internet the first time.'}
            </T>
          </View>
        )}

        <View style={[s.searchWrap, { top: insets.top + 8 }]}>
          <View style={s.search}>
            <Icon name="magnifyingglass" size={17} color={p.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={campus.campus ? `Search ${campus.campus.shortName}: building or room` : 'Search campus'}
              placeholderTextColor={p.muted}
              keyboardAppearance={p.mode}
              returnKeyType="search"
              onSubmitEditing={() => results[0] && focusHit(results[0])}
              accessibilityLabel="Search campus buildings and rooms"
              style={s.searchInput}
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
                <Icon name="xmark.circle.fill" size={18} color={p.muted} />
              </Pressable>
            )}
          </View>
          {query.trim().length > 0 && (
            <View style={s.results}>
              {results.length === 0 ? (
                <Text style={s.noResults}>Nothing on campus matches “{query.trim()}”.</Text>
              ) : (
                results.map((r, i) => (
                  <Pressable
                    key={r.key}
                    accessibilityRole="button"
                    onPress={() => focusHit(r)}
                    style={({ pressed }) => [s.resultRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.divider }, pressed && { opacity: 0.7 }]}>
                    <Icon name={r.icon} size={18} color={p.link} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{r.name}</Text>
                      <Text style={s.resultSub}>{r.subtitle}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
        <Text style={s.attribution}>© OpenStreetMap contributors</Text>
      </View>

      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <HereCard />

        {building ? (
          <>
            <View style={s.sheetTop}>
              <View style={s.chip}>
                <Text style={s.chipText}>{building.category}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close building details" onPress={() => setSelectedBuilding(null)} hitSlop={10}>
                <Icon name="xmark" size={16} color={p.muted} weight="semibold" />
              </Pressable>
            </View>
            <Text style={s.title} numberOfLines={2}>
              {building.name ?? 'Campus building'}
            </Text>
            <Text style={s.small}>
              {building.levels ? `${building.levels} floor${building.levels === 1 ? '' : 's'}` : 'Floors not recorded yet'} · outline from
              OpenStreetMap
            </Text>
            {roomsByFloor.length === 0 ? (
              <Text style={s.note}>No rooms recorded in this building yet.</Text>
            ) : (
              roomsByFloor.map(({ floor, rooms }) => (
                <View key={floor}>
                  <Text style={s.floorTitle}>{floorName(floor)}</Text>
                  {rooms.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedRoom(r.id);
                        focusPoint(r, 19);
                      }}
                      style={[s.roomRow, r.id === selectedRoom && { backgroundColor: p.primarySoft }]}>
                      <Icon name={campusIcon(r.kind)} size={17} color={p.link} />
                      <Text style={s.roomName}>{r.name}</Text>
                      <Text style={s.small}>{r.kind}</Text>
                    </Pressable>
                  ))}
                </View>
              ))
            )}
            {auth.isAdmin && (
              <Button
                title="Add a Room Here"
                icon="plus"
                variant="outline"
                onPress={() => router.push({ pathname: '/add-room', params: { building: String(building.id) } })}
              />
            )}
          </>
        ) : last ? (
          <>
            <View>
              <View style={s.chip}>
                <Text style={s.chipText}>{connected ? 'Connected now' : `Last seen ${formatWhen(last.at, now).toLowerCase()}`}</Text>
              </View>
              <Text style={s.title} numberOfLines={3}>
                {last.label}
              </Text>
            </View>
            <Text style={s.note}>
              Where your phone was when MiTag last had a connection. The building comes from the campus map, the floor from
              your phone’s barometer. The tag has no GPS of its own.
            </Text>
            <Button
              title={connected ? 'Play Sound' : "Beep When I'm in Range"}
              icon="speaker.wave.2.fill"
              onPress={() => router.push('/find')}
            />
            {data.history.length > 1 &&
              data.history.slice(1, 6).map((h) => (
                <View key={`${h.at}`} style={s.historyRow}>
                  <Text style={s.historyName} numberOfLines={1}>
                    {h.label}
                  </Text>
                  <Text style={s.historyWhen}>{formatWhen(h.at, now)}</Text>
                </View>
              ))}
          </>
        ) : (
          <>
            <Text style={s.title}>No last-seen place yet</Text>
            <Text style={s.note}>
              {!tag.tracker
                ? 'Set up your MiTag first. MiTag then remembers where your phone was each time the tag connects or drops out.'
                : !data.prefs.rememberLastSeen
                  ? 'Remember last seen is turned off in Settings.'
                  : 'MiTag saves where your phone is while the tag is connected, and the spot where it drops out.'}
            </Text>
            {!tag.tracker ? (
              <Button title="Set Up MiTag" onPress={() => router.push('/pair')} />
            ) : data.locationPermission !== 'granted' ? (
              <Button
                title="Turn On Location"
                icon="location.fill"
                onPress={() => (permissionBlocked ? Linking.openSettings() : data.requestLocation())}
              />
            ) : null}
          </>
        )}

        <Text style={s.small}>
          {!campus.campus
            ? 'Choose your university in Settings to see its campus map.'
            : campus.buildings.length
            ? `${campus.campus.shortName} campus: ${campus.buildings.length} buildings, ${campus.rooms.length} rooms${campus.fetchedAt ? ` · updated ${formatWhen(campus.fetchedAt, now).toLowerCase()}` : ''}`
            : campus.loading
              ? 'Loading the campus map…'
              : 'Campus buildings appear once they are loaded into the database.'}
          {campus.error ? `  ${campus.error}` : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Live "you are here" with floor detection controls. */
function HereCard() {
  const s = useThemedStyles(makeStyles);
  const indoor = useIndoor();
  const now = useNow(15_000);
  const here = indoor.here;
  const needsMotion = indoor.barometerAvailable && indoor.motionPermission !== 'granted';
  const calibrated = indoor.groundRef;
  const ageMin = calibrated ? Math.max(0, Math.round((now - calibrated.at) / 60_000)) : null;

  if (!here) return null;
  return (
    <View style={s.here} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={s.hereDot} />
        <View style={{ flex: 1 }}>
          <Text style={s.hereLabel}>You are here</Text>
          <Text style={s.hereText}>{here.label}</Text>
        </View>
      </View>
      {needsMotion ? (
        <Button
          title={indoor.motionPermission === 'denied' ? 'Allow Motion in Settings for Floors' : 'Turn On Floor Detection'}
          variant="outline"
          onPress={() => (indoor.motionPermission === 'denied' ? Linking.openSettings() : indoor.requestMotion())}
          style={{ minHeight: 44 }}
        />
      ) : indoor.barometerAvailable ? (
        <View style={s.calRow}>
          <Text style={[s.small, { flex: 1 }]}>
            {calibrated
              ? `Floor reference ${calibrated.source === 'manual' ? 'set by you' : 'taken outdoors'} ${ageMin! < 1 ? 'just now' : `${ageMin} min ago`}`
              : 'Floors need a ground-level reading. Walk outside once, or tap the button on the ground floor.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              indoor.calibrateGround()
                ? Alert.alert('Ground floor set', 'MiTag will measure floors from here.')
                : Alert.alert('No barometer reading yet', 'Wait a second and try again.')
            }
            style={({ pressed }) => [s.calButton, pressed && { opacity: 0.7 }]}>
            <Text style={s.calButtonText}>I’m on the ground floor</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** '#RRGGBB' + alpha -> 'rgba(r,g,b,a)' for map overlays. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function centreOf(buildings: Building[]): LatLon | null {
  if (!buildings.length) return null;
  const cs = buildings.map((b) => polygonCentre(b.footprint));
  return {
    latitude: cs.reduce((a, c) => a + c.latitude, 0) / cs.length,
    longitude: cs.reduce((a, c) => a + c.longitude, 0) / cs.length,
  };
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
    mapPlaceholder: { backgroundColor: p.disabledBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    searchWrap: { position: 'absolute', left: 16, right: 16, gap: 6 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: p.surface,
      borderRadius: 12,
      borderCurve: 'continuous',
      paddingHorizontal: 10,
      minHeight: 44,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    searchInput: { flex: 1, ...F.body, fontSize: 17, color: p.ink, paddingVertical: 10 },
    results: {
      backgroundColor: p.surface,
      borderRadius: 12,
      borderCurve: 'continuous',
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
    resultName: { ...F.body, fontSize: 17, color: p.ink },
    resultSub: { ...F.body, fontSize: 13, color: p.muted },
    noResults: { ...F.body, fontSize: 15, color: p.muted, paddingVertical: 14 },
    attribution: {
      position: 'absolute',
      right: 8,
      bottom: 24,
      ...F.body,
      fontSize: 10,
      color: '#3a3a3a',
      backgroundColor: 'rgba(255,255,255,0.75)',
      paddingHorizontal: 5,
      borderRadius: 4,
      overflow: 'hidden',
    },
    sheet: { marginTop: -16, backgroundColor: p.ground, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    sheetContent: { padding: 16, gap: 12, paddingBottom: 24 },
    sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chip: { alignSelf: 'flex-start' },
    chipText: { ...F.bodySemibold, fontSize: 13, color: p.muted, textTransform: 'uppercase' },
    title: { ...F.display, fontSize: 22, lineHeight: 28, color: p.ink, marginTop: 2 },
    note: { ...F.body, fontSize: 15, lineHeight: 20, color: p.muted },
    small: { ...F.body, fontSize: 13, lineHeight: 18, color: p.muted },
    floorTitle: { ...F.body, fontSize: 13, color: p.muted, textTransform: 'uppercase', marginTop: 4, marginBottom: 6, marginLeft: 4 },
    roomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 12,
      backgroundColor: p.surface,
      borderRadius: 10,
      marginBottom: 2,
    },
    roomName: { ...F.body, fontSize: 17, color: p.ink, flex: 1 },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      backgroundColor: p.surface,
      borderRadius: 10,
    },
    historyName: { ...F.body, fontSize: 17, color: p.ink, flex: 1 },
    historyWhen: { ...F.body, fontSize: 17, color: p.muted },
    here: { backgroundColor: p.surface, borderRadius: 12, borderCurve: 'continuous', padding: 14, gap: 12 },
    hereDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: p.sageDot, borderWidth: 2, borderColor: p.sageBg },
    hereLabel: { ...F.body, fontSize: 13, color: p.muted },
    hereText: { ...F.bodySemibold, fontSize: 17, color: p.ink, marginTop: 1 },
    calRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    calButton: { borderRadius: 8, backgroundColor: p.primarySoft, paddingHorizontal: 12, paddingVertical: 8 },
    calButtonText: { ...F.bodySemibold, fontSize: 15, color: p.link },
  });
