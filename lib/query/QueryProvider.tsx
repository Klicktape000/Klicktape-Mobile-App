import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient, cleanupQueryCache, getQueryClientStats } from './queryClient';
import { REDIS_CONFIG } from '../config/redis';
import { performanceOptimizer } from '../utils/performanceOptimizer';

// Load polyfills for React Query compatibility
if (typeof global !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../polyfills');
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  useEffect(() => {
    // Verify polyfills are available
    if (typeof global.EventTarget === 'undefined') {
      // EventTarget polyfill not available in QueryProvider
      return;
    }

    // Initialize performance monitoring
// console.log('🚀 TanStack Query initialized');
// console.log('📊 Redis caching:', REDIS_CONFIG.enabled ? 'Enabled' : 'Disabled');
    
    // Set up periodic cache cleanup (every 30 minutes)
    const cleanupInterval = setInterval(() => {
      cleanupQueryCache();
    }, 30 * 60 * 1000);
    
    // Set up performance monitoring (every 5 minutes)
    const monitoringInterval = setInterval(() => {
      const stats = getQueryClientStats();
// console.log('📊 Query Client Stats:', stats);
      
      // Log performance metrics if enabled
      if (process.env.EXPO_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true') {
        const performanceMetrics = performanceOptimizer.getMetrics();
// console.log('⚡ Performance Metrics:', performanceMetrics);
      }
    }, 5 * 60 * 1000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(cleanupInterval);
      clearInterval(monitoringInterval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {__DEV__ && process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position={"bottom-right" as any}
        />
      )}
    </QueryClientProvider>
  );
};

export default QueryProvider;

