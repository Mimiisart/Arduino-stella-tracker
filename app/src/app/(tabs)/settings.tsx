import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { friendlyAuthError, useAuth } from '@/backend/auth-context';
import { useMiniTag } from '@/ble/minitag-context';
import { batteryLevel } from '@/ble/protocol';
import { BATTERY_LABEL, Icon, LargeTitle, Row, Section, T, Toggle } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { ALERT_DELAYS, useAppData } from '@/features/app-data';
import { useCampus } from '@/features/campus';
import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import { THEMES, THEME_IDS, type ModePreference, type Palette } from '@/theme/themes';

const MODES: { id: ModePreference; label: string }[] = [
  { id: 'system', label: 'Match iPhone' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function delayLabel(d: number) {
  return d < 60 ? `${d} seconds` : `${d / 60} minute${d === 60 ? '' : 's'}`;
}

export default function SettingsScreen() {
  const tag = useMiniTag();
  const data = useAppData();
  const campus = useCampus();
  const { palette: p, themeId, setTheme, modePreference, setModePreference } = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const [draftName, setDraftName] = useState(tag.tracker?.name ?? '');
  const [openedAt] = useState(Date.now);
  const snoozed = !!data.prefs.snoozedUntil && data.prefs.snoozedUntil > openedAt;

  const connected = tag.connection === 'connected';
  const level = batteryLevel(tag.status);
  const statusLine = connected
    ? [`Battery ${BATTERY_LABEL[level].toLowerCase()}`, tag.status && `firmware ${tag.status.firmware}`]
        .filter(Boolean)
        .join(' · ')
    : 'Not connected right now';

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== tag.tracker?.name) tag.rename(trimmed);
    else setDraftName(tag.tracker?.name ?? '');
  };

  const confirmRemove = () =>
    Alert.alert(`Remove ${tag.tracker?.name ?? 'MiTag'}?`, 'You can pair it again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => tag.forget() },
    ]);

  const check = (on: boolean) => (on ? <Icon name="checkmark" size={17} color={p.link} weight="semibold" /> : undefined);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled">
        <LargeTitle title="Settings" />

        <AccountSection />

        <Section header="University" footer="Your campus map: buildings, floors and rooms for leave-behind alerts.">
          <Row
            icon="building.columns.fill"
            title={campus.campus?.name ?? 'Choose Your University'}
            subtitle={campus.campus ? `${campus.buildings.length} buildings · ${campus.rooms.length} rooms` : undefined}
            onPress={() => router.push('/choose-campus')}
          />
        </Section>

        {/* Tracker */}
        {tag.tracker ? (
          <Section header="Tracker" footer="The name shows on the Home screen and in alerts.">
            <View style={s.trackerRow} accessible accessibilityLabel={`${tag.tracker.name}. ${statusLine}`}>
              <View style={[s.trackerIcon, { backgroundColor: connected ? p.primary : p.disabledBg }]}>
                <Icon name="person.text.rectangle.fill" size={24} color={connected ? '#FFFFFF' : p.idle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trackerName} numberOfLines={1}>
                  {tag.tracker.name}
                </Text>
                <View style={s.statusRow}>
                  <View style={[s.dot, { backgroundColor: connected ? p.sageDot : p.idle }]} />
                  <Text style={s.trackerSub}>{statusLine}</Text>
                </View>
              </View>
            </View>
            <View style={s.inputRow}>
              <Text style={s.inputLabel}>Name</Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onEndEditing={saveName}
                onSubmitEditing={saveName}
                returnKeyType="done"
                maxLength={30}
                placeholder="School ID"
                placeholderTextColor={p.idle}
                keyboardAppearance={p.mode}
                accessibilityLabel="Tracker name"
                style={s.input}
              />
            </View>
            <Row title="Battery" value={connected ? BATTERY_LABEL[level] : '—'} onPress={() => router.push('/battery')} />
          </Section>
        ) : (
          <Section header="Tracker" footer="Pair the MiTag on your ID-card holder to see it here.">
            <Row icon="plus" title="Set Up MiTag" onPress={() => router.push('/pair')} />
          </Section>
        )}

        {/* Alerts */}
        <Section
          header="Leave-behind alerts"
          footer={
            !data.prefs.alertsEnabled
              ? 'Warns you if you walk away from your ID.'
              : [
                  data.prefs.phoneBuzz
                    ? 'Your phone plays a loud alarm and vibrates three times, 10 seconds apart, and keeps vibrating while MiTag is open. The alarm follows your ringer volume; on silent it only vibrates.'
                    : 'Your phone shows one notification.',
                  data.prefs.tagBeep
                    ? 'If the tracker loses your phone for 10 seconds, it also beeps for 20 seconds so people nearby notice your ID.'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')
          }>
          <Row
            title="Alerts"
            right={
              <Toggle
                value={data.prefs.alertsEnabled}
                label="Leave-behind alerts"
                onChange={async (v) => {
                  if (v && data.notificationPermission !== 'granted') await data.requestNotifications();
                  data.setPrefs({ alertsEnabled: v, snoozedUntil: null });
                }}
              />
            }
          />
          {data.prefs.alertsEnabled && data.notificationPermission === 'denied' && (
            <Row
              title="Notifications Are Off"
              subtitle="Alerts can't show. Turn them on in Settings."
              tinted
              onPress={() => Linking.openSettings()}
            />
          )}
          {snoozed && data.prefs.snoozedUntil && (
            <Row
              title="Resume Alerts"
              subtitle={`Snoozed until ${new Date(data.prefs.snoozedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              tinted
              onPress={() => data.setPrefs({ snoozedUntil: null })}
            />
          )}
          {data.prefs.alertsEnabled && (
            <Row
              title="Phone Beeps and Vibrates"
              right={
                <Toggle
                  value={data.prefs.phoneBuzz}
                  label="Phone keeps beeping and vibrating when left behind"
                  onChange={(v) => data.setPrefs({ phoneBuzz: v })}
                />
              }
            />
          )}
          {data.prefs.alertsEnabled && (
            <Row
              title="Tracker Beeps Too"
              right={
                <Toggle
                  value={data.prefs.tagBeep}
                  label="Tracker beeps when left behind"
                  onChange={(v) => data.setPrefs({ tagBeep: v })}
                />
              }
            />
          )}
        </Section>

        {data.prefs.alertsEnabled && (
          <Section header="Wait before alerting" footer="Gives MiTag time to reconnect first.">
            {ALERT_DELAYS.map((d) => (
              <Row
                key={d}
                title={delayLabel(d)}
                right={check(d === data.prefs.alertDelay)}
                chevron={false}
                onPress={() => data.setPrefs({ alertDelay: d })}
                accessibilityLabel={`${delayLabel(d)}${d === data.prefs.alertDelay ? ', selected' : ''}`}
              />
            ))}
          </Section>
        )}

        {/* Location */}
        <Section header="Location" footer="Saves where your phone was when the tracker disconnected. Only you can see it.">
          <Row
            title="Remember Last Seen"
            right={
              <Toggle
                value={data.prefs.rememberLastSeen}
                label="Remember last seen location"
                onChange={async (v) => {
                  if (v && data.locationPermission !== 'granted') await data.requestLocation();
                  data.setPrefs({ rememberLastSeen: v });
                }}
              />
            }
          />
          {data.prefs.rememberLastSeen && data.locationPermission === 'denied' && (
            <Row title="Location Is Off" subtitle="Turn it on for MiTag in Settings." tinted onPress={() => Linking.openSettings()} />
          )}
          {data.history.length > 0 && (
            <Row
              title="Clear Last-Seen History"
              destructive
              onPress={() =>
                Alert.alert('Clear last-seen history?', 'MiTag forgets every place it has seen your ID.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: data.clearHistory },
                ])
              }
            />
          )}
        </Section>

        {/* Appearance */}
        <Section header="Appearance">
          {MODES.map((m) => (
            <Row
              key={m.id}
              title={m.label}
              right={check(m.id === modePreference)}
              chevron={false}
              onPress={() => setModePreference(m.id)}
              accessibilityLabel={`${m.label}${m.id === modePreference ? ', selected' : ''}`}
            />
          ))}
        </Section>

        <Section header="Accent colour">
          {THEME_IDS.map((id) => (
            <Row
              key={id}
              title={THEMES[id].name}
              right={
                <>
                  <View style={[s.swatch, { backgroundColor: THEMES[id][p.mode].primary }]} />
                  <View style={{ width: 17 }}>{check(id === themeId)}</View>
                </>
              }
              chevron={false}
              onPress={() => setTheme(id)}
              accessibilityLabel={`${THEMES[id].name}${id === themeId ? ', selected' : ''}`}
            />
          ))}
        </Section>

        {tag.tracker && (
          <Section>
            <Row title="Remove Tracker" destructive onPress={confirmRemove} />
          </Section>
        )}

        <T variant="caption">MiTag {Constants.expoConfig?.version ?? ''}</T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Signed out: create account / sign in. Signed in: name, email, sign out, delete my data. */
function AccountSection() {
  const auth = useAuth();
  const { palette: p } = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);

  if (!auth.ready) return null;

  if (!auth.session) {
    return (
      <Section
        header="Account"
        footer="Optional. An account lets other MiTag users help find your tag. Beeping, alerts and the map work without one.">
        <Row icon="person.crop.circle.fill" title="Create Account" onPress={() => router.push('/account?mode=signup')} />
        <Row title="Sign In" tinted onPress={() => router.push('/account?mode=signin')} />
      </Section>
    );
  }

  const name = auth.profile?.displayName ?? 'Your account';
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your tag keeps working. Sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: () => auth.signOut().catch(() => {}) },
    ]);
  const confirmDelete = () =>
    Alert.alert(
      'Delete your account and data?',
      'This permanently deletes your account, name and email from MiTag’s server. It can’t be undone. Your tag and settings on this phone stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await auth.deleteMyData();
              Alert.alert('Deleted', 'Your account and data have been deleted.');
            } catch (e) {
              Alert.alert('Couldn’t delete', friendlyAuthError(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <>
      <Section>
        <View style={s.trackerRow} accessible accessibilityLabel={`${name}. ${auth.email ?? ''}`}>
          <View style={[s.avatar, { backgroundColor: p.idle }]}>
            <Text style={s.avatarText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.trackerName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={s.trackerSub} numberOfLines={1}>
              {auth.email}
            </Text>
          </View>
        </View>
      </Section>
      <Section>
        <Row title="Sign Out" tinted onPress={confirmSignOut} />
        {busy ? (
          <Row title="Deleting…" />
        ) : (
          <Row
            title="Delete My Data"
            destructive
            onPress={confirmDelete}
            accessibilityHint="Permanently deletes your account, name and email"
          />
        )}
      </Section>
    </>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingBottom: 32 },
    trackerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16 },
    trackerIcon: { width: 44, height: 44, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
    trackerName: { ...F.bodySemibold, fontSize: 17, lineHeight: 22, color: p.ink },
    trackerSub: { ...F.body, fontSize: 15, lineHeight: 20, color: p.muted, flexShrink: 1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, gap: 12 },
    inputLabel: { ...F.body, fontSize: 17, color: p.ink },
    input: { flex: 1, minHeight: 44, ...F.body, fontSize: 17, color: p.muted, textAlign: 'right' },
    avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    avatarText: { ...F.bodySemibold, fontSize: 24, color: '#FFFFFF' },
    swatch: { width: 22, height: 22, borderRadius: 11 },
  });
