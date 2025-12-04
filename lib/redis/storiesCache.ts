/**
 * Klicktape Stories Redis Caching Implementation
 * Reduces Supabase costs and improves performance
 * Based on: https://supabase.com/docs/guides/functions/examples/upstash-redis
 */

import { Redis } from '@upstash/redis';
import { CACHE_CONFIG } from '../config/redis';
import { 
  checkRedisHealth, 
  safeRedisGet, 
  safeRedisSet, 
  safeRedisDel,
  getCircuitBreakerStatus 
} from '../utils/redisOperations';
import FallbackCache from '../utils/fallbackCache';

// Get Redis configuration from environment variables
const redisUrl = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN; // Only use secure token

// Initialize Redis client only if credentials are available
// Using type assertion since we check availability before use
const redis = (redisUrl && redisToken) ? new Redis({
  url: redisUrl,
  token: redisToken,
}) : null as any as Redis;

// Cache key prefixes
const CACHE_KEYS = {
  STORIES_FEED: 'stories:feed',
  USER_STORIES: 'stories:user:',
  STORY_VIEWS: 'stories:views:',
  STORY_INTERACTIONS: 'stories:interactions:',
  ACTIVE_STORIES: 'stories:active',
  STORY_ANALYTICS: 'stories:analytics:',
} as const;

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  STORIES_FEED: 300, // 5 minutes
  USER_STORIES: 600, // 10 minutes
  STORY_VIEWS: 3600, // 1 hour
  STORY_INTERACTIONS: 1800, // 30 minutes
  ACTIVE_STORIES: 180, // 3 minutes
  STORY_ANALYTICS: 7200, // 2 hours
} as const;

// Types
interface CachedStory {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  image_url: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  story_order: number;
  duration: number;
  story_type: string;
  view_count: number;
  is_viewed: boolean;
}

interface StoriesFeed {
  user_id: string;
  username: string;
  avatar_url: string;
  story_count: number;
  latest_story_time: string;
  has_unviewed: boolean;
  stories: CachedStory[];
}

interface StoryAnalytics {
  total_views: number;
  unique_viewers: number;
  completion_rate: number;
  avg_view_duration: number;
  last_updated: string;
}

