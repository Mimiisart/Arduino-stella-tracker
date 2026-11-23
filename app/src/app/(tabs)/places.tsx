import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, T, Toggle } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import type { Place } from '@/features/geo';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

export default function PlacesScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const data = useAppData();

  const safeCount = data.places.filter((pl) => pl.kind === 'safe').length;
  const watchCount = data.places.length - safeCount;

  const confirmDelete = (pl: Place) =>
    Alert.alert(`Delete ${pl.name}?`, 'MiniTag will treat this spot like anywhere else.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => data.removePlace(pl.id) },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 16 }]}>
      <View>
        <T variant="display" accessibilityRole="header">
          Places
        </T>
        <T variant="body" style={{ color: p.muted, marginTop: 8 }}>
          Mark a safe place where MiniTag can stay put without an alert, like your dorm or a locker.
        </T>
      </View>

      <View style={s.summary} accessibilityLiveRegion="polite">
        <View style={[s.tile, { backgroundColor: p.primary }]} accessible accessibilityLabel={`${safeCount} safe places`}>
          <Text style={[s.tileNumber, { color: p.onPrimary }]}>{safeCount}</Text>
          <Text style={[s.tileLabel, { color: p.onPrimaryMuted }]}>safe places</Text>
        </View>
        <View style={[s.tile, { backgroundColor: p.accent }]} accessible accessibilityLabel={`${watchCount} watched places`}>
          <Text style={[s.tileNumber, { color: p.onAccent }]}>{watchCount}</Text>
          <Text style={[s.tileLabel, { color: p.onAccent }]}>watched</Text>
        </View>
      </View>

      {data.places.length > 0 ? (
        <View style={s.list}>
          {data.places.map((pl, i) => {
            const safe = pl.kind === 'safe';
            return (
              <Pressable
                key={pl.id}
                onLongPress={() => confirmDelete(pl)}
                accessibilityHint="Long press to delete"
                accessibilityActions={[{ name: 'delete', label: 'Delete place' }]}
                onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && confirmDelete(pl)}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: p.divider }]}>
                <View style={[s.rowIcon, { backgroundColor: safe ? p.primarySoft : p.ground }]}>
                  <Icon name={safe ? 'checkmark.shield' : 'bell'} size={19} color={safe ? p.link : p.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  <Text style={s.rowSub}>
                    {safe ? 'Safe place, no alerts here' : 'Alert me if I walk away'} · {pl.radius} m
                  </Text>
                </View>
                <Toggle
                  value={safe}
                  label={`Safe place: ${pl.name}`}
                  onChange={(v) => data.setPlaceKind(pl.id, v ? 'safe' : 'watch')}
                />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={s.empty}>
          <Icon name="mappin.slash" size={28} color={p.muted} />
          <T variant="body" style={{ color: p.muted, textAlign: 'center' }}>
            No places yet. Go somewhere you leave your ID on purpose, like your room, and add it.
          </T>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/add-place')}
        style={({ pressed }) => [s.add, pressed && { opacity: 0.75 }]}>
        <Icon name="plus" size={18} color={p.link} weight="bold" />
        <Text style={s.addText}>Add my current location</Text>
      </Pressable>

      {data.places.length > 0 && <T variant="caption">Long-press a place to delete it.</T>}
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
    summary: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, borderRadius: R.section, paddingVertical: 14, paddingHorizontal: 18 },
    tileNumber: { fontFamily: F.display, fontSize: 48, lineHeight: 50 },
    tileLabel: { fontFamily: F.bodySemibold, fontSize: 14, marginTop: 2 },
    list: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: R.section,
      paddingHorizontal: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8 },
    rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontFamily: F.bodySemibold, fontSize: 16, color: p.ink },
    rowSub: { fontFamily: F.body, fontSize: 13, color: p.muted, marginTop: 1 },
    empty: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 24,
      paddingHorizontal: 16,
      borderRadius: R.section,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 50,
      borderRadius: R.button,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: p.link,
    },
    addText: { fontFamily: F.bodySemibold, fontSize: 16, color: p.link },
  });
