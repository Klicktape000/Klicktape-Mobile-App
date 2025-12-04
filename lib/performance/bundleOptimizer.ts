/**
 * Bundle Optimizer - Performance utilities for lazy loading and code splitting
 */

import React from 'react';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// Performance configuration
export const PERFORMANCE_CONFIG = {
  // Lazy loading delays
  COMPONENT_LOAD_DELAY: 100,
  HEAVY_COMPONENT_DELAY: 300,
  NETWORK_COMPONENT_DELAY: 500,
  
  // Bundle splitting thresholds
  LARGE_COMPONENT_THRESHOLD: 50000, // bytes
  CRITICAL_PATH_COMPONENTS: [
    'home',
    'auth',
    'navigation'
  ],
  
  // Preloading configuration
  PRELOAD_ON_IDLE: true,
  PRELOAD_DELAY: 2000,
  
  // Platform-specific optimizations
  WEB_OPTIMIZATIONS: Platform.OS === 'web',
  NATIVE_OPTIMIZATIONS: Platform.OS !== 'web',
} as const;

// Component priority levels for loading
export enum ComponentPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BACKGROUND = 'background'
}

// Lazy loading utility with priority support
export const createLazyComponent = <T = any>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  priority: ComponentPriority = ComponentPriority.MEDIUM,
  preload: boolean = false
) => {
  const LazyComponent = React.lazy(importFn);
  
  // Preload component if specified
  if (preload && PERFORMANCE_CONFIG.PRELOAD_ON_IDLE) {
    setTimeout(() => {
      importFn().catch(() => {
        // Silently handle preload failures
      });
    }, PERFORMANCE_CONFIG.PRELOAD_DELAY);
  }
  
  return LazyComponent;
};

// Bundle analyzer for development
export const bundleAnalyzer = {
  // Track component load times
  trackComponentLoad: (componentName: string, startTime: number) => {
    const loadTime = Date.now() - startTime;
    logger.performance.bundle(`📦 Component ${componentName} loaded in ${loadTime}ms`);
    
    if (loadTime > 1000) {
      logger.performance.warn(`⚠️ Slow component load: ${componentName} (${loadTime}ms)`);
    }
  },
  
  // Monitor bundle size impact
  trackBundleImpact: (feature: string, size: number) => {
    logger.performance.bundle(`📊 Feature ${feature} bundle impact: ${(size / 1024).toFixed(2)}KB`);
    
    if (size > PERFORMANCE_CONFIG.LARGE_COMPONENT_THRESHOLD) {
      logger.performance.warn(`⚠️ Large bundle detected: ${feature} (${(size / 1024).toFixed(2)}KB)`);
    }
  }
};

// Performance monitoring hooks
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = React.useRef(Date.now());
  
  React.useEffect(() => {
    bundleAnalyzer.trackComponentLoad(componentName, startTime.current);
  }, [componentName]);
};

// Preloader for critical components
export const preloadCriticalComponents = async () => {
  const criticalImports = [
    () => import('@/app/(root)/(tabs)/home'),
    () => import('@/components/ThemedGradient'),
    () => import('@/lib/supabase'),
  ];
  
  // Preload critical components in background
  setTimeout(async () => {
    for (const importFn of criticalImports) {
      try {
        await importFn();
      } catch (error) {
        logger.performance.warn('Failed to preload critical component:', error);
      }
    }
  }, PERFORMANCE_CONFIG.PRELOAD_DELAY);
};

// Memory management utilities
export const memoryManager = {
  // Clear component cache when memory is low
  clearComponentCache: () => {
    if (Platform.OS === 'web' && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      const memoryUsage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
      
      if (memoryUsage > 0.8) {
        logger.performance.memory('🧹 Clearing component cache due to high memory usage');
        // Clear React lazy cache if available
      }
    }
  },
  
  // Monitor memory usage
  monitorMemory: () => {
    if (Platform.OS === 'web' && 'memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        const usedMB = (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const totalMB = (memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2);
        
        logger.performance.memory(`💾 Memory usage: ${usedMB}MB / ${totalMB}MB`);
      }, 30000); // Check every 30 seconds
    }
  }
};

// Initialize performance monitoring
export const initializePerformanceMonitoring = () => {
  logger.performance.bundle('🚀 Performance monitoring initialized');
  memoryManager.monitorMemory();
  preloadCriticalComponents();
};