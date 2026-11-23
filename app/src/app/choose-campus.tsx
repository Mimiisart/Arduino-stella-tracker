import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Row, Section, SheetHeader, T } from '@/components/minitag/ui';
import { useCampus } from '@/features/campus';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

/** Pick the university you study at. Its map, buildings and rooms are then downloaded. */
export default function ChooseCampusScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const campus = useCampus();
  const { campuses, refresh } = campus;

  // First launch without a saved list: fetch it.
  useEffect(() => {
    if (campuses.length === 0) refresh();
  }, [campuses.length, refresh]);

  const choose = async (slug: string) => {
    await campus.selectCampus(slug);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={{ backgroundColor: p.ground }} contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}>
      <SheetHeader title="Your University" onDone={campus.campus ? () => router.back() : undefined} />

      <View style={s.intro}>
        <View style={s.introIcon}>
          <Icon name="graduationcap.fill" size={30} color={p.link} />
        </View>
        <T variant="small" style={{ textAlign: 'center' }}>
          MiTag uses your campus map to tell you which building, floor and room you left your ID in.
        </T>
      </View>

      {campuses.length === 0 ? (
        <Section footer={campus.error ?? 'Loading the list needs the internet the first time.'}>
          <Row title="Loading universities…" right={<ActivityIndicator />} />
        </Section>
      ) : (
        <Section
          header="Universities in Lagos"
          footer="Campus maps © OpenStreetMap contributors. More universities are coming.">
          {campuses.map((c) => {
            const on = c.slug === campus.campus?.slug;
            return (
              <Row
                key={c.slug}
                icon="building.columns.fill"
                title={c.name}
                subtitle={[c.shortName, c.area].filter(Boolean).join(' · ')}
                right={on ? <Icon name="checkmark" size={17} color={p.link} weight="semibold" /> : undefined}
                chevron={false}
                onPress={() => choose(c.slug)}
                accessibilityLabel={`${c.name}${on ? ', selected' : ''}`}
              />
            );
          })}
        </Section>
      )}
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 16, paddingTop: 8 },
    intro: { alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 24, paddingHorizontal: 20 },
    introIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
