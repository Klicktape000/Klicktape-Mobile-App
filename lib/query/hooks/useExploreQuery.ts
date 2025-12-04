/**
 * Optimized Explore Query Hooks using TanStack Query
 * 
 * These hooks provide fast, cached explore/search data loading with:
 * - Pagination for explore feed
 * - Automatic caching and revalidation
 * - Infinite scroll support
 * - Combined posts and reels feed
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ExplorePost {
  id: string;
  image_urls: string[];
  caption: string;
  user_id: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  type: 'image';
  user: {
    username: string;
    avatar_url: string;
  };
}

export interface ExploreReel {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  user_id: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  type: 'video';
  user: {
    username: string;
    avatar_url: string;
  };
}

export type ExploreItem = ExplorePost | ExploreReel;

export interface SearchUser {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  name: string;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Fetch explore posts with pagination
 */
const fetchExplorePosts = async (
  limit: number = 15,
  offset: number = 0
): Promise<ExplorePost[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      image_urls,
      caption,
      user_id,
      created_at,
      likes_count,
      comments_count,
      profiles!posts_user_id_fkey (
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching explore posts:', error);
    throw error;
  }

  return (data || []).map((post: any) => ({
    ...post,
    type: 'image' as const,
    user: post.profiles || {
      username: 'Unknown User',
      avatar_url: 'https://via.placeholder.com/150',
    },
  }));
};

/**
 * Fetch explore reels with pagination
 */
const fetchExploreReels = async (
  limit: number = 15,
  offset: number = 0
): Promise<ExploreReel[]> => {
  const { data, error } = await supabase
    .from('reels')
    .select(`
      id,
      video_url,
      thumbnail_url,
      caption,
      user_id,
      created_at,
      likes_count,
      comments_count,
      views_count,
      profiles!reels_user_id_fkey (
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching explore reels:', error);
    throw error;
  }

  return (data || []).map((reel: any) => ({
    ...reel,
    type: 'video' as const,
    user: reel.profiles || {
      username: 'Unknown User',
      avatar_url: 'https://via.placeholder.com/150',
    },
  }));
};

/**
 * Fetch combined explore feed (posts + reels)
 */
const fetchExploreFeed = async (
  limit: number = 30,
  offset: number = 0
): Promise<ExploreItem[]> => {
  const postsLimit = Math.ceil(limit / 2);
  const reelsLimit = Math.floor(limit / 2);

  const [posts, reels] = await Promise.all([
    fetchExplorePosts(postsLimit, Math.floor(offset / 2)),
    fetchExploreReels(reelsLimit, Math.floor(offset / 2)),
  ]);

  // Combine and shuffle
  const combined = [...posts, ...reels];
  return combined.sort(() => Math.random() - 0.5);
};

/**
 * Search users by username or name with pagination
 */
const searchUsers = async (
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchUser[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bio, name')
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
    .order('username', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error searching users:', error);
    throw error;
  }

  return data || [];
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch explore feed with pagination
 * 
 * @param limit - Number of items per page
 * @param offset - Offset for pagination
 * 
 * @example
 * const { data, isLoading, refetch } = useExploreFeed(30, 0);
 */
export const useExploreFeed = (
  limit: number = 30,
  offset: number = 0,
  options?: {
    enabled?: boolean;
  }
) => {
  return useQuery({
    queryKey: ['explore', 'feed', limit, offset],
    queryFn: () => fetchExploreFeed(limit, offset),
    enabled: options?.enabled !== false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook to fetch explore feed with infinite scroll
 * 
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteExploreFeed();
 */
export const useInfiniteExploreFeed = () => {
  return useInfiniteQuery({
    queryKey: ['explore', 'feed', 'infinite'],
    queryFn: ({ pageParam = 0 }) => fetchExploreFeed(30, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 30) return undefined;
      return allPages.length * 30;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook to search users
 *
 * @param query - Search query string
 *
 * @example
 * const { data: users, isLoading } = useSearchUsers(searchQuery);
 */
export const useSearchUsers = (
  query: string,
  options?: {
    enabled?: boolean;
  }
) => {
  return useQuery({
    queryKey: ['search', 'users', query],
    queryFn: () => searchUsers(query, 20, 0),
    enabled: options?.enabled !== false && query.trim().length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to search users with infinite scroll
 *
 * @param query - Search query string
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useInfiniteSearchUsers(searchQuery);
 */
export const useInfiniteSearchUsers = (query: string) => {
  return useInfiniteQuery({
    queryKey: ['search', 'users', 'infinite', query],
    queryFn: ({ pageParam = 0 }) => searchUsers(query, 20, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined;
      return allPages.length * 20;
    },
    initialPageParam: 0,
    enabled: query.trim().length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};