export class StoriesCache {
  /**
   * Check if Redis is available with enhanced timeout handling
   */
  private static async isRedisAvailable(): Promise<boolean> {
    try {
      if (!redis || !redisUrl || !redisToken) {
// console.warn('⚠️ Redis configuration missing or client not initialized');
        return false;
      }

      // Use enhanced health check with proper timeout and retry
      const isHealthy = await checkRedisHealth();

      if (!isHealthy) {
        const circuitStatus = getCircuitBreakerStatus();
// console.warn(`⚠️ Redis health check failed. Circuit breaker state: ${circuitStatus.state}`);
      }

      return isHealthy;
    } catch (__error) {
// console.warn('⚠️ Redis availability check failed:', __error instanceof Error ? __error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get stories feed from cache with enhanced fallback system
   */
  static async getStoriesFeed(
    limit: number = 50,
    fallbackFn?: () => Promise<StoriesFeed[]>
  ): Promise<StoriesFeed[]> {
    try {
      const cacheKey = `${CACHE_KEYS.STORIES_FEED}:${limit}`;
      
      // Check Redis availability first
      const redisAvailable = await this.isRedisAvailable();
      
      if (redisAvailable) {
        // Try to get from Redis cache using safe Redis operation
        const cached = await safeRedisGet<StoriesFeed[]>(cacheKey);
        
        if (cached) {
// console.log('📱 Stories feed served from Redis cache');
          return cached;
        }
      } else {
// console.warn('⚠️ Redis unavailable, trying fallback cache');
        
        // Try fallback cache when Redis is unavailable
        const fallbackData = await FallbackCache.get<StoriesFeed[]>(cacheKey);
        if (fallbackData) {
// console.log('📱 Stories feed served from fallback cache');
          return fallbackData;
        }
      }
      
      // If not in cache and fallback provided, fetch from database
      if (fallbackFn) {
// console.log('🔄 Fetching stories feed from database');
        const freshData = await fallbackFn();
        
        // Try to cache the fresh data
        if (freshData.length > 0) {
          if (redisAvailable) {
            const cacheSuccess = await this.setStoriesFeed(freshData, limit);
            if (!cacheSuccess) {
// console.warn('⚠️ Redis cache failed, using fallback cache');
              await FallbackCache.set(cacheKey, freshData, CACHE_TTL.STORIES_FEED);
            }
          } else {
            // Use fallback cache when Redis is unavailable
            await FallbackCache.set(cacheKey, freshData, CACHE_TTL.STORIES_FEED);
          }
        }
        
        return freshData;
      }
      
      return [];
    } catch (__error) {
      // Use network error handler for better error management
      const { handleNetworkError, isNetworkError } = await import('../utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
        handleNetworkError(__error, { 
          context: 'Stories cache', 
          showUserAlert: false // Don't show alert for cache failures
        });
      } else {
        console.error('❌ Error getting stories feed from cache:', __error);
      }
      
      // If Redis is completely unavailable, try fallback without caching
      if (fallbackFn) {
        try {
// console.log('🔄 Redis unavailable, fetching directly from database');
          return await fallbackFn();
        } catch (__fallbackError) {
          handleNetworkError(__fallbackError, { 
            context: 'Stories feed', 
            showUserAlert: true 
          });
          return [];
        }
      }
      
      return [];
    }
  }

  /**
   * Cache stories feed data with enhanced timeout handling
   */
  static async setStoriesFeed(data: StoriesFeed[], limit: number = 50): Promise<boolean> {
    try {
      const redisAvailable = await this.isRedisAvailable();
      if (!redisAvailable) {
// console.warn('⚠️ Redis unavailable, skipping cache set for stories feed');
        return false;
      }

      const cacheKey = `${CACHE_KEYS.STORIES_FEED}:${limit}`;
      const success = await safeRedisSet(cacheKey, data, { ex: CACHE_TTL.STORIES_FEED });
      
      if (success) {
// console.log(`✅ Successfully cached stories feed (${data.length} items)`);
        return true;
      } else {
// console.warn('⚠️ Failed to cache stories feed due to timeout or error');
        return false;
      }
    } catch (__error) {
      // Use network error handler for better error detection
      const { handleNetworkError, isNetworkError } = await import('../utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
// console.warn('⚠️ Network error while caching stories feed - Redis may be unavailable:', __error instanceof Error ? __error.message : 'Unknown error');
        // Don't show user alert for cache failures
      } else {
        console.error('❌ Error caching stories feed:', __error);
      }
      return false; // Return false on error
    }
  }

  /**
   * Get user stories from cache with enhanced fallback system
   */
  static async getUserStories(
    userId: string,
    fallbackFn?: () => Promise<CachedStory[]>
  ): Promise<CachedStory[]> {
    try {
      const cacheKey = `${CACHE_KEYS.USER_STORIES}${userId}`;
      
      // Check Redis availability first
      const redisAvailable = await this.isRedisAvailable();
      
      if (redisAvailable) {
        // Try to get from Redis cache using safe Redis operation
        const cached = await safeRedisGet<CachedStory[]>(cacheKey);
        
        if (cached) {
// console.log(`📱 User stories for ${userId} served from Redis cache`);
          return cached;
        }
      } else {
// console.warn('⚠️ Redis unavailable, trying fallback cache');
        
        // Try fallback cache when Redis is unavailable
        const fallbackData = await FallbackCache.get<CachedStory[]>(cacheKey);
        if (fallbackData) {
// console.log(`📱 User stories for ${userId} served from fallback cache`);
          return fallbackData;
        }
      }
      
      // If not in cache and fallback provided, fetch from database
      if (fallbackFn) {
// console.log(`🔄 Fetching user stories for ${userId} from database`);
        const freshData = await fallbackFn();
        
        // Try to cache the fresh data
        if (freshData.length > 0) {
          if (redisAvailable) {
            await this.setUserStories(userId, freshData);
// console.log(`💾 User stories for ${userId} cached successfully`);
          } else {
            // Use fallback cache when Redis is unavailable
            await FallbackCache.set(cacheKey, freshData, CACHE_TTL.USER_STORIES);
          }
        }
        
        return freshData;
      }
      
      return [];
    } catch (__error) {
      // Use network error handler for better error management
      const { handleNetworkError, isNetworkError } = await import('../utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
        handleNetworkError(__error, { 
          context: 'User stories cache', 
          showUserAlert: false // Don't show alert for cache failures
        });
      } else {
        console.error(`❌ Error getting user stories for ${userId} from cache:`, __error);
      }
      
      // If Redis is completely unavailable, try fallback without caching
      if (fallbackFn) {
        try {
// console.log(`🔄 Redis unavailable, fetching user stories for ${userId} directly from database`);
          return await fallbackFn();
        } catch (__fallbackError) {
          handleNetworkError(__fallbackError, { 
            context: 'User stories', 
            showUserAlert: true 
          });
          return [];
        }
      }
      
      return [];
    }
  }

  /**
   * Cache user stories data
   */
  static async setUserStories(userId: string, stories: CachedStory[]): Promise<void> {
    try {
      const redisAvailable = await this.isRedisAvailable();
      if (!redisAvailable || !redis) {
// console.warn(`⚠️ Redis unavailable, skipping cache set for user stories ${userId}`);
        return;
      }

      const cacheKey = `${CACHE_KEYS.USER_STORIES}${userId}`;
      await redis.setex(cacheKey, CACHE_TTL.USER_STORIES, stories);
// console.log(`💾 User stories for ${userId} cached successfully`);
    } catch (__error) {
// console.warn(`⚠️ Failed to cache user stories for ${userId}, continuing without cache:`, __error);
      // Don't throw error - graceful degradation
    }
  }

  /**
   * Track story view in cache (for analytics)
   */
  static async trackStoryView(
    storyId: string,
    viewerId: string,
    viewDuration: number = 0
  ): Promise<void> {
    try {
      const redisAvailable = await this.isRedisAvailable();
      if (!redisAvailable) {
// console.warn(`⚠️ Redis unavailable, skipping story view tracking for ${storyId}`);
        return;
      }

      const viewKey = `${CACHE_KEYS.STORY_VIEWS}${storyId}`;
      const analyticsKey = `${CACHE_KEYS.STORY_ANALYTICS}${storyId}`;
      
      // Track individual view
      const viewData = {
        viewer_id: viewerId,
        viewed_at: new Date().toISOString(),
        view_duration: viewDuration,
        completed: viewDuration >= 3000,
      };
      
      await redis.hset(viewKey, { [viewerId]: viewData });
      await redis.expire(viewKey, CACHE_TTL.STORY_VIEWS);
      
      // Update analytics
      const currentAnalytics = await redis.get<StoryAnalytics>(analyticsKey) || {
        total_views: 0,
        unique_viewers: 0,
        completion_rate: 0,
        avg_view_duration: 0,
        last_updated: new Date().toISOString(),
      };
      
      // Get all views for this story
      const allViews = await redis.hgetall(viewKey);
      const viewsArray = Object.values(allViews || {}) as any[];
      
      const updatedAnalytics: StoryAnalytics = {
        total_views: viewsArray.length,
        unique_viewers: new Set(viewsArray.map(v => v.viewer_id)).size,
        completion_rate: viewsArray.filter(v => v.completed).length / viewsArray.length,
        avg_view_duration: viewsArray.reduce((sum, v) => sum + v.view_duration, 0) / viewsArray.length,
        last_updated: new Date().toISOString(),
      };
      
      await redis.setex(analyticsKey, CACHE_TTL.STORY_ANALYTICS, updatedAnalytics);
// console.log(`📊 Story view tracked for ${storyId} by ${viewerId}`);

    } catch (__error) {
// console.warn(`⚠️ Failed to track story view for ${storyId}, continuing without analytics:`, __error);
      // Don't throw error - graceful degradation
    }
  }

  /**
   * Get story analytics from cache
   */
  static async getStoryAnalytics(storyId: string): Promise<StoryAnalytics | null> {
    try {
      const analyticsKey = `${CACHE_KEYS.STORY_ANALYTICS}${storyId}`;
      const analytics = await redis.get<StoryAnalytics>(analyticsKey);
      
      if (analytics) {

      }
      
      return analytics;
    } catch (__error) {
      console.error(`❌ Error getting story analytics for ${storyId}:`, __error);
      return null;
    }
  }

  /**
   * Invalidate cache when stories are updated
   */
  static async invalidateStoriesCache(userId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      
      // Always invalidate feed cache
      const feedKeys = await redis.keys(`${CACHE_KEYS.STORIES_FEED}:*`);
      keysToDelete.push(...feedKeys);
      
      // Invalidate active stories cache
      keysToDelete.push(CACHE_KEYS.ACTIVE_STORIES);
      
      // If specific user, invalidate their stories
      if (userId) {
        keysToDelete.push(`${CACHE_KEYS.USER_STORIES}${userId}`);
      } else {
        // Invalidate all user stories
        const userStoryKeys = await redis.keys(`${CACHE_KEYS.USER_STORIES}*`);
        keysToDelete.push(...userStoryKeys);
      }
      
      // Delete all keys
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);

      }
    } catch (__error) {
      console.error('❌ Error invalidating stories cache:', __error);
    }
  }

  /**
   * Cache active stories list for quick access
   */
  static async setActiveStories(storyIds: string[]): Promise<void> {
    try {
      await redis.setex(CACHE_KEYS.ACTIVE_STORIES, CACHE_TTL.ACTIVE_STORIES, storyIds);

    } catch (__error) {
      console.error('❌ Error caching active stories:', __error);
    }
  }

  /**
   * Get active stories list from cache
   */
  static async getActiveStories(): Promise<string[]> {
    try {
      const cached = await redis.get<string[]>(CACHE_KEYS.ACTIVE_STORIES);
      
      if (cached) {

        return cached;
      }
      
      return [];
    } catch (__error) {
      console.error('❌ Error getting active stories from cache:', __error);
      return [];
    }
  }

  /**
   * Batch update multiple cache entries
   */
  static async batchUpdate(operations: {
    key: string;
    data: any;
    ttl: number;
  }[]): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      
      operations.forEach(({ key, data, ttl }) => {
        pipeline.setex(key, ttl, data);
      });
      
      await pipeline.exec();

    } catch (__error) {
      console.error('❌ Error in batch cache update:', __error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    total_keys: number;
    stories_feed_keys: number;
    user_stories_keys: number;
    analytics_keys: number;
  }> {
    try {
      const [
        allKeys,
        feedKeys,
        userStoryKeys,
        analyticsKeys,
      ] = await Promise.all([
        redis.keys('stories:*'),
        redis.keys(`${CACHE_KEYS.STORIES_FEED}:*`),
        redis.keys(`${CACHE_KEYS.USER_STORIES}*`),
        redis.keys(`${CACHE_KEYS.STORY_ANALYTICS}*`),
      ]);
      
      return {
        total_keys: allKeys.length,
        stories_feed_keys: feedKeys.length,
        user_stories_keys: userStoryKeys.length,
        analytics_keys: analyticsKeys.length,
      };
    } catch (__error) {
      console.error('❌ Error getting cache stats:', __error);
      return {
        total_keys: 0,
        stories_feed_keys: 0,
        user_stories_keys: 0,
        analytics_keys: 0,
      };
    }
  }

  /**
   * Clear all stories cache (use with caution)
   */
  static async clearAllCache(): Promise<void> {
    try {
      const allKeys = await redis.keys('stories:*');
      
      if (allKeys.length > 0) {
        await redis.del(...allKeys);

      }
    } catch (__error) {
      console.error('❌ Error clearing all cache:', __error);
    }
  }
}

export default StoriesCache;

