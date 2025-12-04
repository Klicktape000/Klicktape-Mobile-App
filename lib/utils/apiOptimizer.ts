/**
 * API Request Optimizer
 * Reduces API calls through batching, deduplication, and intelligent caching
 */

import { QueryClient } from '@tanstack/react-query';

interface BatchRequest {
  id: string;
  queryKey: string[];
  queryFn: () => Promise<any>;
  resolve: (data: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface RequestCache {
  [key: string]: {
    data: any;
    timestamp: number;
    expiry: number;
  };
}

class APIOptimizer {
  private batchQueue: BatchRequest[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private requestCache: RequestCache = {};
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private readonly BATCH_DELAY = 50; // ms
  private readonly MAX_BATCH_SIZE = 10;
  private readonly DEFAULT_CACHE_TIME = 30000; // 30 seconds

  /**
   * Batch multiple requests together to reduce API calls
   */
  batchRequest<T>(
    queryKey: string[],
    queryFn: () => Promise<T>,
    options: { cacheTime?: number } = {}
  ): Promise<T> {
    const requestId = this.generateRequestId(queryKey);
    const cacheKey = queryKey.join('|');
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    // Check if request is already pending (deduplication)
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new batched request
    const promise = new Promise<T>((resolve, reject) => {
      const batchRequest: BatchRequest = {
        id: requestId,
        queryKey,
        queryFn,
        resolve: (data) => {
          this.setCachedData(cacheKey, data, options.cacheTime);
          resolve(data);
        },
        reject,
        timestamp: Date.now(),
      };

      this.batchQueue.push(batchRequest);
      this.scheduleBatchExecution();
    });

    this.pendingRequests.set(requestId, promise);
    
    // Clean up pending request after completion
    promise.finally(() => {
      this.pendingRequests.delete(requestId);
    });

    return promise;
  }

  /**
   * Execute batched requests
   */
  private async executeBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.MAX_BATCH_SIZE);
    
    // Group similar requests that can be batched together
    const groupedRequests = this.groupSimilarRequests(batch);
    
    // Execute each group
    await Promise.all(
      Object.values(groupedRequests).map(group => this.executeRequestGroup(group))
    );
  }

  /**
   * Group similar requests for more efficient batching
   */
  private groupSimilarRequests(requests: BatchRequest[]): { [key: string]: BatchRequest[] } {
    const groups: { [key: string]: BatchRequest[] } = {};
    
    requests.forEach(request => {
      // Group by the first part of the query key (e.g., 'users', 'posts', etc.)
      const groupKey = request.queryKey[0] || 'default';
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(request);
    });
    
    return groups;
  }

  /**
   * Execute a group of similar requests
   */
  private async executeRequestGroup(requests: BatchRequest[]): Promise<void> {
    // For now, execute requests individually
    // In a real implementation, you might batch similar API calls
    await Promise.all(
      requests.map(async (request) => {
        try {
          const data = await request.queryFn();
          request.resolve(data);
        } catch (error) {
          request.reject(error);
        }
      })
    );
  }

  /**
   * Schedule batch execution with debouncing
   */
  private scheduleBatchExecution(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.executeBatch();
      this.batchTimeout = null;
    }, this.BATCH_DELAY);

    // Execute immediately if batch is full
    if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      this.executeBatch();
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(queryKey: string[]): string {
    return queryKey.join('|') + '|' + Date.now();
  }

  /**
   * Get cached data if still valid
   */
  private getCachedData(key: string): any | null {
    const cached = this.requestCache[key];
    
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      delete this.requestCache[key];
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cached data with expiry
   */
  private setCachedData(key: string, data: any, cacheTime?: number): void {
    const expiry = Date.now() + (cacheTime || this.DEFAULT_CACHE_TIME);
    
    this.requestCache[key] = {
      data,
      timestamp: Date.now(),
      expiry,
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    Object.keys(this.requestCache).forEach(key => {
      if (this.requestCache[key].expiry < now) {
        delete this.requestCache[key];
      }
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    cacheSize: number;
    hitRate: number;
  } {
    const now = Date.now();
    const entries = Object.values(this.requestCache);
    const expiredEntries = entries.filter(entry => entry.expiry < now).length;
    
    return {
      totalEntries: entries.length,
      expiredEntries,
      cacheSize: JSON.stringify(this.requestCache).length,
      hitRate: 0, // Would need to track hits/misses to calculate
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.requestCache = {};
  }

  /**
   * Prefetch data for better performance
   */
  async prefetch<T>(
    queryKey: string[],
    queryFn: () => Promise<T>,
    cacheTime?: number
  ): Promise<void> {
    const cacheKey = queryKey.join('|');
    
    // Don't prefetch if already cached
    if (this.getCachedData(cacheKey)) {
      return;
    }

    try {
      const data = await queryFn();
      this.setCachedData(cacheKey, data, cacheTime);
    } catch (error) {
      // Silently fail prefetch attempts
// console.warn('Prefetch failed:', error);
    }
  }
}

// Export singleton instance
export const apiOptimizer = new APIOptimizer();

// Clean up expired cache every 5 minutes
setInterval(() => {
  apiOptimizer.clearExpiredCache();
}, 5 * 60 * 1000);

export default apiOptimizer;