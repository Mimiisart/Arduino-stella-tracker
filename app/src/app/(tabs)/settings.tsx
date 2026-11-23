import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import { BATTERY_LABEL, Button, Icon, T, Toggle, type IconName } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { ALERT_DELAYS, useAppData, type AlertDelay } from '@/features/app-data';
import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import { THEMES, THEME_IDS, type ModePreference, type Palette, type ThemeId } from '@/theme/themes';

const MODES: { id: ModePreference; label: string; icon: IconName }[] = [
  { id: 'light', label: 'Light', icon: 'sun.max' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'system', label: 'Match iPhone', icon: 'iphone' },
];

export default function SettingsScreen() {
  const tag = useMiniTag();
  const data = useAppData();
  const { palette: p, themeId, setTheme, modePreference, setModePreference } = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [draftName, setDraftName] = useState(tag.tracker?.name ?? '');
  const [openedAt] = useState(Date.now);
  const snoozed = !!data.prefs.snoozedUntil && data.prefs.snoozedUntil > openedAt;

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
        onPress: () => tag.forget(),
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[s.page, { paddingTop: insets.top + 16, paddingBottom: 28 }]}
        keyboardShouldPersistTaps="handled">
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
              <View style={[s.dot, { backgroundColor: connected ? p.sageDot : p.idle }]} />
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
            <Button title="Set up MiniTag" onPress={() => router.push('/pair')} style={{ marginBottom: 14 }} />
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
                keyboardAppearance={p.mode}
                accessibilityLabelledBy="renameLabel"
                accessibilityLabel="Tracker name"
                style={s.input}
              />
            </View>
          </View>
        )}

        {/* Alerts */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Leave-behind alerts</Text>
              <Text style={[s.rowSub, { marginBottom: 0 }]}>Warn me if I walk away from my ID</Text>
            </View>
            <Toggle
              value={data.prefs.alertsEnabled}
              label="Leave-behind alerts"
              onChange={async (v) => {
                if (v && data.notificationPermission !== 'granted') await data.requestNotifications();
                data.setPrefs({ alertsEnabled: v, snoozedUntil: null });
              }}
            />
          </View>
          {data.prefs.alertsEnabled && data.notificationPermission === 'denied' && (
            <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={s.warn}>
              <Text style={s.warnText}>Notifications are off for MiniTag, so alerts can&apos;t show. Tap to open Settings.</Text>
            </Pressable>
          )}
          {snoozed && data.prefs.snoozedUntil && (
            <Pressable accessibilityRole="button" onPress={() => data.setPrefs({ snoozedUntil: null })} style={s.warn}>
              <Text style={s.warnText}>
                Alerts snoozed until{' '}
                {new Date(data.prefs.snoozedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Tap to
                turn them back on.
              </Text>
            </Pressable>
          )}
          {data.prefs.alertsEnabled && (
            <View style={[s.sectionBody, { borderTopWidth: 1, borderTopColor: p.divider }]}>
              <Text style={[s.rowTitle, { fontSize: 15 }]}>Wait before alerting</Text>
              <Text style={s.rowSub}>Gives MiniTag time to reconnect first</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Alert delay" style={s.segment}>
                {ALERT_DELAYS.map((d: AlertDelay) => {
                  const on = d === data.prefs.alertDelay;
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => data.setPrefs({ alertDelay: d })}
                      style={({ pressed }) => [
                        s.chip,
                        on && { backgroundColor: p.primary, borderColor: p.primary },
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Text style={[s.segmentText, { fontSize: 15, color: on ? p.onPrimary : p.ink }]}>
                        {d < 60 ? `${d} s` : `${d / 60} min`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Remember last seen</Text>
              <Text style={[s.rowSub, { marginBottom: 0 }]}>Save where my phone was when it disconnected</Text>
            </View>
            <Toggle
              value={data.prefs.rememberLastSeen}
              label="Remember last seen location"
              onChange={async (v) => {
                if (v && data.locationPermission !== 'granted') await data.requestLocation();
                data.setPrefs({ rememberLastSeen: v });
              }}
            />
          </View>
          {data.prefs.rememberLastSeen && data.locationPermission === 'denied' && (
            <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={s.warn}>
              <Text style={s.warnText}>Location is off for MiniTag. Tap to open Settings.</Text>
            </Pressable>
          )}
          {data.history.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Clear last-seen history?', 'MiniTag forgets every place it has seen your ID.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: data.clearHistory },
                ])
              }
              style={[s.row, { borderTopWidth: 1, borderTopColor: p.divider, minHeight: 50 }]}>
              <Text style={[s.rowTitle, { fontSize: 15, color: p.link }]}>Clear last-seen history</Text>
            </Pressable>
          )}
        </View>

        {/* Appearance */}
        <View style={s.section}>
          <View style={[s.sectionBody, { borderBottomWidth: 1, borderBottomColor: p.divider }]}>
            <Text style={s.rowTitle}>Mode</Text>
            <Text style={s.rowSub}>Light, dark, or follow your iPhone&apos;s setting</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Mode" style={s.segment}>
              {MODES.map((m) => {
                const on = m.id === modePreference;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                    onPress={() => setModePreference(m.id)}
                    style={({ pressed }) => [
                      s.segmentItem,
                      on && { backgroundColor: p.primary, borderColor: p.primary },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Icon name={m.icon} size={18} color={on ? p.onPrimary : p.muted} weight="semibold" />
                    <Text style={[s.segmentText, { color: on ? p.onPrimary : p.ink }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
  const { palette: current, mode } = useAppTheme();
  const { name } = THEMES[id];
  const t = THEMES[id][mode]; // preview in the mode that is showing now
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} theme`}
      onPress={onPress}
      style={({ pressed }) => [
        s.themeOption,
        { borderColor: selected ? current.link : current.border },
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
        <Text style={[s.themeName, selected && { color: current.link }]}>{name}</Text>
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
    segment: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.ground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warn: { backgroundColor: p.primarySoft, borderRadius: 14, padding: 12, marginBottom: 12 },
    warnText: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: p.ink },
    segmentItem: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.ground,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 4,
    },
    segmentText: { fontFamily: F.bodySemibold, fontSize: 13, textAlign: 'center' },
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
