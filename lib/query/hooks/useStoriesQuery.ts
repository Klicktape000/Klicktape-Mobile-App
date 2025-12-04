/**
 * TanStack Query Hooks for Stories with Redis Integration
 * Maintains all Redis caching benefits while using TanStack Query
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { Database } from '../../../types/supabase';
import StoriesCache from '../../redis/storiesCache';
import { queryKeys } from '../queryKeys';
import { invalidateCache } from '../queryClient';
import { REDIS_CONFIG } from '../../config/redis';
import { authManager } from '../../authManager';

// Types
interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  viewed_by: string[];
  story_order: number;
  view_count: number;
  duration: number;
  story_type: string;
  is_active: boolean;
  user: {
    username: string;
    avatar: string;
  };
  is_viewed?: boolean;
}

interface StoriesFeed {
  user_id: string;
  username: string;
  avatar_url: string;
  story_count: number;
  latest_story_time: string;
  has_unviewed: boolean;
  stories: Story[];
}

interface CreateStoryData {
  imageUrl: string;
  userId: string;
  caption?: string;
  duration?: number;
  storyType?: string;
}

interface StoryViewData {
  storyId: string;
  viewDuration?: number;
}

// Performance tracking
const performanceOptimizer = {
  trackCacheHit: (isHit: boolean, responseTime: number) => {
// console.log(`📊 Stories Cache ${isHit ? 'HIT' : 'MISS'} - ${responseTime}ms`);
  }
};

// Type conversion utilities for stories
const convertCachedStoryToStory = (cachedStory: any): any => ({
  id: cachedStory.id,
  user_id: cachedStory.user_id,
  image_url: cachedStory.image_url,
  caption: cachedStory.caption,
  created_at: cachedStory.created_at,
  expires_at: cachedStory.expires_at,
  story_order: cachedStory.story_order,
  duration: cachedStory.duration,
  story_type: cachedStory.story_type,
  viewed_by: [],
  is_active: true,
  user: {
    username: cachedStory.username,
    avatar_url: cachedStory.avatar_url,
  },
  is_viewed: cachedStory.is_viewed,
});

// Query Functions with Redis Integration
const storiesQueryFunctions = {
  /**
   * Get stories feed with Redis caching fallback
   */
  getStoriesFeed: async (limit: number = 50): Promise<StoriesFeed[]> => {
    const startTime = Date.now();
    
    try {
      // Try Redis cache first if enabled
      if (REDIS_CONFIG.enabled) {
        const cachedFeed = await StoriesCache.getStoriesFeed(limit);
        
        if (cachedFeed.length > 0) {
          const responseTime = Date.now() - startTime;
          performanceOptimizer.trackCacheHit(true, responseTime);
// console.log('📱 Stories feed served from Redis cache');
          return cachedFeed.map((feed: any) => ({
            ...feed,
            stories: feed.stories.map(convertCachedStoryToStory)
          }));
        }
      }
      
      // Fallback to database - temporary direct query workaround
// console.log('🔄 Fetching stories feed from database');
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          expires_at,
          story_order,
          duration,
          story_type,
          is_active,
          profiles!stories_user_id_fkey(username, avatar_url)
        `)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch stories feed: ${error.message}`);
      }

      // Transform the data to match expected format
      const storiesData = data || [];
      const groupedStories: Record<string, StoriesFeed> = storiesData.reduce((acc: Record<string, StoriesFeed>, story: any) => {
        const userId = story.user_id;
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            username: story.profiles.username,
            avatar_url: story.profiles.avatar_url,
            story_count: 0,
            latest_story_time: story.created_at,
            has_unviewed: true,
            stories: []
          };
        }
        acc[userId].stories.push({
          ...story,
          user: {
            username: story.profiles.username,
            avatar: story.profiles.avatar_url
          },
          viewed_by: [],
          view_count: 0,
          is_viewed: false
        });
        acc[userId].story_count++;
        return acc;
      }, {});

      const result: StoriesFeed[] = Object.values(groupedStories);
      
      // Cache the result in Redis (don't fail if caching fails)
      if (REDIS_CONFIG.enabled && result.length > 0) {
        try {
          // Convert to CachedStory format for caching
          const cacheableResult = result.map(feed => ({
            ...feed,
            stories: feed.stories.map(story => ({
              id: story.id,
              user_id: story.user_id,
              username: story.user.username,
              avatar_url: story.user.avatar,
              image_url: story.image_url,
              caption: story.caption,
              created_at: story.created_at,
              expires_at: story.expires_at,
              story_order: story.story_order,
              duration: story.duration,
              story_type: story.story_type,
              view_count: story.view_count || 0,
              is_viewed: story.is_viewed || false,
            }))
          }));
          await StoriesCache.setStoriesFeed(cacheableResult, limit);
        } catch (__cacheError) {
// console.warn('⚠️ Failed to cache stories feed, continuing without cache:', __cacheError);
        }
      }
      
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackCacheHit(false, responseTime);
      
      return result;
    } catch (__error) {
      // Use enhanced network error handling
      const { handleNetworkError, isNetworkError } = await import('../../utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
// console.warn('⚠️ Network connectivity issue while fetching stories');
        handleNetworkError(__error, { 
          context: 'Loading stories feed', 
          showUserAlert: true 
        });
        // Return empty array instead of throwing to prevent app crashes
        return [];
      } else {
        console.error('❌ Error fetching stories feed:', __error);
        throw __error;
      }
    }
  },

  /**
   * Get user stories with Redis caching
   */
  getUserStories: async (userId: string): Promise<Story[]> => {
    const startTime = Date.now();
    
    try {
      // Try Redis cache first if enabled
      if (REDIS_CONFIG.enabled) {
        const cachedStories = await StoriesCache.getUserStories(userId);
        
        if (cachedStories.length > 0) {
          const responseTime = Date.now() - startTime;
          performanceOptimizer.trackCacheHit(true, responseTime);
// console.log(`📱 User stories for ${userId} served from Redis cache`);
          return cachedStories.map(convertCachedStoryToStory);
        }
      }
      
      // Fallback to database - temporary direct query workaround
// console.log(`🔄 Fetching user stories for ${userId} from database`);
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          expires_at,
          story_order,
          duration,
          story_type,
          is_active,
          profiles!stories_user_id_fkey(username, avatar_url)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch user stories: ${error.message}`);
      }

      // Transform the data to match expected format
      const result = (data || []).map((story: any) => ({
        ...story,
        user: {
          username: story.profiles.username,
          avatar: story.profiles.avatar_url
        },
        viewed_by: [],
        view_count: 0,
        is_viewed: false
      }));
      
      // Cache the result in Redis
      if (REDIS_CONFIG.enabled && result.length > 0) {
        await StoriesCache.setUserStories(userId, result);
      }
      
      const responseTime = Date.now() - startTime;
      performanceOptimizer.trackCacheHit(false, responseTime);
      
      return result;
    } catch (__error) {
      console.error('Error fetching user stories:', __error);
      throw __error;
    }
  },

  /**
   * Get story analytics
   */
  getStoryAnalytics: async (storyId: string) => {
    try {
      // Try Redis cache first
      if (REDIS_CONFIG.enabled) {
        const cachedAnalytics = await StoriesCache.getStoryAnalytics(storyId);
        if (cachedAnalytics) {
          return cachedAnalytics;
        }
      }

      // Fallback to database calculation
      const { data: views, error } = await supabase
        .from('story_views')
        .select('view_duration, completed')
        .eq('story_id', storyId);

      if (error) {
        throw new Error(`Failed to fetch story analytics: ${error.message}`);
      }

      const analytics = {
        total_views: views?.length || 0,
        unique_viewers: views?.length || 0,
        completion_rate: views?.length ? (views as any).filter((v: any) => v.completed).length / views.length : 0,
        avg_view_duration: views?.length ? (views as any).reduce((sum: number, v: any) => sum + v.view_duration, 0) / views.length : 0,
        last_updated: new Date().toISOString(),
      };

      return analytics;
    } catch (__error) {
      console.error('Error fetching story analytics:', __error);
      return null;
    }
  },
};

// Mutation Functions
const storiesMutationFunctions = {
  /**
   * Create a new story
   */
  createStory: async (data: CreateStoryData) => {
    try {
      const { imageUrl, userId, caption, duration = 5000, storyType = 'image' } = data;
      
      // TEMPORARY WORKAROUND: Use direct database insertion instead of RPC function
      // TODO: Replace with RPC function once create_story_enhanced is deployed
      const storyData: Database['public']['Tables']['stories']['Insert'] = {
        user_id: userId,
        image_url: imageUrl,
        caption: caption || '',
        duration: duration || 5000,
        story_type: storyType || 'image',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        is_active: true,
        story_order: Math.floor(Date.now() / 1000), // Use timestamp as order
      };

      const { data: result, error } = await (supabase
        .from('stories') as any)
        .insert(storyData)
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create story: ${error.message}`);
      }

      if (!result) {
        throw new Error('Failed to create story - no data returned');
      }

      return { id: (result as any).id, success: true };
    } catch (__error) {
      console.error('Error creating story:', __error);
      throw __error;
    }
  },

  /**
   * Mark story as viewed
   */
  markStoryViewed: async (data: StoryViewData) => {
    try {
      const { storyId, viewDuration = 0 } = data;
      
      const user = await authManager.getCurrentUser();
      if (!user) {
        return false;
      }

      // TEMPORARY WORKAROUND: Use direct database operations instead of RPC function
      // TODO: Replace with RPC function once mark_story_viewed is deployed
      
      // First, check if the view already exists
      const { data: existingView } = await supabase
        .from('story_views')
        .select('id')
        .eq('story_id', storyId)
        .eq('viewer_id', user.id)
        .single();

      if (!existingView) {
        // Insert new view record
        const viewData: Database['public']['Tables']['story_views']['Insert'] = {
          story_id: storyId,
          viewer_id: user.id,
          view_duration: viewDuration,
          completed: viewDuration >= 3000, // Consider completed if viewed for 3+ seconds
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await (supabase
          .from('story_views') as any)
          .insert(viewData);

        if (insertError) {
          console.error('Error inserting story view:', insertError);
          return false;
        }

        // Note: We'll handle view count updates via database triggers or RPC functions
        // For now, we'll skip the view count update to avoid SQL injection issues
      }

      // Track in Redis cache for analytics
      if (REDIS_CONFIG.enabled) {
        await StoriesCache.trackStoryView(storyId, user.id, viewDuration);
      }

      return true;
    } catch (__error) {
      console.error('Error marking story as viewed:', __error);
      return false;
    }
  },

  /**
   * Delete a story (complete deletion with storage cleanup)
   */
  deleteStory: async (storyId: string) => {
    try {
      // Import storiesAPI for proper deletion with storage cleanup
      const { storiesAPI } = await import('../../storiesApi');

      // Use the enhanced deleteStory function that handles storage cleanup
      const result = await storiesAPI.deleteStory(storyId);

      return result;
    } catch (__error) {
      console.error('Error deleting story:', __error);
      throw __error; // Re-throw to let the mutation handle the error
    }
  },
};

