import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { MiniTagProvider } from '@/ble/minitag-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <MiniTagProvider>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'MiniTag', headerLargeTitle: true }} />
          <Stack.Screen name="pair" options={{ title: 'Add MiniTag', presentation: 'modal' }} />
          <Stack.Screen name="find" options={{ title: 'Find My ID' }} />
        </Stack>
      </MiniTagProvider>
    </ThemeProvider>
  );
}
