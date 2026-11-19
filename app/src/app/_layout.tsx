import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { MiniTagProvider } from '@/ble/minitag-context';
import { AppThemeProvider, usePalette } from '@/theme/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppThemeProvider>
      <MiniTagProvider>
        <ThemedStack />
      </MiniTagProvider>
    </AppThemeProvider>
  );
}

/** Navigation chrome follows the chosen colour theme. */
function ThemedStack() {
  const p = usePalette();
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: { ...DefaultTheme.colors, background: p.ground, card: p.ground, primary: p.primary, text: p.ink },
    }),
    [p],
  );
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.ground } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
        <Stack.Screen name="find" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings" />
      </Stack>
    </ThemeProvider>
  );
}
