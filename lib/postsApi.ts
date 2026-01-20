import { supabase } from "./supabase";
import { supabaseOptimizer } from "./utils/supabaseOptimizer";
import { SupabaseNotificationBroadcaster } from "./supabaseNotificationManager";
import { Platform } from "react-native";

export const postsAPI = {
  uploadImage: async (file: {
    uri: string;
    name?: string;
    type: string;
    size: number;
  }) => {
    try {
      if(!supabase) throw new Error("Supabase client not initialized");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const fileExt = "jpg";
      const fileName = `post_${Date.now()}_${Math.floor(Math.random() * 1000000)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Normalize URI for Android
      let normalizedUri = file.uri;
      if (Platform.OS === "android" && !normalizedUri.startsWith("file://")) {
        normalizedUri = `file://${normalizedUri}`;
      }

      // Use FormData directly - most reliable for React Native
      const formData = new FormData();
      formData.append("file", {
        uri: normalizedUri,
        name: fileName,
        type: "image/jpeg",
      } as any);

      const { error } = await supabase.storage
        .from("posts")
        .upload(filePath, formData, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
      return { fileId: filePath, url: data.publicUrl };
    } catch (__error: any) {
      console.error('Image upload failed:', __error);
      throw __error;
    }
  },

  createPost: async (
    imageFiles: { uri: string; name?: string; type: string; size: number }[],
    caption: string,
    userId: string,
    location?: string | null,
    genre?: string | null,
    hashtags?: string[],
    taggedUsers?: string[],
    collaborators?: string[],
    onProgress?: (progress: number) => void
  ) => {
    try {
      // Upload all images in parallel for maximum speed
      const totalImages = imageFiles.length;
      let uploadedCount = 0;
      
      const uploadPromises = imageFiles.map(async (file) => {
        // Direct upload without extra auth check (userId already validated)
        const fileExt = "jpg";
        const fileName = `post_${Date.now()}_${Math.floor(Math.random() * 1000000)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        let normalizedUri = file.uri;
        if (Platform.OS === "android" && !normalizedUri.startsWith("file://")) {
          normalizedUri = `file://${normalizedUri}`;
        }

        const formData = new FormData();
        formData.append("file", {
          uri: normalizedUri,
          name: fileName,
          type: "image/jpeg",
        } as any);

        const { error } = await supabase.storage
          .from("posts")
          .upload(filePath, formData, { contentType: "image/jpeg", upsert: false });

        if (error) throw new Error(`Upload failed: ${error.message}`);

        uploadedCount++;
        if (onProgress) onProgress(Math.floor((uploadedCount / totalImages) * 80));

        const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
        return data.publicUrl;
      });
      
      const imageUrls = await Promise.all(uploadPromises);
      if (onProgress) onProgress(85);

      // Create post record
      const { data, error } = await (supabase.from("posts") as any)
        .insert({
          user_id: userId,
          image_urls: imageUrls,
          caption,
          genre: genre || null,
          hashtags: hashtags || [],
          tagged_users: taggedUsers || [],
          collaborators: collaborators || [],
          created_at: new Date().toISOString(),
          likes_count: 0,
          comments_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      if (onProgress) onProgress(100);
      
      return data;
    } catch (__error: any) {
      throw new Error(`Failed to create post: ${__error.message}`);
    }
  },

  getPosts: async (page = 1, limit = 5) => {
    try {
      const offset = (page - 1) * limit;
      const { data: posts, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles(username, avatar_url)
        `
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !posts) return [];

      return posts.map((post) => ({
        ...(post as any),
        user: (post as any).profiles || {
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
        },
      }));
    } catch (__error) {
      console.error("Error in getPosts:", __error);
      return [];
    }
  },

  getPost: async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles(username, avatar_url)
        `
        )
        .eq("id", postId)
        .single();

      if (error) throw error;
      return {
        ...(data as any),
        user: (data as any).profiles || {
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
        },
      };
    } catch (__error) {
      // Error: Error fetching posts
      throw __error;
    }
  },

  toggleLike: async (postId: string, userId: string) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .single();

      if (postError || !post) throw new Error("Post not found");

      const { data: existingLike, error: likeError } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", (user as any).id)
        .eq("post_id", postId);

      if (likeError) throw likeError;

      if (existingLike && existingLike.length > 0) {
        await supabase.from("likes").delete().eq("id", (existingLike[0] as any).id);
        return false;
      } else {
        await (supabase.from("likes") as any).insert({
          user_id: (user as any).id,
          post_id: postId,
          created_at: new Date().toISOString(),
        });

        // Create notification if liking someone else's post
        if ((post as any).user_id !== (user as any).id) {
          try {
            // Import SupabaseNotificationBroadcaster dynamically to avoid circular imports
            const { SupabaseNotificationBroadcaster } = await import('./supabaseNotificationManager');
            await SupabaseNotificationBroadcaster.broadcastLike(
              (post as any).user_id,
              (user as any).id,
              postId,
              undefined // reelId
            );
          } catch {
            // Error: Error creating like notification
            // Don't fail the like operation if notification creation fails
          }
        }

        return true;
      }
    } catch (__error: any) {
      // Error: Error toggling like
      throw new Error(`Failed to toggle like: ${__error.message}`);
    }
  },

  addComment: async (
    postId: string,
    userId: string,
    content: string,
    parentCommentId: string | null = null
  ) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("id, user_id, comments_count")
        .eq("id", postId)
        .single();

      if (postError || !post) throw new Error("Post not found");

      const { data: comment, error: commentError } = await (supabase
        .from("comments") as any)
        .insert({
          post_id: postId,
          user_id: (user as any).id,
          content,
          parent_comment_id: parentCommentId,
          created_at: new Date().toISOString(),
          replies_count: 0,
        })
        .select()
        .single();

      if (commentError) throw commentError;

      const operations: Promise<any>[] = [];

      operations.push(
        (supabase
          .from("posts") as any)
          .update({ comments_count: ((post as any).comments_count || 0) + 1 })
          .eq("id", postId)
      );

      if (parentCommentId) {
        const { data: parentComment, error: parentError } = await supabase
          .from("comments")
          .select("id, user_id, replies_count")
          .eq("id", parentCommentId)
          .single();

        if (parentError || !parentComment)
          throw new Error("Parent comment not found");

        operations.push(
          (supabase
            .from("comments") as any)
            .update({ replies_count: ((parentComment as any).replies_count || 0) + 1 })
            .eq("id", parentCommentId)
        );

        if ((parentComment as any).user_id !== (user as any).id) {
          operations.push(
            (supabase.from("notifications") as any).insert({
              recipient_id: (parentComment as any).user_id,
              sender_id: (user as any).id,
              type: "comment",
              post_id: postId,
              comment_id: (comment as any).id,
              created_at: new Date().toISOString(),
              is_read: false,
            })
          );
        }
      }

      if ((post as any).user_id !== (user as any).id) {
        operations.push(
          (supabase.from("notifications") as any).insert({
            recipient_id: (post as any).user_id, // Fixed: was receiver_id, should be recipient_id
            sender_id: (user as any).id,
            type: "comment",
            post_id: postId,
            comment_id: (comment as any).id,
            created_at: new Date().toISOString(),
            is_read: false,
          })
        );
      }

      await Promise.all(operations);

      return {
        ...(comment as any),
        user: {
          username: (user as any).username,
          avatar: (user as any).avatar_url,
        },
      };
    } catch (__error) {
      // Error: Error adding comment
      throw __error;
    }
  },

  getComments: async (postId: string) => {
    try {
      const { data: comments, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          profiles(username, avatar_url)
        `
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return comments.map((comment) => ({
        ...(comment as any),
        user: (comment as any).profiles || {
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
        },
      }));
    } catch (__error) {
      // Error: Error fetching comments
      throw __error;
    }
  },

  deleteComment: async (commentId: string, postId: string) => {
    try {
      const { data: comment, error: commentError } = await supabase
        .from("comments")
        .select("parent_comment_id")
        .eq("id", commentId)
        .single();

      if (commentError || !comment) throw new Error("Comment not found");

      await supabase.from("comments").delete().eq("id", commentId);

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("comments_count")
        .eq("id", postId)
        .single();

      if (postError || !post) throw new Error("Post not found");

      await (supabase
        .from("posts") as any)
        .update({ comments_count: Math.max(0, ((post as any).comments_count || 0) - 1) })
        .eq("id", postId);

      if ((comment as any).parent_comment_id) {
        const { data: parentComment, error: parentError } = await supabase
          .from("comments")
          .select("replies_count")
          .eq("id", (comment as any).parent_comment_id)
          .single();

        if (parentError || !parentComment)
          throw new Error("Parent comment not found");

        await (supabase
          .from("comments") as any)
          .update({
            replies_count: Math.max(0, ((parentComment as any).replies_count || 0) - 1),
          })
          .eq("id", (comment as any).parent_comment_id);
      }

      return true;
    } catch (__error: any) {
      throw new Error(`Failed to delete comment: ${__error.message}`);
    }
  },

  toggleBookmark: async (postId: string, userId: string) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const { data: existingBookmark, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", (user as any).id)
        .eq("post_id", postId);

      if (bookmarkError) throw bookmarkError;

      if (existingBookmark && existingBookmark.length > 0) {
        await supabase
          .from("bookmarks")
          .delete()
          .eq("id", (existingBookmark[0] as any).id);
        return false;
      } else {
        await (supabase.from("bookmarks") as any).insert({
          user_id: (user as any).id,
          post_id: postId,
          created_at: new Date().toISOString(),
        });
        return true;
      }
    } catch (__error: any) {
      throw new Error(`Failed to toggle bookmark: ${__error.message}`);
    }
  },

  getBookmarkedPosts: async (userId: string) => {
    try {
      // Check if user is authenticated and can only access their own bookmarks
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !currentUser) {
        throw new Error('User not authenticated');
      }

      // Only allow users to access their own bookmarks
      if (currentUser.id !== userId) {
        throw new Error('Access denied: Users can only view their own saved posts');
      }

      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const { data: bookmarks, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", (user as any).id);

      if (bookmarkError) throw bookmarkError;

      const postIds = (bookmarks as any[]).map((bookmark: any) => bookmark.post_id);
      if (postIds.length === 0) return [];

      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles(username, avatar_url)
        `
        )
        .in("id", postIds);

      if (postsError) throw postsError;

      return posts.map((post) => ({
        ...(post as any),
        user: (post as any).profiles || {
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
        },
      }));
    } catch (__error: any) {
      throw new Error(`Failed to fetch bookmarked posts: ${__error.message}`);
    }
  },

  getUserProfile: async (userId: string) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

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
      };
    } catch (__error) {
      throw new Error(`Failed to fetch user profile: ${(__error as any)?.message || 'Unknown error'}`);
    }
  },

  searchUsers: async (searchTerm: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `${searchTerm}%`)
        .order("username", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    } catch (__error) {
      console.error("Search users error:", __error);
      throw __error;
    }
  },

  getUserPosts: async (userId: string) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", (user as any).id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    } catch (__error) {
      throw new Error(`Failed to fetch user posts: ${(__error as any)?.message || 'Unknown error'}`);
    }
  },

  deletePost: async (postId: string) => {
    try {
      if(!supabase) throw new Error("Supabase client not initialized");

// console.log(`🗑️ Starting deletion process for post: ${postId}`);

      // First, get the post data including image URLs
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("image_urls, user_id")
        .eq("id", postId)
        .single();

      if (postError || !post) {
        // Error: Post not found
        throw new Error("Post not found");
      }

// console.log(`📸 Found post with ${(post as any).image_urls?.length || 0} images`);

      // Step 1: Delete associated images from storage (enhanced batch approach)
      const storageDeleteResults: {filePath: string, success: boolean, error?: string}[] = [];
      if ((post as any).image_urls && Array.isArray((post as any).image_urls) && (post as any).image_urls.length > 0) {
// console.log(`🗂️ Deleting ${(post as any).image_urls.length} images from storage...`);

        // Helper function to extract file path from Supabase URL (same as stories)
        const extractFilePath = (url: string): string | null => {
          if (!url) return null;
          try {
            // Handle different URL formats
            if (url.includes('/storage/v1/object/public/posts/')) {
              // Standard Supabase public URL format
              const parts = url.split('/storage/v1/object/public/posts/');
              return parts[1] || null;
            } else if (url.includes('/posts/')) {
              // Alternative format
              const parts = url.split('/posts/');
              return parts[1] || null;
            } else {
              // Fallback: try to get last two parts (user_id/filename.ext)
              const urlParts = url.split("/");
              if (urlParts.length >= 2) {
                return urlParts.slice(-2).join("/");
              }
            }
            return null;
          } catch (__error) {
// console.warn(`Failed to extract file path from URL: ${url}`, __error);
            return null;
          }
        };

        // Collect all valid file paths
        const filesToDelete: string[] = [];
        for (const imageUrl of (post as any).image_urls) {
          const filePath = extractFilePath(imageUrl);
          if (filePath) {
            filesToDelete.push(filePath);
// console.log(`📸 Found image file to delete: ${filePath}`);
          } else {
// console.warn(`⚠️ Could not extract file path from URL: ${imageUrl}`);
            storageDeleteResults.push({ filePath: imageUrl, success: false, error: "Invalid URL format" });
          }
        }

        // Batch delete all files at once (more efficient than individual deletions)
        if (filesToDelete.length > 0) {
          try {
// console.log(`🗑️ Batch deleting ${filesToDelete.length} storage files:`, filesToDelete);

            const { data: deletedFiles, error: storageError } = await supabase.storage
              .from("posts")
              .remove(filesToDelete);

            if (storageError) {
// console.warn("⚠️ Storage batch deletion warning:", storageError.message);
              // Mark all files as failed
              filesToDelete.forEach(filePath => {
                storageDeleteResults.push({ filePath, success: false, error: storageError.message });
              });
            } else {
// console.log(`✅ Successfully batch deleted ${deletedFiles?.length || 0} storage files`);
              // Mark all files as successful
              filesToDelete.forEach(filePath => {
                storageDeleteResults.push({ filePath, success: true });
              });
            }
          } catch (__fileError: any) {
// console.warn("⚠️ Error during batch storage deletion:", __fileError);
            // Mark all files as failed
            filesToDelete.forEach(filePath => {
              storageDeleteResults.push({ filePath, success: false, error: __fileError?.message || "Unknown error" });
            });
          }
        }
      } else {
// console.log("ℹ️ No images found to delete from storage");
      }

      // Step 2: Delete related database records (using CASCADE DELETE for efficiency)
// console.log("🗄️ Deleting related database records...");

      const deleteOperations = [
        // Delete likes (will cascade to related records)
        supabase.from("likes").delete().eq("post_id", postId),
        // Delete comments (will cascade to comment likes and replies)
        supabase.from("comments").delete().eq("post_id", postId),
        // Delete bookmarks
        supabase.from("bookmarks").delete().eq("post_id", postId),
      ];

      const deleteResults = await Promise.allSettled(deleteOperations);

      // Log results of related record deletions
      const operationNames = ["likes", "comments", "bookmarks"];
      deleteResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
// console.log(`✅ Successfully deleted ${operationNames[index]} for post ${postId}`);
        } else {
// console.warn(`⚠️ Failed to delete ${operationNames[index]} for post ${postId}:`, result.reason);
        }
      });

      // Step 3: Finally, delete the post record itself
