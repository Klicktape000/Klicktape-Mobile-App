import { useState, useEffect, useCallback, useRef } from 'react';
import { Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface PreloadOptions {
  priority?: 'low' | 'normal' | 'high';
  maxConcurrent?: number;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk';
  timeout?: number;
}

interface PreloadResult {
  loaded: boolean;
  error: boolean;
  progress: number;
}

interface PreloadQueue {
  uri: string;
  priority: 'low' | 'normal' | 'high';
  resolve: (success: boolean) => void;
  reject: (error: any) => void;
}

class ImagePreloader {
  private queue: PreloadQueue[] = [];
  private loading: Set<string> = new Set();
  private cache: Map<string, boolean> = new Map();
  private maxConcurrent: number = 3;

  async preload(
    uri: string, 
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<boolean> {
    // Check if already cached
    if (this.cache.has(uri)) {
      return this.cache.get(uri) || false;
    }

    // Check if already loading
    if (this.loading.has(uri)) {
      return new Promise((resolve) => {
        const checkLoading = () => {
          if (!this.loading.has(uri)) {
            resolve(this.cache.get(uri) || false);
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ uri, priority, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.loading.size >= this.maxConcurrent) {
      return;
    }

    // Sort queue by priority
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const item = this.queue.shift();
    if (!item) return;

    this.loading.add(item.uri);

    try {
      // Use ExpoImage for better preloading performance
      await ExpoImage.prefetch(item.uri, {
        cachePolicy: 'memory-disk',
      });
      
      this.cache.set(item.uri, true);
      item.resolve(true);
    } catch (error) {
      this.cache.set(item.uri, false);
      item.reject(error);
    } finally {
      this.loading.delete(item.uri);
      // Process next item in queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

const imagePreloader = new ImagePreloader();

export function useImagePreloader(
  images: string[],
  options: PreloadOptions = {}
) {
  const [results, setResults] = useState<{ [uri: string]: PreloadResult }>({});
  const [isPreloading, setIsPreloading] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  const {
    priority = 'normal',
    maxConcurrent = 3,
    timeout = 10000,
  } = options;

  const preloadImages = useCallback(async () => {
    if (images.length === 0) return;

    setIsPreloading(true);
    abortController.current = new AbortController();
    
    // Set max concurrent downloads
    imagePreloader.setMaxConcurrent(maxConcurrent);

    // Initialize results
    const initialResults: { [uri: string]: PreloadResult } = {};
    images.forEach(uri => {
      initialResults[uri] = { loaded: false, error: false, progress: 0 };
    });
    setResults(initialResults);

    try {
      // Preload images with timeout
      const preloadPromises = images.map(async (uri, index) => {
        try {
          // Add artificial delay for progress simulation
          const progressInterval = setInterval(() => {
            setResults(prev => ({
              ...prev,
              [uri]: {
                ...prev[uri],
                progress: Math.min(prev[uri].progress + 10, 90),
              },
            }));
          }, 100);

          const timeoutPromise = new Promise<boolean>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeout);
          });

          const preloadPromise = imagePreloader.preload(uri, priority);
          
          const success = await Promise.race([preloadPromise, timeoutPromise]);
          
          clearInterval(progressInterval);
          
          setResults(prev => ({
            ...prev,
            [uri]: { loaded: success, error: !success, progress: 100 },
          }));

          return success;
        } catch (error) {
          setResults(prev => ({
            ...prev,
            [uri]: { loaded: false, error: true, progress: 100 },
          }));
          return false;
        }
      });

      await Promise.allSettled(preloadPromises);
    } catch (error) {
// console.warn('Image preloading error:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [images, priority, maxConcurrent, timeout]);

  const cancelPreloading = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      setIsPreloading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    imagePreloader.clearCache();
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      cacheSize: imagePreloader.getCacheSize(),
      loadedCount: Object.values(results).filter(r => r.loaded).length,
      errorCount: Object.values(results).filter(r => r.error).length,
      totalCount: images.length,
    };
  }, [results, images.length]);

  useEffect(() => {
    if (images.length > 0) {
      preloadImages();
    }

    return () => {
      cancelPreloading();
    };
  }, [images, preloadImages, cancelPreloading]);

  return {
    results,
    isPreloading,
    preloadImages,
    cancelPreloading,
    clearCache,
    getCacheStats,
  };
}

// Hook for preloading images in viewport
export function useViewportImagePreloader(
  images: string[],
  options: PreloadOptions & { threshold?: number } = {}
) {
  const [visibleImages, setVisibleImages] = useState<string[]>([]);
  const { threshold = 0.1 } = options;

  const preloaderResult = useImagePreloader(visibleImages, options);

  const updateVisibleImages = useCallback((startIndex: number, endIndex: number) => {
    const visible = images.slice(
      Math.max(0, startIndex - 2), // Preload 2 images before
      Math.min(images.length, endIndex + 3) // Preload 3 images after
    );
    setVisibleImages(visible);
  }, [images]);

  return {
    ...preloaderResult,
    updateVisibleImages,
  };
}

export default useImagePreloader;