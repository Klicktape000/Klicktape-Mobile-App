/**
 * ProfileCache - Aggressive caching for profile queries
 * 
 * Prevents repeated queries to profiles table by caching results
 * with long TTL (30 minutes) to avoid timeout issues
 */

interface CachedProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  name?: string | null;
  bio?: string | null;
  [key: string]: any;
}

interface CacheEntry {
  data: CachedProfile;
  timestamp: number;
}

class ProfileCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get cached profile by ID
   */
  get(userId: string): CachedProfile | null {
    const entry = this.cache.get(userId);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(userId);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set profile in cache
   */
  set(userId: string, profile: CachedProfile): void {
    this.cache.set(userId, {
      data: profile,
      timestamp: Date.now()
    });
  }

  /**
   * Set multiple profiles at once
   */
  setMany(profiles: CachedProfile[]): void {
    const timestamp = Date.now();
    profiles.forEach(profile => {
      this.cache.set(profile.id, {
        data: profile,
        timestamp
      });
    });
  }

  /**
   * Check if profile is cached and valid
   */
  has(userId: string): boolean {
    return this.get(userId) !== null;
  }

  /**
   * Clear specific profile from cache
   */
  delete(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear all cached profiles
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL
    };
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.CACHE_TTL) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.cache.delete(key));
  }
}

// Export singleton
export const profileCache = new ProfileCache();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    profileCache.cleanup();
  }, 5 * 60 * 1000);
}