// Custom Hooks
export const useStoriesFeed = (
  limit: number = 50,
  options?: Omit<UseQueryOptions<StoriesFeed[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.stories.feed(limit),
    queryFn: () => storiesQueryFunctions.getStoriesFeed(limit),
    ...options,
  });
};

export const useUserStories = (
  userId: string,
  options?: Omit<UseQueryOptions<Story[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.stories.userStories(userId),
    queryFn: () => storiesQueryFunctions.getUserStories(userId),
    enabled: !!userId,
    ...options,
  });
};

export const useStoryAnalytics = (
  storyId: string,
  options?: Omit<UseQueryOptions<any, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.stories.storyAnalytics(storyId),
    queryFn: () => storiesQueryFunctions.getStoryAnalytics(storyId),
    enabled: !!storyId,
    ...options,
  });
};

export const useCreateStory = (
  options?: UseMutationOptions<any, Error, CreateStoryData>
) => {
  return useMutation({
    mutationFn: storiesMutationFunctions.createStory,
    onSuccess: async (data, variables) => {
      // Invalidate and refetch stories queries
      await invalidateCache(queryKeys.stories.feeds());
      await invalidateCache(queryKeys.stories.userStories(variables.userId));
      
      // Invalidate Redis cache
      if (REDIS_CONFIG.enabled) {
        await StoriesCache.invalidateStoriesCache(variables.userId);
      }

// console.log('✅ Story created successfully, cache invalidated');
    },
    ...options,
  });
};

