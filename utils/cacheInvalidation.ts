/**
 * Cache Invalidation Utilities for Klicktape
 * Provides comprehensive cache clearing and invalidation across all data sources
 */

import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '@/src/store/store';
import { 
  setStories,
  clearPosts,
  resetReels,
  setUser,
  resetUnreadMessageCount,
  setNotifications
} from '@/src/store/slices/index';

// Query keys for TanStack Query
export const QUERY_KEYS = {
  STORIES: ['stories'] as string[],
  POSTS: ['posts'] as string[],
  REELS: ['reels'] as string[],
  PROFILE: ['profile'] as string[],
  USER_PROFILE: (userId: string) => ['profile', userId] as string[],
  CHATS: ['chats'] as string[],
  CHAT_MESSAGES: (chatId: string) => ['chat', 'messages', chatId] as string[],
  NOTIFICATIONS: ['notifications'] as string[],
  LEADERBOARD: ['leaderboard'] as string[],
  FOLLOWERS: (userId: string) => ['followers', userId] as string[],
  FOLLOWING: (userId: string) => ['following', userId] as string[],
  LIKES: (postId: string) => ['likes', postId] as string[],
  COMMENTS: (postId: string) => ['comments', postId] as string[],
  SEARCH: ['search'] as string[],
  TRENDING: ['trending'] as string[],
  FEED: ['feed'] as string[],
  DISCOVER: ['discover'] as string[],
};

// Cache types
export type CacheType = 
  | 'tanstack-query'
  | 'redux'
  | 'async-storage'
  | 'redis'
  | 'all';

export type DataSource = 
  | 'stories'
  | 'posts'
  | 'reels'
  | 'profile'
  | 'chats'
  | 'notifications'
  | 'leaderboard'
  | 'followers'
  | 'following'
  | 'likes'
  | 'comments'
  | 'search'
  | 'trending'
  | 'feed'
  | 'discover'
  | 'all';

interface CacheInvalidationOptions {
  cacheTypes?: CacheType[];
  dataSources?: DataSource[];
  userId?: string;
  postId?: string;
  chatId?: string;
  force?: boolean;
  silent?: boolean;
}

/**
 * TanStack Query Cache Management
 */
export class TanStackQueryCacheManager {
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Clear all TanStack Query caches
   */
  async clearAll(): Promise<void> {
    // console.log('🗑️ Clearing all TanStack Query caches');
    await this.queryClient.clear();
  }

  /**
   * Invalidate specific query keys
   */
  async invalidateQueries(queryKeys: string[][]): Promise<void> {
    // console.log('🔄 Invalidating TanStack Query keys:', queryKeys);
    
    const promises = queryKeys.map(key => 
      this.queryClient.invalidateQueries({ queryKey: key })
    );
    
    await Promise.all(promises);
  }

  /**
   * Remove specific query keys
   */
  async removeQueries(queryKeys: string[][]): Promise<void> {
    // console.log('🗑️ Removing TanStack Query keys:', queryKeys);
    
    queryKeys.forEach(key => {
      this.queryClient.removeQueries({ queryKey: key });
    });
  }

  /**
   * Reset specific query keys
   */
  async resetQueries(queryKeys: string[][]): Promise<void> {
    // console.log('🔄 Resetting TanStack Query keys:', queryKeys);
    
    const promises = queryKeys.map(key => 
      this.queryClient.resetQueries({ queryKey: key })
    );
    
    await Promise.all(promises);
  }

  /**
   * Get query keys for data source
   */
  getQueryKeysForDataSource(dataSource: DataSource, options?: { userId?: string; postId?: string; chatId?: string }): string[][] {
    const { userId, postId, chatId } = options || {};
    
    switch (dataSource) {
      case 'stories':
        return [QUERY_KEYS.STORIES];
      case 'posts':
        return [QUERY_KEYS.POSTS, QUERY_KEYS.FEED];
      case 'reels':
        return [QUERY_KEYS.REELS];
      case 'profile':
        return userId ? [QUERY_KEYS.USER_PROFILE(userId)] : [QUERY_KEYS.PROFILE];
      case 'chats':
        return chatId ? [QUERY_KEYS.CHAT_MESSAGES(chatId)] : [QUERY_KEYS.CHATS];
      case 'notifications':
        return [QUERY_KEYS.NOTIFICATIONS];
      case 'leaderboard':
        return [QUERY_KEYS.LEADERBOARD];
      case 'followers':
        return userId ? [QUERY_KEYS.FOLLOWERS(userId)] : [];
      case 'following':
        return userId ? [QUERY_KEYS.FOLLOWING(userId)] : [];
      case 'likes':
        return postId ? [QUERY_KEYS.LIKES(postId)] : [];
      case 'comments':
        return postId ? [QUERY_KEYS.COMMENTS(postId)] : [];
      case 'search':
        return [QUERY_KEYS.SEARCH];
      case 'trending':
        return [QUERY_KEYS.TRENDING];
      case 'feed':
        return [QUERY_KEYS.FEED];
      case 'discover':
        return [QUERY_KEYS.DISCOVER];
      case 'all':
        return Object.values(QUERY_KEYS).filter(Array.isArray);
      default:
        return [];
    }
  }
}

