/**
 * POST VIEW TRACKING HOOKS
 * React hooks for automatic view tracking and smart feed management
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
  PostViewTracker, 
  SmartFeedApi, 
  SessionManager,
  initializePostViewTracking,
  cleanupPostViewTracking,
  SmartFeedOptions
} from '../lib/postViewsApi';
import { useSmartFeed as useSmartFeedQuery } from '../lib/query/hooks/usePostsQuery';

// =====================================================
// TYPES
// =====================================================

interface ViewTrackingOptions {
  threshold?: number; // Percentage of post visible to count as view
  minViewTime?: number; // Minimum time in ms post must be visible
  debounceTime?: number; // Debounce time for view tracking
}

// =====================================================
// POST VIEW TRACKING HOOK
// =====================================================

/**
 * Hook for tracking when a post becomes visible on screen
 */
export function usePostViewTracking(
  postId: string,
  options: ViewTrackingOptions = {}
) {
  const { threshold = 0.5, minViewTime = 1000, debounceTime = 500 } = options;
  const user = useSelector((state: any) => state.user);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  
  const elementRef = useRef<HTMLDivElement>(null);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isViewedRef = useRef(false);

  const trackView = useCallback(async () => {
    if (!user?.id || !postId || isViewedRef.current) return;

    try {
      await PostViewTracker.trackView(postId, user.id);
      isViewedRef.current = true;
      setHasBeenViewed(true);
// console.log(`👁️ View tracked for post: ${postId}`);
    } catch (error) {
      console.error('❌ Failed to track view:', error);
    }
  }, [postId, user?.id]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    const isCurrentlyVisible = entry.isIntersecting;
    
    setIsVisible(isCurrentlyVisible);

    // Clear existing timers
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (isCurrentlyVisible && !isViewedRef.current) {
      // Start view timer after debounce
      debounceTimerRef.current = setTimeout(() => {
        viewTimerRef.current = setTimeout(() => {
          trackView();
        }, minViewTime) as unknown as NodeJS.Timeout;
      }, debounceTime) as unknown as NodeJS.Timeout;
    }
  }, [trackView, minViewTime, debounceTime]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin: '0px'
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleIntersection, threshold]);

  return {
    ref: elementRef,
    isVisible,
    hasBeenViewed,
    trackView: () => trackView()
  };
}

// =====================================================
// SMART FEED HOOK
// =====================================================

/**
 * Hook for smart feed management with view tracking
 */
export const useSmartFeed = (options: SmartFeedOptions = {}) => {
  const { sessionToken } = useSessionManagement();
  
  const smartFeedQuery = useSmartFeedQuery(
    sessionToken || undefined,
    options.excludePostIds,
    {
      limit: options.limit,
      excludeViewedTwice: options.excludeViewedTwice,
      respect24hCooldown: options.respect24hCooldown
    },
    {
      // Always enable - the query has internal fallback to regular feed
      enabled: true,
      // Enable auto-refetch on mount to load posts automatically
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      refetchOnMount: true, // Changed to true to load posts automatically
      refetchOnReconnect: true, // Enable reconnect refetch for better UX
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    }
  );

  // Transform the infinite query data to a flat array with deduplication
  const posts = useMemo(() => {
    if (!smartFeedQuery.data?.pages) return [];

    const allPosts = smartFeedQuery.data.pages.flatMap((page: any) => page.posts);

    // Deduplicate posts by ID to prevent duplicate key errors
    const seenIds = new Set<string>();
    const uniquePosts = allPosts.filter((post: any) => {
      if (seenIds.has(post.id)) {
        console.warn(`⚠️ Duplicate post detected and removed: ${post.id}`);
        return false;
      }
      seenIds.add(post.id);
      return true;
    });

    return uniquePosts;
  }, [smartFeedQuery.data]);

  const refreshSmartFeed = useCallback(() => {
    smartFeedQuery.refetch();
  }, [smartFeedQuery]);

  const loadMoreSmartFeed = useCallback(() => {
    if (smartFeedQuery.hasNextPage && !smartFeedQuery.isFetchingNextPage) {
      smartFeedQuery.fetchNextPage();
    }
  }, [smartFeedQuery]);

  return {
    posts,
    loading: smartFeedQuery.isLoading,
    refreshing: smartFeedQuery.isRefetching || false,
    error: smartFeedQuery.error?.message || null,
    hasMore: smartFeedQuery.hasNextPage || false,
    refresh: refreshSmartFeed,
    loadMore: loadMoreSmartFeed,
    refreshSmartFeed,
    loadMoreSmartFeed,
    refetch: refreshSmartFeed,
    isFetchingNextPage: smartFeedQuery.isFetchingNextPage
  };
};