// console.log("📝 Deleting post record...");
      const { error: postDeleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (postDeleteError) {
        // Error: Failed to delete post record
        throw new Error(`Failed to delete post record: ${postDeleteError.message}`);
      }

// console.log("✅ Post deletion completed successfully");

      // Return detailed results
      return {
        success: true,
        postId,
        storageResults: storageDeleteResults,
        message: "Post and associated data deleted successfully"
      };

    } catch (__error: any) {
      // Error in deletePost
      throw new Error(`Failed to delete post: ${__error.message || "Unknown error"}`);
    }
  },

  toggleFollow: async (targetUserId: string, currentUserId: string) => {
    try {
      const { data: currentUser, error: currentUserError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUserId) // profiles.id = auth.users.id
        .single();

      if (currentUserError || !currentUser)
        throw new Error("Current user not found");

      const { data: targetUser, error: targetUserError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", targetUserId) // profiles.id = auth.users.id
        .single();

      if (targetUserError || !targetUser)
        throw new Error("Target user not found");

      const { data: existingFollow, error: followError } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", (currentUser as any).id)
        .eq("following_id", (targetUser as any).id);

      if (followError) throw followError;

      if (existingFollow && existingFollow.length > 0) {
        await supabase.from("follows").delete().eq("id", (existingFollow[0] as any).id);
        return false;
      } else {
        await (supabase.from("follows") as any).insert({
          follower_id: (currentUser as any).id,
          following_id: (targetUser as any).id,
          created_at: new Date().toISOString(),
        });

        // Create and broadcast follow notification
        await SupabaseNotificationBroadcaster.broadcastFollow(
          (targetUser as any).id, // recipient (user being followed)
          (currentUser as any).id // sender (current user doing the following)
        );

        return true;
      }
    } catch (__error) {
      // Error: Toggle follow error
      throw __error;
    }
  },

  checkFollowing: async (targetUserId: string, currentUserId: string) => {
    try {
      const { data: currentUser, error: currentUserError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUserId) // profiles.id = auth.users.id
        .single();

      if (currentUserError || !currentUser)
        throw new Error("Current user not found");

      const { data: targetUser, error: targetUserError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", targetUserId) // profiles.id = auth.users.id
        .single();

      if (targetUserError || !targetUser)
        throw new Error("Target user not found");

      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", (currentUser as any).id)
        .eq("following_id", (targetUser as any).id);

      if (error) throw error;
      return data && data.length > 0;
    } catch (__error) {
      // Error: Check following error
      throw __error;
    }
  },

  updateUserProfile: async (userId: string, data: Partial<any>) => {
    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId) // profiles.id = auth.users.id
        .single();

      if (userError || !user) throw new Error("User not found");

      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      Object.keys(updateData).forEach(
        (key) => (updateData as any)[key] === undefined && delete (updateData as any)[key]
      );

      const { data: updatedUser, error } = await (supabase
        .from("profiles") as any)
        .update(updateData)
        .eq("id", (user as any).id)
        .select()
        .single();

      if (error) throw error;
      return updatedUser;
    } catch (__error) {
      // Error: Update error
      throw new Error(
        `Failed to update profile: ${(__error as any)?.message || "Unknown error"}`
      );
    }
  },

  getExplorePosts: async () => {
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles:profiles!posts_user_id_fkey (username, avatar_url)
        `
        )
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const combinedPosts = posts.map((post) => ({
        ...(post as any),
        type: "image",
        user: (post as any).profiles || {
          username: "Unknown User",
          avatar: "https://via.placeholder.com/150",
        },
      }));

      return combinedPosts.sort(() => Math.random() - 0.5);
    } catch (__error) {
      // Error: Error fetching explore posts
      throw __error;
    }
  },

  getPostLikes: async (postId: string, limit: number = 50) => {
    try {
      const { data, error } = await supabase.rpc("get_post_likes", {
        post_id_param: postId,
        limit_param: limit,
      } as any);

      if (error) throw error;
      return data || [];
    } catch (__error: any) {
      // Error: Error fetching post likes
      throw new Error(`Failed to fetch post likes: ${__error.message}`);
    }
  },
};
