/**
 * Request Manager for Supabase API Optimization
 * Handles request deduplication, cancellation, and resource management
 */

import { logger } from './logger';

interface PendingRequest {
  promise: Promise<any>;
  controller: AbortController;
  timestamp: number;
  requestKey: string;
}

class RequestManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5000; // 5 seconds cache
  private readonly MAX_CONCURRENT_REQUESTS = 10;

  /**
   * Generate a unique key for request deduplication
   */
  private generateRequestKey(
    table: string,
    operation: string,
    params: Record<string, any> = {}
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    return `${table}:${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Check if we have a cached response
   */
  private getCachedResponse(requestKey: string): any | null {
    const cached = this.requestCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.performance.api(`📋 Cache hit for ${requestKey}`);
      return cached.data;
    }
    
    if (cached) {
      this.requestCache.delete(requestKey);
    }
    return null;
  }

  /**
   * Cache a response
   */
  private setCachedResponse(requestKey: string, data: any): void {
    this.requestCache.set(requestKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > this.CACHE_DURATION) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Execute a request with deduplication and caching
   */
  async executeRequest<T>(
    table: string,
    operation: string,
    requestFn: (signal: AbortSignal) => Promise<T>,
    params: Record<string, any> = {},
    options: {
      skipCache?: boolean;
      skipDeduplication?: boolean;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const requestKey = this.generateRequestKey(table, operation, params);
    
    // Check cache first (unless skipped)
    if (!options.skipCache) {
      const cached = this.getCachedResponse(requestKey);
      if (cached) {
        return cached;
      }
    }

    // Check for existing pending request (unless skipped)
    if (!options.skipDeduplication) {
      const existing = this.pendingRequests.get(requestKey);
      if (existing) {
        logger.performance.api(`🔄 Deduplicating request: ${requestKey}`);
        return existing.promise;
      }
    }

    // Limit concurrent requests
    if (this.pendingRequests.size >= this.MAX_CONCURRENT_REQUESTS) {
      logger.performance.warn(`⚠️ Too many concurrent requests (${this.pendingRequests.size}), waiting...`);
      
      // Wait for some requests to complete
      const oldestRequest = Array.from(this.pendingRequests.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      
      if (oldestRequest) {
        try {
          await oldestRequest.promise;
        } catch {
          // Ignore errors, just wait for completion
        }
      }
    }

    // Create new request
    const controller = new AbortController();
    
    // OPTIMIZED: Longer timeout for profiles table queries
    const isProfileQuery = table === 'profiles' || requestKey.includes('profiles');
    const timeout = isProfileQuery ? 30000 : (options.timeout || 10000); // 30s for profiles, 10s for others

    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.performance.warn(`⏰ Request timeout: ${requestKey}`);
    }, timeout);

    const pendingRequest: PendingRequest = {
      promise: requestFn(controller.signal)
        .then((result) => {
          // Cache successful result
          if (!options.skipCache) {
            this.setCachedResponse(requestKey, result);
          }
          
          logger.performance.api(`✅ Request completed: ${requestKey}`);
          return result;
        })
        .catch((error) => {
          if (error.name === 'AbortError') {
            logger.performance.api(`🚫 Request cancelled: ${requestKey}`);
          } else {
            logger.performance.warn(`❌ Request failed: ${requestKey} - ${error.message}`);
          }
          throw error;
        })
        .finally(() => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(requestKey);
          this.cleanupCache();
        }),
      controller,
      timestamp: Date.now(),
      requestKey
    };

    this.pendingRequests.set(requestKey, pendingRequest);
    logger.performance.api(`🚀 Starting request: ${requestKey}`);

    return pendingRequest.promise;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    logger.performance.api(`🛑 Cancelling ${this.pendingRequests.size} pending requests`);
    
    for (const request of this.pendingRequests.values()) {
      request.controller.abort();
    }
    
    this.pendingRequests.clear();
  }

  /**
   * Cancel requests for a specific table/operation
   */
  cancelRequestsFor(table: string, operation?: string): void {
    const toCancel: string[] = [];
    
    for (const [key, request] of this.pendingRequests.entries()) {
      if (key.startsWith(`${table}:`)) {
        if (!operation || key.startsWith(`${table}:${operation}:`)) {
          request.controller.abort();
          toCancel.push(key);
        }
      }
    }
    
    toCancel.forEach(key => this.pendingRequests.delete(key));
    
    if (toCancel.length > 0) {
      logger.performance.api(`🛑 Cancelled ${toCancel.length} requests for ${table}${operation ? `:${operation}` : ''}`);
    }
  }

  /**
   * Get current request statistics
   */
  getStats(): {
    pendingRequests: number;
    cachedResponses: number;
    oldestRequestAge: number;
  } {
    const now = Date.now();
    const oldestRequest = Array.from(this.pendingRequests.values())
      .reduce((oldest, current) => 
        current.timestamp < oldest ? current.timestamp : oldest, now);

    return {
      pendingRequests: this.pendingRequests.size,
      cachedResponses: this.requestCache.size,
      oldestRequestAge: now - oldestRequest
    };
  }

  /**
   * Clear all caches and cancel all requests
   */
  reset(): void {
    this.cancelAllRequests();
    this.requestCache.clear();
    logger.performance.api('🔄 Request manager reset');
  }
}

// Export singleton instance
export const requestManager = new RequestManager();

// Cleanup on app state changes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    requestManager.cancelAllRequests();
  });
}