// Import polyfills first - CRITICAL: Must be before any other imports
import '../polyfills';
import 'react-native-get-random-values';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import './globals.css';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/src/store/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import { notificationService } from '@/lib/notificationManager';
import { QueryProvider } from '@/lib/query/QueryProvider';
import { AlertProvider } from '@/components/providers/AlertProvider';
// Removed RefreshProvider - using standard React Native refresh instead
import { alertService } from "@/lib/utils/alertService";
import { AuthProvider } from "@/lib/authContext";
import RouteTracker from "@/components/RouteTracker";
import { developmentErrorFilter } from '../lib/utils/developmentErrorFilter';
import ErrorBoundary from "@/components/ErrorBoundary";

import { initializePerformanceMonitoring } from '@/lib/performance/bundleOptimizer';
import { initializeApiOptimizations } from '@/lib/performance/apiOptimizer';
import { initializeNetworkOptimization } from '@/lib/performance/networkOptimizer';
import { initializeMemoryOptimization } from '@/lib/performance/memoryOptimizer';
// Load React Native Reanimated on native platforms only
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated');
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Theme-aware Stack component
function ThemedStack() {
  const { isDarkMode } = useTheme();

  return (
    <Stack
      screenOptions={{
        // Set theme-aware background for all screens to prevent white flash
        contentStyle: {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(root)" options={{ headerShown: false }} />

      <Stack.Screen
        name="verify-email"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

// Initialize performance monitoring ONLY in production to reduce dev overhead
if (process.env.NODE_ENV === 'production') {
  // Lazy load performance monitoring to reduce initial bundle size
  setTimeout(() => {
    initializePerformanceMonitoring();
    initializeApiOptimizations();
    initializeNetworkOptimization();
    initializeMemoryOptimization();
  }, 3000); // Delay 3 seconds after app start
}

// DO NOT initialize error filter here - it will be initialized after component mounts

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();

      // Initialize development error filtering after polyfills are loaded
      if (__DEV__ || process.env.NODE_ENV === 'development') {
        try {
          developmentErrorFilter.initialize();
        } catch (error) {
// console.warn('Could not initialize development error filter:', error);
        }
      }

      // Initialize notification service (non-blocking)
      const initializeNotifications = async () => {
        try {
          const cleanup = await notificationService.initializeOnAppStart();
          if (cleanup && typeof cleanup === 'function') {
            // Store cleanup function for potential future use
            if (__DEV__) {
              alertService.success('Notifications', 'Notification service initialized successfully');
            }
          }
        } catch {
          alertService.warning('Notifications', 'Notification service initialization failed, continuing without notifications');
        }
      };

      initializeNotifications();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <QueryProvider>
              <ThemeProvider>
                <AuthProvider>
                  <AlertProvider>
                    <RouteTracker />
                    <DeepLinkHandler />
                    <ThemedStack />
                    {/* Only load NotificationManager for development builds, not Expo Go */}
                  </AlertProvider>
                </AuthProvider>
              </ThemeProvider>
            </QueryProvider>
          </PersistGate>
        </Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

