/**
 * Query Optimizer - Advanced API performance optimizations
 * Enhances TanStack Query with intelligent caching, deduplication, and batching
 */

import { QueryClient, QueryKey } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Configuration for query optimization
export const QUERY_CONFIG = {
  staleTime: {
    posts: 5 * 60 * 1000,      // 5 minutes
    stories: 2 * 60 * 1000,    // 2 minutes
    reels: 3 * 60 * 1000,      // 3 minutes
    profile: 10 * 60 * 1000,   // 10 minutes
    comments: 1 * 60 * 1000,   // 1 minute
    notifications: 30 * 1000,  // 30 seconds
  },
  cacheTime: {
    posts: 30 * 60 * 1000,     // 30 minutes
    stories: 15 * 60 * 1000,   // 15 minutes
    reels: 20 * 60 * 1000,     // 20 minutes
    profile: 60 * 60 * 1000,   // 1 hour
    comments: 10 * 60 * 1000,  // 10 minutes
    notifications: 5 * 60 * 1000, // 5 minutes
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  maxRetries: 3,
};

// Request deduplication manager
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear() {
    this.pendingRequests.clear();
  }
}

// Batch request manager
class BatchRequestManager {
  private batches = new Map<string, {
    requests: { id: string; resolve: Function; reject: Function }[];
    timer: ReturnType<typeof setTimeout>;
  }>();

  private readonly BATCH_DELAY = 50; // 50ms batching window
  private readonly MAX_BATCH_SIZE = 10;

  async batchRequest<T>(
    batchKey: string,
    requestId: string,
    batchExecutor: (ids: string[]) => Promise<T[]>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, {
          requests: [],
          timer: setTimeout(() => this.executeBatch(batchKey, batchExecutor), this.BATCH_DELAY)
        });
      }

      const batch = this.batches.get(batchKey)!;
      batch.requests.push({ id: requestId, resolve, reject });

      // Execute immediately if batch is full
      if (batch.requests.length >= this.MAX_BATCH_SIZE) {
        clearTimeout(batch.timer);
        this.executeBatch(batchKey, batchExecutor);
      }
    });
  }

  private async executeBatch<T>(
    batchKey: string,
    batchExecutor: (ids: string[]) => Promise<T[]>
  ) {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    this.batches.delete(batchKey);
    const ids = batch.requests.map(req => req.id);

    try {
      const results = await batchExecutor(ids);
      batch.requests.forEach((req, index) => {
        req.resolve(results[index]);
      });
    } catch (error) {
      batch.requests.forEach(req => req.reject(error));
    }
  }
}

// Smart cache invalidation
export class SmartCacheInvalidator {
  constructor(private queryClient: QueryClient) {}

  invalidateRelatedQueries(entityType: string, entityId?: string, action?: string) {
    const patterns = this.getInvalidationPatterns(entityType, entityId, action);
    
    patterns.forEach(pattern => {
      this.queryClient.invalidateQueries({
        predicate: (query) => this.matchesPattern(query.queryKey, pattern)
      });
    });
  }

  private getInvalidationPatterns(entityType: string, entityId?: string, action?: string): string[][] {
    const patterns: string[][] = [];

    switch (entityType) {
      case 'post':
        patterns.push(['posts', 'feed']);
        patterns.push(['posts', 'explore']);
        if (entityId) {
          patterns.push(['posts', entityId]);
          patterns.push(['posts', 'comments', entityId]);
        }
        if (action === 'like' || action === 'bookmark') {
          patterns.push(['posts', 'user-interactions']);
        }
        break;

      case 'reel':
        patterns.push(['reels', 'feed']);
        patterns.push(['reels', 'trending']);
        if (entityId) {
          patterns.push(['reels', entityId]);
          patterns.push(['reels', 'comments', entityId]);
        }
        break;

      case 'story':
        patterns.push(['stories', 'feed']);
        if (entityId) {
          patterns.push(['stories', 'user', entityId]);
        }
        break;

      case 'profile':
        if (entityId) {
          patterns.push(['profile', entityId]);
          patterns.push(['posts', 'user', entityId]);
          patterns.push(['reels', 'user', entityId]);
          patterns.push(['stories', 'user', entityId]);
        }
        break;
    }

    return patterns;
  }

  private matchesPattern(queryKey: QueryKey, pattern: string[]): boolean {
    if (!Array.isArray(queryKey)) return false;
    
    return pattern.every((segment, index) => {
      if (index >= queryKey.length) return false;
      return segment === '*' || queryKey[index] === segment;
    });
  }
}

