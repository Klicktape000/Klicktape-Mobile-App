import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Redirect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/authContext';
import { getUserProfileData, getAuthRedirectPath } from '@/lib/profileUtils';
import { restoreLastRoute } from '@/lib/routeRestoration';
import SplashScreen from '@/components/SplashScreen';


export default function Index() {
  const { user, isAuthenticated, authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Initialize app after auth context is ready
  useEffect(() => {
    const initializeApp = async () => {
// console.log('🚀 App initialization started');
// console.log('📊 Auth loading:', authLoading, 'Is authenticated:', isAuthenticated, 'User:', user?.id);
// console.log('🌐 Platform:', Platform.OS);
      
      if (authLoading) {
        // Wait for auth context to finish loading
// console.log('⏳ Waiting for auth context to load...');
        return;
      }

      try {
        if (isAuthenticated && user) {
// console.log('✅ User is authenticated');
          
          // For web platform, completely skip initialization and let Expo Router handle everything
          if (Platform.OS === 'web') {
// console.log('🌐 Web platform detected - skipping all initialization, letting Expo Router handle routing');
            
            // Silently store user profile data in background without affecting routing
            getUserProfileData(user.id).then(profileData => {
              if (profileData) {
                AsyncStorage.setItem("user", JSON.stringify(profileData)).catch(console.error);
              }
            }).catch(console.error);
            
            // Immediately finish loading to let Expo Router take over
            setIsLoading(false);
            return;
          }
          
          // For mobile platforms, try to restore the last visited route
// console.log('📱 Mobile platform detected - attempting route restoration...');
          const routeRestored = await restoreLastRoute();
          
          if (routeRestored) {
// console.log('✅ Route successfully restored, exiting initialization');
            setIsLoading(false);
            return; // Exit early since route was restored
          }

          // If no route to restore, proceed with normal flow
// console.log('📍 No route to restore, proceeding with normal flow');
          
          // Get user profile data and store in AsyncStorage
          const profileData = await getUserProfileData(user.id);

          if (profileData) {
            await AsyncStorage.setItem("user", JSON.stringify(profileData));
          }

          // Determine where to redirect the user based on profile completion
          const redirectPath = await getAuthRedirectPath(user.id, user.email);
          setRedirectPath(redirectPath);
        } else {
          // User is not authenticated
          setRedirectPath(null);
        }
      } catch (__error) {
        console.error("❌ Error in app initialization:", __error);
        // Default to create-profile for safety if authenticated, otherwise null
        setRedirectPath(isAuthenticated ? '/(root)/create-profile' : null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [user, isAuthenticated, authLoading]);

  // Show splash screen first
  if (showSplash) {
    return (
      <SplashScreen 
        onFinish={() => setShowSplash(false)} 
      />
    );
  }

  // Show loading screen while initializing
  if (isLoading || authLoading) {
    // For web platform, don't show loading screen to avoid interfering with direct routes
    if (Platform.OS === 'web' && !authLoading) {
      return null;
    }
    
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Handle redirects
  if (redirectPath) {
    return <Redirect href={redirectPath as any} />;
  }

  // If not authenticated, redirect to sign-in screen
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // For web platform, don't redirect to tabs - let Expo Router handle the current URL
  if (Platform.OS === 'web') {
    // Return null to let Expo Router handle the current route
    return null;
  }

  // Default fallback for mobile platforms
  return <Redirect href="/(root)/(tabs)/home" />;
}