// =====================================================
// SESSION MANAGEMENT HOOK
// =====================================================

/**
 * Hook for managing user sessions and view tracking lifecycle
 */
export function useSessionManagement() {
  const user = useSelector((state: any) => state.user);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeSession = useCallback(async () => {
    if (!user?.id || isInitialized) return;

    try {
      await initializePostViewTracking(user.id);
      const token = await SessionManager.getCurrentSession();
      setSessionToken(token);
      setIsInitialized(true);
      //// console.log('✅ Session management initialized');
    } catch {
      // console.error('❌ Failed to initialize session');
    }
  }, [user?.id, isInitialized]);

  const endSession = useCallback(async () => {
    if (!user?.id) return;

    try {
      await cleanupPostViewTracking(user.id);
      setSessionToken(null);
      setIsInitialized(false);
      //// console.log('✅ Session ended');
    } catch {
      // console.error('❌ Failed to end session');
    }
  }, [user?.id]);

  const startNewSession = useCallback(async () => {
    if (!user?.id) return;

    try {
      const token = await SessionManager.startSession(user.id, {
        platform: 'web',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      setSessionToken(token);
      setIsInitialized(true);
      //// console.log('✅ New session started');
    } catch {
      // console.error('❌ Failed to start new session');
    }
  }, [user?.id]);

  // Initialize on user login
  useEffect(() => {
    if (user?.id && !isInitialized) {
      initializeSession();
    }
  }, [user?.id, isInitialized, initializeSession]);

  // Cleanup on unmount or user logout
  useEffect(() => {
    return () => {
      if (user?.id && isInitialized) {
        endSession();
      }
    };
  }, [user?.id, isInitialized, endSession]);

  return {
    sessionToken,
    isInitialized,
    startNewSession,
    endSession
  };
}

// =====================================================
// POST ANALYTICS HOOK
// =====================================================

/**
 * Hook for getting post view analytics
 */
export function usePostAnalytics(postId: string) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!postId) return;

    try {
      setLoading(true);
      const { PostAnalyticsApi } = await import('../lib/postViewsApi');
      const data = await PostAnalyticsApi.getPostAnalytics(postId);
      setAnalytics(data);
    } catch (error) {
      console.error('❌ Failed to load post analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    refresh: loadAnalytics
  };
}

// =====================================================
// VIEW HISTORY HOOK
// =====================================================

/**
 * Hook for managing user's view history
 */
export function useViewHistory() {
  const user = useSelector((state: any) => state.user);
  const [viewHistory, setViewHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadViewHistory = useCallback(async (limit: number = 50, offset: number = 0) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await SmartFeedApi.getUserViewHistory(user.id, limit, offset);
      setViewHistory(data);
    } catch (error) {
      console.error('❌ Failed to load view history:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const resetViewHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      await SmartFeedApi.resetUserViewHistory(user.id);
      setViewHistory([]);
// console.log('✅ View history reset');
    } catch (error) {
      console.error('❌ Failed to reset view history:', error);
    }
  }, [user?.id]);

  const getPostViewCount = useCallback((postId: string): number => {
    const view = viewHistory.find(v => v.post_id === postId);
    return view?.view_count || 0;
  }, [viewHistory]);

  useEffect(() => {
    if (user?.id) {
      loadViewHistory();
    }
  }, [user?.id, loadViewHistory]);

  return {
    viewHistory,
    loading,
    loadViewHistory,
    resetViewHistory,
    getPostViewCount
  };
}

// =====================================================
// UTILITY HOOKS
// =====================================================

/**
 * Hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for tracking element visibility
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => observer.disconnect();
  }, [options]);

  return {
    ref: elementRef,
    isIntersecting,
    entry
  };
}