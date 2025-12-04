import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import Modal from "react-native-modal";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/context/ThemeContext";
import CachedImage from "@/components/CachedImage";
import CommentsSkeleton from "@/components/skeletons/CommentsSkeleton";
import { SupabaseNotificationBroadcaster } from "@/lib/supabaseNotificationManager";
import { useRouter } from "expo-router";
import CommentEditModal from "@/components/CommentEditModal";
import CommentPinButton from "@/components/CommentPinButton";
import PinnedCommentIndicator from "@/components/PinnedCommentIndicator";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  parent_comment_id: string | null;
  parent_id?: string | null; // Alternative field name used in some queries
  created_at: string;
  updated_at?: string;
  likes_count: number;
  replies_count?: number;
  user: {
    id?: string;
    username: string;
    full_name?: string;
    avatar?: string;
    avatar_url?: string;
  } | null;
  replies?: Comment[];
  mentions?: { user_id: string; username: string }[];
  // New fields for editing and pinning
  edited_at?: string;
  is_edited?: boolean;
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
}

interface CommentsModalProps {
  entityType: "post" | "reel";
  entityId: string;
  onClose: () => void;
  entityOwnerUsername?: string;
  entityOwnerId?: string;
  visible: boolean;
}

const CommentsModal: React.FC<CommentsModalProps> = React.memo(
  function CommentsModal({ entityType, entityId, onClose, entityOwnerUsername, entityOwnerId, visible }) {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Memoize colors to prevent unnecessary re-renders
    const memoizedColors = useMemo(() => colors, [colors.text, colors.background, colors.primary]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [mentionedUsers, setMentionedUsers] = useState<
      { id: string; username: string }[]
    >([]);
    const [showMentionsList, setShowMentionsList] = useState(false);
    const [filteredUsers, setFilteredUsers] = useState<
      { id: string; username: string }[]
    >([]);
    // Add like status tracking
    const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
    const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());
    // Add expanded replies tracking
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
    // Add edit modal state
    const [editingComment, setEditingComment] = useState<Comment | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    // Add entity owner ID state
    const [resolvedEntityOwnerId, setResolvedEntityOwnerId] = useState<string>("");
    const mentionInputRef = useRef<TextInput>(null);
    const mentionStartIndex = useRef<number>(-1);
    const subscriptionRef = useRef<any>(null);
    const cacheTimestamp = useRef<number>(0);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cacheKey = `${entityType}_comments_${entityId}`;
    const table = entityType === "reel" ? "reel_comments" : "comments";
    const entityTable = entityType === "reel" ? "reels" : "posts";
    const likeTable =
      entityType === "reel" ? "reel_comment_likes" : "comment_likes";

    useEffect(() => {
      if (visible && mentionInputRef.current) {
        mentionInputRef.current.focus();
      }
      const getUserFromStorage = async () => {
        try {
          //// console.log(`👤 Loading user data...`);
          const userData = await AsyncStorage.getItem("user");
          if (userData) {
            const parsedUser = JSON.parse(userData);
            //// console.log(`👤 Found user in storage:`, parsedUser.id);

            if (!supabase) {
              // console.error("❌ Supabase not available for user loading");
              // Set a basic user object so comments can still load
              setUser({
                ...parsedUser,
                username: parsedUser.username || "Unknown",
                avatar: "https://via.placeholder.com/40",
              });
              return;
            }

            let { data: userFromDB, error } = await supabase
              .from("profiles")
              .select("id, username, avatar_url")
              .eq("id", parsedUser.id)
              .single();

            if (error || !userFromDB) {
              //// console.log(`👤 User not found in DB, creating profile...`);
              const username = `user_${Math.random()
                .toString(36)
                .substring(2, 10)}`;
              const { data: newProfile, error: insertError } = await (supabase
                .from("profiles") as any)
                .insert({
                  id: parsedUser.id,
                  username,
                  avatar_url: "",
                })
                .select()
                .single();

              if (insertError || !newProfile) {
                // console.error("❌ Failed to create user profile:", insertError?.message);
                // Set a fallback user so comments can still load
                setUser({
                  ...parsedUser,
                  username: username,
                  avatar: "https://via.placeholder.com/40",
                });
                return;
              }
              userFromDB = newProfile;
            }

            const updatedUser = {
              ...parsedUser,
              username: (userFromDB as any)?.username || "Unknown",
              avatar: (userFromDB as any)?.avatar_url || "https://via.placeholder.com/40",
            };
            //// console.log(`✅ User loaded successfully:`, {
// //   username: updatedUser.username,
// //   avatar: updatedUser.avatar,
// //   hasAvatar: !!updatedUser.avatar
// // });
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
          } else {
            //// console.log(`👤 No user data found in storage`);
          }
        } catch (__error) {
          // console.error("❌ Error getting user from storage:", error);
          // Don't let user loading errors block the component
        }
      };

      getUserFromStorage();
    }, [visible]);

    // Define fetchLikeStatus before it's used in useEffect
    const fetchLikeStatus = useCallback(async (commentsToCheck: Comment[]) => {
      if (!user?.id || !commentsToCheck.length) return;

      try {
        const commentIds = commentsToCheck.map(c => c.id);
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds);

        if (likes) {
          const likedIds = new Set(likes.map((like: { comment_id: string }) => like.comment_id));
          setLikedComments(likedIds);
        }
      } catch (__error) {
        // console.error("Error fetching like status:", error);
      }
    }, [user?.id]);

    // Define nestComments before it's used in fetchComments
    const nestComments = useCallback((comments: Comment[]): Comment[] => {
      if (!comments || comments.length === 0) return [];

      const commentMap: { [key: string]: Comment } = {};
      const nested: Comment[] = [];

      // First pass: create map and initialize replies
      for (const comment of comments) {
        comment.replies = [];
        commentMap[comment.id] = comment;
      }

      // Second pass: build hierarchy
      for (const comment of comments) {
        if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
          commentMap[comment.parent_comment_id].replies!.push(comment);
        } else if (!comment.parent_comment_id) {
          nested.push(comment);
        }
      }

      return nested;
    }, []);

    // Define fetchComments before it's used in setupSubscription
    const fetchComments = useCallback(async (useCache = true) => {
      try {
        // Check cache first if requested and not too old (5 minutes)
        if (useCache && Date.now() - cacheTimestamp.current < 300000) {
          const cachedComments = await AsyncStorage.getItem(cacheKey);
          if (cachedComments) {
            try {
              const parsed = JSON.parse(cachedComments);
              const comments = parsed.comments || parsed;
              setComments(comments);
              // Note: Like status will be fetched separately when user is loaded
              return;
            } catch {
              console.error("Error parsing cached comments");
              // Clear corrupted cache
              await AsyncStorage.removeItem(cacheKey);
              await AsyncStorage.removeItem(`${cacheKey}_timestamp`);
            }
          }
        }

        //// console.log(`🔍 Fetching ${entityType} comments from database...`);
        // Use the correct foreign key constraint name based on the table
        const foreignKeyName = table === "reel_comments"
          ? "reel_comments_user_id_fkey"
          : "comments_user_id_fkey";

        const { data: commentsData, error } = await supabase
          .from(table)
          .select(`
            id,
            content,
            user_id,
            parent_id,
            created_at,
            updated_at,
            likes_count,
            edited_at,
            is_edited,
            is_pinned,
            pinned_at,
            pinned_by,
            profiles!${foreignKeyName} (
              id,
              username,
              full_name,
              avatar,
              avatar_url
            )
          `)
          .eq(`${entityType}_id`, entityId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error fetching comments:", error);
          return;
        }

        if (commentsData) {
          // Transform the data to match our Comment interface
          const transformedComments: Comment[] = commentsData.map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            user_id: comment.user_id,
            parent_comment_id: comment.parent_id,
            parent_id: comment.parent_id, // Keep both for compatibility
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            likes_count: comment.likes_count || 0, // Initialize to 0 if null
            edited_at: comment.edited_at,
            is_edited: comment.is_edited,
            is_pinned: comment.is_pinned,
            pinned_at: comment.pinned_at,
            pinned_by: comment.pinned_by,
            user: comment.profiles ? {
              id: comment.profiles.id,
              username: comment.profiles.username,
              full_name: comment.profiles.full_name,
              avatar: comment.profiles.avatar,
              avatar_url: comment.profiles.avatar_url,
            } : null,
            replies: [],
            mentions: [],
          }));

          const nestedComments = nestComments(transformedComments);
          setComments(nestedComments);

          // Cache the comments
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(nestedComments));
            await AsyncStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
            cacheTimestamp.current = Date.now();
          } catch (__cacheError) {
            console.error("Error caching comments:", __cacheError);
          }
        }
      } catch (__error) {
        console.error("Error in fetchComments:", __error);
      } finally {
        setLoading(false);
      }
    }, [entityId, entityType, table, cacheKey, nestComments]);

    // Define setupSubscription after fetchComments is defined
    const setupSubscription = useCallback(() => {
      if (!supabase) {
        // console.error("Supabase client not available for subscription");
        return;
      }

      subscriptionRef.current = supabase
        .channel(`${table}:${entityId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `${entityType}_id=eq.${entityId}`,
          },
          async () => {
            await fetchComments();
          }
        )
        .subscribe();
    }, [entityId, entityType, table, fetchComments]);

    // Fetch like status when both user and comments are available
    useEffect(() => {
      if (user?.id && comments.length > 0 && visible) {
        //// console.log(`💖 User loaded, fetching like status for ${comments.length} comments`);
        fetchLikeStatus(comments);
      }
    }, [user?.id, comments.length, visible, fetchLikeStatus]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (entityId && visible) {
        const loadComments = async () => {
          setLoading(true);
          //// console.log(`🚀 Starting to load comments for ${entityType} ${entityId}`);

          try {
            // Load cached timestamp
            const cachedTimestamp = await AsyncStorage.getItem(`${cacheKey}_timestamp`);
            if (cachedTimestamp) {
              cacheTimestamp.current = parseInt(cachedTimestamp);
            }

            const cachedComments = await AsyncStorage.getItem(cacheKey);
            if (cachedComments) {
              try {
                const parsed = JSON.parse(cachedComments);
                // Handle both old and new cache formats
                const comments = parsed.comments || parsed;
                //// console.log(`📦 Loaded ${comments.length} comments from cache`);
                setComments(comments);
                // Note: Like status will be fetched separately when user is loaded
              } catch (__error) {
                console.error("Error parsing cached comments:", __error);
                // Clear corrupted cache
                await AsyncStorage.removeItem(cacheKey);
                await AsyncStorage.removeItem(`${cacheKey}_timestamp`);
              }
            }

            //// console.log(`🔄 Fetching fresh comments from database`);
            await fetchComments();
            //// console.log(`✅ Comments loading completed successfully`);
          } catch (__error) {
            console.error("Error loading comments from cache:", __error);
            try {
              await fetchComments();
            } catch (__fetchError) {
              console.error("Error in fallback fetchComments:", __fetchError);
              Alert.alert("Error", "Failed to load comments. Please try again.");
            }
          } finally {
            //// console.log(`🏁 Setting loading to false`);
            setLoading(false);
          }
        };
        loadComments();
        setupSubscription();
      }

      return () => {
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      };
    }, [entityId, entityType, visible, cacheKey, fetchComments, setupSubscription]);

    // Fetch entity owner ID if not provided
    useEffect(() => {
      const fetchEntityOwnerId = async () => {
        if (entityOwnerId) {
          setResolvedEntityOwnerId(entityOwnerId);
          return;
        }

        if (!entityId || !entityType) {
// console.warn('❌ Missing entityId or entityType for owner ID fetch');
          return;
        }

        try {
          const tableName = entityType === "post" ? "posts" : "reels";
          const { data, error } = await supabase
            .from(tableName as any)
            .select("user_id")
            .eq("id", entityId)
            .single();

          if (error) {
            console.error(`❌ Error fetching entity owner ID:`, error);
            throw error;
          }

          const entityData = data as any;
          const ownerId = entityData?.user_id || "";
          setResolvedEntityOwnerId(ownerId);
        } catch (__error) {
          console.error("❌ Error fetching entity owner ID:", __error);
          setResolvedEntityOwnerId("");
        }
      };

      if (visible && entityId && entityType) {
        fetchEntityOwnerId();
      }
    }, [visible, entityId, entityType, entityOwnerId, user?.id]);

    // Function to sync comment count with actual comments
    const syncCommentCount = useCallback(async (nestedComments: Comment[]) => {
      try {
        if (!supabase) {
          // console.error("Supabase client not available for count sync");
          return;
        }

        // Count all comments including replies
        const countAllComments = (comments: Comment[]): number => {
          let count = 0;
          for (const comment of comments) {
            count += 1; // Count the comment itself
            if (comment.replies && comment.replies.length > 0) {
              count += countAllComments(comment.replies); // Count replies recursively
            }
          }
          return count;
        };

        const actualCount = countAllComments(nestedComments);

        // Get current count from database
        const { data: entity, error: entityError } = await supabase
          .from(entityTable)
          .select("comments_count")
          .eq("id", entityId)
          .single();

        if (entityError || !entity) {
          // console.error(`Error fetching ${entityType} for count sync:`, entityError);
          return;
        }

        // Update count if it doesn't match
        if ((entity as any).comments_count !== actualCount) {
          //// console.log(`Syncing comment count: DB has ${(entity as any).comments_count}, actual is ${actualCount}`);

          const { error: updateError } = await (supabase
            .from(entityTable) as any)
            .update({ comments_count: actualCount })
            .eq("id", entityId);

          if (updateError) {
            // console.error(`Error updating ${entityType} comment count:`, updateError);
          }
        }
      } catch (__error) {
        // console.error("Error syncing comment count:", error);
      }
    }, [entityId, entityType, entityTable]);

    const validateEntityId = async () => {
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { data, error } = await supabase
        .from(entityTable)
        .select("id")
        .eq("id", entityId)
        .single();

      if (error || !data) {
        // console.error(`${entityType} ID validation error:`, entityId, error);
        throw new Error(
          `Cannot add comment: ${entityType} with ID ${entityId} does not exist.`
        );
      }
      return true;
    };

    const handleAddComment = async () => {
      if (!newComment.trim()) return;
      if (!user) {
        Alert.alert("Error", "You must be logged in to comment.");
        return;
      }
      if (!supabase) {
        Alert.alert("Error", "Database connection not available.");
        return;
      }

      setSubmitting(true);
      try {
        await validateEntityId();
        const mentionData = mentionedUsers.map((user) => ({
          user_id: user.id,
          username: user.username,
        }));

        const { data: newCommentData, error: insertError } = await (supabase
          .from(table) as any)
          .insert({
            [`${entityType}_id`]: entityId,
            user_id: user.id,
            content: newComment.trim(),
            parent_comment_id: replyingTo ? replyingTo.id : null,
            created_at: new Date().toISOString(),
            likes_count: 0,
            replies_count: 0,
            mentions: mentionData,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Create notification for the post/reel owner
        try {
          const { data: entity, error: entityError } = await supabase
            .from(entityTable)
            .select("user_id")
            .eq("id", entityId)
            .single();

          // Only use the broadcaster to create notifications (no direct database insert)
          if (!entityError && entity && (entity as any).user_id !== user.id) {
            try {
              await SupabaseNotificationBroadcaster.broadcastComment(
                (entity as any).user_id,
                user.id,
                newCommentData.id,
                entityType === 'post' ? entityId : undefined,
                entityType === 'reel' ? entityId : undefined
              );
            } catch (__broadcastError) {
              // console.error("Error broadcasting comment notification:", broadcastError);
              // Don't throw - comment was created successfully
            }
          }
        } catch (__notificationError) {
          // console.error("Error creating comment notification:", notificationError);
          // Don't throw - comment was created successfully
        }

        // Note: Comment count is now automatically updated by database triggers
        // No need to manually update comments_count

        if (replyingTo) {
          const { data: parentComment, error: parentError } = await supabase
            .from(table)
            .select("replies_count")
            .eq("id", replyingTo.id)
            .single();

          if (parentError || !parentComment)
            throw new Error("Parent comment not found");

          await (supabase
            .from(table) as any)
            .update({ replies_count: ((parentComment as any).replies_count || 0) + 1 })
            .eq("id", replyingTo.id);

          // Create notification for the parent comment owner
          if ((parentComment as any).user_id !== user.id) {
            try {
              await SupabaseNotificationBroadcaster.broadcastComment(
                (parentComment as any).user_id,
                user.id,
                newCommentData.id,
                entityType === 'post' ? entityId : undefined,
                entityType === 'reel' ? entityId : undefined
              );
            } catch (__notificationError) {
              // console.error("Error creating reply notification:", notificationError);
              // Don't throw - comment was created successfully
            }
          }
        }

        const newCommentWithUser: Comment = {
          ...newCommentData,
          user: {
            username: user.username || "Unknown",
            avatar: user.avatar || "https://via.placeholder.com/40",
          },
          replies: [],
        };

        let updatedComments = [...comments];
        if (replyingTo) {
          updatedComments = updatedComments.map((comment) => {
            if (comment.id === replyingTo.id) {
              return {
                ...comment,
                replies: [...(comment.replies || []), newCommentWithUser],
                replies_count: (comment.replies_count || 0) + 1,
              };
            }
            return comment;
          });
        } else {
          updatedComments.push(newCommentWithUser);
        }

        setComments(updatedComments);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedComments));

        setMentionedUsers([]);
        setNewComment("");
        setReplyingTo(null);
        setShowMentionsList(false);
      } catch (__error) {
        // console.error(`Error adding ${entityType} comment:`, error);
        Alert.alert("Error", `Failed to add ${entityType} comment.`);
      } finally {
        setSubmitting(false);
      }
    };

    const handleDeleteComment = async (
      commentId: string,
      parentCommentId: string | null
    ) => {
      if (!user) {
        Alert.alert("Error", "You must be logged in to delete a comment.");
        return;
      }

      Alert.alert(
        "Delete Comment",
        "Are you sure you want to delete this comment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                // Add to deleting set for immediate UI feedback
                setDeletingComments(prev => new Set([...prev, commentId]));

                // Optimistic UI update - remove comment immediately
                const removeCommentFromTree = (comments: Comment[]): Comment[] => {
                  return comments.reduce((acc: Comment[], comment) => {
                    if (comment.id === commentId) {
                      // Skip this comment (delete it)
                      return acc;
                    }

                    if (comment.replies && comment.replies.length > 0) {
                      const updatedReplies = removeCommentFromTree(comment.replies);
                      const wasReplyDeleted = comment.replies.length !== updatedReplies.length;

                      return [...acc, {
                        ...comment,
                        replies: updatedReplies,
                        replies_count: wasReplyDeleted ? Math.max(0, (comment.replies_count || 0) - 1) : comment.replies_count
                      }];
                    }

                    return [...acc, comment];
                  }, []);
                };

                const optimisticComments = removeCommentFromTree(comments);
                setComments(optimisticComments);

                // Update cache immediately
                await AsyncStorage.setItem(cacheKey, JSON.stringify(optimisticComments));

                const { error: deleteError } = await supabase
                  .from(table)
                  .delete()
                  .eq("id", commentId)
                  .eq("user_id", user.id);

                if (deleteError) throw deleteError;

                // Note: Comment count is now automatically updated by database triggers
                // No need to manually update comments_count

                if (parentCommentId) {
                  const { data: parentComment, error: parentError } =
                    await supabase
                      .from(table)
                      .select("replies_count")
                      .eq("id", parentCommentId)
                      .single();

                  if (parentError || !parentComment)
                    throw new Error("Parent comment not found");

                  await (supabase
                    .from(table) as any)
                    .update({
                      replies_count: Math.max(
                        0,
                        ((parentComment as any).replies_count || 0) - 1
                      ),
                    })
                    .eq("id", parentCommentId);
                }

                let updatedComments = [...comments];
                if (parentCommentId) {
                  updatedComments = updatedComments.map((comment) => {
                    if (comment.id === parentCommentId) {
                      return {
                        ...comment,
                        replies: (comment.replies || []).filter(
                          (reply) => reply.id !== commentId
                        ),
                        replies_count: Math.max(
                          0,
                          (comment.replies_count || 0) - 1
                        ),
                      };
                    }
                    return comment;
                  });
                } else {
                  updatedComments = updatedComments.filter(
                    (comment) => comment.id !== commentId
                  );
                }

                // Remove from deleting set
                setDeletingComments(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(commentId);
                  return newSet;
                });

                // Final cache update
                await AsyncStorage.setItem(
                  cacheKey,
                  JSON.stringify(updatedComments)
                );
              } catch (__error) {
                // console.error(`Error deleting ${entityType} comment:`, error);
                Alert.alert("Error", `Failed to delete ${entityType} comment.`);

                // Remove from deleting set and revert optimistic update
                setDeletingComments(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(commentId);
                  return newSet;
                });

                // Refresh from server to revert changes
                await fetchComments(false);
              }
            },
          },
        ]
      );
    };

    const handleLikeComment = async (commentId: string) => {
      if (!user) {
        Alert.alert("Error", "You must be logged in to like a comment.");
        return;
      }
      if (!supabase) {
        Alert.alert("Error", "Database connection not available.");
        return;
      }

      const isCurrentlyLiked = likedComments.has(commentId);

      try {
        //// console.log(`Toggling like for comment ${commentId}, currently liked: ${isCurrentlyLiked}`);

        // Optimistic UI update
        const newLikedComments = new Set(likedComments);
        if (isCurrentlyLiked) {
          newLikedComments.delete(commentId);
        } else {
          newLikedComments.add(commentId);
        }
        setLikedComments(newLikedComments);

        // Update comments state optimistically
        const updateCommentsLikeCount = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                likes_count: Math.max(0, comment.likes_count + (isCurrentlyLiked ? -1 : 1))
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateCommentsLikeCount(comment.replies)
              };
            }
            return comment;
          });
        };

        const updatedComments = updateCommentsLikeCount(comments);
        setComments(updatedComments);

        // Update cache immediately with new structure
        const cacheData = {
          comments: updatedComments,
          timestamp: Date.now(),
          version: 1
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));

        const { data: existingLike, error: fetchLikeError } = await supabase
          .from(likeTable)
          .select("id")
          .eq("comment_id", commentId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchLikeError) throw fetchLikeError;

        if (existingLike) {
          //// console.log(`Removing existing like for comment ${commentId}`);
          const { error: deleteError } = await supabase
            .from(likeTable)
            .delete()
            .eq("id", (existingLike as any).id);
          if (deleteError) throw deleteError;
        } else {
          //// console.log(`Adding new like for comment ${commentId}`);
          const { error: insertError } = await (supabase.from(likeTable) as any).insert({
            comment_id: commentId,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
          if (insertError) throw insertError;
        }

        //// console.log(`Successfully updated like status for comment ${commentId}`);

        // Ensure the like status is properly reflected in the UI
        //// console.log("Current liked comments after update:", Array.from(newLikedComments));

        // Note: Like count is now automatically updated by database triggers
        // No need to refresh comments since we already updated optimistically
      } catch (__error) {
        // console.error(`Error liking ${entityType} comment:`, error);
        Alert.alert("Error", `Failed to like ${entityType} comment.`);

        // Revert optimistic update on error
        const revertedLikedComments = new Set(likedComments);
        if (isCurrentlyLiked) {
          revertedLikedComments.add(commentId);
        } else {
          revertedLikedComments.delete(commentId);
        }
        setLikedComments(revertedLikedComments);

        // Revert comment count
        const revertCommentsLikeCount = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                likes_count: Math.max(0, comment.likes_count + (isCurrentlyLiked ? 1 : -1))
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: revertCommentsLikeCount(comment.replies)
              };
            }
            return comment;
          });
        };
        setComments(revertCommentsLikeCount(comments));
      }
    };

    const toggleRepliesExpansion = (commentId: string) => {
      setExpandedReplies(prev => {
        const newSet = new Set(prev);
        if (newSet.has(commentId)) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });
    };

    const parseCommentText = (
      text: string,
      mentions: { user_id: string; username: string }[] = [],
      colorsToUse: any = memoizedColors
    ) => {
      const parts: React.ReactElement[] = [];
      const mentionRegex = /@(\w+)/g;
      let lastIndex = 0;
      let match;

      while ((match = mentionRegex.exec(text)) !== null) {
        const mentionStart = match.index;
        const mentionEnd = mentionStart + match[0].length;
        const username = match[1];

        if (mentionStart > lastIndex) {
          parts.push(
            <Text
              key={`text-${lastIndex}`}
              style={[styles.commentText, { color: colorsToUse.text }]}
            >
              {text.slice(lastIndex, mentionStart)}
            </Text>
          );
        }

        const mentionedUser = mentions.find((m) => m.username === username);
        if (mentionedUser) {
          parts.push(
            <TouchableOpacity
              key={`mention-${mentionStart}`}
              onPress={() => handleMentionClick(mentionedUser.user_id)}
            >
              <Text style={[styles.commentText, { color: colorsToUse.primary }]}>
                {match[0]}
              </Text>
            </TouchableOpacity>
          );
        } else {
          parts.push(
            <Text
              key={`text-${mentionStart}`}
              style={[styles.commentText, { color: colorsToUse.text }]}
            >
              {match[0]}
            </Text>
          );
        }

        lastIndex = mentionEnd;
      }

      if (lastIndex < text.length) {
        parts.push(
          <Text
            key={`text-${lastIndex}`}
            style={[styles.commentText, { color: colorsToUse.text }]}
          >
            {text.slice(lastIndex)}
          </Text>
        );
      }

      return parts;
    };

    const handleMentionClick = (userId: string) => {
      try {
        if (!userId) {
          //// console.warn("Invalid user ID for mention click");
          return;
        }

        //// console.log("🔗 Navigating to user profile:", userId);

        // Navigate to user profile using Expo Router
        router.push(`/userProfile/${userId}`);
      } catch (__error) {
        // console.error("Error navigating to user profile:", error);
      }
    };

    // Handle edit comment
    const handleEditComment = (comment: Comment) => {
      setEditingComment(comment);
      setShowEditModal(true);
    };

    // Handle comment updated from edit modal
    const handleCommentUpdated = (updatedComment: {
      id: string;
      content: string;
      edited_at: string;
      is_edited: boolean;
      mentions: { user_id: string; username: string }[];
    }) => {
      setComments(prevComments => {
        const updateComment = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === updatedComment.id) {
              return {
                ...comment,
                content: updatedComment.content,
                edited_at: updatedComment.edited_at,
                is_edited: updatedComment.is_edited,
                mentions: updatedComment.mentions,
              };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: updateComment(comment.replies),
              };
            }
            return comment;
          });
        };
        return updateComment(prevComments);
      });
    };

    // Handle pin toggle
    const handlePinToggled = (commentId: string, isPinned: boolean, pinnedAt?: string, pinnedBy?: string) => {
      setComments(prevComments => {
        const updateComment = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                is_pinned: isPinned,
                pinned_at: pinnedAt,
                pinned_by: pinnedBy,
              };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: updateComment(comment.replies),
              };
            }
            return comment;
          });
        };

        const updatedComments = updateComment(prevComments);

        // Sort comments so pinned ones appear first
        const sortedComments = updatedComments.sort((a, b) => {
          // First, sort by pinned status (pinned comments first)
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;

          // If both are pinned, sort by pinned_at (most recently pinned first)
          if (a.is_pinned && b.is_pinned) {
            const aTime = new Date(a.pinned_at || 0).getTime();
            const bTime = new Date(b.pinned_at || 0).getTime();
            return bTime - aTime;
          }

          // If neither is pinned, sort by created_at (oldest first)
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          return aTime - bTime;
        });

        //// console.log(`📌 Pin toggled for comment ${commentId}, isPinned: ${isPinned}, sorted ${sortedComments.length} comments`);

        // Update cache with new sorted comments
        const updateCache = async () => {
          try {
            const cacheData = {
              comments: sortedComments,
              timestamp: Date.now(),
              version: 1
            };
            await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
            //// console.log(`💾 Updated cache after pin toggle`);
          } catch (__error) {
            // console.error("Error updating cache after pin toggle:", error);
          }
        };
        updateCache();

        return sortedComments;
      });
    };

    const renderComment = useCallback(
      ({ item: comment }: { item: Comment }) => {
        const timeAgo = getTimeAgo(comment.created_at);
        const avatarUri =
          comment.user?.avatar || comment.user?.avatar_url || "https://via.placeholder.com/40";
        const isLikedByUser = likedComments.has(comment.id);
        const isDeleting = deletingComments.has(comment.id);

        // Return null if comment.user is null
        if (!comment.user) {
          return null;
        }



        return (
          <View
            style={[
              styles.commentContainer,
              comment.parent_comment_id && {
                ...styles.replyContainer,
                borderLeftColor: (memoizedColors as any).border || memoizedColors.textSecondary,
              },
              isDeleting && { opacity: 0.5 },
            ]}
          >
            <View style={styles.commentRow}>
              <TouchableOpacity
                onPress={() => handleMentionClick(comment.user_id)}
              >
                <CachedImage
                  uri={avatarUri}
                  style={styles.avatar}
                  fallbackUri="https://via.placeholder.com/40"
                />
              </TouchableOpacity>
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <TouchableOpacity
                    onPress={() => handleMentionClick(comment.user_id)}
                  >
                    <Text style={[styles.username, { color: memoizedColors.text }]}>
                      {comment.user?.username || 'Unknown User'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.time, { color: memoizedColors.textSecondary }]}>
                    {timeAgo}
                  </Text>
                  {comment.is_edited && (
                    <Text style={[styles.editedIndicator, { color: memoizedColors.textSecondary }]}>
                      • edited
                    </Text>
                  )}
                </View>
                {/* Pinned indicator */}
                <PinnedCommentIndicator
                  isPinned={comment.is_pinned || false}
                  pinnedAt={comment.pinned_at}
                  size="small"
                  style={styles.pinnedIndicator}
                />
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  flex: 1,
                  minHeight: 20, // Ensure minimum height for text
                  alignItems: 'flex-start' // Align text to top
                }}>
                  <Text style={[
                    styles.commentText,
                    {
                      color: memoizedColors.text,
                      flex: 1,
                      minHeight: 20 // Ensure text has enough height
                    }
                  ]}>
                    {parseCommentText(comment.content, comment.mentions, memoizedColors)}
                  </Text>
                </View>
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    onPress={() => handleLikeComment(comment.id)}
                    style={styles.actionButton}
                  >
                    <AntDesign
                      name="heart"
                      size={16}
                      color={isLikedByUser ? "#FF3040" : memoizedColors.textSecondary}
                    />
                    {comment.likes_count > 0 && (
                      <Text
                        style={[
                          styles.likeCount,
                          { color: memoizedColors.textSecondary },
                        ]}
                      >
                        {comment.likes_count}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setReplyingTo(comment)}
                    style={styles.actionButton}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: memoizedColors.textSecondary },
                      ]}
                    >
                      Reply
                    </Text>
                  </TouchableOpacity>
                  {comment.user_id === user?.id && (
                    <>
                      <TouchableOpacity
                        onPress={() => handleEditComment(comment)}
                        style={styles.actionButton}
                      >
                        <Text
                          style={[styles.actionText, { color: memoizedColors.textSecondary }]}
                        >
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          handleDeleteComment(
                            comment.id,
                            comment.parent_comment_id
                          )
                        }
                        style={styles.actionButton}
                      >
                        <Text
                          style={[styles.actionText, { color: memoizedColors.error }]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {/* Pin button - only show for entity owner */}
                  <CommentPinButton
                    commentId={comment.id}
                    entityId={entityId}
                    entityType={entityType}
                    entityOwnerId={resolvedEntityOwnerId}
                    currentUserId={user?.id || ""}
                    isPinned={comment.is_pinned || false}
                    onPinToggled={handlePinToggled}
                    style={styles.actionButton}
                  />
                </View>
              </View>
            </View>
            {comment.replies && comment.replies.length > 0 && (
              <View style={styles.repliesSection}>
                {!expandedReplies.has(comment.id) ? (
                  <TouchableOpacity
                    onPress={() => toggleRepliesExpansion(comment.id)}
                    style={styles.viewRepliesButton}
                  >
                    <View style={[styles.replyLine, { backgroundColor: (memoizedColors as any).border || memoizedColors.textSecondary }]} />
                    <Text style={[styles.viewRepliesText, { color: memoizedColors.textSecondary }]}>
                      View all {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <TouchableOpacity
                      onPress={() => toggleRepliesExpansion(comment.id)}
                      style={styles.hideRepliesButton}
                    >
                      <View style={[styles.replyLine, { backgroundColor: (memoizedColors as any).border || memoizedColors.textSecondary }]} />
                      <Text style={[styles.hideRepliesText, { color: memoizedColors.textSecondary }]}>
                        Hide replies
                      </Text>
                    </TouchableOpacity>
                    <FlatList
                      data={comment.replies}
                      renderItem={renderComment}
                      keyExtractor={(item) => item.id}
                      style={styles.repliesList}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        );
      },
      [
        user,
        comments,
        entityType,
        handleLikeComment,
        handleDeleteComment,
        memoizedColors,
        likedComments,
        deletingComments,
        entityId,
        expandedReplies,
        handleMentionClick,
        handlePinToggled,
        parseCommentText,
        resolvedEntityOwnerId,
      ]
    );

    const searchUsers = useCallback(async (query: string) => {
      try {
        if (!supabase) {
          console.error("Supabase client not available for user search");
          return [];
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, username")
          .ilike("username", `%${query}%`)
          .limit(5);

        if (error) throw error;
        return data || [];
      } catch (__error) {
        console.error("Error searching users:", __error);
        return [];
      }
    }, []);

    const handleTextChange = useCallback((text: string) => {
      setNewComment(text);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      const cursorPosition = text.length;
      const lastAtSymbolIndex = text.lastIndexOf("@", cursorPosition - 1);

      if (lastAtSymbolIndex !== -1) {
        const query = text.slice(lastAtSymbolIndex + 1, cursorPosition);
        if (!query.includes(" ")) {
          mentionStartIndex.current = lastAtSymbolIndex;
          if (query.length > 0) {
            // Debounce the search to reduce API calls
            searchTimeoutRef.current = setTimeout(async () => {
              const users = await searchUsers(query);
              setFilteredUsers(users);
              setShowMentionsList(users.length > 0);
            }, 300) as any; // 300ms debounce
          } else {
            setShowMentionsList(true);
            setFilteredUsers([]);
          }
        } else {
          setShowMentionsList(false);
          mentionStartIndex.current = -1;
        }
      } else {
        setShowMentionsList(false);
        mentionStartIndex.current = -1;
      }
    }, [searchUsers]);

    const handleMentionSelect = useCallback((selectedUser: {
      id: string;
      username: string;
    }) => {
      // Get text before the @ symbol
      const beforeMention = newComment.slice(0, mentionStartIndex.current);

      // Find the end of the current mention (space or end of string)
      const afterAtSymbol = newComment.slice(mentionStartIndex.current + 1);
      const spaceIndex = afterAtSymbol.indexOf(" ");
      const mentionEnd = spaceIndex === -1 ? newComment.length : mentionStartIndex.current + 1 + spaceIndex;

      // Get text after the mention
      const afterMention = newComment.slice(mentionEnd);

      // Build the new comment with the selected mention
      const updatedComment = `${beforeMention}@${selectedUser.username} ${afterMention}`.trim();

      setNewComment(updatedComment);
      setMentionedUsers([...mentionedUsers, selectedUser]);
      setShowMentionsList(false);
      mentionStartIndex.current = -1;

      // Focus back on input
      setTimeout(() => {
        mentionInputRef.current?.focus();
      }, 100);
    }, [newComment, mentionedUsers]);

    const MentionsList = () => (
      <View
        style={[
          styles.mentionsContainer,
          {
            backgroundColor: colors.background,
            borderColor: isDarkMode
              ? "rgba(255, 255, 255, 0.2)"
              : "rgba(0, 0, 0, 0.2)",
            boxShadow: "0px -2px 3.84px rgba(0, 0, 0, 0.25)",
          },
        ]}
      >
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={[
                styles.mentionItem,
                { borderBottomColor: `${colors.primary}10` },
              ]}
              onPress={() => {
                handleMentionSelect(user);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.mentionText, { color: colors.primary }]}>
                @{user.username}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text
            style={[styles.noMentionsText, { color: colors.textSecondary }]}
          >
            No users found
          </Text>
        )}
      </View>
    );

    const getTimeAgo = (dateString: string) => {
      const now = new Date();
      const commentDate = new Date(dateString);
      const diffMs = now.getTime() - commentDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays > 0) return `${diffDays}d`;
      if (diffHours > 0) return `${diffHours}h`;
      if (diffMins > 0) return `${diffMins}m`;
      return "just now";
    };

    // Debug logging for render (only when visible changes)
    useEffect(() => {
      if (visible) {
        //// console.log(`🎨 Comments modal opened:`, {
// //   entityType,
// //   entityId,
// //   commentsCount: comments.length,
// //   userLoaded: !!user,
// // });
      }
    }, [visible, entityType, entityId]);

    return (
      <SafeAreaView style={styles.modalContainer}>
        <Modal
          isVisible={visible}
          style={styles.modal}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          backdropOpacity={0.5}
          onBackButtonPress={onClose}
          onBackdropPress={onClose}
          avoidKeyboard={true}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: `${colors.primary}20` }]}>
              <TouchableOpacity 
                onPress={() => {
                  onClose();
                }} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessible={true}
                accessibilityLabel="Close comments"
                accessibilityRole="button"
              >
                <AntDesign name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text
                style={[styles.modalTitle, { color: colors.text }]}
                className="font-rubik-bold"
              >
                Comments
              </Text>
              <View style={{ width: 24 }} />
            </View>
          <View style={styles.contentContainer}>
            <View style={styles.commentsContainer}>
              {loading ? (
                <CommentsSkeleton numComments={5} />
              ) : comments.length === 0 ? (
                <View style={styles.noCommentsContainer}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.noCommentsText, { color: colors.text }]}
                    className="font-rubik-medium"
                  >
                    No comments yet
                  </Text>
                  <Text
                    style={[
                      styles.noCommentsSubtext,
                      { color: colors.textSecondary },
                    ]}
                    className="font-rubik-regular"
                  >
                    Be the first to comment
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={comments}
                  renderItem={renderComment}
                  keyExtractor={(item) => item.id}
                  style={styles.commentsList}
                  contentContainerStyle={styles.commentsListContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: "#000000",
                  borderTopColor: "#333",
                  paddingBottom: Math.max(insets.bottom, 10)
                },
              ]}
            >
              {replyingTo && (
                <View
                  style={[
                    styles.replyingToContainer,
                    { backgroundColor: isDarkMode ? "#222" : "#f0f0f0" },
                  ]}
                >
                  <Text
                    style={[
                      styles.replyingToText,
                      { color: colors.textSecondary },
                    ]}
                    className="font-rubik-medium"
                  >
                    Replying to @{replyingTo.user?.username || 'Unknown User'}
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <Ionicons
                      name="close"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              )}
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDarkMode ? "#222" : "#f0f0f0",
                    borderColor: isDarkMode ? "#333" : "#ddd",
                  },
                ]}
              >
                <CachedImage
                  uri={user?.avatar || "https://via.placeholder.com/40"}
                  style={styles.inputAvatar}
                  fallbackUri="https://via.placeholder.com/40"
                  onError={(error) => {
                    // Avatar image failed to load
                  }}
                  onLoad={() => {
                    // Avatar image loaded successfully
                  }}
                />
                <TextInput
                  ref={mentionInputRef}
                  style={[styles.input, { color: colors.text }]}
                  placeholder={
                    replyingTo
                      ? `Reply to @${replyingTo.user?.username || 'Unknown User'}...`
                      : `Add a comment for ${
                          entityOwnerUsername || `this ${entityType}`
                        }...`
                  }
                  placeholderTextColor={colors.textSecondary}
                  value={newComment}
                  onChangeText={handleTextChange}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleAddComment}
                  autoFocus={true}
                />
                <TouchableOpacity
                  onPress={handleAddComment}
                  style={styles.sendButton}
                  disabled={submitting || !newComment.trim()}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={
                        newComment.trim() ? colors.primary : colors.textTertiary
                      }
                    />
                  )}
                </TouchableOpacity>
              </View>
              {showMentionsList && <MentionsList />}
            </View>
          </View>
          </View>
        </Modal>

        {/* Edit Comment Modal */}
        <CommentEditModal
          visible={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingComment(null);
          }}
          comment={editingComment || { id: "", content: "", mentions: [] }}
          entityType={entityType}
          onCommentUpdated={handleCommentUpdated}
        />
      </SafeAreaView>
    );
  }
);

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 10,
    color: "#999",
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  noCommentsText: {
    fontSize: 16,
    marginTop: 10,
    color: "#fff",
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 5,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingBottom: 10,
  },
  commentContainer: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  replyContainer: {
    marginLeft: 50,
    marginTop: 5,
    borderBottomWidth: 0,
    paddingLeft: 10,
    borderLeftWidth: 2,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginRight: 5,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  commentText: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 20, // Increased from 18 to prevent clipping
    marginBottom: 5,
    flexWrap: 'wrap',
    flexShrink: 1,
    includeFontPadding: false, // Android: prevents extra padding
    textAlignVertical: 'center', // Android: better vertical alignment
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  actionButton: {
    marginRight: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    fontSize: 12,
    color: "#999",
    marginLeft: 5,
  },
  likeCount: {
    fontSize: 12,
    color: "#999",
    marginLeft: 5,
  },
  repliesSection: {
    marginTop: 8,
    marginLeft: 50,
  },
  repliesList: {
    marginTop: 5,
  },
  viewRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  hideRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  viewRepliesText: {
    fontSize: 12,
    marginLeft: 8,
  },
  hideRepliesText: {
    fontSize: 12,
    marginLeft: 8,
  },
  replyLine: {
    width: 24,
    height: 1,
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    // paddingBottom is now set dynamically using safe area insets
  },
  replyingToContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  replyingToText: {
    fontSize: 13,
    color: "#999",
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    paddingVertical: 0,
    paddingHorizontal: 10,
  },
  sendButton: {
    padding: 5,
  },
  mentionsContainer: {
    position: "absolute",
    bottom: "100%",
    left: 10,
    right: 10,
    borderRadius: 10,
    maxHeight: 200,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#222",
    zIndex: 9999,
    elevation: 10, // For Android
  },
  mentionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  mentionText: {
    fontSize: 14,
    color: "#0095f6",
  },
  noMentionsText: {
    padding: 10,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  editedIndicator: {
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  pinnedIndicator: {
    marginTop: 4,
    marginBottom: 2,
  },
});

export default CommentsModal;
