/**
 * Image Caching Utilities for React Native
 * Reduces bandwidth costs and improves performance
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditional import for file system - only on native platforms
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    FileSystem = require('expo-file-system/legacy');
  } catch {
// console.warn('⚠️ expo-file-system not available, using web-compatible mode');
  }
}

// Enhanced cache configuration for egress reduction and faster loading
const IMAGE_CACHE_CONFIG = {
  MAX_CACHE_SIZE: 300 * 1024 * 1024, // Increased to 300MB for better caching
  MAX_CACHE_AGE: 21 * 24 * 60 * 60 * 1000, // Extended to 21 days
  CACHE_KEY_PREFIX: 'image_cache_',
  METADATA_KEY: 'image_cache_metadata',
  CACHE_DIR: FileSystem ? `${FileSystem.cacheDirectory}images/` : null,
  // Aggressive caching for frequently accessed content
  PRIORITY_CACHE_AGE: 45 * 24 * 60 * 60 * 1000, // 45 days for avatars/thumbnails
  // Performance optimizations
  CONCURRENT_DOWNLOADS: 3, // Limit concurrent downloads to prevent overwhelming
  DOWNLOAD_TIMEOUT: 8000, // 8 seconds timeout for downloads
  RETRY_DELAY: 1000, // 1 second delay between retries
} as const;

interface ImageCacheMetadata {
  url: string;
  cacheKey: string;
  timestamp: number;
  size: number;
  localPath?: string;
}

/**
 * Image Cache Manager
 */
export class ImageCacheManager {
  private static metadata: Map<string, ImageCacheMetadata> = new Map();
  private static initialized = false;
  private static downloadQueue: Set<string> = new Set(); // Track ongoing downloads
  private static activeDownloads = 0; // Track concurrent downloads

  /**
   * Initialize cache manager
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Skip file system operations on web platform
      if (Platform.OS === 'web' || !FileSystem) {
// console.log('✅ Image cache manager initialized (web mode - file system disabled)');
        this.initialized = true;
        return;
      }

      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_CONFIG.CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(IMAGE_CACHE_CONFIG.CACHE_DIR, { intermediates: true });
      }

      const metadataJson = await AsyncStorage.getItem(IMAGE_CACHE_CONFIG.METADATA_KEY);
      if (metadataJson) {
        const metadataArray: ImageCacheMetadata[] = JSON.parse(metadataJson);
        this.metadata = new Map(metadataArray.map(item => [item.url, item]));
      }
      
      // Clean up expired cache entries
      await this.cleanupExpiredCache();
      
      this.initialized = true;
// console.log('✅ Image cache manager initialized');
    } catch (__error) {
      console.error('❌ Error initializing image cache manager:', __error);
      // Fallback to web mode if initialization fails
      this.initialized = true;
    }
  }

  /**
   * Get cached image URI or original URI
   */
  static async getCachedImageUri(originalUri: string): Promise<string> {
    await this.initialize();

    // On web platform or without FileSystem, return original URI directly
    if (Platform.OS === 'web' || !FileSystem) {
      return originalUri;
    }

    try {
      const metadata = this.metadata.get(originalUri);
      
      if (metadata) {
        // Check if cache is still valid
        const age = Date.now() - metadata.timestamp;
        if (age < IMAGE_CACHE_CONFIG.MAX_CACHE_AGE) {
          // Check if local file exists
          if (metadata.localPath) {
            const fileInfo = await FileSystem.getInfoAsync(metadata.localPath);
            if (fileInfo.exists) {
// console.log(`📱 Image served from cache: ${originalUri}`);
              return metadata.localPath;
            }
          }
          
          // Fallback to AsyncStorage for base64 data
          const cachedData = await AsyncStorage.getItem(metadata.cacheKey);
          if (cachedData) {
// console.log(`📱 Image served from AsyncStorage cache: ${originalUri}`);
            return `data:image/jpeg;base64,${cachedData}`;
          }
        }
        
        // Cache expired or corrupted, remove metadata
        this.metadata.delete(originalUri);
        await this.saveMetadata();
      }
      
      // Return original URI if not cached or cache invalid
      return originalUri;
    } catch (__error) {
      console.error('❌ Error getting cached image:', __error);
      return originalUri;
    }
  }

