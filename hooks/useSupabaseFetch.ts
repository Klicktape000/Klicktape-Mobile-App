import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Constants for profile check retries
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const useSupabaseFetch = () => {
  const [loading, setLoading] = useState(false);
  const checkProfile = async (
    email: string,
    userId?: string,
    retryCount = 0
  ): Promise<boolean> => {
    if (retryCount === 0) setLoading(true);
    try {
      // First try by email
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("username")
        .eq("email", email)
        .single();

      // If found by email and has username, return true
      if ((profileByEmail as any)?.username && (profileByEmail as any).username.trim() !== "") {
// console.log("Profile found by email:", email);
        if (retryCount === 0) setLoading(false);
        return true;
      }

      // If userId is provided, also try by ID
      if (userId) {
        const { data: profileById } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .single();

        // If found by ID and has username, return true
        if ((profileById as any)?.username && (profileById as any).username.trim() !== "") {
// console.log("Profile found by ID:", userId);
          if (retryCount === 0) setLoading(false);
          return true;
        }
      }

      // No valid profile found
      if (retryCount === 0) setLoading(false);
      return false;
    } catch (error) {
      console.error("Error checking profile:", error);
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return checkProfile(email, userId, retryCount + 1);
      }
      if (retryCount === 0) setLoading(false);
      return false;
    }
  };

  const fetchUserProfile = async (userId: string): Promise<any> => {
    setLoading(true);
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, username, name, avatar_url, account_type, gender, bio, current_tier")
        .eq("id", userId)
        .single();

      if (userError || !user) throw new Error("User not found");

      const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", (user as any).id),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", (user as any).id),
      ]);

      const result = {
        ...(user as any),
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
      };
      
      setLoading(false);
      return result;
    } catch (error: any) {
      setLoading(false);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }
  };

  const fetchPosts = async (userId: string): Promise<any[]> => {
    setLoading(true);
    try {
      const { data: userPosts, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoading(false);
      return userPosts || [];
    } catch (error) {
      console.error("Error fetching posts:", error);
      setLoading(false);
      return [];
    }
  };

  const fetchBookmarks = async (userId: string): Promise<any[]> => {
    setLoading(true);
    try {
      // Check if user is authenticated and can only access their own bookmarks
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
// console.log("User not authenticated, cannot access bookmarks");
        setLoading(false);
        return [];
      }

      // Only allow users to access their own bookmarks
      if (user.id !== userId) {
// console.log("Access denied: Users can only view their own saved posts");
        setLoading(false);
        return [];
      }

      const { data: bookmarkedPosts, error } = await supabase
        .from("bookmarks")
        .select("post:posts(*)")
        .eq("user_id", userId);

      if (error) throw error;
      const result = (bookmarkedPosts as any)?.map((bookmark: any) => bookmark.post) || [];
      setLoading(false);
      return result;
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      setLoading(false);
      return [];
    }
  };

  const fetchReels = async (userId: string): Promise<any[]> => {
    setLoading(true);
    try {
      const { data: userReels, error } = await supabase
        .from("reels")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoading(false);
      return userReels || [];
    } catch (error) {
      console.error("Error fetching reels:", error);
      setLoading(false);
      return [];
    }
  };

  return {
    checkProfile,
    fetchUserProfile,
    fetchPosts,
    fetchBookmarks,
    fetchReels,
    loading
  };
};