export const useMarkStoryViewed = (
  options?: UseMutationOptions<boolean, Error, StoryViewData>
) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: storiesMutationFunctions.markStoryViewed,
    onSuccess: async (data, variables) => {
      // Update story analytics cache
      await queryClient.invalidateQueries({
        queryKey: queryKeys.stories.storyAnalytics(variables.storyId),
      });

// console.log('✅ Story view tracked successfully');
    },
    ...options,
  });
};

export const useDeleteStory = (
  options?: UseMutationOptions<boolean, Error, string>
) => {
  return useMutation({
    mutationFn: storiesMutationFunctions.deleteStory,
    onSuccess: async (data, storyId) => {
      // Get current user to invalidate their stories
      const user = await authManager.getCurrentUser();
      
      if (user) {
        // Invalidate stories queries
        await invalidateCache(queryKeys.stories.feeds());
        await invalidateCache(queryKeys.stories.userStories(user.id));
        
        // Invalidate Redis cache
        if (REDIS_CONFIG.enabled) {
          await StoriesCache.invalidateStoriesCache(user.id);
        }
      }

// console.log('✅ Story deleted successfully, cache invalidated');
    },
    ...options,
  });
};

// Prefetch helpers
export const prefetchStoriesFeed = async (queryClient: any, limit: number = 50) => {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.stories.feed(limit),
    queryFn: () => storiesQueryFunctions.getStoriesFeed(limit),
  });
};

export const prefetchUserStories = async (queryClient: any, userId: string) => {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.stories.userStories(userId),
    queryFn: () => storiesQueryFunctions.getUserStories(userId),
  });
};

export default {
  useStoriesFeed,
  useUserStories,
  useStoryAnalytics,
  useCreateStory,
  useMarkStoryViewed,
  useDeleteStory,
  prefetchStoriesFeed,
  prefetchUserStories,
};