  /**
   * Cache an image from URL with enhanced error handling and retry logic
   */
  static async cacheImageFromUrl(
    url: string, 
    priority: boolean = false
  ): Promise<string | null> {
    await this.initialize();

    // Skip caching on web platform or without FileSystem
    if (Platform.OS === 'web' || !FileSystem) {
// console.log('⚠️ Image caching skipped (web platform or FileSystem unavailable)');
      return null;
    }

    try {
      // Validate URL
      if (!url || typeof url !== 'string') {
// console.warn('⚠️ Invalid image URL provided for caching');
        return null;
      }

      // Check if already cached
      const existing = this.metadata.get(url);
      if (existing) {
        const age = Date.now() - existing.timestamp;
        if (age < IMAGE_CACHE_CONFIG.MAX_CACHE_AGE) {
// console.log('📱 Image served from cache:', url);
          return existing.localPath || null;
        }
      }

      // Check if already downloading
      if (this.downloadQueue.has(url)) {
// console.log(`⏳ Image already downloading: ${url}`);
        return null;
      }

      // Check concurrent download limit
      if (this.activeDownloads >= IMAGE_CACHE_CONFIG.CONCURRENT_DOWNLOADS) {
// console.log(`⏸️ Download queue full, skipping: ${url}`);
        return null;
      }

      // Add to download queue
      this.downloadQueue.add(url);
      this.activeDownloads++;

// console.log(`📥 Caching image (${this.activeDownloads}/${IMAGE_CACHE_CONFIG.CONCURRENT_DOWNLOADS}): ${url}`);
      
      try {
        const result = await this.downloadAndCacheImage(url, priority);
        return result;
      } finally {
        // Always cleanup
        this.downloadQueue.delete(url);
        this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      }

    } catch (__error) {
      console.error('❌ Failed to cache image after 2 attempts:', __error);
      
      // Use network error handler for consistent error management
      try {
        const { handleNetworkError, isNetworkError } = await import('./networkErrorHandler');
        
        if (isNetworkError(__error)) {
          handleNetworkError(__error, { 
            context: 'Image caching', 
            showUserAlert: false // Don't show alerts for image cache failures
          });
        }
      } catch (__importError) {
// console.warn('⚠️ Could not import network error handler:', __importError);
      }
      
      return null;
    }
  }

  /**
   * Download and cache image with enhanced error handling
   */
  private static async downloadAndCacheImage(
    url: string, 
    priority: boolean
  ): Promise<string | null> {
    // Skip if FileSystem is not available
    if (!FileSystem) {
      throw new Error('FileSystem not available for image caching');
    }

    const maxRetries = 2; // Reduced from 3 for faster failure
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
// console.log(`📥 Downloading image (attempt ${attempt}/${maxRetries}): ${url}`);

        // Generate unique filename
        const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
        const localPath = `${IMAGE_CACHE_CONFIG.CACHE_DIR}${filename}`;
        
        // Direct download with timeout and proper error handling
        const downloadPromise = FileSystem.downloadAsync(url, localPath, {
          headers: {
            'User-Agent': 'KlicktapeApp/1.0',
            'Accept': 'image/*',
            'Cache-Control': 'no-cache',
          },
        });

        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Image download timeout after ${IMAGE_CACHE_CONFIG.DOWNLOAD_TIMEOUT}ms`));
          }, IMAGE_CACHE_CONFIG.DOWNLOAD_TIMEOUT);
        });

        const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
        
        if (downloadResult && downloadResult.status === 200) {
          const fileInfo = await FileSystem.getInfoAsync(localPath);
          const size = (fileInfo.exists && 'size' in fileInfo) ? fileInfo.size : 0;
          
          // Validate image size (max 5MB per image)
          if (size > 5 * 1024 * 1024) {
            throw new Error('Image too large (>5MB)');
          }
          
          // Check cache size limits
          await this.ensureCacheSpace(size);
          
          // Update metadata
          const metadata: ImageCacheMetadata = {
            url,
            cacheKey: `${IMAGE_CACHE_CONFIG.CACHE_KEY_PREFIX}${filename}`,
            timestamp: Date.now(),
            size,
            localPath,
          };
          
          this.metadata.set(url, metadata);
          await this.saveMetadata();

// console.log(`✅ Image cached: ${url} (${(size / 1024).toFixed(1)}KB)`);
          return localPath;
        } else {
          const status = downloadResult?.status || 'unknown';
          throw new Error(`Download failed with status: ${status}`);
        }

      } catch (__error) {
        lastError = __error as Error;
// console.warn(`⚠️ Image download attempt ${attempt} failed:`, __error);

        // Don't retry on certain errors
        if (
          __error instanceof Error && (
            __error.message.includes('HTTP 404') ||
            __error.message.includes('HTTP 403') ||
            __error.message.includes('status: 404') ||
            __error.message.includes('status: 403') ||
            __error.message.includes('status: 400') ||
            __error.message.includes('Image too large') ||
            __error.message.includes('timeout')
          )
        ) {
          break;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, IMAGE_CACHE_CONFIG.RETRY_DELAY));
        }
      }
    }

    throw lastError || new Error('Image download failed after all retries');
  }

  /**
   * Cache image data (base64)
   */
  static async cacheImage(uri: string, base64Data: string): Promise<void> {
    await this.initialize();

    try {
      const cacheKey = `${IMAGE_CACHE_CONFIG.CACHE_KEY_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const size = base64Data.length;
      
      // Check cache size limits
      await this.ensureCacheSpace(size);
      
      // Store image data
      await AsyncStorage.setItem(cacheKey, base64Data);
      
      // Update metadata
      const metadata: ImageCacheMetadata = {
        url: uri,
        cacheKey,
        timestamp: Date.now(),
        size,
      };
      
      this.metadata.set(uri, metadata);
      await this.saveMetadata();

// console.log(`✅ Image cached: ${uri} (${(size / 1024).toFixed(1)}KB)`);
    } catch (__error) {
      console.error('❌ Error caching image:', __error);
    }
  }

