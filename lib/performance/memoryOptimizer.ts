import { Platform } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

// Memory optimization configuration
export const MEMORY_CONFIG = {
  // Memory thresholds (in MB)
  thresholds: {
    warning: Platform.OS === 'web' ? 100 : 50,    // Warn at 100MB (web) / 50MB (mobile)
    critical: Platform.OS === 'web' ? 200 : 100,  // Critical at 200MB (web) / 100MB (mobile)
    cleanup: Platform.OS === 'web' ? 150 : 75,    // Cleanup at 150MB (web) / 75MB (mobile)
  },
  
  // Cache limits
  cacheLimits: {
    images: 50,        // Max 50 cached images
    videos: 10,        // Max 10 cached videos
    queries: 100,      // Max 100 cached queries
    components: 20,    // Max 20 cached components
  },
  
  // Cleanup intervals (in ms)
  intervals: {
    memoryCheck: 30000,    // Check memory every 30 seconds
    cacheCleanup: 300000,  // Cleanup cache every 5 minutes
    garbageCollection: 60000, // Force GC every minute (if available)
  },
} as const;

// Memory usage tracker
class MemoryTracker {
  private memoryUsage: number[] = [];
  private listeners: Set<(usage: MemoryUsage) => void> = new Set();
  private isMonitoring = false;

  public startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.performance.memory('Starting memory monitoring...');

    // Start periodic memory checks
    setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY_CONFIG.intervals.memoryCheck);

    // Initial check
    this.checkMemoryUsage();
  }

  public stopMonitoring() {
    this.isMonitoring = false;
    logger.performance.memory('Stopped memory monitoring');
  }

  private async checkMemoryUsage() {
    try {
      const usage = await this.getCurrentMemoryUsage();
      
      // Store usage history (keep last 20 measurements)
      this.memoryUsage.push(usage.used);
      if (this.memoryUsage.length > 20) {
        this.memoryUsage.shift();
      }

      // Check thresholds and trigger actions
      this.handleMemoryThresholds(usage);

      // Notify listeners
      this.listeners.forEach(listener => listener(usage));
    } catch (error) {
      logger.performance.warn('Failed to check memory usage:', error);
    }
  }

  private async getCurrentMemoryUsage(): Promise<MemoryUsage> {
    if (Platform.OS === 'web' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // Convert to MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }

    // For React Native, we'll estimate based on app state
    // This is a rough estimation since RN doesn't expose memory APIs
    return {
      used: this.estimateMemoryUsage(),
      total: Platform.OS === 'ios' ? 512 : 256, // Rough estimates
      limit: Platform.OS === 'ios' ? 1024 : 512,
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation based on various factors
    // This is not accurate but gives us a baseline
    const baseUsage = 20; // Base app usage
    const cacheUsage = this.estimateCacheUsage();
    return baseUsage + cacheUsage;
  }

  private estimateCacheUsage(): number {
    // Estimate cache usage (very rough)
    return 10; // Placeholder - in real app, this would be more sophisticated
  }

  private handleMemoryThresholds(usage: MemoryUsage) {
    const { warning, critical, cleanup } = MEMORY_CONFIG.thresholds;

    if (usage.used >= critical) {
      logger.performance.warn('Critical memory usage detected:', usage.used, 'MB');
      this.triggerAggressiveCleanup();
    } else if (usage.used >= cleanup) {
      logger.performance.warn('High memory usage, triggering cleanup:', usage.used, 'MB');
      this.triggerMemoryCleanup();
    } else if (usage.used >= warning) {
      logger.performance.memory('Memory usage warning:', usage.used, 'MB');
    }
  }

  private triggerMemoryCleanup() {
    // Trigger various cleanup mechanisms
    memoryManager.cleanupCaches();
    this.forceGarbageCollection();
  }

  private triggerAggressiveCleanup() {
    // More aggressive cleanup
    memoryManager.aggressiveCleanup();
    this.forceGarbageCollection();
    
    // Clear some non-essential caches
    if (Platform.OS === 'web') {
      // Clear browser caches if possible
      try {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              if (name.includes('images') || name.includes('temp')) {
                caches.delete(name);
              }
            });
          });
        }
      } catch (error) {
        logger.performance.warn('Failed to clear browser caches:', error);
      }
    }
  }

  private forceGarbageCollection() {
     // Force garbage collection if available
     if (Platform.OS === 'web' && 'gc' in window) {
       try {
         (window as any).gc();
         logger.performance.memory('Forced garbage collection');
       } catch (error) {
         // GC not available or failed
       }
     }
   }

  public subscribe(listener: (usage: MemoryUsage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memoryUsage.length < 5) return 'stable';

    const recent = this.memoryUsage.slice(-5);
    const older = this.memoryUsage.slice(-10, -5);
    
    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const diff = recentAvg - olderAvg;
    
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }
}

