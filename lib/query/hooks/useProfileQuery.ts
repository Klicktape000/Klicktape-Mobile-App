/**
 * Optimized Profile Query Hooks using TanStack Query
 * 
 * These hooks provide fast, cached profile data loading with:
 * - Single RPC call for complete profile data
 * - Automatic caching and revalidation
 * - Optimistic updates for follow/unfollow
 * - Pagination for posts, reels, and bookmarks
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileData {
  profile: {
    id: string;
    username: string;
    name: string;
    email: string;
    avatar_url: string;
    bio: string;
    account_type: string;
    gender: string;
    website: string;
    current_tier: string;
    headline: string;
    extra_line: string;
    created_at: string;
    updated_at: string;
  };
  followers_count: number;
  following_count: number;
  posts_count: number;
  reels_count: number;
  bookmarks_count: number;
  is_following: boolean;
  rank_data: {
    rank_position: number | null;
    total_points: number;
    rank_tier: string | null;
    points_to_next_rank: number;
    is_in_top_50: boolean;
  };
}

export interface ProfilePost {
  id: string;
  user_id: string;
  caption: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface ProfileReel {
  id: string;
  user_id: string;
  caption: string;
  video_url: string;
  thumbnail_url: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
}

export interface ProfileBookmark {
  id: string;
  user_id: string;
  caption: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  post_user_id: string;
  post_username: string;
  post_avatar_url: string;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Fetch complete profile data - ULTRA OPTIMIZED with minimal queries
 * INSTANT RENDER: Returns basic profile data immediately, counts load in background
 */
