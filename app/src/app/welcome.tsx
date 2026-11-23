import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ONBOARDED_KEY, useMiniTag } from '@/ble/minitag-context';
import { Button, Icon, IconTile, Radar, T, type IconName } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { useAppData } from '@/features/app-data';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

/** First launch: explain each permission before iOS asks for it. */
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
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.ground }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.hero} aria-hidden>
        <Radar size={120} active ringColor={p.onPrimaryMuted} guideColor={p.primaryGuide} rings={2}>
          <View style={s.core}>
            <Icon name="person.text.rectangle.fill" size={30} color={p.primary} />
          </View>
        </Radar>
      </View>

      <View>
        <T variant="title">Never lose your ID again</T>
        <T variant="body" style={{ color: p.muted, marginTop: 8 }}>
          MiniTag needs a few permissions to find and protect your ID card.
        </T>
      </View>

      <View style={s.list} accessibilityLabel="Permissions">
        <Permission icon="dot.radiowaves.left.and.right" title="Bluetooth" body="Connects to your tag so it can beep." required />
        <Permission
          icon="mappin.and.ellipse"
          title="Location"
          body="Remembers where your phone was when the tag disconnected."
          divider
        />
        <Permission icon="bell" title="Notifications" body="Warns you if you walk away from your ID." divider />
      </View>

      <View style={{ flex: 1 }} />

      <Button title="Allow and continue" onPress={() => finish(true)} loading={busy} />
      <Button title="Not now" variant="ghost" onPress={() => finish(false)} disabled={busy} />
      <T variant="caption">You can change these any time in Settings.</T>
    </ScrollView>
  );
}

function Permission({
  icon,
  title,
  body,
  required,
  divider,
}: {
  icon: IconName;
  title: string;
  body: string;
  required?: boolean;
  divider?: boolean;
}) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.row, divider && { borderTopWidth: 1, borderTopColor: p.divider }]} accessible>
      <IconTile name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowBody}>{body}</Text>
      </View>
      <View style={[s.pill, { backgroundColor: required ? p.primary : p.primarySoft }]}>
        <Text style={[s.pillText, { color: required ? p.onPrimary : p.link }]}>{required ? 'Required' : 'Optional'}</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { flexGrow: 1, paddingHorizontal: 20, gap: 14 },
    hero: {
      backgroundColor: p.primary,
      borderRadius: R.hero,
      height: 150,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    core: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: p.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: R.section,
      paddingHorizontal: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 10 },
    rowTitle: { fontFamily: F.bodySemibold, fontSize: 16, color: p.ink },
    rowBody: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: p.muted, marginTop: 1 },
    pill: { borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontFamily: F.bodySemibold, fontSize: 12 },
  });
