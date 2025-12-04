/**
 * POST VIEWS API
 * Smart Home Feed with View Tracking & Session Management
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface PostView {
  id: string;
  user_id: string;
  post_id: string;
  view_count: number;
  last_viewed_at: string;
  first_viewed_at: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  started_at: string;
  last_activity_at: string;
  ended_at?: string;
  is_active: boolean;
  device_info?: any;
  created_at: string;
}

export interface SmartFeedPost {
  id: string;
  caption: string;
  image_urls: string[];
  user_id: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  username: string;
  avatar_url: string;
  user_view_count: number;
  last_viewed_at?: string;
}

export interface SmartFeedOptions {
  limit?: number;
  offset?: number;
  excludeViewedTwice?: boolean;
  respect24hCooldown?: boolean;
  sessionId?: string;
  excludePostIds?: string[];
}

export interface ViewTrackingBatch {
  postId: string;
  viewedAt: Date;
  sessionId?: string;
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

const SESSION_STORAGE_KEY = 'klicktape_session_token';
const PENDING_VIEWS_KEY = 'klicktape_pending_views';

// SessionManager class definition
class SessionManager {
  private static currentSessionToken: string | null = null;
  private static sessionStartTime: Date | null = null;

  /**
   * Start a new user session
   */
  static async startSession(userId: string, deviceInfo?: any): Promise<string> {
    try {
      const { data, error } = await (supabase as any).rpc('start_user_session', {
        p_user_id: userId,
        p_device_info: deviceInfo
      });

      if (error) throw error;

      const sessionToken = data as string;
      this.currentSessionToken = sessionToken;
      this.sessionStartTime = new Date();

      // Store session token locally
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, sessionToken);

// console.log('📱 New session started:', sessionToken);
      return sessionToken;
    } catch (__error) {
      console.error('❌ Failed to start session:', __error);
      throw __error;
    }
  }

  /**
   * Get current session token
   */
  static async getCurrentSession(): Promise<string | null> {
    if (this.currentSessionToken) {
      return this.currentSessionToken;
    }

    // Try to retrieve from storage
    try {
      const storedToken = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (storedToken) {
        this.currentSessionToken = storedToken;
        return storedToken;
      }
    } catch (__error) {
      console.error('❌ Failed to get session from storage:', __error);
    }

    return null;
  }

  /**
   * End current session
   */
  static async endSession(): Promise<void> {
    try {
      if (this.currentSessionToken) {
        // Update session as ended in database
        await (supabase as any)
          .from('user_sessions')
          .update({
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq('session_token', this.currentSessionToken);
      }

      // Clear local data
      this.currentSessionToken = null;
      this.sessionStartTime = null;
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);

// console.log('📱 Session ended');
    } catch (__error) {
      console.error('❌ Failed to end session:', __error);
    }
  }

  /**
   * Check if session is valid (not older than 24 hours)
   */
  static isSessionValid(): boolean {
    if (!this.sessionStartTime) return false;
    
    const now = new Date();
    const sessionAge = now.getTime() - this.sessionStartTime.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return sessionAge < maxAge;
  }
}

// =====================================================
// VIEW TRACKING WITH BATCHING
// =====================================================

class PostViewTracker {
  private static pendingViews: Map<string, ViewTrackingBatch> = new Map();
  private static batchTimer: NodeJS.Timeout | null = null;
  private static readonly BATCH_DELAY = 2000; // 2 seconds
  private static readonly MAX_BATCH_SIZE = 10;

  /**
   * Track a post view (with batching for performance)
   */
  static async trackView(postId: string, userId: string, sessionId?: string): Promise<void> {
    try {
      // Add to pending batch
      this.pendingViews.set(postId, {
        postId,
        viewedAt: new Date(),
        sessionId: sessionId || await SessionManager.getCurrentSession() || undefined
      });

      // Store pending views locally for persistence
      await this.savePendingViews();

      // Process batch if it's full or start timer
      if (this.pendingViews.size >= this.MAX_BATCH_SIZE) {
        await this.processBatch(userId);
      } else {
        this.startBatchTimer(userId);
      }
    } catch (__error) {
      console.error('❌ Failed to track view:', __error);
    }
  }

  /**
   * Process batch of view tracking
   */
  private static async processBatch(userId: string): Promise<void> {
    if (this.pendingViews.size === 0) return;

    try {
      const views = Array.from(this.pendingViews.values());
      this.pendingViews.clear();
      
      // Clear timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      // Process each view
      const promises = views.map(view => 
        (supabase as any).rpc('track_post_view', {
          p_user_id: userId,
          p_post_id: view.postId,
          p_session_id: view.sessionId
        })
      );

      await Promise.all(promises);
      
      // Clear from local storage
      await AsyncStorage.removeItem(PENDING_VIEWS_KEY);

// console.log(`✅ Processed ${views.length} view tracking records`);
    } catch (__error) {
      console.error('❌ Failed to process view batch:', __error);
      // Re-add failed views to pending (could implement retry logic)
    }
  }

