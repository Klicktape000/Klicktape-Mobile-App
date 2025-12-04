/**
 * Optimized Data Fetching Hook
 * Reduces API calls by batching requests and using intelligent caching
 */

import { useState, useEffect, useCallback } from 'react';
import { authManager } from '../authManager';
import { requestBatcher } from '../utils/requestBatcher';
import { notificationsAPI } from '../notificationsApi';
import { messagesAPI } from '../messagesApi';

interface HomeData {
  unreadNotifications: number;
  unreadMessages: number;
  userId: string | null;
}

interface UseOptimizedDataFetchingOptions {
  enableRealtime?: boolean;
  fetchInterval?: number;
  cacheTime?: number;
}

export const useOptimizedDataFetching = (
  options: UseOptimizedDataFetchingOptions = {}
) => {
  const {
    enableRealtime = true,
    fetchInterval = 30000, // 30 seconds
    cacheTime = 5 * 60 * 1000, // 5 minutes
  } = options;

  const [data, setData] = useState<HomeData>({
    unreadNotifications: 0,
    unreadMessages: 0,
    userId: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    return Date.now() - lastFetchTime < cacheTime;
  }, [lastFetchTime, cacheTime]);

  // Optimized data fetching function
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      // Skip if cache is still valid and not forcing refresh
      if (!forceRefresh && isCacheValid() && data.userId) {
// console.log('📊 Data: Serving from cache');
        return data;
      }

// console.log('📊 Data: Fetching fresh data');
      setLoading(true);
      setError(null);

      // Get user from auth manager (cached)
      let user;
      try {
        user = await authManager.getCurrentUser();
      } catch (__authError) {
        console.error('Auth manager error, falling back to direct Supabase call:', __authError);
        // Fallback to direct Supabase call with proper error handling
        const { supabase } = await import('../supabase');
        if (supabase) {
          try {
            const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
            if (error) {
              if (error.message?.includes('Auth session missing')) {
// console.log('📊 Data: No authenticated session found');
                user = null;
              } else {
                console.error('📊 Data: Auth error in fallback:', error);
                user = null;
              }
            } else {
              user = supabaseUser ? {
                id: supabaseUser.id,
                email: supabaseUser.email!,
                cached_at: Date.now(),
              } : null;
            }
          } catch (__fallbackError: any) {
// console.warn('📊 Data: Fallback auth call failed:', __fallbackError.message);
            user = null;
          }
        }
      }

      if (!user) {
        setData({ unreadNotifications: 0, unreadMessages: 0, userId: null });
        setLoading(false);
        return;
      }

      // Batch the notification and message requests
      const [notifications, unreadMessages] = await Promise.all([
        notificationsAPI.getNotifications(user.id),
        messagesAPI.getUnreadMessagesCount(user.id),
      ]);

      const unreadNotifications = notifications.filter(n => !n.is_read).length;

      const newData = {
        unreadNotifications,
        unreadMessages,
        userId: user.id,
      };

      setData(newData);
      setLastFetchTime(Date.now());
// console.log('📊 Data: Fresh data loaded');

      return newData;
    } catch (__err) {
      console.error('📊 Data: Error fetching data:', __err);
      setError(__err instanceof Error ? __err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [data, isCacheValid]);

  // Initial data fetch
  useEffect(() => {
    // Initial fetch: keep this to populate badges/counters, but it should not affect the post feed
    fetchData();
  }, []);

  // Set up periodic refresh if enabled
  useEffect(() => {
    // Manual-only feed requirement: default to no interval unless explicitly enabled by caller
    if (!enableRealtime || fetchInterval <= 0) return;

    const interval = setInterval(() => {
      // Only fetch if cache is expired
      if (!isCacheValid()) {
        fetchData();
      }
    }, fetchInterval);

    return () => clearInterval(interval);
  }, [enableRealtime, fetchInterval, fetchData, isCacheValid]);

  // Refresh function for manual refresh
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    setLastFetchTime(0);
    setData({ unreadNotifications: 0, unreadMessages: 0, userId: null });
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    isCacheValid: isCacheValid(),
    lastFetchTime,
  };
};

/**
 * Hook for batched profile data fetching
 */
export const useBatchedProfiles = (userIds: string[]) => {
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userIds.length === 0) return;

    const fetchProfiles = async () => {
      setLoading(true);
      try {
        const profilesData = await requestBatcher.batchProfileRequests(userIds);
        const profilesMap: Record<string, any> = {};
        
        profilesData.forEach(profile => {
          profilesMap[profile.id] = profile;
        });

        setProfiles(profilesMap);
      } catch (__error) {
        console.error('Error fetching batched profiles:', __error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [userIds.join(',')]); // Only re-fetch if userIds change

  return { profiles, loading };
};

/**
 * Hook for batched like status checks
 */
export const useBatchedLikeStatus = (userId: string, postIds: string[]) => {
  const [likeStatus, setLikeStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || postIds.length === 0) return;

    const fetchLikeStatus = async () => {
      setLoading(true);
      try {
        const status = await requestBatcher.batchLikeStatusChecks(userId, postIds);
        setLikeStatus(status);
      } catch (__error) {
        console.error('Error fetching batched like status:', __error);
      } finally {
        setLoading(false);
      }
    };

    fetchLikeStatus();
  }, [userId, postIds.join(',')]); // Only re-fetch if dependencies change

  return { likeStatus, loading };
};

