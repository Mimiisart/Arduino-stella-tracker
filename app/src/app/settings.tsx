import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import { BATTERY_LABEL, Button, Icon, T } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import { STATUS, THEMES, THEME_IDS, type Palette, type ThemeId } from '@/theme/themes';

export default function SettingsScreen() {
  const tag = useMiniTag();
  const { palette: p, themeId, setTheme } = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [draftName, setDraftName] = useState(tag.tracker?.name ?? '');

  const connected = tag.connection === 'connected';
  const level = batteryLevel(tag.status);
  const statusLine = connected
    ? [`Battery ${BATTERY_LABEL[level].toLowerCase()}`, tag.status && `Firmware ${tag.status.firmware}`].filter(Boolean).join(' · ')
    : 'Not connected right now';

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== tag.tracker?.name) tag.rename(trimmed);
    else setDraftName(tag.tracker?.name ?? '');
  };

  const confirmRemove = () =>
    Alert.alert(`Remove ${tag.tracker?.name ?? 'MiniTag'}?`, 'You can pair it again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await tag.forget();
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[s.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.back()} hitSlop={8} style={s.back}>
          <Icon name="chevron.left" size={17} color={p.primary} weight="semibold" />
          <Text style={s.backText}>Home</Text>
        </Pressable>

        <T variant="display" accessibilityRole="header">
          Settings
        </T>

        {/* Tracker */}
        {tag.tracker ? (
          <View style={s.trackerCard}>
            <View style={s.trackerIcon}>
              <Icon name="person.text.rectangle.fill" size={26} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.trackerName} numberOfLines={1}>
                {tag.tracker.name}
              </Text>
              <Text style={s.trackerSub}>{statusLine}</Text>
            </View>
            <View style={s.trackerChip}>
              <View style={[s.dot, { backgroundColor: connected ? STATUS.sageDot : p.idle }]} />
              <Text style={s.trackerChipText}>{connected ? 'Connected' : 'Away'}</Text>
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">No tracker yet</T>
                <T variant="small" style={{ marginTop: 2 }}>
                  Pair your MiniTag to see it here.
                </T>
              </View>
            </View>
            <Button title="Set up MiniTag" onPress={() => router.replace('/pair')} style={{ marginBottom: 14 }} />
          </View>
        )}

        {tag.tracker && (
          <View style={s.section}>
            <View style={s.sectionBody}>
              <Text style={s.rowTitle} nativeID="renameLabel">
                Tracker name
              </Text>
              <Text style={s.rowSub}>Shown on the home screen and in alerts</Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onEndEditing={saveName}
                onSubmitEditing={saveName}
                returnKeyType="done"
                maxLength={30}
                placeholder="School ID"
                placeholderTextColor={p.muted}
                accessibilityLabelledBy="renameLabel"
                accessibilityLabel="Tracker name"
                style={s.input}
              />
            </View>
          </View>
        )}

        {/* Appearance */}
        <View style={s.section}>
          <View style={s.sectionBody}>
            <Text style={s.rowTitle}>Colour theme</Text>
            <Text style={s.rowSub}>Changes the colours across MiniTag</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Colour theme" style={s.themeGrid}>
              {THEME_IDS.map((id) => (
                <ThemeOption key={id} id={id} selected={id === themeId} onPress={() => setTheme(id)} />
              ))}
            </View>
          </View>
        </View>

        {tag.tracker && <Button title="Remove tracker" variant="remove" onPress={confirmRemove} />}

        <T variant="caption">MiniTag {Constants.expoConfig?.version ?? ''}</T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A theme choice drawn as a tiny preview of that theme's home screen. */
function ThemeOption({ id, selected, onPress }: { id: ThemeId; selected: boolean; onPress: () => void }) {
  const s = useThemedStyles(makeStyles);
  const { palette: current } = useAppTheme();
  const { name, palette: t } = THEMES[id];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} theme`}
      onPress={onPress}
      style={({ pressed }) => [
        s.themeOption,
        { borderColor: selected ? current.primary : current.border },
        selected && { borderWidth: 2, padding: 9 },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={[s.preview, { backgroundColor: t.ground, borderColor: t.border }]}>
        <View style={[s.previewHero, { backgroundColor: t.primary }]}>
          <View style={[s.previewCore, { backgroundColor: t.accent }]} />
        </View>
        <View style={[s.previewButton, { backgroundColor: t.primary }]} />
      </View>
      <View style={s.themeLabelRow}>
        <Text style={[s.themeName, selected && { color: current.primary }]}>{name}</Text>
        {selected && (
          <View style={[s.check, { backgroundColor: current.primary }]}>
            <Icon name="checkmark" size={11} color={current.onPrimary} weight="heavy" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 20, gap: 14 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
    backText: { fontFamily: F.bodySemibold, fontSize: 16, color: p.primary },
    trackerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: p.primary,
      borderRadius: 26,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    trackerIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: p.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackerName: { fontFamily: F.display, fontSize: 24, color: p.onPrimary },
    trackerSub: { fontFamily: F.body, fontSize: 13, color: p.onPrimaryMuted, marginTop: 2 },
    trackerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: p.primaryChip,
      borderRadius: R.pill,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    trackerChipText: { fontFamily: F.bodySemibold, fontSize: 12, color: p.onPrimary },
    dot: { width: 7, height: 7, borderRadius: 4 },
    section: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: R.section,
      paddingHorizontal: 16,
    },
    sectionBody: { paddingTop: 14, paddingBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
    rowTitle: { fontFamily: F.bodySemibold, fontSize: 16, color: p.ink },
    rowSub: { fontFamily: F.body, fontSize: 13, color: p.muted, marginTop: 2, marginBottom: 12 },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 16,
      paddingHorizontal: 14,
      fontFamily: F.bodyMedium,
      fontSize: 16,
      color: p.ink,
      backgroundColor: p.ground,
    },
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    themeOption: {
      flexBasis: '47%',
      flexGrow: 1,
      borderWidth: 1,
      borderRadius: R.tile,
      padding: 10,
      gap: 8,
      backgroundColor: p.surface,
    },
    preview: { height: 72, borderRadius: 12, borderWidth: 1, padding: 6, gap: 5 },
    previewHero: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    previewCore: { width: 18, height: 18, borderRadius: 9 },
    previewButton: { height: 10, borderRadius: 5, width: '70%', alignSelf: 'center' },
    themeLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
    themeName: { fontFamily: F.bodySemibold, fontSize: 15, color: p.ink },
    check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  });