  /**
   * Ensure cache has enough space
   */
  private static async ensureCacheSpace(requiredSize: number): Promise<void> {
    const currentSize = Array.from(this.metadata.values())
      .reduce((total, item) => total + item.size, 0);
    
    if (currentSize + requiredSize <= IMAGE_CACHE_CONFIG.MAX_CACHE_SIZE) {
      return;
    }
    
    // Remove oldest entries until we have enough space
    const sortedEntries = Array.from(this.metadata.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    let freedSpace = 0;
    for (const [url, metadata] of sortedEntries) {
      try {
        // Remove local file if exists
        if (metadata.localPath) {
          await FileSystem.deleteAsync(metadata.localPath, { idempotent: true });
        }
        
        // Remove AsyncStorage entry
        await AsyncStorage.removeItem(metadata.cacheKey);
        
        this.metadata.delete(url);
        freedSpace += metadata.size;
        
        if (freedSpace >= requiredSize) {
          break;
        }
      } catch (__error) {
        console.error('❌ Error removing cached image:', __error);
      }
    }
    
    await this.saveMetadata();
  }

  /**
   * Clean up expired cache entries
   */
  private static async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    const expiredEntries: string[] = [];
    
    for (const [url, metadata] of this.metadata.entries()) {
      const age = now - metadata.timestamp;
      if (age > IMAGE_CACHE_CONFIG.MAX_CACHE_AGE) {
        expiredEntries.push(url);
        try {
          // Remove local file if exists
          if (metadata.localPath) {
            await FileSystem.deleteAsync(metadata.localPath, { idempotent: true });
          }
          
          // Remove AsyncStorage entry
          await AsyncStorage.removeItem(metadata.cacheKey);
        } catch (__error) {
          console.error('❌ Error removing expired cache entry:', __error);
        }
      }
    }
    
    expiredEntries.forEach(url => this.metadata.delete(url));
    
    if (expiredEntries.length > 0) {
      await this.saveMetadata();
// console.log(`🧹 Cleaned up ${expiredEntries.length} expired cache entries`);
    }
  }

  /**
   * Save metadata to storage
   */
  private static async saveMetadata(): Promise<void> {
    try {
      const metadataArray = Array.from(this.metadata.values());
      await AsyncStorage.setItem(
        IMAGE_CACHE_CONFIG.METADATA_KEY,
        JSON.stringify(metadataArray)
      );
    } catch (__error) {
      console.error('❌ Error saving cache metadata:', __error);
    }
  }

  /**
   * Clear all cached images
   */
  static async clearCache(): Promise<void> {
    await this.initialize();

    try {
      for (const metadata of this.metadata.values()) {
        // Remove local file if exists
        if (metadata.localPath) {
          await FileSystem.deleteAsync(metadata.localPath, { idempotent: true });
        }
        
        // Remove AsyncStorage entry
        await AsyncStorage.removeItem(metadata.cacheKey);
      }
      
      this.metadata.clear();
      await AsyncStorage.removeItem(IMAGE_CACHE_CONFIG.METADATA_KEY);

// console.log('✅ Image cache cleared');
    } catch (__error) {
      console.error('❌ Error clearing image cache:', __error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalSize: number;
    totalImages: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    await this.initialize();

    const entries = Array.from(this.metadata.values());
    const totalSize = entries.reduce((sum, item) => sum + item.size, 0);
    const timestamps = entries.map(item => item.timestamp);
    
    return {
      totalSize,
      totalImages: entries.length,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }
}

