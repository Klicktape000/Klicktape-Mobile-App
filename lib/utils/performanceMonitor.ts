/**
 * Performance Monitor for API Request Optimization
 * Tracks and reports on API usage to help reduce costs
 */

interface RequestMetric {
  endpoint: string;
  method: string;
  timestamp: number;
  responseTime: number;
  cached: boolean;
  error?: string;
  retryCount?: number;
}

interface NetworkMetric {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  error?: string;
  retryCount?: number;
}

interface CacheMetric {
  operation: 'get' | 'set' | 'del' | 'batch';
  key: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  hit?: boolean;
  error?: string;
  retryCount?: number;
}

interface PerformanceStats {
  totalRequests: number;
  cachedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  requestsByEndpoint: Record<string, number>;
  cacheHitRate: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: RequestMetric[] = [];
  private networkMetrics: NetworkMetric[] = [];
  private cacheMetrics: CacheMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 requests
  private readonly REPORT_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    // Set up periodic reporting
    setInterval(() => {
      this.generateReport();
    }, this.REPORT_INTERVAL);
  }

  /**
   * Track an API request
   */
  trackRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    cached: boolean = false,
    error?: string,
    retryCount?: number
  ): void {
    const metric: RequestMetric = {
      endpoint,
      method,
      timestamp: Date.now(),
      responseTime,
      cached,
      error,
      retryCount
    };

    this.metrics.push(metric);

    // Keep only the last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /**
   * Track a network request
   */
  trackNetworkRequest(
    url: string,
    method: string,
    startTime: number,
    endTime?: number,
    status?: number,
    error?: string,
    retryCount?: number
  ): void {
    const metric: NetworkMetric = {
      url,
      method,
      startTime,
      endTime,
      duration: endTime ? endTime - startTime : undefined,
      status,
      error,
      retryCount
    };

    this.networkMetrics.push(metric);

    // Keep only the last MAX_METRICS
    if (this.networkMetrics.length > this.MAX_METRICS) {
      this.networkMetrics.shift();
    }
  }

  /**
   * Track a cache operation
   */
  trackCacheOperation(
    operation: 'get' | 'set' | 'del' | 'batch',
    key: string,
    startTime: number,
    endTime?: number,
    hit?: boolean,
    error?: string,
    retryCount?: number
  ): void {
    const metric: CacheMetric = {
      operation,
      key,
      startTime,
      endTime,
      duration: endTime ? endTime - startTime : undefined,
      hit,
      error,
      retryCount
    };

    this.cacheMetrics.push(metric);

    // Keep only the last MAX_METRICS
    if (this.cacheMetrics.length > this.MAX_METRICS) {
      this.cacheMetrics.shift();
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats(timeWindow: number = 60 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.networkMetrics.filter(m => m.startTime > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        averageRetryCount: 0,
      };
    }

    const totalRequests = recentMetrics.length;
    const errorRequests = recentMetrics.filter(m => m.error).length;
    const completedRequests = recentMetrics.filter(m => m.duration !== undefined);
    const totalResponseTime = completedRequests.reduce((sum, m) => sum + (m.duration || 0), 0);
    const totalRetries = recentMetrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);

    return {
      totalRequests,
      averageResponseTime: completedRequests.length > 0 ? totalResponseTime / completedRequests.length : 0,
      errorRate: errorRequests / totalRequests,
      averageRetryCount: totalRetries / totalRequests,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(timeWindow: number = 60 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.cacheMetrics.filter(m => m.startTime > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalOperations: 0,
        hitRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };
    }

    const totalOperations = recentMetrics.length;
    const hits = recentMetrics.filter(m => m.hit === true).length;
    const errorOperations = recentMetrics.filter(m => m.error).length;
    const completedOperations = recentMetrics.filter(m => m.duration !== undefined);
    const totalResponseTime = completedOperations.reduce((sum, m) => sum + (m.duration || 0), 0);

    return {
      totalOperations,
      hitRate: hits / totalOperations,
      averageResponseTime: completedOperations.length > 0 ? totalResponseTime / completedOperations.length : 0,
      errorRate: errorOperations / totalOperations,
    };
  }

  /**
   * Generate performance statistics
   */
  getStats(timeWindow: number = 60 * 60 * 1000): PerformanceStats {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        cachedRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsByEndpoint: {},
        cacheHitRate: 0,
      };
    }

    const totalRequests = recentMetrics.length;
    const cachedRequests = recentMetrics.filter(m => m.cached).length;
    const errorRequests = recentMetrics.filter(m => m.error).length;
    const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);

    const requestsByEndpoint: Record<string, number> = {};
    recentMetrics.forEach(m => {
      requestsByEndpoint[m.endpoint] = (requestsByEndpoint[m.endpoint] || 0) + 1;
    });

    return {
      totalRequests,
      cachedRequests,
      averageResponseTime: totalResponseTime / totalRequests,
      errorRate: errorRequests / totalRequests,
      requestsByEndpoint,
      cacheHitRate: cachedRequests / totalRequests,
    };
  }

  /**
   * Generate and log performance report
   */
  generateReport(): void {
    const stats = this.getStats();
    const networkStats = this.getNetworkStats();
    const cacheStats = this.getCacheStats();
    
    if (stats.totalRequests === 0 && networkStats.totalRequests === 0 && cacheStats.totalOperations === 0) {
      return;
    }

// console.log('📊 Performance Report:');
    
    // API Request Stats
    if (stats.totalRequests > 0) {
// console.log(`🔄 API Requests: ${stats.totalRequests}`);
// console.log(`⚡ Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
// console.log(`⏱️  Avg Response Time: ${stats.averageResponseTime.toFixed(0)}ms`);
// console.log(`❌ Error Rate: ${(stats.errorRate * 100).toFixed(1)}%`);
    }

    // Network Stats
    if (networkStats.totalRequests > 0) {
// console.log(`🌐 Network Requests: ${networkStats.totalRequests}`);
// console.log(`⏱️  Avg Network Time: ${networkStats.averageResponseTime.toFixed(0)}ms`);
// console.log(`❌ Network Error Rate: ${(networkStats.errorRate * 100).toFixed(1)}%`);
// console.log(`🔄 Avg Retry Count: ${networkStats.averageRetryCount.toFixed(1)}`);
    }

    // Cache Stats
    if (cacheStats.totalOperations > 0) {
// console.log(`💾 Cache Operations: ${cacheStats.totalOperations}`);
// console.log(`⚡ Cache Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
// console.log(`⏱️  Avg Cache Time: ${cacheStats.averageResponseTime.toFixed(0)}ms`);
// console.log(`❌ Cache Error Rate: ${(cacheStats.errorRate * 100).toFixed(1)}%`);
    }

    // Optimization suggestions
    const suggestions = this.getOptimizationSuggestions();
    if (suggestions.length > 0) {
      // Optimization suggestions available
      // suggestions.forEach(suggestion => { /* log suggestion */ });
    }
  }

  /**
   * Check if an endpoint should typically be cached
   */
  private shouldBeCached(endpoint: string): boolean {
    const cacheableEndpoints = [
      'profiles',
      'posts',
      'reels',
      'stories',
      'notifications',
      'comments',
    ];

    return cacheableEndpoints.some(cacheable => endpoint.includes(cacheable));
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const stats = this.getStats();
    const suggestions: string[] = [];

    if (stats.cacheHitRate < 0.3) {
      suggestions.push('Increase cache times for frequently accessed data');
    }

    if (stats.averageResponseTime > 1500) {
      suggestions.push('Optimize database queries and add indexes');
    }

    if (stats.errorRate > 0.05) {
      suggestions.push('Investigate and fix API errors');
    }

    // Check for endpoints with high request counts
    const highVolumeEndpoints = Object.entries(stats.requestsByEndpoint)
      .filter(([, count]) => count > stats.totalRequests * 0.2);

    if (highVolumeEndpoints.length > 0) {
      suggestions.push(`Consider batching requests for: ${highVolumeEndpoints.map(([endpoint]) => endpoint).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.networkMetrics = [];
    this.cacheMetrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Convenience function to track Supabase requests
export const trackSupabaseRequest = (
  table: string,
  operation: string,
  startTime: number,
  cached: boolean = false,
  error?: string
) => {
  const responseTime = Date.now() - startTime;
  const endpoint = `${table}:${operation}`;
  
  performanceMonitor.trackRequest(
    endpoint,
    'POST', // Most Supabase operations are POST
    responseTime,
    cached,
    error
  );
};

// Convenience function to track network requests
export const trackNetworkRequest = (
  url: string,
  method: string,
  startTime: number,
  endTime?: number,
  status?: number,
  error?: string,
  retryCount?: number
) => {
  performanceMonitor.trackNetworkRequest(url, method, startTime, endTime, status, error, retryCount);
};

// Convenience function to track cache operations
export const trackCacheOperation = (
  operation: 'get' | 'set' | 'del' | 'batch',
  key: string,
  startTime: number,
  endTime?: number,
  hit?: boolean,
  error?: string,
  retryCount?: number
) => {
  performanceMonitor.trackCacheOperation(operation, key, startTime, endTime, hit, error, retryCount);
};

