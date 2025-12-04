/**
 * Route Persistence Utility
 * Handles storing and restoring the current route to maintain navigation state on app refresh
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const LAST_ROUTE_KEY = 'lastVisitedRoute';

/**
 * Store the current route for persistence across app refreshes
 */
export const storeCurrentRoute = async (route: string) => {
  try {
    // Don't store certain routes that shouldn't be restored
    const excludedRoutes = [
      '/',
      '/index',
      '/(auth)/welcome',
      '/(auth)/sign-in',
      '/(auth)/sign-up',
      '/verify-email',
      '/reset-password'
    ];

    // Also exclude dynamic routes that might cause issues
    const isDynamicRoute = route.includes('[') || route.includes(']');
    
    if (!excludedRoutes.includes(route) && !isDynamicRoute) {
      await AsyncStorage.setItem(LAST_ROUTE_KEY, route);
// console.log('📍 Route stored for persistence:', route);
    } else {
// console.log('📍 Route excluded from persistence:', route);
    }
  } catch (__error) {
    console.error('❌ Error storing route:', __error);
  }
};

/**
 * Get the last visited route
 */
export const getLastVisitedRoute = async (): Promise<string | null> => {
  try {
    const route = await AsyncStorage.getItem(LAST_ROUTE_KEY);
    return route;
  } catch (__error) {
    console.error('❌ Error getting last visited route:', __error);
    return null;
  }
};

/**
 * Clear the stored route
 */
export const clearStoredRoute = async () => {
  try {
    await AsyncStorage.removeItem(LAST_ROUTE_KEY);
// console.log('🗑️ Stored route cleared');
  } catch (__error) {
    console.error('❌ Error clearing stored route:', __error);
  }
};

/**
 * Hook to automatically track route changes
 */
export const useRouteTracking = () => {
  // This would be used in individual screens to track when they become active
  const trackRoute = (route: string) => {
    storeCurrentRoute(route);
  };

  return { trackRoute };
};

export default {
  storeCurrentRoute,
  getLastVisitedRoute,
  clearStoredRoute,
  useRouteTracking,
};
