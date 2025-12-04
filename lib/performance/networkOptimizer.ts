import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import NetInfo from '@react-native-community/netinfo';

// Network optimization configuration
export const NETWORK_CONFIG = {
  // Connection quality thresholds
  connectionQuality: {
    excellent: { minSpeed: 10000, maxLatency: 50 },   // 10 Mbps, <50ms
    good: { minSpeed: 5000, maxLatency: 100 },        // 5 Mbps, <100ms
    fair: { minSpeed: 1000, maxLatency: 300 },        // 1 Mbps, <300ms
    poor: { minSpeed: 0, maxLatency: 1000 },          // <1 Mbps, <1s
  },
  
  // Adaptive loading strategies
  adaptiveLoading: {
    excellent: {
      imageQuality: 100,
      videoQuality: 'high',
      prefetchDistance: 10,
      batchSize: 20,
      enablePreloading: true,
    },
    good: {
      imageQuality: 85,
      videoQuality: 'medium',
      prefetchDistance: 5,
      batchSize: 15,
      enablePreloading: true,
    },
    fair: {
      imageQuality: 70,
      videoQuality: 'low',
      prefetchDistance: 3,
      batchSize: 10,
      enablePreloading: false,
    },
    poor: {
      imageQuality: 50,
      videoQuality: 'lowest',
      prefetchDistance: 1,
      batchSize: 5,
      enablePreloading: false,
    },
  },
  
  // Request timeouts based on connection
  timeouts: {
    excellent: { request: 5000, upload: 30000 },
    good: { request: 8000, upload: 45000 },
    fair: { request: 12000, upload: 60000 },
    poor: { request: 20000, upload: 120000 },
  },
} as const;

export type ConnectionQuality = keyof typeof NETWORK_CONFIG.connectionQuality;
export type AdaptiveSettings = typeof NETWORK_CONFIG.adaptiveLoading[ConnectionQuality];

// Network state manager
class NetworkStateManager {
  private currentQuality: ConnectionQuality = 'good';
  private listeners: Set<(quality: ConnectionQuality) => void> = new Set();
  private connectionInfo: any = null;
  private speedTestResults: number[] = [];
  private latencyResults: number[] = [];

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private async initializeNetworkMonitoring() {
    try {
      // Initial network state
      const state = await NetInfo.fetch();
      this.updateConnectionInfo(state);

      // Subscribe to network changes
      NetInfo.addEventListener(this.updateConnectionInfo.bind(this));

      // Periodic speed tests
      this.startPeriodicSpeedTests();
    } catch (error) {
      logger.performance.warn('Failed to initialize network monitoring:', error);
    }
  }

  private updateConnectionInfo(state: any) {
    this.connectionInfo = state;
    
    if (!state.isConnected) {
      this.setQuality('poor');
      return;
    }

    // Determine quality based on connection type and details
    const quality = this.determineConnectionQuality(state);
    this.setQuality(quality);
  }

  private determineConnectionQuality(state: any): ConnectionQuality {
    // For cellular connections
    if (state.type === 'cellular') {
      const generation = state.details?.cellularGeneration;
      switch (generation) {
        case '5g': return 'excellent';
        case '4g': return 'good';
        case '3g': return 'fair';
        default: return 'poor';
      }
    }

    // For WiFi connections
    if (state.type === 'wifi') {
      const strength = state.details?.strength;
      if (strength >= 80) return 'excellent';
      if (strength >= 60) return 'good';
      if (strength >= 40) return 'fair';
      return 'poor';
    }

    // For ethernet (web)
    if (state.type === 'ethernet' || Platform.OS === 'web') {
      // Use speed test results if available
      if (this.speedTestResults.length > 0) {
        const avgSpeed = this.speedTestResults.reduce((a, b) => a + b, 0) / this.speedTestResults.length;
        const avgLatency = this.latencyResults.length > 0 
          ? this.latencyResults.reduce((a, b) => a + b, 0) / this.latencyResults.length 
          : 100;

        for (const [quality, thresholds] of Object.entries(NETWORK_CONFIG.connectionQuality)) {
          if (avgSpeed >= thresholds.minSpeed && avgLatency <= thresholds.maxLatency) {
            return quality as ConnectionQuality;
          }
        }
      }
      return 'good'; // Default for ethernet
    }

    return 'fair'; // Default fallback
  }

  private async startPeriodicSpeedTests() {
    // Run speed test every 5 minutes
    setInterval(() => {
      this.performSpeedTest();
    }, 5 * 60 * 1000);

    // Initial speed test
    setTimeout(() => this.performSpeedTest(), 2000);
  }

  private async performSpeedTest() {
    try {
      const startTime = Date.now();
      
      // Small speed test - download a small image
      const testUrl = 'https://httpbin.org/bytes/1024'; // 1KB test
      const response = await fetch(testUrl, {
        method: 'GET',
        cache: 'no-cache',
      });

      if (response.ok) {
        const endTime = Date.now();
        const latency = endTime - startTime;
        const bytes = 1024;
        const speed = (bytes * 8) / (latency / 1000); // bits per second

        logger.performance.network('Connection speed measured:', speed, 'bits/s, latency:', latency, 'ms');

        // Store results (keep last 5 measurements)
        this.speedTestResults.push(speed);
        this.latencyResults.push(latency);
        
        if (this.speedTestResults.length > 5) {
          this.speedTestResults.shift();
          this.latencyResults.shift();
        }

        // Update quality based on new measurements
        const quality = this.determineConnectionQuality(this.connectionInfo);
        this.setQuality(quality);
      }
    } catch (error) {
      logger.performance.warn('Speed test failed:', error);
    }
  }

