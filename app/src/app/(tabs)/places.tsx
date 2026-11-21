import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Icon, LargeTitle, Row, Section } from '@/components/minitag/ui';
import { useAppData } from '@/features/app-data';
import type { Place } from '@/features/geo';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

export default function PlacesScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const data = useAppData();

  const safe = data.places.filter((pl) => pl.kind === 'safe');
  const watched = data.places.filter((pl) => pl.kind !== 'safe');

  const confirmDelete = (pl: Place) =>
    Alert.alert(`Delete ${pl.name}?`, 'MiTag will treat this spot like anywhere else.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => data.removePlace(pl.id) },
    ]);

  // Tapping a place opens the system action sheet.
  const openPlace = (pl: Place) => {
    const isSafe = pl.kind === 'safe';
    const toggle = isSafe ? 'Alert Me Here' : 'Mark as Safe Place';
    if (Platform.OS !== 'ios') {
      Alert.alert(pl.name, undefined, [
        { text: toggle, onPress: () => data.setPlaceKind(pl.id, isSafe ? 'watch' : 'safe') },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(pl) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      { title: pl.name, options: [toggle, 'Delete Place', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) data.setPlaceKind(pl.id, isSafe ? 'watch' : 'safe');
        if (i === 1) confirmDelete(pl);
      },
    );
  };

  const placeRow = (pl: Place) => (
    <Row
      key={pl.id}
      icon={pl.kind === 'safe' ? 'house.fill' : 'bell.fill'}
      iconColor={pl.kind === 'safe' ? p.sage : p.amber}
      title={pl.name}
      subtitle={`Within ${pl.radius} m`}
      onPress={() => openPlace(pl)}
      accessibilityHint="Opens options for this place"
    />
  );

  return (
    <ScrollView style={{ backgroundColor: p.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.page}>
      <LargeTitle
        title="Places"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add my current location"
            onPress={() => router.push('/add-place')}
            hitSlop={8}
            style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.5 }]}>
            <Icon name="plus" size={22} color={p.link} weight="medium" />
          </Pressable>
        }
      />

      {data.places.length === 0 && (
        <Section footer="Add places where you leave your ID on purpose, like your room or a locker. MiTag won't alert you there.">
          <Row icon="plus" title="Add Current Location" onPress={() => router.push('/add-place')} />
        </Section>
      )}

      {safe.length > 0 && (
        <Section header="Safe places" footer="No leave-behind alerts here, and the tracker doesn't beep.">
          {safe.map(placeRow)}
        </Section>
      )}

      {watched.length > 0 && (
        <Section header="Watched places" footer="MiTag alerts you if you walk away from your ID here.">
          {watched.map(placeRow)}
        </Section>
      )}
    </ScrollView>
  );
}

const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingBottom: 32 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  });
