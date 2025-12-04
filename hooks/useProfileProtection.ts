import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';
import { Platform, AppState } from 'react-native';
import { checkProfileCompletion } from '@/lib/profileUtils';
import { authManager } from '@/lib/authManager';
import { supabase } from '@/lib/supabase';

// Cache to prevent repeated profile checks within same session
const profileCheckCache = new Map<string, { isComplete: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Track if app is being reopened (fresh launch)
let appLaunchTime = Date.now();

/**
 * Hook to protect routes that require a complete profile
 * Redirects to create-profile if profile is incomplete
 * - Checks on every fresh app launch
 * - Uses cache within the same session to prevent repeated checks
 */
export const useProfileProtection = () => {
  const pathname = usePathname();
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);

  useEffect(() => {
    // Skip profile protection on web platform to allow natural URL handling
    if (Platform.OS === 'web') {
      return;
    }

    // Skip if already checking to prevent duplicate checks
    if (isCheckingRef.current) {
      return;
    }

    const checkAndRedirect = async () => {
      // Prevent duplicate checks
      if (isCheckingRef.current) {
        return;
      }

      // Check if this is a fresh app launch (within 3 seconds of app start)
      const isAppLaunch = (Date.now() - appLaunchTime) < 3000;
      
      // Only run if:
      // 1. Fresh app launch, OR
      // 2. Haven't checked in the last 30 seconds (prevents spam but allows periodic checks)
      const timeSinceLastCheck = Date.now() - lastCheckTimeRef.current;
      if (!isAppLaunch && timeSinceLastCheck < 30000) {
        return;
      }

      isCheckingRef.current = true;

      try {
        // Skip profile protection for certain routes
        const skipRoutes = ['/notifications', '/notification-settings', '/create-profile'];
        if (skipRoutes.some(route => pathname?.includes(route))) {
          return;
        }

        // Get current user
        let user;
        try {
          user = await authManager.getCurrentUser();
        } catch (error) {
          console.error("❌ Error getting user from auth manager:", error);
          // Fallback to direct Supabase call with error handling
          try {
            const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
            if (authError) {
              if (authError.message?.includes('Auth session missing')) {
                user = null;
              } else {
                console.error("Profile protection auth error:", authError);
                user = null;
              }
            } else {
              user = supabaseUser;
            }
          } catch (fallbackError) {
            user = null;
          }
        }

        if (!user) {
          router.replace("/(auth)/sign-in");
          return;
        }

        // Check cache first to avoid repeated database queries (within same session)
        const cached = profileCheckCache.get(user.id);
        const now = Date.now();
        
        // Use cache only if not a fresh app launch and cache is still valid
        if (!isAppLaunch && cached && (now - cached.timestamp) < CACHE_DURATION) {
          // Use cached result
          if (!cached.isComplete) {
            router.replace("/(root)/create-profile");
          }
          return;
        }

        // Check profile completion from database
        try {
          const completionStatus = await checkProfileCompletion(user.id);
          
          // Cache the result
          profileCheckCache.set(user.id, {
            isComplete: completionStatus.exists && completionStatus.isComplete,
            timestamp: now,
          });
          
          // Update last check time
          lastCheckTimeRef.current = now;
          
          if (!completionStatus.exists || !completionStatus.isComplete) {
            // Profile incomplete - redirect to create-profile
            router.replace("/(root)/create-profile");
            return;
          }
        } catch (profileError) {
          console.error("❌ Error checking profile completion:", profileError);
          // On error, don't redirect to avoid infinite loops
        }
      } catch (error) {
        console.error("❌ Error in profile protection:", error);
        // On error, don't redirect to avoid infinite loops
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkAndRedirect();
  }, [pathname]); // ✅ React to pathname changes but use smart caching

  // Listen for app state changes to detect when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - update launch time to force fresh check
        appLaunchTime = Date.now();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
};

/**
 * Clear profile check cache (call this after profile update)
 */
export const clearProfileCheckCache = (userId?: string) => {
  if (userId) {
    profileCheckCache.delete(userId);
  } else {
    profileCheckCache.clear();
  }
  // Reset launch time to force fresh check on next navigation
  appLaunchTime = Date.now();
};