  private setQuality(quality: ConnectionQuality) {
    if (this.currentQuality !== quality) {
      const previousQuality = this.currentQuality;
      this.currentQuality = quality;
      logger.performance.network('Network quality changed:', previousQuality, '->', quality);
      
      // Notify listeners
      this.listeners.forEach(listener => listener(quality));
    }
  }

  public getCurrentQuality(): ConnectionQuality {
    return this.currentQuality;
  }

  public getAdaptiveSettings(): AdaptiveSettings {
    return NETWORK_CONFIG.adaptiveLoading[this.currentQuality];
  }

  public getTimeouts() {
    return NETWORK_CONFIG.timeouts[this.currentQuality];
  }

  public subscribe(listener: (quality: ConnectionQuality) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public isOnline(): boolean {
    return this.connectionInfo?.isConnected ?? true;
  }

  public getConnectionType(): string {
    return this.connectionInfo?.type ?? 'unknown';
  }
}

// Adaptive request manager
class AdaptiveRequestManager {
  private requestQueue: Map<string, Promise<any>> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(private networkManager: NetworkStateManager) {}

  public async adaptiveRequest<T>(
    url: string,
    options: RequestInit = {},
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    const quality = this.networkManager.getCurrentQuality();
    const timeouts = this.networkManager.getTimeouts();
    const requestId = `${url}-${JSON.stringify(options)}`;

    logger.performance.network(`Making adaptive request to ${url} with ${quality} connection (priority: ${priority})`);

    // Check if request is already in progress
    if (this.requestQueue.has(requestId)) {
      return this.requestQueue.get(requestId);
    }

    // Create adaptive request
    const requestPromise = this.executeAdaptiveRequest<T>(
      url,
      options,
      timeouts,
      quality,
      priority
    );

    // Store in queue
    this.requestQueue.set(requestId, requestPromise);

    try {
      const result = await requestPromise;
      this.requestQueue.delete(requestId);
      this.retryAttempts.delete(requestId);
      logger.performance.network(`Request successful for ${url}`);
      return result;
    } catch (error) {
      this.requestQueue.delete(requestId);
      
      // Retry logic based on network quality
      const maxRetries = quality === 'poor' ? 3 : quality === 'fair' ? 2 : 1;
      const currentAttempts = this.retryAttempts.get(requestId) || 0;
      
      if (currentAttempts < maxRetries) {
        this.retryAttempts.set(requestId, currentAttempts + 1);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, currentAttempts), 10000);
        logger.performance.network(`Request attempt ${currentAttempts + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.adaptiveRequest<T>(url, options, priority);
      }
      
      this.retryAttempts.delete(requestId);
      logger.performance.warn(`All retry attempts failed for ${url}:`, error);
      throw error;
    }
  }

  private async executeAdaptiveRequest<T>(
    url: string,
    options: RequestInit,
    timeouts: typeof NETWORK_CONFIG.timeouts[ConnectionQuality],
    quality: ConnectionQuality,
    priority: 'high' | 'medium' | 'low'
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeouts.request);

    try {
      // Adjust request based on quality and priority
      const adaptedOptions: RequestInit = {
        ...options,
        signal: controller.signal,
        // Add compression for poor connections
        headers: {
          ...options.headers,
          ...(quality === 'poor' && { 'Accept-Encoding': 'gzip, deflate, br' }),
        },
      };

      const response = await fetch(url, adaptedOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Image optimization based on network
export class NetworkAwareImageOptimizer {
  constructor(private networkManager: NetworkStateManager) {}

  public getOptimizedImageUrl(
    baseUrl: string,
    width: number,
    height: number
  ): string {
    const settings = this.networkManager.getAdaptiveSettings();
    const quality = settings.imageQuality;
    const connectionQuality = this.networkManager.getCurrentQuality();

    logger.performance.network(`Optimizing image for ${connectionQuality} connection: quality=${quality}, size=${width}x${height}`);

    // Add quality and size parameters
    const url = new URL(baseUrl);
    url.searchParams.set('w', width.toString());
    url.searchParams.set('h', height.toString());
    url.searchParams.set('q', quality.toString());
    
    // Use WebP for better compression on poor connections
    if (connectionQuality === 'poor') {
      url.searchParams.set('f', 'webp');
    }

    return url.toString();
  }

  public shouldPreloadImage(): boolean {
    const settings = this.networkManager.getAdaptiveSettings();
    return settings.enablePreloading;
  }
}

// Global network manager instance
export const networkStateManager = new NetworkStateManager();
export const adaptiveRequestManager = new AdaptiveRequestManager(networkStateManager);
export const networkAwareImageOptimizer = new NetworkAwareImageOptimizer(networkStateManager);

// React hook for network-aware components
export const useNetworkState = () => {
  const [quality, setQuality] = useState<ConnectionQuality>(
    networkStateManager.getCurrentQuality()
  );
  const [isOnline, setIsOnline] = useState(
    networkStateManager.isOnline()
  );

  useEffect(() => {
    const unsubscribe = networkStateManager.subscribe((newQuality) => {
      setQuality(newQuality);
      setIsOnline(networkStateManager.isOnline());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    quality,
    isOnline,
    settings: networkStateManager.getAdaptiveSettings(),
    connectionType: networkStateManager.getConnectionType(),
  };
};

// Initialize network optimization
export const initializeNetworkOptimization = () => {
  logger.performance.network('Initializing network optimization...');
  
  // Network manager is initialized automatically
  // Additional setup can be added here
  
  logger.performance.network('Network optimization initialized');
};