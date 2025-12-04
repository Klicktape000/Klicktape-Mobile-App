import { supabase } from "./supabase";
import { SupabaseNotificationBroadcaster } from "./supabaseNotificationManager";
import { Database } from "../types/supabase";
import { profileCache } from "./utils/profileCache";

interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  account_type?: string;
  gender?: string;
}

export const usersApi = {
  getUserProfile: async (userId: string): Promise<UserProfile> => {
    try {
      // OPTIMIZED: Check cache first
      const cachedProfile = profileCache.get(userId);
      if (cachedProfile) {
        // Return from cache with additional data fetched separately
        const [{ count: followersCount }, { count: followingCount }] =
          await Promise.all([
            supabase
              .from("follows")
              .select("*", { count: "exact", head: true })
              .eq("following_id", userId),
            supabase
              .from("follows")
              .select("*", { count: "exact", head: true })
              .eq("follower_id", userId),
          ]);

        return {
          id: cachedProfile.id,
          username: cachedProfile.username || "Unknown User",
          avatar: cachedProfile.avatar_url || "https://via.placeholder.com/150",
          bio: cachedProfile.bio || "",
          followersCount: followersCount || 0,
          followingCount: followingCount || 0,
          postsCount: 0, // Will be fetched separately if needed
          isFollowing: false,
          account_type: cachedProfile.account_type,
          gender: cachedProfile.gender,
        };
      }

      // OPTIMIZED: Increased timeout for profiles query
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, account_type, gender, bio")
        .eq("id", userId)
        .abortSignal(AbortSignal.timeout(30000)) // 30 second timeout
        .single();

      if (userError || !user) {
        return {
          id: userId,
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
          bio: "",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isFollowing: false,
        };
      }

      // Cache the profile data
      profileCache.set(userId, user as any);

      const [{ count: followersCount }, { count: followingCount }] =
        await Promise.all([
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", (user as any).id),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", (user as any).id),
        ]);

      return {
        ...(user as any),
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        postsCount: 0,
        isFollowing: false,
      } as UserProfile;
    } catch (__error: any) {
      // Use enhanced network error handling
      const { handleNetworkError, isNetworkError } = await import('./utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
        handleNetworkError(__error, { 
          context: 'Fetching user profile', 
          showUserAlert: true 
        });
      } else {
        console.error("Error fetching user profile:", __error);
      }
      throw new Error(`Failed to fetch user profile: ${__error.message}`);
    }
  },

  checkFollowing: async (targetUserId: string, currentUserId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);

      if (error) throw error;
      return data && data.length > 0;
    } catch (__error: any) {
      throw new Error(`Failed to check following: ${__error.message}`);
    }
  },

  /**
   * OPTIMIZED: Batch check following status for multiple users
   * Replaces N individual queries with 1 batch query
   */
  checkFollowingBatch: async (targetUserIds: string[], currentUserId: string): Promise<Record<string, boolean>> => {
    try {
      if (!targetUserIds || targetUserIds.length === 0) {
        return {};
      }

      // Single query to check all following relationships at once
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", targetUserIds);

      if (error) throw error;

      // Create a map of userId -> isFollowing
      const followingMap: Record<string, boolean> = {};

      // Initialize all users as not following
      targetUserIds.forEach(userId => {
        followingMap[userId] = false;
      });

      // Mark users that are being followed
      if (data) {
        data.forEach((follow: any) => {
          followingMap[follow.following_id] = true;
        });
      }

      return followingMap;
    } catch (__error: any) {
      throw new Error(`Failed to batch check following: ${__error.message}`);
    }
  },

  toggleFollow: async (targetUserId: string, currentUserId: string): Promise<boolean> => {
    console.log('⚡ OPTIMIZED toggleFollow - Using lightning_toggle_follow RPC');
    
    try {
      const startTime = Date.now();
      
      // Use fast RPC function instead of slow manual queries
      const { data: result, error } = await supabase.rpc('lightning_toggle_follow', {
        p_follower_id: currentUserId,
        p_following_id: targetUserId,
      } as any);

      const duration = Date.now() - startTime;
      console.log(`⚡ lightning_toggle_follow completed in ${duration}ms`);

      if (error) {
        console.error('❌ RPC error:', error);
        throw new Error(`Failed to toggle follow: ${error.message}`);
      }

      console.log('✅ Follow toggled successfully:', result);
      return result;
    } catch (__error: any) {
      console.error('❌ toggleFollow error:', __error);
      
      // Provide more specific error messages
      if (__error.message?.includes('JWT')) {
        throw new Error('Authentication expired. Please log in again.');
      }
      if (__error.message?.includes('network') || __error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      if (__error.message?.includes('permission') || __error.message?.includes('policy')) {
        throw new Error('Permission denied. Please log in again.');
      }
      
      throw __error;
    }
  },

  // Legacy method - keeping for backward compatibility but replacing implementation
  toggleFollowLegacy: async (targetUserId: string, currentUserId: string): Promise<boolean> => {
    try {
      const { data: existingFollow, error: followError } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);

      if (followError) throw followError;

      if (existingFollow && existingFollow.length > 0) {
        await supabase.from("follows").delete().eq("id", (existingFollow[0] as any).id);
        return false;
      } else {
        await (supabase.from("follows") as any).insert({
          follower_id: currentUserId,
          following_id: targetUserId,
          created_at: new Date().toISOString(),
        });

        // Create and broadcast follow notification
        await SupabaseNotificationBroadcaster.broadcastFollow(
          targetUserId, // recipient (user being followed)
          currentUserId // sender (current user doing the following)
        );

        return true;
      }
    } catch (__error: any) {
      throw new Error(`Failed to toggle follow: ${__error.message}`);
    }
  },

  getUserPosts: async (userId: string): Promise<{id: string, image_urls: string[], created_at: string}[]> => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, image_urls, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    } catch (__error: any) {
      throw new Error(`Failed to fetch user posts: ${__error.message}`);
    }
  },

  getUserReels: async (userId: string): Promise<{id: string, video_url: string, created_at: string}[]> => {
    try {
      const { data, error } = await supabase
        .from("reels")
        .select("id, video_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    } catch (__error: any) {
      throw new Error(`Failed to fetch user reels: ${__error.message}`);
    }
  },

  /**
   * OPTIMIZED: Get followers with direct query instead of RPC
   */
  getFollowers: async (userId: string, limit: number = 50): Promise<{follower_id: string, username: string, avatar_url: string | null, created_at: string}[]> => {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          follower_id,
          created_at,
          profiles!follows_follower_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((follow: any) => ({
        follower_id: follow.follower_id,
        username: follow.profiles?.username || 'Unknown',
        avatar_url: follow.profiles?.avatar_url || null,
        created_at: follow.created_at,
      }));
    } catch (__error: any) {
      console.error('Error fetching followers:', __error);
      throw new Error(`Failed to fetch followers: ${__error.message}`);
    }
  },

  /**
   * OPTIMIZED: Get following with direct query instead of RPC
   */
  getFollowing: async (userId: string, limit: number = 50): Promise<{following_id: string, username: string, avatar_url: string | null, created_at: string}[]> => {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          created_at,
          profiles!follows_following_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((follow: any) => ({
        following_id: follow.following_id,
        username: follow.profiles?.username || 'Unknown',
        avatar_url: follow.profiles?.avatar_url || null,
        created_at: follow.created_at,
      }));
    } catch (__error: any) {
      console.error('Error fetching following:', __error);
      throw new Error(`Failed to fetch following: ${__error.message}`);
    }
  },
};

