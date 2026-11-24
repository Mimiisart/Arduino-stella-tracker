import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { AuthProvider } from '@/backend/auth-context';
import { MiniTagProvider } from '@/ble/minitag-context';
import { AppDataProvider } from '@/features/app-data';
import { CampusProvider } from '@/features/campus';
import { IndoorProvider } from '@/features/indoor-context';
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
      <AuthProvider>
        <MiniTagProvider>
          <CampusProvider>
            <IndoorProvider>
              <AppDataProvider>
                <ThemedStack />
              </AppDataProvider>
            </IndoorProvider>
          </CampusProvider>
        </MiniTagProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}

/** Navigation chrome follows the chosen colour theme. */
function ThemedStack() {
  const p = usePalette();
  const navTheme = useMemo(() => {
    const base = p.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: p.ground, card: p.ground, primary: p.link, text: p.ink, border: p.border },
    };
  }, [p]);
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={p.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
        <Stack.Screen name="find" options={{ animation: 'fade' }} />
        <Stack.Screen name="precision" options={{ presentation: 'modal' }} />
        <Stack.Screen name="alert" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="add-place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="battery" />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-room" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