// Memory manager for caches and cleanup
class MemoryManager {
  private imageCacheSize = 0;
  private videoCacheSize = 0;
  private queryCacheSize = 0;
  private componentCacheSize = 0;

  public cleanupCaches() {
    logger.performance.memory('Starting memory cleanup...');

    // Cleanup image cache
    this.cleanupImageCache();
    
    // Cleanup video cache
    this.cleanupVideoCache();
    
    // Cleanup query cache
    this.cleanupQueryCache();
    
    // Cleanup component cache
    this.cleanupComponentCache();

    logger.performance.memory('Memory cleanup completed');
  }

  public aggressiveCleanup() {
    logger.performance.memory('Starting aggressive memory cleanup...');

    // More aggressive cleanup - clear more caches
    this.clearImageCache();
    this.clearVideoCache();
    this.clearNonEssentialQueryCache();
    this.clearComponentCache();

    logger.performance.memory('Aggressive memory cleanup completed');
  }

  private cleanupImageCache() {
    // Cleanup old/unused images from cache
    if (this.imageCacheSize > MEMORY_CONFIG.cacheLimits.images) {
      logger.performance.memory('Cleaning up image cache...');
      // Implementation would depend on your image caching solution
      this.imageCacheSize = Math.floor(this.imageCacheSize * 0.7); // Simulate cleanup
    }
  }

  private cleanupVideoCache() {
    // Cleanup old/unused videos from cache
    if (this.videoCacheSize > MEMORY_CONFIG.cacheLimits.videos) {
      logger.performance.memory('Cleaning up video cache...');
      this.videoCacheSize = Math.floor(this.videoCacheSize * 0.5); // Simulate cleanup
    }
  }

  private cleanupQueryCache() {
    // Cleanup old query results
    if (this.queryCacheSize > MEMORY_CONFIG.cacheLimits.queries) {
      logger.performance.memory('Cleaning up query cache...');
      this.queryCacheSize = Math.floor(this.queryCacheSize * 0.8); // Simulate cleanup
    }
  }

  private cleanupComponentCache() {
    // Cleanup cached components
    if (this.componentCacheSize > MEMORY_CONFIG.cacheLimits.components) {
      logger.performance.memory('Cleaning up component cache...');
      this.componentCacheSize = Math.floor(this.componentCacheSize * 0.6); // Simulate cleanup
    }
  }

  private clearImageCache() {
    logger.performance.memory('Clearing image cache...');
    this.imageCacheSize = 0;
  }

  private clearVideoCache() {
    logger.performance.memory('Clearing video cache...');
    this.videoCacheSize = 0;
  }

  private clearNonEssentialQueryCache() {
    logger.performance.memory('Clearing non-essential query cache...');
    this.queryCacheSize = Math.floor(this.queryCacheSize * 0.3); // Keep only essential
  }

  private clearComponentCache() {
    logger.performance.memory('Clearing component cache...');
    this.componentCacheSize = 0;
  }

  // Methods to track cache usage
  public trackImageCache(size: number) {
    this.imageCacheSize = size;
  }

  public trackVideoCache(size: number) {
    this.videoCacheSize = size;
  }

  public trackQueryCache(size: number) {
    this.queryCacheSize = size;
  }