  /**
   * Start batch processing timer
   */
  private static startBatchTimer(userId: string): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(async () => {
      await this.processBatch(userId);
    }, this.BATCH_DELAY) as unknown as NodeJS.Timeout;
  }

  /**
   * Save pending views to local storage
   */
  private static async savePendingViews(): Promise<void> {
    try {
      const viewsArray = Array.from(this.pendingViews.entries());
      await AsyncStorage.setItem(PENDING_VIEWS_KEY, JSON.stringify(viewsArray));
    } catch (__error) {
      console.error('❌ Failed to save pending views:', __error);
    }
  }

  /**
   * Load pending views from local storage
   */
  static async loadPendingViews(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PENDING_VIEWS_KEY);
      if (stored) {
        const viewsArray = JSON.parse(stored);
        this.pendingViews = new Map(viewsArray);
      }
    } catch (__error) {
      console.error('❌ Failed to load pending views:', __error);
    }
  }

  /**
   * Force process all pending views
   */
  static async flushPendingViews(userId: string): Promise<void> {
    await this.processBatch(userId);
  }
}

// =====================================================
// SMART FEED API
// =====================================================

class SmartFeedApi {
  /**
   * Get smart feed for user with view-based filtering
   */
  static async getSmartFeed(
    userId: string, 
    options: SmartFeedOptions = {}
  ): Promise<SmartFeedPost[]> {
    try {
      const {
        limit = 20,
        offset = 0,
        excludeViewedTwice = true,
        respect24hCooldown = true,
        sessionId
      } = options;

      const currentSession = sessionId || await SessionManager.getCurrentSession();

      const { data, error } = await (supabase as any).rpc('get_smart_feed_for_user', {
        p_user_id: userId,
        p_session_id: sessionId,
        p_limit: limit,
        p_offset: offset,
        p_exclude_viewed_twice: excludeViewedTwice,
        p_respect_24h_cooldown: respect24hCooldown
      }) as { data: SmartFeedPost[] | null; error: any };

      if (error) throw error;

// console.log(`📱 Smart feed loaded: ${data?.length || 0} posts`);
      return data || [];
    } catch (__error) {
      console.error('❌ Failed to get smart feed:', __error);
      throw __error;
    }
  }

  /**
   * Get user's view history for a specific post
   */
  static async getPostViewHistory(userId: string, postId: string): Promise<PostView | null> {
    try {
      const { data, error } = await supabase
        .from('post_views')
        .select('*')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      return data || null;
    } catch (__error) {
      console.error('❌ Failed to get post view history:', __error);
      return null;
    }
  }

  /**
   * Get user's complete view history
   */
  static async getUserViewHistory(
    userId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<PostView[]> {
    try {
      const { data, error } = await supabase
        .from('post_views')
        .select('*')
        .eq('user_id', userId)
        .order('last_viewed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      
      return data || [];
    } catch (__error) {
      console.error('❌ Failed to get user view history:', __error);
      return [];
    }
  }

  /**
   * Reset user's view history (for testing or admin purposes)
   */
  static async resetUserViewHistory(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('post_views')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

// console.log('✅ User view history reset');
    } catch (__error) {
      console.error('❌ Failed to reset view history:', __error);
      throw __error;
    }
  }
}

// =====================================================
// ANALYTICS API
// =====================================================

class PostAnalyticsApi {
  /**
   * Get analytics for a specific post
   */
  static async getPostAnalytics(postId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('post_view_analytics')
        .select('*')
        .eq('post_id', postId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data || null;
    } catch (__error) {
      console.error('❌ Failed to get post analytics:', __error);
      return null;
    }
  }

  /**
   * Get top viewed posts
   */
  static async getTopViewedPosts(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('post_view_analytics')
        .select(`
          *,
          posts:post_id (
            id,
            caption,
            image_urls,
            created_at,
            profiles:user_id (username, avatar_url)
          )
        `)
        .order('total_views', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return data || [];
    } catch (__error) {
      console.error('❌ Failed to get top viewed posts:', __error);
      return [];
    }
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Initialize post view tracking system
 */
export async function initializePostViewTracking(userId: string): Promise<void> {
  try {
    // Load any pending views from storage
    await PostViewTracker.loadPendingViews();
    
    // Start new session if needed
    if (!(await SessionManager.getCurrentSession()) || !SessionManager.isSessionValid()) {
      await SessionManager.startSession(userId, {
        platform: 'mobile',
        timestamp: new Date().toISOString()
      });
    }

// console.log('✅ Post view tracking initialized');
  } catch (__error) {
    console.error('❌ Failed to initialize post view tracking:', __error);
  }
}

/**
 * Cleanup function to call on app close/logout
 */
export async function cleanupPostViewTracking(userId: string): Promise<void> {
  try {
    // Flush any pending views
    await PostViewTracker.flushPendingViews(userId);
    
    // End current session
    await SessionManager.endSession();

// console.log('✅ Post view tracking cleanup completed');
  } catch (__error) {
    console.error('❌ Failed to cleanup post view tracking:', __error);
  }
}

// Export all classes and functions
export {
  SessionManager,
  PostViewTracker,
  SmartFeedApi,
  PostAnalyticsApi
};