/**
 * Redux Cache Management
 */
export class ReduxCacheManager {
  /**
   * Clear all Redux caches
   */
  async clearAll(): Promise<void> {
    // console.log('🗑️ Clearing all Redux caches');
    
    const actions = [
      setStories([]),
      clearPosts(),
      resetReels(),
      setUser(null),
      resetUnreadMessageCount(),
      setNotifications([]),
    ];

    actions.forEach(action => {
      store.dispatch(action);
    });
  }

  /**
   * Clear specific data source caches
   */
  async clearDataSource(dataSource: DataSource): Promise<void> {
    // console.log(`🗑️ Clearing Redux cache for: ${dataSource}`);
    
    switch (dataSource) {
      case 'stories':
        store.dispatch(setStories([]));
        break;
      case 'posts':
        store.dispatch(clearPosts());
        break;
      case 'reels':
        store.dispatch(resetReels());
        break;
      case 'profile':
        store.dispatch(setUser(null));
        break;
      case 'chats':
        store.dispatch(resetUnreadMessageCount());
        break;
      case 'notifications':
        store.dispatch(setNotifications([]));
        break;
      case 'leaderboard':
        // No specific leaderboard action available, skip
        // console.log('⚠️ No leaderboard clear action available');
        break;
      case 'all':
        await this.clearAll();
        break;
    }
  }
}

/**
 * AsyncStorage Cache Management
 */
export class AsyncStorageCacheManager {
  private readonly CACHE_KEYS = {
    STORIES: '@klicktape/stories',
    POSTS: '@klicktape/posts',
    REELS: '@klicktape/reels',
    PROFILE: '@klicktape/profile',
    CHATS: '@klicktape/chats',
    NOTIFICATIONS: '@klicktape/notifications',
    LEADERBOARD: '@klicktape/leaderboard',
    USER_PREFERENCES: '@klicktape/preferences',
    CACHE_TIMESTAMPS: '@klicktape/cache_timestamps',
  };

  /**
   * Clear all AsyncStorage caches
   */
  async clearAll(): Promise<void> {
    // console.log('🗑️ Clearing all AsyncStorage caches');
    
    const keys = Object.values(this.CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  }

  /**
   * Clear specific data source caches
   */
  async clearDataSource(dataSource: DataSource): Promise<void> {
    // console.log(`🗑️ Clearing AsyncStorage cache for: ${dataSource}`);
    
    const keysToRemove: string[] = [];
    
    switch (dataSource) {
      case 'stories':
        keysToRemove.push(this.CACHE_KEYS.STORIES);
        break;
      case 'posts':
        keysToRemove.push(this.CACHE_KEYS.POSTS);
        break;
      case 'reels':
        keysToRemove.push(this.CACHE_KEYS.REELS);
        break;
      case 'profile':
        keysToRemove.push(this.CACHE_KEYS.PROFILE);
        break;
      case 'chats':
        keysToRemove.push(this.CACHE_KEYS.CHATS);
        break;
      case 'notifications':
        keysToRemove.push(this.CACHE_KEYS.NOTIFICATIONS);
        break;
      case 'leaderboard':
        keysToRemove.push(this.CACHE_KEYS.LEADERBOARD);
        break;
      case 'all':
        await this.clearAll();
        return;
    }

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  }

  /**
   * Update cache timestamp
   */
  async updateCacheTimestamp(dataSource: DataSource): Promise<void> {
    const timestamps = await this.getCacheTimestamps();
    timestamps[dataSource] = Date.now();
    await AsyncStorage.setItem(this.CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
  }

  /**
   * Get cache timestamps
   */
  async getCacheTimestamps(): Promise<Record<string, number>> {
    try {
      const timestamps = await AsyncStorage.getItem(this.CACHE_KEYS.CACHE_TIMESTAMPS);
      return timestamps ? JSON.parse(timestamps) : {};
    } catch (__error) {
      // console.error('❌ Error getting cache timestamps:', __error);
      return {};
    }
  }
}

/**
 * Redis Cache Management (Backend)
 */
export class RedisCacheManager {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Clear all Redis caches
   */
  async clearAll(): Promise<void> {
    // console.log('🗑️ Clearing all Redis caches');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/cache/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Redis clear all failed: ${response.statusText}`);
      }

      // console.log('✅ All Redis caches cleared successfully');
    } catch (_error) {
      // console.error('❌ Error clearing Redis caches:', _error);
      throw _error;
    }
  }

  /**
   * Clear specific data source caches
   */
  async clearDataSource(dataSource: DataSource, options?: { userId?: string; postId?: string }): Promise<void> {
    // console.log(`🗑️ Clearing Redis cache for: ${dataSource}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/cache/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataSource,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Redis clear failed: ${response.statusText}`);
      }