  public trackComponentCache(size: number) {
    this.componentCacheSize = size;
  }

  public getCacheStats() {
    return {
      images: this.imageCacheSize,
      videos: this.videoCacheSize,
      queries: this.queryCacheSize,
      components: this.componentCacheSize,
      total: this.imageCacheSize + this.videoCacheSize + this.queryCacheSize + this.componentCacheSize,
    };
  }
}

// Memory leak detector
class MemoryLeakDetector {
  private objectCounts: Map<string, number> = new Map();
  private listeners: Set<() => void> = new Set();

  public startDetection() {
    logger.performance.memory('Starting memory leak detection...');

    // Check for memory leaks every 2 minutes
    setInterval(() => {
      this.detectLeaks();
    }, 120000);
  }

  private detectLeaks() {
    // This is a simplified leak detection
    // In a real implementation, you'd track specific object types
    
    const currentCounts = this.getCurrentObjectCounts();
    
    for (const [type, count] of currentCounts) {
      const previousCount = this.objectCounts.get(type) || 0;
      const growth = count - previousCount;
      
      // If objects of this type are growing consistently, it might be a leak
      if (growth > 100) { // Threshold for potential leak
        logger.performance.warn(`Potential memory leak detected: ${type} objects increased by ${growth}`);
        this.notifyListeners();
      }
      
      this.objectCounts.set(type, count);
    }
  }

  private getCurrentObjectCounts(): Map<string, number> {
    // This would be implemented based on your app's specific objects
    // For now, return mock data
    return new Map([
      ['components', Math.floor(Math.random() * 100)],
      ['listeners', Math.floor(Math.random() * 50)],
      ['timers', Math.floor(Math.random() * 20)],
    ]);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Types
export interface MemoryUsage {
  used: number;    // MB
  total: number;   // MB
  limit: number;   // MB
}

export interface MemoryStats {
  usage: MemoryUsage;
  trend: 'increasing' | 'stable' | 'decreasing';
  caches: ReturnType<MemoryManager['getCacheStats']>;
}

// Global instances
export const memoryTracker = new MemoryTracker();
export const memoryManager = new MemoryManager();
export const memoryLeakDetector = new MemoryLeakDetector();

// React hook for memory monitoring
export const useMemoryMonitor = () => {
  const [memoryUsage, setMemoryUsage] = React.useState<MemoryUsage>({
    used: 0,
    total: 0,
    limit: 0,
  });
  const [memoryTrend, setMemoryTrend] = React.useState<'increasing' | 'stable' | 'decreasing'>('stable');

  React.useEffect(() => {
    const unsubscribe = memoryTracker.subscribe((usage) => {
      setMemoryUsage(usage);
      setMemoryTrend(memoryTracker.getMemoryTrend());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    usage: memoryUsage,
    trend: memoryTrend,
    stats: memoryManager.getCacheStats(),
    isHighUsage: memoryUsage.used > MEMORY_CONFIG.thresholds.warning,
    isCriticalUsage: memoryUsage.used > MEMORY_CONFIG.thresholds.critical,
  };
};

// Utility functions
export const getMemoryStats = (): MemoryStats => {
  return {
    usage: { used: 0, total: 0, limit: 0 }, // Would be populated by actual usage
    trend: memoryTracker.getMemoryTrend(),
    caches: memoryManager.getCacheStats(),
  };
};

export const forceMemoryCleanup = () => {
  memoryManager.cleanupCaches();
};

export const forceAggressiveCleanup = () => {
  memoryManager.aggressiveCleanup();
};

// Initialize memory optimization
export const initializeMemoryOptimization = () => {
  logger.performance.memory('Initializing memory optimization...');
  
  // Start memory tracking
  memoryTracker.startMonitoring();
  
  // Start leak detection
  memoryLeakDetector.startDetection();
  
  // Set up periodic cleanup
  setInterval(() => {
    memoryManager.cleanupCaches();
  }, MEMORY_CONFIG.intervals.cacheCleanup);
  
  logger.performance.memory('Memory optimization initialized');
};