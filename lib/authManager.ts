
/**
 * Centralized Authentication Manager
 * Reduces auth requests by caching user data and providing single source of truth
 */

import { supabase } from './supabase';
import { supabaseOptimizer } from './utils/supabaseOptimizer';
import { User } from '@supabase/supabase-js';

interface CachedUser {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  cached_at: number;
}

class AuthManager {
  private static instance: AuthManager;
  private cachedUser: CachedUser | null = null;
  private authPromise: Promise<CachedUser | null> | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Get current user with caching to reduce auth requests
   */
  async getCurrentUser(): Promise<CachedUser | null> {
    try {
      // Return cached user if still valid
      if (this.cachedUser && this.isCacheValid()) {
// console.log('🔐 Auth: Serving user from cache');
        return this.cachedUser;
      }

      // If there's already an auth request in progress, wait for it
      if (this.authPromise) {
// console.log('🔐 Auth: Waiting for existing auth request');
        return this.authPromise;
      }

      // Create new auth request
      this.authPromise = this.fetchUserData();
      const user = await this.authPromise;
      this.authPromise = null;

      return user;
    } catch (__error) {
// console.log('🔐 Auth: Error in getCurrentUser, returning null:', __error);
      this.cachedUser = null;
      this.authPromise = null;
      return null;
    }
  }

  private async fetchUserData(): Promise<CachedUser | null> {
    try {
// console.log('🔐 Auth: Fetching user from Supabase');

      if (!supabase) {
        // Error: Supabase client not initialized
        return null;
      }

      // Use getSession instead of getUser to avoid AuthSessionMissingError
      let user: User | null = null;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (sessionError.message?.includes('Auth session missing')) {
// console.log('🔐 Auth: No authenticated session');
            this.cachedUser = null;
            return null;
          } else {
            throw sessionError;
          }
        }

        user = session?.user || null;
      } catch (__sessionError: any) {
        // If session check fails with "Auth session missing", don't fallback to getUser
        // as it will also fail with the same error, causing duplicate error logs
        if (__sessionError.message?.includes('Auth session missing')) {
// console.log('🔐 Auth: No authenticated session (session check failed)');
          this.cachedUser = null;
          return null;
        }

// console.warn('🔐 Auth: Session check failed with non-auth error, trying getUser as fallback:', __sessionError.message);

        // Only fallback to getUser for non-auth errors
        const { data: { user: fallbackUser }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          if (userError.message?.includes('Auth session missing')) {
// console.log('🔐 Auth: No authenticated user (fallback)');
          } else {
            // Error: Error getting current user (fallback)
          }
          this.cachedUser = null;
          return null;
        }

        user = fallbackUser;
      }

      if (!user) {
// console.log('🔐 Auth: No authenticated user');
        this.cachedUser = null;
        return null;
      }

      // Get basic profile data without external dependency
      let profileData: any = null;
      try {
        const { data, error } = await supabaseOptimizer.select(
          'profiles',
          (builder) => builder.select('username, avatar_url').eq('id', user.id).single(),
          { skipCache: false }
        );

        if (!error && data) {
          profileData = data;
        }
      } catch (__profileError) {
// console.warn('🔐 Auth: Could not fetch profile data:', __profileError);
      }

      this.cachedUser = {
        id: user.id,
        email: user.email!,
        username: profileData?.username || undefined,
        avatar_url: profileData?.avatar_url || undefined,
        cached_at: Date.now(),
      };

// console.log('🔐 Auth: User cached successfully');
      return this.cachedUser;
    } catch {
      // Error: Error fetching user
      this.cachedUser = null;
      return null;
    }
  }

  private isCacheValid(): boolean {
    if (!this.cachedUser) return false;
    return Date.now() - this.cachedUser.cached_at < this.CACHE_DURATION;
  }

  /**
   * Clear cached user data (call on logout)
   */
  clearCache(): void {
    this.cachedUser = null;
    this.authPromise = null;
// console.log('🔐 Auth: Cache cleared');
  }

  /**
   * Get user ID quickly from cache
   */
  getUserId(): string | null {
    return this.cachedUser?.id || null;
  }

  /**
   * Check if user is authenticated without making API call
   */
  isAuthenticated(): boolean {
    return this.cachedUser !== null && this.isCacheValid();
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();

// Convenience hooks for React components
export const useAuthManager = () => {
  return {
    getCurrentUser: () => authManager.getCurrentUser(),
    getUserId: () => authManager.getUserId(),
    isAuthenticated: () => authManager.isAuthenticated(),
    clearCache: () => authManager.clearCache(),
  };
};

