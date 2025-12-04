/**
 * Enhanced Route Restoration Utility
 * Provides better handling for route restoration after app refresh
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const ROUTE_STORAGE_KEY = 'lastVisitedRoute';

interface RouteState {
  pathname: string;
  params?: Record<string, any>;
  timestamp: number;
}

/**
 * Store the current route with parameters for better restoration
 */
export const storeRouteState = async (pathname: string, params: any = {}) => {
  try {
// console.log('💾 Storing route state - pathname:', pathname, 'params:', params);
    
    const routeState: RouteState = {
      pathname,
      params: params || {},
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routeState));
// console.log('✅ Route state stored successfully:', routeState);
  } catch (__error) {
    console.error('❌ Error storing route state:', __error);
  }
};

/**
 * Get the last visited route state
 */
export const getLastRouteState = async (): Promise<RouteState | null> => {
  try {
// console.log('🔍 Getting last route state from storage...');
    const storedRoute = await AsyncStorage.getItem(ROUTE_STORAGE_KEY);
// console.log('📊 Raw stored route data:', storedRoute);
    
    if (!storedRoute) {
// console.log('❌ No stored route found');
      return null;
    }

    const routeState: RouteState = JSON.parse(storedRoute);
// console.log('📊 Parsed route state:', routeState);

    // Check if the stored route is still valid (within 24 hours)
    const now = Date.now();
    const routeAge = now - routeState.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// console.log('⏰ Route age:', routeAge, 'ms, Max age:', maxAge, 'ms');

    if (routeAge > maxAge) {
// console.log('⏰ Route state expired, clearing...');
      await clearStoredRouteState();
      return null;
    }

// console.log('✅ Valid route state found:', routeState);
    return routeState;
  } catch (__error) {
    console.error('❌ Error getting route state:', __error);
    return null;
  }
};

/**
 * Restore the last visited route
 */
export const restoreLastRoute = async (): Promise<boolean> => {
  try {
// console.log('🔍 Attempting to restore last route...');
    const routeState = await getLastRouteState();

// console.log('📊 Retrieved route state:', routeState);
    
    if (routeState && routeState.pathname) {
// console.log('🔄 Restoring route:', routeState.pathname, 'with params:', routeState.params);
      
      // Use router.replace to restore the route
      if (routeState.params && Object.keys(routeState.params).length > 0) {
// console.log('🎯 Restoring with params');
        router.replace({
          pathname: routeState.pathname as any,
          params: routeState.params
        });
      } else {
// console.log('🎯 Restoring without params');
        router.replace(routeState.pathname as any);
      }
      
      return true;
    }

// console.log('❌ No valid route state found to restore');
    return false;
  } catch (__error) {
    console.error('❌ Error restoring route:', __error);
    return false;
  }
};

/**
 * Clear the stored route state
 */
export const clearStoredRouteState = async () => {
  try {
    await AsyncStorage.removeItem(ROUTE_STORAGE_KEY);
// console.log('🗑️ Stored route state cleared');
  } catch (__error) {
    console.error('❌ Error clearing route state:', __error);
  }
};

/**
 * Check if a route should be persisted
 */
export const shouldPersistRoute = (pathname: string): boolean => {
  const excludedRoutes = [
    '/',
    '/index',
    '/(auth)/welcome',
    '/(auth)/sign-in',
    '/(auth)/sign-up',
    '/verify-email',
    '/reset-password'
  ];

  return !excludedRoutes.includes(pathname);
};

export default {
  storeRouteState,
  getLastRouteState,
  restoreLastRoute,
  clearStoredRouteState,
  shouldPersistRoute,
};
