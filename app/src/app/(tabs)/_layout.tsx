import { NativeTabs } from 'expo-router/native-tabs';

import { usePalette } from '@/theme/theme-context';

/** The system tab bar (UITabBar), tinted with the theme colour. */
export default function TabsLayout() {
  const p = usePalette();
  return (
    <NativeTabs tintColor={p.link}>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: p.ground }}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map" contentStyle={{ backgroundColor: p.ground }}>
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="places" contentStyle={{ backgroundColor: p.ground }}>
        <NativeTabs.Trigger.Label>Places</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'mappin.circle', selected: 'mappin.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" contentStyle={{ backgroundColor: p.ground }}>
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
