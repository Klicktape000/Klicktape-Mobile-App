import { supabase } from "./supabase";
import { Reel } from "@/types/type";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  parent_comment_id: string | null;
  created_at: string;
  likes_count: number;
  replies_count?: number;
  user: {
    username: string;
    avatar: string;
  };
  replies?: Comment[];
}

export const reelsAPI = {
  getReels: async (limit: number = 10, offset: number = 0, likedReelIds: string[] = []) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (authError.message?.includes('Auth session missing')) {
          throw new Error("User not authenticated - no session");
        } else {
          throw new Error(`Auth error: ${authError.message}`);
        }
      }
      if (!user) throw new Error("User not authenticated");

      // First, get the user's liked reels
      const { data: likedReels } = await supabase
        .from('reel_likes')
        .select('reel_id')
        .eq('user_id', user.id);

      const userLikedReelIds = (likedReels as any)?.map((like: any) => like.reel_id) || [];

      // Then fetch the reels with profiles instead of users
      const { data, error: reelsError } = await supabase
        .from("reels")
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (reelsError) throw new Error(`Failed to fetch reels: ${reelsError.message}`);

      const reels = (data || []).map((reel: any) => ({
        ...reel,
        is_liked: userLikedReelIds.includes(reel.id),
        user: {
          ...reel.user,
          avatar: reel.user?.avatar_url || "https://via.placeholder.com/150"
        }
      })) as Reel[];

      const invalidReels = reels.filter((reel) => !reel.id || typeof reel.id !== "string");
      if (invalidReels.length > 0) {
// console.warn("Invalid reels in getReels:", invalidReels);
      }

      return reels;
    } catch (__error: any) {
      // Use enhanced network error handling
      const { handleNetworkError, isNetworkError } = await import('./utils/networkErrorHandler');
      
      if (isNetworkError(__error)) {
        handleNetworkError(__error, { 
          context: 'Fetching reels', 
          showUserAlert: true 
        });
      } else {
        // getReels error
      }
      throw new Error(`Failed to fetch reels: ${__error.message}`);
    }
  },

  toggleReelLike: async (reelId: string, isLiked: boolean) => {
    try {
      if (!reelId || typeof reelId !== "string" || reelId === "undefined") {
        // Invalid reelId
        throw new Error("Invalid reel ID");
      }
// console.log("toggleReelLike:", { reelId, isLiked });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (authError.message?.includes('Auth session missing')) {
          throw new Error("User not authenticated - no session");
        } else {
          throw new Error(`Auth error: ${authError.message}`);
        }
      }
      if (!user) throw new Error("User not authenticated");

      // Call the RPC function to toggle the like
      const { data, error } = await supabase
        .rpc("toggle_reel_like", {
          p_reel_id: reelId,
          p_user_id: user.id,
          p_is_liked: isLiked,
        } as any);

      if (error) {
        // Error calling toggle_reel_like
        throw new Error(`Failed to toggle like: ${error.message}`);
      }

      if (!data || !Array.isArray(data) || (data as any).length === 0) {
        // No data returned from toggle_reel_like
        throw new Error("Failed to toggle like: No data returned");
      }

