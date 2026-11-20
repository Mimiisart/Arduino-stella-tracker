import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ONBOARDED_KEY, useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, T, type IconName } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

/** First launch, in the style of Apple's welcome screens: explain each permission before iOS asks. */
export default function WelcomeScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tag = useMiniTag();
  const data = useAppData();
  const [busy, setBusy] = useState(false);

  const finish = async (askOptional: boolean) => {
    setBusy(true);
    Storage.setItemSync(ONBOARDED_KEY, '1');
    tag.startBluetooth(); // iOS shows the Bluetooth prompt now
    if (askOptional) {
      await data.requestLocation();
      await data.requestNotifications();
    }
    setBusy(false);
    router.replace('/');
    // Offer an account next; it's optional and the screen has Cancel.
    if (askOptional) router.push('/account?mode=signup');
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.surface }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
      <Text style={s.title} accessibilityRole="header">
        Welcome to{'\n'}
        <Text style={{ color: p.link }}>MiTag</Text>
      </Text>

      <View style={s.list} accessibilityLabel="Permissions">
        <Feature
          icon="dot.radiowaves.left.and.right"
          title="Bluetooth"
          body="Connects to the tag on your ID-card holder so it can beep. Required."
        />
        <Feature
          icon="location.fill"
          title="Location"
          body="Remembers where your phone was when the tag disconnected. Optional."
        />
        <Feature icon="bell.badge.fill" title="Notifications" body="Warns you if you walk away from your ID. Optional." />
      </View>

      <View style={{ flex: 1 }} />

      <T variant="caption" style={{ marginBottom: 14 }}>
        You can change these at any time in Settings.
      </T>
      <Button title="Continue" onPress={() => finish(true)} loading={busy} />
      <Button title="Not Now" variant="ghost" onPress={() => finish(false)} disabled={busy} style={{ marginTop: 4 }} />
    </ScrollView>
  );
}

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.row} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={s.iconWrap}>
        <Icon name={icon} size={30} color={p.link} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { flexGrow: 1, paddingHorizontal: 28 },
    title: { ...F.display, fontSize: 34, lineHeight: 41, color: p.ink, textAlign: 'center', marginBottom: 44 },
    list: { gap: 26 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconWrap: { width: 44, alignItems: 'center' },
    rowTitle: { ...F.bodySemibold, fontSize: 15, lineHeight: 20, color: p.ink },
    rowBody: { ...F.body, fontSize: 15, lineHeight: 20, color: p.muted },
  });
