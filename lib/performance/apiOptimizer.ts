/**
 * API Optimizer - Performance utilities for API calls and data fetching
 */

import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// API performance configuration
export const API_CONFIG = {
  // Request batching
  BATCH_DELAY: 50, // ms
  MAX_BATCH_SIZE: 10,
  
  // Caching
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  
  // Debouncing
  SEARCH_DEBOUNCE: 300, // ms
  TYPING_DEBOUNCE: 500, // ms
  
  // Request optimization
  CONCURRENT_REQUESTS: Platform.OS === 'web' ? 6 : 4,
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Request cache implementation
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = API_CONFIG.CACHE_TTL) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= API_CONFIG.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  size() {
    return this.cache.size;
  }
}

// Global request cache instance
export const requestCache = new RequestCache();

// Request batching utility
class RequestBatcher {
  private batches = new Map<string, {
    requests: { resolve: Function; reject: Function; params: any }[];
    timer: ReturnType<typeof setTimeout>;
  }>();
  
  batch<T>(
    batchKey: string,
    params: any,
    batchExecutor: (batchedParams: any[]) => Promise<T[]>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.batches.get(batchKey);
      
      if (!batch) {
        batch = {
          requests: [],
          timer: setTimeout(() => this.executeBatch(batchKey, batchExecutor), API_CONFIG.BATCH_DELAY)
        };
        this.batches.set(batchKey, batch);
      }
      
      batch.requests.push({ resolve, reject, params });
      
      // Execute immediately if batch is full
      if (batch.requests.length >= API_CONFIG.MAX_BATCH_SIZE) {
        clearTimeout(batch.timer);
        this.executeBatch(batchKey, batchExecutor);
      }
    });
  }
  
  private async executeBatch<T>(
    batchKey: string,
    batchExecutor: (batchedParams: any[]) => Promise<T[]>
  ) {
    const batch = this.batches.get(batchKey);
    if (!batch) return;
    
    this.batches.delete(batchKey);
    
    try {
      const params = batch.requests.map(req => req.params);
      const results = await batchExecutor(params);
      
      batch.requests.forEach((req, index) => {
        req.resolve(results[index]);
      });
    } catch (error) {
      batch.requests.forEach(req => {
        req.reject(error);
      });
    }
  }
}

// Global request batcher instance
export const requestBatcher = new RequestBatcher();

// Debounce utility for API calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  let latestResolve: Function;
  let latestReject: Function;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      latestResolve = resolve;
      latestReject = reject;
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          latestResolve(result);
        } catch (error) {
          latestReject(error);
        }
      }, delay);
    });
  };
};

// Request queue for managing concurrent requests
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  
  async add<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++;
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
      
      this.processQueue();
    });
  }
  
  private processQueue() {
    if (this.running >= API_CONFIG.CONCURRENT_REQUESTS || this.queue.length === 0) {
      return;
    }
    
    const request = this.queue.shift();
    if (request) {
      request();
    }
  }
}

// Global request queue instance
export const requestQueue = new RequestQueue();

// Optimized fetch wrapper with caching, retries, and timeout
export const optimizedFetch = async (
  url: string,
  options: RequestInit = {},
  cacheKey?: string,
  cacheTTL?: number
): Promise<Response> => {
  // Check cache first
  if (cacheKey) {
    const cached = requestCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Add timeout to request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  
  const requestOptions: RequestInit = {
    ...options,
    signal: controller.signal
  };
  
  let lastError: Error | null = null;
  
  // Retry logic
  for (let attempt = 0; attempt < API_CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);
      
      // Cache successful responses
      if (response.ok && cacheKey) {
        const data = await response.clone().json();
        requestCache.set(cacheKey, data, cacheTTL);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        break;
      }
      
      // Wait before retry
      if (attempt < API_CONFIG.RETRY_ATTEMPTS - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1))
        );
      }
    }
  }
  
  clearTimeout(timeoutId);
  throw lastError || new Error('Request failed after all retry attempts');
};

// Performance monitoring for API calls
export const apiPerformanceMonitor = {
  trackRequest: (url: string, startTime: number, success: boolean) => {
    const duration = Date.now() - startTime;
    const status = success ? '✅' : '❌';
    logger.performance.api(`${status} API ${url} - ${duration}ms`);
    
    if (duration > 2000) {
      logger.performance.warn(`⚠️ Slow API call: ${url} (${duration}ms)`);
    }
  },
  
  trackCacheHit: (key: string) => {
    logger.performance.api(`💾 Cache hit: ${key}`);
  },
  
  trackCacheMiss: (key: string) => {
    logger.performance.api(`💸 Cache miss: ${key}`);
  }
};

// Initialize API optimizations
export const initializeApiOptimizations = () => {
  logger.performance.api('🚀 API optimizations initialized');
  
  // Log cache statistics periodically
  setInterval(() => {
    logger.performance.api(`📊 Request cache: ${requestCache.size()}/${API_CONFIG.MAX_CACHE_SIZE} entries`);
  }, 60000); // Every minute
};