// console.log("toggle_reel_like result:", data);

      // Return the updated state from the database (RPC returns array)
      const result = data[0] as any;
      return {
        is_liked: result.is_liked,
        likes_count: result.likes_count
      };
    } catch (__error: any) {
      // toggleReelLike error
      throw new Error(`Failed to toggle like: ${__error.message}`);
    }
  },

  getComments: async (entityType: "post" | "reel", entityId: string) => {
    try {
      const table = entityType === "reel" ? "reel_comments" : "comments";
      const cacheKey = `${entityType}_comments_${entityId}`;

      const { data, error } = await supabase
        .from(table)
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .eq(`${entityType}_id`, entityId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to fetch ${entityType} comments: ${error.message}`);

      const commentsWithDefaultAvatar = (data || []).map((comment: any) => ({
        ...comment,
        user: {
          username: comment.user?.username || "Unknown",
          avatar: comment.user?.avatar_url || "https://via.placeholder.com/40",
        },
      }));

      const nestedComments = nestComments(commentsWithDefaultAvatar);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(nestedComments));
      return nestedComments;
    } catch (__error: any) {
      // getComments error
      throw new Error(`Failed to fetch ${entityType} comments: ${__error.message}`);
    }
  },

  addComment: async ({
    entityType,
    entityId,
    content,
    parentCommentId,
    userId,
    user,
  }: {
    entityType: "post" | "reel";
    entityId: string;
    content: string;
    parentCommentId: string | null;
    userId: string;
    user: { username: string; avatar: string };
  }) => {
    try {
      const table = entityType === "reel" ? "reel_comments" : "comments";
      const entityTable = entityType === "reel" ? "reels" : "posts";
      const cacheKey = `${entityType}_comments_${entityId}`;

      const { data: newCommentData, error: insertError } = await supabase
        .from(table as any)
        .insert({
          [`${entityType}_id`]: entityId,
          user_id: userId,
          content,
          parent_comment_id: parentCommentId,
          created_at: new Date().toISOString(),
          likes_count: 0,
          replies_count: 0,
        } as any)
        .select()
        .single();

      if (insertError) throw new Error(`Failed to insert ${entityType} comment: ${insertError.message}`);

      // Create notification for the post/reel owner
      const { data: entity, error: entityError } = await supabase
        .from(entityTable)
        .select("user_id, comments_count")
        .eq("id", entityId)
        .single();

      if (entityError || !entity) throw new Error(`${entityType} not found`);

      // Note: Notification creation is handled by the Comments component
      // to avoid duplicate notifications

      await (supabase
        .from(entityTable as any) as any)
        .update({ comments_count: ((entity as any).comments_count || 0) + 1 })
        .eq("id", entityId);

      if (parentCommentId) {
        const { data: parentComment, error: parentError } = await supabase
          .from(table as any)
          .select("replies_count")
          .eq("id", parentCommentId)
          .single();

        if (parentError || !parentComment) throw new Error("Parent comment not found");

        await (supabase
          .from(table as any) as any)
          .update({ replies_count: ((parentComment as any).replies_count || 0) + 1 })
          .eq("id", parentCommentId);
      }

      const newComment: Comment = {
        ...(newCommentData as any),
        user,
        replies: [],
      };

      const cachedComments = await AsyncStorage.getItem(cacheKey);
      let updatedComments: Comment[] = cachedComments ? JSON.parse(cachedComments) : [];
      if (parentCommentId) {
        updatedComments = updatedComments.map((comment) =>
          comment.id === parentCommentId
            ? {
                ...comment,
                replies: [...(comment.replies || []), newComment],
                replies_count: (comment.replies_count || 0) + 1,
              }
            : comment
        );
      } else {
        updatedComments.push(newComment);
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedComments));

      return newComment;
    } catch (__error: any) {
      // addComment error
      throw new Error(`Failed to add ${entityType} comment: ${__error.message}`);
    }
  },

  deleteComment: async ({
    entityType,
    entityId,
    commentId,
    parentCommentId,
    userId,
  }: {
    entityType: "post" | "reel";
    entityId: string;
    commentId: string;
    parentCommentId: string | null;
    userId: string;
  }) => {
    try {
      const table = entityType === "reel" ? "reel_comments" : "comments";
      const entityTable = entityType === "reel" ? "reels" : "posts";
      const cacheKey = `${entityType}_comments_${entityId}`;

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", commentId)
        .eq("user_id", userId);

      if (deleteError) throw new Error(`Failed to delete ${entityType} comment: ${deleteError.message}`);

      const { data: entity, error: entityError } = await supabase
        .from(entityTable)
        .select("comments_count")
        .eq("id", entityId)
        .single();

      if (entityError || !entity) throw new Error(`${entityType} not found`);

      await (supabase
        .from(entityTable as any) as any)
        .update({ comments_count: Math.max(0, ((entity as any).comments_count || 0) - 1) })
        .eq("id", entityId);

      if (parentCommentId) {
        const { data: parentComment, error: parentError } = await supabase
          .from(table as any)
          .select("replies_count")
          .eq("id", parentCommentId)
          .single();

        if (parentError || !parentComment) throw new Error("Parent comment not found");

        await (supabase
          .from(table as any) as any)
          .update({ replies_count: Math.max(0, ((parentComment as any).replies_count || 0) - 1) })
          .eq("id", parentCommentId);
      }

      const cachedComments = await AsyncStorage.getItem(cacheKey);
      let updatedComments: Comment[] = cachedComments ? JSON.parse(cachedComments) : [];
      if (parentCommentId) {
        updatedComments = updatedComments.map((comment) =>
          comment.id === parentCommentId
            ? {
                ...comment,
                replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
                replies_count: Math.max(0, (comment.replies_count || 0) - 1),
              }
            : comment
        );
      } else {
        updatedComments = updatedComments.filter((comment) => comment.id !== commentId);
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedComments));
    } catch (__error: any) {
      // deleteComment error
      throw new Error(`Failed to delete ${entityType} comment: ${__error.message}`);
    }
  },

  toggleCommentLike: async (
    entityType: "post" | "reel",
    commentId: string,
    isLiked: boolean,
    userId: string
  ) => {
    try {
      if (!commentId || typeof commentId !== "string" || commentId === "undefined") {
        // Invalid commentId
        throw new Error("Invalid comment ID");
      }

      const table = entityType === "reel" ? "reel_comments" : "comments";
      const likeTable = entityType === "reel" ? "reel_comment_likes" : "comment_likes";

      const { data, error } = await supabase.rpc(
        "toggle_comment_like" as any,
        {
          p_comment_id: commentId,
          p_user_id: userId,
          p_is_liked: isLiked,
        } as any
      );

      if (error) {
        // Error calling toggle_comment_like
        throw new Error(`Failed to toggle comment like: ${error.message}`);
      }

      if (!data || !Array.isArray(data) || (data as any).length === 0) {
        // No data returned from toggle_comment_like
        throw new Error(`Failed to toggle comment like: No data returned`);
      }

// console.log(`toggle_comment_like result:`, data);
      const result = data[0] as any;
      return { is_liked: result.is_liked, likes_count: result.likes_count };
    } catch (__error: any) {
      // toggleCommentLike error
      throw new Error(`Failed to toggle ${entityType} comment like: ${__error.message}`);
    }
  },

  uploadFile: async (file: { uri: string; name: string; type: string }) => {
    try {
      let normalizedUri = file.uri;
      if (Platform.OS === 'android' && !file.uri.startsWith('file://')) {
        normalizedUri = `file://${file.uri}`;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: normalizedUri,
        name: file.name,
        type: file.type,
      } as any);

      // Get current user ID for folder structure
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (authError.message?.includes('Auth session missing')) {
          throw new Error("User not authenticated - no session");
        } else {
          throw new Error(`Auth error: ${authError.message}`);
        }
      }
      if (!user) {
        throw new Error("User not authenticated");
      }

      const filePath = `${user.id}/${file.name}`;

      const { data, error } = await supabase.storage
        .from('reels')
        .upload(filePath, formData, {
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        // Storage upload error
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (__error: any) {
      // uploadFile error
      throw new Error(`File upload failed: ${__error.message}`);
    }
  },

  createReel: async (videoUrl: string, caption: string, music: string, thumbnailUrl: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("reels")
        .insert({
          video_url: videoUrl,
          caption,
          music,
          thumbnail_url: thumbnailUrl,
          user_id: userId,
          created_at: new Date().toISOString(),
          comments_count: 0,
          likes_count: 0,
        } as any)
        .select()
        .single();

      if (error) {
        // Error creating reel
        throw new Error(`Failed to create reel: ${error.message}`);
      }

      return data;
    } catch (__error: any) {
      // createReel error
      throw new Error(`Failed to create reel: ${__error.message}`);
    }
  },

  getReelLikes: async (reelId: string, limit: number = 50) => {
    try {
      const { data, error } = await supabase.rpc("get_reel_likes" as any, {
        reel_id_param: reelId,
        limit_param: limit,
      } as any);

      if (error) throw error;
      return data || [];
    } catch (__error: any) {
      // Error fetching reel likes
      throw new Error(`Failed to fetch reel likes: ${__error.message}`);
    }
  },
};

const nestComments = (comments: Comment[]): Comment[] => {
  const commentMap: { [key: string]: Comment } = {};
  const nested: Comment[] = [];

  comments.forEach((comment) => {
    comment.replies = [];
    commentMap[comment.id] = comment;
  });

  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const parent = commentMap[comment.parent_comment_id];
      if (parent) {
        parent.replies!.push(comment);
      }
    } else {
      nested.push(comment);
    }
  });

  return nested;
};
