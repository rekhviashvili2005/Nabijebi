// import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
// import * as SplashScreen from 'expo-splash-screen';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';
// import AuthScreen from '@/components/auth-screen';
// import '@/i18n';
// import { AuthProvider, useAuth } from '@/services/auth-context';

// SplashScreen.preventAutoHideAsync();

// function RootNavigator() {
//   const { session, isLoading } = useAuth();

//   // The splash overlay stays visible while the saved session is being read
//   if (isLoading) {
//     return null;
//   }

//   return session ? <AppTabs /> : <AuthScreen />;
// }

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AuthProvider>
//         <RootNavigator />
//       </AuthProvider>
//     </ThemeProvider>
//   );
// }










import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AuthScreen from '@/components/auth-screen';
import '@/i18n';
import { AuthProvider, useAuth } from '@/services/auth-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  // The splash overlay stays visible while the saved session is being read
  if (isLoading) {
    return null;
  }

  return session ? <Stack screenOptions={{ headerShown: false }} /> : <AuthScreen />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}