// Query performance monitor
export class QueryPerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    cacheHits: number;
  }>();

  trackQuery(queryKey: QueryKey, duration: number, fromCache: boolean, error?: boolean) {
    const key = JSON.stringify(queryKey);
    const current = this.metrics.get(key) || { count: 0, totalTime: 0, errors: 0, cacheHits: 0 };
    
    current.count++;
    current.totalTime += duration;
    if (fromCache) current.cacheHits++;
    if (error) current.errors++;
    
    this.metrics.set(key, current);
  }

  getMetrics() {
    const results: {
      queryKey: string;
      avgTime: number;
      cacheHitRate: number;
      errorRate: number;
      totalCalls: number;
    }[] = [];

    this.metrics.forEach((metrics, queryKey) => {
      results.push({
        queryKey,
        avgTime: metrics.totalTime / metrics.count,
        cacheHitRate: metrics.cacheHits / metrics.count,
        errorRate: metrics.errors / metrics.count,
        totalCalls: metrics.count,
      });
    });

    return results.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  reset() {
    this.metrics.clear();
  }
}

// Optimized batch operations
export const batchOperations = {
  async batchFetchPosts(postIds: string[]) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, avatar_url),
        likes:likes!post_id (user_id),
        bookmarks:bookmarks!post_id (user_id)
      `)
      .in('id', postIds);

    if (error) throw error;
    return data;
  },

  async batchFetchReels(reelIds: string[]) {
    const { data, error } = await supabase
      .from('reels')
      .select(`
        *,
        profiles:user_id (username, avatar_url),
        likes:reel_likes!reel_id (user_id),
        bookmarks:reel_bookmarks!reel_id (user_id)
      `)
      .in('id', reelIds);

    if (error) throw error;
    return data;
  },

  async batchFetchProfiles(userIds: string[]) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (error) throw error;
    return data;
  },
};

// Intelligent prefetching
export class IntelligentPrefetcher {
  constructor(private queryClient: QueryClient) {}

  async prefetchRelatedContent(entityType: string, entityId: string) {
    switch (entityType) {
      case 'post':
        await this.prefetchPostRelated(entityId);
        break;
      case 'reel':
        await this.prefetchReelRelated(entityId);
        break;
      case 'profile':
        await this.prefetchProfileRelated(entityId);
        break;
    }
  }

  private async prefetchPostRelated(postId: string) {
    // Prefetch post comments
    this.queryClient.prefetchQuery({
      queryKey: ['posts', 'comments', postId],
      queryFn: () => this.fetchPostComments(postId),
      staleTime: QUERY_CONFIG.staleTime.comments,
    });

    // Prefetch post author's other posts
    const post = this.queryClient.getQueryData(['posts', postId]) as any;
    if (post?.user_id) {
      this.queryClient.prefetchQuery({
        queryKey: ['posts', 'user', post.user_id],
        queryFn: () => this.fetchUserPosts(post.user_id),
        staleTime: QUERY_CONFIG.staleTime.posts,
      });
    }
  }

  private async prefetchReelRelated(reelId: string) {
    // Similar logic for reels
    this.queryClient.prefetchQuery({
      queryKey: ['reels', 'comments', reelId],
      queryFn: () => this.fetchReelComments(reelId),
      staleTime: QUERY_CONFIG.staleTime.comments,
    });
  }

  private async prefetchProfileRelated(userId: string) {
    // Prefetch user's posts and reels
    Promise.all([
      this.queryClient.prefetchQuery({
        queryKey: ['posts', 'user', userId],
        queryFn: () => this.fetchUserPosts(userId),
        staleTime: QUERY_CONFIG.staleTime.posts,
      }),
      this.queryClient.prefetchQuery({
        queryKey: ['reels', 'user', userId],
        queryFn: () => this.fetchUserReels(userId),
        staleTime: QUERY_CONFIG.staleTime.reels,
      }),
    ]);
  }

  private async fetchPostComments(postId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:user_id (username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  private async fetchUserPosts(userId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id (username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    return data;
  }

  private async fetchUserReels(userId: string) {
    const { data, error } = await supabase
      .from('reels')
      .select('*, profiles:user_id (username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    return data;
  }

  private async fetchReelComments(reelId: string) {
    const { data, error } = await supabase
      .from('reel_comments')
      .select('*, profiles:user_id (username, avatar_url)')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

// Global instances
export const requestDeduplicator = new RequestDeduplicator();
export const batchRequestManager = new BatchRequestManager();
export const queryPerformanceMonitor = new QueryPerformanceMonitor();

// Initialize query optimizer
export const initializeQueryOptimizer = (queryClient: QueryClient) => {
  const smartCacheInvalidator = new SmartCacheInvalidator(queryClient);
  const intelligentPrefetcher = new IntelligentPrefetcher(queryClient);

  // Add query performance tracking
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.query.state.status === 'success') {
      const duration = Date.now() - (event.query.state.dataUpdatedAt || 0);
      const fromCache = !event.query.isStale();
      
      queryPerformanceMonitor.trackQuery(
        event.query.queryKey,
        duration,
        fromCache
      );
    }
  });

  return {
    smartCacheInvalidator,
    intelligentPrefetcher,
    requestDeduplicator,
    batchRequestManager,
    queryPerformanceMonitor,
  };
};

export default {
  QUERY_CONFIG,
  SmartCacheInvalidator,
  QueryPerformanceMonitor,
  IntelligentPrefetcher,
  batchOperations,
  requestDeduplicator,
  batchRequestManager,
  queryPerformanceMonitor,
  initializeQueryOptimizer,
};