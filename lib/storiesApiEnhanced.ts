/**
 * Enhanced Stories API with Redis Caching
 * Reduces Supabase costs and improves performance
 */

import { supabase } from "./supabase";
import { Platform } from "react-native";
import StoriesCache from "./redis/storiesCache";

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  viewed_by: string[];
  story_order: number;
  view_count: number;
  duration: number;
  story_type: string;
  is_active: boolean;
  user: {
    username: string;
    avatar: string;
  };
  is_viewed?: boolean;
}

interface StoriesFeed {
  user_id: string;
  username: string;
  avatar_url: string;
  story_count: number;
  latest_story_time: string;
  has_unviewed: boolean;
  stories: Story[];
}

export const storiesAPIEnhanced = {
  /**
   * Upload image with optimized file handling
   */
  uploadImage: async (file: { uri: string; name: string; type: string }) => {
    try {
      // Check authentication
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Normalize URI for Android
      let normalizedUri = file.uri;
      if (Platform.OS === "android" && !normalizedUri.startsWith("file://")) {
        normalizedUri = `file://${normalizedUri}`;
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", {
        uri: normalizedUri,
        type: file.type,
        name: file.name,
      } as any);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("stories")
        .upload(filePath, formData, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("stories")
        .getPublicUrl(data.path);

      return { filePath: data.path, publicUrl: urlData.publicUrl };
    } catch (__error) {
      // Use enhanced network error handling
      const { handleNetworkError, isNetworkError } = await import('./utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
        handleNetworkError(__error, { 
          context: 'Image upload', 
          showUserAlert: true 
        });
      } else {
        console.error("Error uploading image:", __error);
      }
      throw __error;
    }
  },

  /**
   * Create story with enhanced features and cache invalidation
   */
  createStory: async (
    imageUrl: string,
    userId: string,
    caption?: string,
    duration: number = 5000,
    storyType: string = 'image'
  ) => {
    try {
      // Use enhanced database function
      const { data, error } = await supabase.rpc("create_story_enhanced", {
        image_url_param: imageUrl,
        caption_param: caption,
        duration_param: duration,
        story_type_param: storyType,
      } as any);

      if (error) {
        throw new Error(`Failed to create story: ${error.message}`);
      }

      // Invalidate cache for this user and feed
      await StoriesCache.invalidateStoriesCache(userId);

      return { id: data, success: true };
    } catch (__error) {
      console.error("Error creating story:", __error);
      throw __error;
    }
  },

  /**
   * Get stories feed with Redis caching
   */
  getStoriesFeed: async (limit: number = 50): Promise<StoriesFeed[]> => {
    try {
      // Try to get from cache first
      const cachedFeed = await StoriesCache.getStoriesFeed(limit, async () => {
        // Fallback to database
// console.log("🔄 Fetching stories feed from database");
        
        const { data, error } = await supabase.rpc("get_stories_feed_enhanced", {
          limit_param: limit,
        } as any);

        if (error) {
          throw new Error(`Failed to fetch stories feed: ${error.message}`);
        }

        return data || [];
      });

      return cachedFeed.map((feed: any) => ({
        ...feed,
        stories: feed.stories.map((story: any) => ({
          ...story,
          viewed_by: [],
          is_active: true,
          user: {
            username: story.username || feed.username,
            avatar_url: story.avatar_url || feed.avatar_url,
          }
        }))
      }));
    } catch (__error) {
      console.error("Error fetching stories feed:", __error);
      throw __error;
    }
  },

  /**
   * Get user stories with caching and multiple stories support
   */
  getUserStories: async (userId: string): Promise<Story[]> => {
    try {
      const cachedStories = await StoriesCache.getUserStories(userId, async () => {
// console.log(`🔄 Fetching user stories for ${userId} from database`);
        
        const { data, error } = await supabase.rpc("get_user_stories_enhanced", {
          user_id_param: userId,
        } as any);

        if (error) {
          throw new Error(`Failed to fetch user stories: ${error.message}`);
        }

        return data || [];
      });

      return cachedStories.map((story: any) => ({
        ...story,
        viewed_by: [],
        is_active: true,
        user: {
          username: story.username,
          avatar_url: story.avatar_url,
        }
      }));
    } catch (__error) {
      console.error("Error fetching user stories:", __error);
      throw __error;
    }
  },

  /**
   * Mark story as viewed with analytics tracking
   */
  markStoryViewed: async (storyId: string, viewDuration: number = 0): Promise<boolean> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        return false;
      }

      // Update database
      const { data, error } = await supabase.rpc("mark_story_viewed", {
        story_id_param: storyId,
        view_duration_param: viewDuration,
      } as any);

      if (error) {
        console.error("Error marking story as viewed:", error);
        return false;
      }

      // Track in cache for analytics
      await StoriesCache.trackStoryView(storyId, user.id, viewDuration);

      return data || false;
    } catch (__error) {
      console.error("Error marking story as viewed:", __error);
      return false;
    }
  },

  /**
   * Get active stories (for quick checks)
   */
  getActiveStories: async (): Promise<Story[]> => {
    try {
      // Check cache first
      const activeStoryIds = await StoriesCache.getActiveStories();

      if (activeStoryIds.length > 0) {
        // OPTIMIZED: Batch fetch all stories in a single query instead of N+1 queries
        const { data, error } = await supabase
          .from("stories")
          .select(`
            id,
            user_id,
            image_url,
            caption,
            created_at,
            expires_at,
            viewed_by,
            story_order,
            view_count,
            duration,
            story_type,
            is_active,
            profiles!stories_user_id_fkey (username, avatar_url)
          `)
          .in("id", activeStoryIds)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching stories batch:", error);
          // Fall through to fallback query
        } else if (data && data.length > 0) {
          return data.map((story: any) => ({
            ...story,
            user: {
              username: story.profiles.username,
              avatar: story.profiles.avatar_url || "",
            },
          }));
        }
      }

      // Fallback to database query
      const { data, error } = await supabase
        .from("stories")
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          expires_at,
          viewed_by,
          story_order,
          view_count,
          duration,
          story_type,
          is_active,
          profiles!stories_user_id_fkey (username, avatar_url)
        `)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Failed to fetch active stories: ${error.message}`);
      }

      const stories: Story[] = (data || []).map((story) => ({
        ...(story as any),
        user: {
          username: (story as any).profiles.username,
          avatar: (story as any).profiles.avatar_url || "",
        },
      }));

      // Cache the active story IDs
      await StoriesCache.setActiveStories(stories.map(s => s.id));

      return stories;
    } catch (__error) {
      console.error("Error fetching active stories:", __error);
      throw __error;
    }
  },

  /**
   * Delete story with complete storage cleanup and cache invalidation
   */
  deleteStory: async (storyId: string): Promise<boolean> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      // Import storiesAPI for proper deletion with storage cleanup
      const { storiesAPI } = await import('./storiesApi');

      // Use the enhanced deleteStory function that handles storage cleanup
      const result = await storiesAPI.deleteStory(storyId);

      if (result) {
        // Invalidate cache after successful deletion
        await StoriesCache.invalidateStoriesCache(user.id);
// console.log("✅ Story deleted and cache invalidated");
      }

      return result;
    } catch (__error) {
      console.error("Error deleting story:", __error);
      return false;
    }
  },

  /**
   * Get story analytics
   */
  getStoryAnalytics: async (storyId: string) => {
    try {
      // Try cache first
      const cachedAnalytics = await StoriesCache.getStoryAnalytics(storyId);
      
      if (cachedAnalytics) {
        return cachedAnalytics;
      }

      // Fallback to database calculation
      const { data: views, error } = await supabase
        .from("story_views")
        .select("view_duration, completed")
        .eq("story_id", storyId);

      if (error) {
        throw new Error(`Failed to fetch story analytics: ${error.message}`);
      }

      const analytics = {
        total_views: views?.length || 0,
        unique_viewers: views?.length || 0, // Since we have unique constraint
        completion_rate: views?.length ? views.filter((v: any) => v.completed).length / views.length : 0,
        avg_view_duration: views?.length ? views.reduce((sum: number, v: any) => sum + v.view_duration, 0) / views.length : 0,
        last_updated: new Date().toISOString(),
      };

      return analytics;
    } catch (__error) {
      console.error("Error fetching story analytics:", __error);
      return null;
    }
  },

  /**
   * Cleanup expired stories (call periodically)
   */
  cleanupExpiredStories: async (): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc("cleanup_expired_stories");

      if (error) {
        throw new Error(`Failed to cleanup expired stories: ${error.message}`);
      }

      // Clear cache after cleanup
      await StoriesCache.invalidateStoriesCache();

// console.log(`🧹 Cleaned up ${data} expired stories`);
      return data || 0;
    } catch (__error) {
      console.error("Error cleaning up expired stories:", __error);
      return 0;
    }
  },

  /**
   * Preload stories for better performance
   */
  preloadStories: async (userIds: string[]): Promise<void> => {
    try {
      // Batch fetch stories for multiple users
      const storiesPromises = userIds.map(userId =>
        ((this as any).getUserStories)?.(userId) || Promise.resolve([])
      );

      await Promise.all(storiesPromises);
// console.log(`📦 Preloaded stories for ${userIds.length} users`);
    } catch (__error) {
      console.error("Error preloading stories:", __error);
    }
  },

  /**
   * Get cache statistics
   */
  getCacheStats: async () => {
    try {
      return await StoriesCache.getCacheStats();
    } catch (__error) {
      console.error("Error getting cache stats:", __error);
      return null;
    }
  },
};