      // console.log(`✅ Redis cache cleared for ${dataSource}`);
    } catch (_error) {
      // console.error(`❌ Error clearing Redis cache for ${dataSource}:`, _error);
      throw _error;
    }
  }

  /**
   * Invalidate cache patterns
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // console.log(`🔄 Invalidating Redis cache pattern: ${pattern}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pattern }),
      });

      if (!response.ok) {
        throw new Error(`Redis invalidate failed: ${response.statusText}`);
      }

      // console.log(`✅ Redis cache pattern invalidated: ${pattern}`);
    } catch (_error) {
      // console.error(`❌ Error invalidating Redis cache pattern ${pattern}:`, _error);
      throw _error;
    }
  }
}

/**
 * Universal Cache Invalidation Manager
 */
export class UniversalCacheInvalidator {
  private tanstackManager: TanStackQueryCacheManager;
  private reduxManager: ReduxCacheManager;
  private asyncStorageManager: AsyncStorageCacheManager;
  private redisManager: RedisCacheManager;

  constructor(queryClient: QueryClient) {
    this.tanstackManager = new TanStackQueryCacheManager(queryClient);
    this.reduxManager = new ReduxCacheManager();
    this.asyncStorageManager = new AsyncStorageCacheManager();
    this.redisManager = new RedisCacheManager();
  }

  /**
   * Invalidate caches based on options
   */
  async invalidate(options: CacheInvalidationOptions = {}): Promise<void> {
    const {
      cacheTypes = ['all'],
      dataSources = ['all'],
      userId,
      postId,
      chatId,
      force = false,
      silent = false,
    } = options;

    if (!silent) {
      // console.log('🔄 Starting cache invalidation:', { cacheTypes, dataSources });
    }

    const errors: Error[] = [];

    // Determine which cache types to clear
    const shouldClearTanStack = cacheTypes.includes('all') || cacheTypes.includes('tanstack-query');
    const shouldClearRedux = cacheTypes.includes('all') || cacheTypes.includes('redux');
    const shouldClearAsyncStorage = cacheTypes.includes('all') || cacheTypes.includes('async-storage');
    const shouldClearRedis = cacheTypes.includes('all') || cacheTypes.includes('redis');

    // Process each data source
    for (const dataSource of dataSources) {
      try {
        // TanStack Query
        if (shouldClearTanStack) {
          if (dataSource === 'all') {
            await this.tanstackManager.clearAll();
          } else {
            const queryKeys = this.tanstackManager.getQueryKeysForDataSource(dataSource, { userId, postId, chatId });
            if (force) {
              await this.tanstackManager.removeQueries(queryKeys);
            } else {
              await this.tanstackManager.invalidateQueries(queryKeys);
            }
          }
        }

        // Redux
        if (shouldClearRedux) {
          await this.reduxManager.clearDataSource(dataSource);
        }

        // AsyncStorage
        if (shouldClearAsyncStorage) {
          await this.asyncStorageManager.clearDataSource(dataSource);
          if (dataSource !== 'all') {
            await this.asyncStorageManager.updateCacheTimestamp(dataSource);
          }
        }

        // Redis (Backend)
        if (shouldClearRedis) {
          if (dataSource === 'all') {
            await this.redisManager.clearAll();
          } else {
            await this.redisManager.clearDataSource(dataSource, { userId, postId });
          }
        }
      } catch (_error) {
        // console.error(`❌ Error invalidating ${dataSource}:`, _error);
        errors.push(_error as Error);
      }
    }

    if (errors.length > 0 && !silent) {
      // console.warn(`⚠️ Cache invalidation completed with ${errors.length} errors`);
    } else if (!silent) {
      // console.log('✅ Cache invalidation completed successfully');
    }

    // Throw if there were critical errors and force is enabled
    if (errors.length > 0 && force) {
      throw new Error(`Cache invalidation failed: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * Quick invalidation for common scenarios
   */
  async quickInvalidate(dataSource: DataSource, userId?: string): Promise<void> {
    await this.invalidate({
      cacheTypes: ['tanstack-query', 'redux'],
      dataSources: [dataSource],
      userId,
      silent: true,
    });
  }

  /**
   * Deep invalidation for thorough refresh
   */
  async deepInvalidate(dataSources: DataSource[] = ['all']): Promise<void> {
    await this.invalidate({
      cacheTypes: ['all'],
      dataSources,
      force: true,
    });
  }

  /**
   * Background invalidation (silent, non-blocking)
   */
  async backgroundInvalidate(dataSources: DataSource[] = ['all']): Promise<void> {
    // Run in background without awaiting
    this.invalidate({
      cacheTypes: ['tanstack-query'],
      dataSources,
      silent: true,
    }).catch(error => {
      // console.error('❌ Background cache invalidation failed:', error);
    });
  }
}

// Export singleton instance factory
export const createCacheInvalidator = (queryClient: QueryClient) => {
  return new UniversalCacheInvalidator(queryClient);
};