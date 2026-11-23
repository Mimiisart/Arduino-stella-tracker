import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/minitag/ui';
import { F } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Home', icon: 'house', iconOn: 'house.fill' },
  map: { label: 'Map', icon: 'mappin.and.ellipse', iconOn: 'mappin.and.ellipse' },
  places: { label: 'Places', icon: 'building.2', iconOn: 'building.2.fill' },
  settings: { label: 'Settings', icon: 'slider.horizontal.3', iconOn: 'slider.horizontal.3' },
};

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.ground } }}
      tabBar={(props) => <PillTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="places" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

/** The floating pill tab bar from the design canvas. */
function PillTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const on = i === state.index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.label}
              onPress={() => navigateToTab(route.key)}
              style={({ pressed }) => [s.item, on && { backgroundColor: p.primary }, pressed && !on && { opacity: 0.7 }]}>
              <Icon name={on ? tab.iconOn : tab.icon} size={21} color={on ? p.onPrimary : p.muted} />
              <Text style={[s.label, { color: on ? p.onPrimary : p.muted, fontFamily: on ? F.bodySemibold : F.bodyMedium }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 20, paddingTop: 8, backgroundColor: p.ground },
    bar: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 28,
      padding: 6,
      shadowColor: '#4E1420',
      shadowOpacity: p.mode === 'dark' ? 0 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    item: {
      flex: 1,
      minHeight: 52,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    label: { fontSize: 12 },
  });
