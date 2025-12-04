/**
 * Fallback Cache Implementation for when Redis is unavailable
 * Uses AsyncStorage as a backup caching mechanism
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface FallbackCacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class FallbackCache {
  private static readonly CACHE_PREFIX = 'fallback_cache_';
  private static readonly METADATA_KEY = 'fallback_cache_metadata';
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit for AsyncStorage
  
  /**
   * Get item from fallback cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cachedItem = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedItem) {
        return null;
      }
      
      const parsed: FallbackCacheItem<T> = JSON.parse(cachedItem);
      
      // Check if item has expired
      const now = Date.now();
      if (now - parsed.timestamp > parsed.ttl) {
        // Item expired, remove it
        await this.delete(key);
        return null;
      }

// console.log(`📱 Fallback cache HIT: ${key}`);
      return parsed.data;
    } catch (__error) {
      // Error: Fallback cache get error
      return null;
    }
  }
  
  /**
   * Set item in fallback cache
   */
  static async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const ttlMs = ttlSeconds * 1000;
      
      const cacheItem: FallbackCacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };
      
      const serialized = JSON.stringify(cacheItem);
      
      // Check size before storing
      if (serialized.length > 1024 * 1024) { // 1MB per item limit
        // Warning: Fallback cache item too large
        return false;
      }
      
      // Ensure we have space
      await this.ensureSpace(serialized.length);
      
      await AsyncStorage.setItem(cacheKey, serialized);
      await this.updateMetadata(key, serialized.length);

// console.log(`💾 Fallback cache SET: ${key} (${(serialized.length / 1024).toFixed(1)}KB)`);
      return true;
    } catch (__error) {
      // Error: Fallback cache set error
      return false;
    }
  }
  
  /**
   * Delete item from fallback cache
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);
      await this.removeFromMetadata(key);
      return true;
    } catch (__error) {
      // Error: Fallback cache delete error
      return false;
    }
  }
  
  /**
   * Clear all fallback cache
   */
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      
      await AsyncStorage.removeItem(this.METADATA_KEY);
// console.log(`🗑️ Fallback cache cleared (${cacheKeys.length} items)`);
    } catch (__error) {
      // Error: Fallback cache clear error
    }
  }
  
  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    itemCount: number;
    totalSize: number;
    oldestItem: number;
    newestItem: number;
  }> {
    try {
      const metadata = await this.getMetadata();
      const items = Object.values(metadata);
      
      if (items.length === 0) {
        return { itemCount: 0, totalSize: 0, oldestItem: 0, newestItem: 0 };
      }
      
      const totalSize = items.reduce((sum, item) => sum + item.size, 0);
      const timestamps = items.map(item => item.timestamp);
      
      return {
        itemCount: items.length,
        totalSize,
        oldestItem: Math.min(...timestamps),
        newestItem: Math.max(...timestamps),
      };
    } catch (__error) {
      // Error: Fallback cache stats error
      return { itemCount: 0, totalSize: 0, oldestItem: 0, newestItem: 0 };
    }
  }
  
  /**
   * Cleanup expired items
   */
  static async cleanup(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      const now = Date.now();
      
      for (const cacheKey of cacheKeys) {
        try {
          const cachedItem = await AsyncStorage.getItem(cacheKey);
          if (cachedItem) {
            const parsed: FallbackCacheItem<any> = JSON.parse(cachedItem);
            if (now - parsed.timestamp > parsed.ttl) {
              const originalKey = cacheKey.replace(this.CACHE_PREFIX, '');
              await this.delete(originalKey);
            }
          }
        } catch (__itemError) {
          // Remove corrupted items
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (__error) {
      // Error: Fallback cache cleanup error
    }
  }
  
  // Private helper methods
  
  private static async getMetadata(): Promise<Record<string, { size: number; timestamp: number }>> {
    try {
      const metadata = await AsyncStorage.getItem(this.METADATA_KEY);
      return metadata ? JSON.parse(metadata) : {};
    } catch (__error) {
      return {};
    }
  }
  
  private static async updateMetadata(key: string, size: number): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      metadata[key] = { size, timestamp: Date.now() };
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (__error) {
      // Ignore metadata errors
    }
  }
  
  private static async removeFromMetadata(key: string): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      delete metadata[key];
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (__error) {
      // Ignore metadata errors
    }
  }
  
  private static async ensureSpace(requiredSize: number): Promise<void> {
    try {
      const stats = await this.getStats();
      
      if (stats.totalSize + requiredSize > this.MAX_CACHE_SIZE) {
        // Remove oldest items until we have enough space
        const metadata = await this.getMetadata();
        const items = Object.entries(metadata).sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        let freedSpace = 0;
        for (const [key] of items) {
          if (freedSpace >= requiredSize) break;
          
          const itemSize = metadata[key]?.size || 0;
          await this.delete(key);
          freedSpace += itemSize;
        }
      }
    } catch (__error) {
      // Error: Fallback cache space management error
    }
  }
}

export default FallbackCache;