const fetchCompleteProfileData = async (
  profileUserId: string,
  currentUserId?: string
): Promise<ProfileData> => {
  // OPTIMIZED: Only 3 parallel queries for INSTANT initial render
  const [profileResult, followCheck, rankResult] = await Promise.all([
    // 1. Get profile data
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profileUserId)
      .single(),

    // 2. Check if current user follows this profile (only if different users)
    currentUserId && currentUserId !== profileUserId
      ? supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', profileUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // 3. Get rank data if available
    supabase
      .from('leaderboard_rankings')
      .select('rank_position, total_points')
      .eq('user_id', profileUserId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  // OPTIMIZED: Return basic profile data IMMEDIATELY for instant render
  // Counts will be fetched separately in background (non-blocking)
  return {
    profile: profileResult.data as any,
    followers_count: 0, // Will be loaded by separate hook
    following_count: 0, // Will be loaded by separate hook
    posts_count: 0, // Will be loaded by separate hook
    reels_count: 0, // Will be loaded by separate hook
    bookmarks_count: 0, // Will be loaded by separate hook
    is_following: !!followCheck.data,
    rank_data: {
      rank_position: (rankResult.data as any)?.rank_position || null,
      total_points: (rankResult.data as any)?.total_points || 0,
      rank_tier: null,
      points_to_next_rank: 0,
      is_in_top_50: ((rankResult.data as any)?.rank_position || 999) <= 50,
    },
  };
};

/**
 * Fetch profile posts - OPTIMIZED with direct query
 */
const fetchProfilePosts = async (
  userId: string,
  limit: number = 12,
  offset: number = 0
): Promise<ProfilePost[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, caption, image_urls, created_at, likes_count, comments_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return (data || []) as ProfilePost[];
};

/**
 * Fetch profile reels - OPTIMIZED with direct query
 */
const fetchProfileReels = async (
  userId: string,
  limit: number = 12,
  offset: number = 0
): Promise<ProfileReel[]> => {
  const { data, error } = await supabase
    .from('reels')
    .select('id, user_id, caption, video_url, thumbnail_url, created_at, likes_count, comments_count, views_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return (data || []) as ProfileReel[];
};

/**
 * Fetch profile bookmarks - OPTIMIZED with RPC function
 */
const fetchProfileBookmarks = async (
  userId: string,
  limit: number = 12,
  offset: number = 0
): Promise<ProfileBookmark[]> => {
  // OPTIMIZED: Use RPC function to eliminate N+1 queries
  try {
    const { data, error } = await supabase.rpc('get_user_bookmarks_optimized' as any, {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset
    } as any);

    if (error) {
      throw error;
    }

    const bookmarksData = (data || []) as any[];
    const mappedBookmarks = bookmarksData.map((bookmark: any) => ({
      id: bookmark.post_id,
      user_id: userId,
      caption: bookmark.post_caption,
      image_urls: bookmark.post_image_urls,
      created_at: bookmark.post_created_at,
      likes_count: bookmark.post_likes_count,
      comments_count: bookmark.post_comments_count,
      post_user_id: bookmark.post_user_id,
      post_username: bookmark.post_username,
      post_avatar_url: bookmark.post_avatar_url,
    }));
    
    return mappedBookmarks as ProfileBookmark[];
  } catch (error) {
    // Fallback to regular query if RPC not deployed yet
    const { data, error: fallbackError } = await supabase
      .from('bookmarks')
      .select(`
        id,
        user_id,
        created_at,
        posts!inner (
          id,
          caption,
          image_urls,
          created_at,
          likes_count,
          comments_count,
          user_id,
          profiles!inner (
            username,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fallbackError) {
      throw fallbackError;
    }

    const bookmarksData = (data || []) as any[];
    return bookmarksData.map((bookmark: any) => ({
      id: bookmark.posts.id,
      user_id: bookmark.user_id,
      caption: bookmark.posts.caption,
      image_urls: bookmark.posts.image_urls,
      created_at: bookmark.posts.created_at,
      likes_count: bookmark.posts.likes_count,
      comments_count: bookmark.posts.comments_count,
      post_user_id: bookmark.posts.user_id,
      post_username: bookmark.posts.profiles.username,
      post_avatar_url: bookmark.posts.profiles.avatar_url,
    })) as ProfileBookmark[];
  }
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch complete profile data with caching
 * 
 * @param profileUserId - The user ID of the profile to fetch
 * @param currentUserId - The current logged-in user ID (optional)
 * @param options - Query options
 * 
 * @example
 * const { data, isLoading, error } = useCompleteProfileData(userId, currentUserId);
 */
export const useCompleteProfileData = (
  profileUserId: string,
  currentUserId?: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: ['profile', 'complete', profileUserId],
    queryFn: () => fetchCompleteProfileData(profileUserId, currentUserId),
    enabled: options?.enabled !== false && !!profileUserId && profileUserId.length > 0, // CRITICAL: Validate profileUserId
    staleTime: options?.staleTime || 1000 * 60 * 5, // 5 minutes
    gcTime: options?.cacheTime || 1000 * 60 * 10, // 10 minutes (renamed from cacheTime)
    networkMode: 'offlineFirst', // Cache first for instant display
    placeholderData: (previousData) => previousData, // Show cached while fetching
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 0,
    retryDelay: 0,
  });
};

/**
 * Hook to fetch profile posts with pagination
 */
export const useProfilePosts = (
  userId: string,
  limit: number = 12,
  offset: number = 0,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: ['profile', 'posts', userId, limit, offset],
    queryFn: () => fetchProfilePosts(userId, limit, offset),
    enabled: options?.enabled !== false && !!userId && userId.length > 0, // CRITICAL: Validate userId
    staleTime: options?.staleTime || 1000 * 60 * 2, // 2 minutes
    gcTime: options?.cacheTime || 1000 * 60 * 5, // 5 minutes
    networkMode: 'offlineFirst', // Cache first
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    retry: 0,
  });
};

/**
 * Hook to fetch profile posts with infinite scroll
 */
export const useInfiniteProfilePosts = (userId: string) => {
  return useInfiniteQuery({
    queryKey: ['profile', 'posts', 'infinite', userId],
    queryFn: ({ pageParam = 0 }) => fetchProfilePosts(userId, 30, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 30) return undefined;
      return allPages.length * 30;
    },
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch profile reels with pagination
 */
export const useProfileReels = (
  userId: string,
  limit: number = 12,
  offset: number = 0,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: ['profile', 'reels', userId, limit, offset],
    queryFn: () => fetchProfileReels(userId, limit, offset),
    enabled: options?.enabled !== false && !!userId && userId.length > 0, // CRITICAL: Validate userId
    staleTime: options?.staleTime || 1000 * 60 * 2, // 2 minutes
    gcTime: options?.cacheTime || 1000 * 60 * 5, // 5 minutes
    networkMode: 'offlineFirst', // Cache first
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    retry: 0,
  });
};

/**
 * Hook to fetch profile reels with infinite scroll
 */
export const useInfiniteProfileReels = (userId: string) => {
  return useInfiniteQuery({
    queryKey: ['profile', 'reels', 'infinite', userId],
    queryFn: ({ pageParam = 0 }) => fetchProfileReels(userId, 30, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 30) return undefined;
      return allPages.length * 30;
    },
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch profile bookmarks with pagination
 */
export const useProfileBookmarks = (
  userId: string,
  limit: number = 12,
  offset: number = 0,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: ['profile', 'bookmarks', userId, limit, offset],
    queryFn: () => fetchProfileBookmarks(userId, limit, offset),
    enabled: options?.enabled !== false && !!userId && userId.length > 0, // CRITICAL: Validate userId
    staleTime: options?.staleTime || 1000 * 60 * 2, // 2 minutes
    gcTime: options?.cacheTime || 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch profile bookmarks with infinite scroll
 */
export const useInfiniteProfileBookmarks = (userId: string) => {
  return useInfiniteQuery({
    queryKey: ['profile', 'bookmarks', 'infinite', userId],
    queryFn: ({ pageParam = 0 }) => fetchProfileBookmarks(userId, 30, pageParam),
    getNextPageParam: (lastPage: any, allPages: any) => {
      if (lastPage.length < 30) return undefined;
      return allPages.length * 30;
    },
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to toggle follow status with optimistic updates
 * Uses fast lightning_toggle_follow RPC function
 */
export const useToggleFollow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetUserId,
      currentUserId,
    }: {
      targetUserId: string;
      currentUserId: string;
    }) => {
      // OPTIMIZED: Direct insert/delete instead of RPC
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .single();

      if (existing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        return false;
      } else {
        // Follow
        await (supabase
          .from('follows')
          .insert as any)({
            follower_id: currentUserId,
            following_id: targetUserId,
          });
        return true;
      }
    },
    onMutate: async ({ targetUserId, currentUserId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['profile', 'complete', targetUserId]
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<ProfileData>([
        'profile',
        'complete',
        targetUserId,
        currentUserId,
      ]);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<ProfileData>(
          ['profile', 'complete', targetUserId],
          {
            ...previousData,
            is_following: !previousData.is_following,
            followers_count: previousData.is_following
              ? previousData.followers_count - 1
              : previousData.followers_count + 1,
          }
        );
      }

      return { previousData };
    },
    onError: (__err, { targetUserId, currentUserId }, context) => {
      // Revert on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ['profile', 'complete', targetUserId],
          context.previousData
        );
      }
    },
    onSettled: (__data, __error, { targetUserId, currentUserId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['profile', 'complete', targetUserId]
      });
    },
  });
};
