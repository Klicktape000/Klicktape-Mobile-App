import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";

import { supabase } from "@/lib/supabase";
import { useDispatch, useSelector } from "react-redux";
import { toggleLike, toggleBookmark, updatePost } from "@/src/store/slices/postsSlice";
import { RootState } from "@/src/store/store";
import { useTheme } from "@/src/context/ThemeContext";
import { authManager } from "@/lib/authManager";
import { usePost, usePostComments } from "@/lib/query/hooks/usePostsQuery";
import PostDetailSkeleton from "@/components/skeletons/PostDetailSkeleton";
import { useAuth } from "@/lib/authContext";
import ImageCarousel from "@/components/ImageCarousel";

const { width } = Dimensions.get("window");
const IMAGE_HEIGHT = width * 0.9;

// Update the comment interface to match the correct field name
interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string;  // Changed from avatar to avatar_url
  };
}

interface Post {
  id: string;
  user_id: string;
  caption: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  user: {
    username: string;
    avatar_url: string;
  };
}

const PostDetailScreen = () => {
  const { id, from } = useLocalSearchParams(); // Get 'from' parameter
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || null;

  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const likeScale = useState(new Animated.Value(1))[0];

  // OPTIMIZED: Smart back navigation
  const handleBack = () => {
    // If came from notifications, go directly back to notifications
    if (from === 'notifications') {
      router.replace('/(root)/notifications');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(root)/(tabs)/home');
    }
  };

  // MAXIMUM SPEED: Use TanStack Query with instant cache display
  const { data: post, isLoading: postLoading, error: postError } = usePost(
    id as string,
    userId || undefined,
    {
      staleTime: Infinity,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 0,
      retryDelay: 0,
      networkMode: 'offlineFirst', // Try cache first, then network
      placeholderData: (previousData) => previousData,
    }
  );

  // MAXIMUM SPEED: Comments load with cache-first strategy
  const { data: comments = [] } = usePostComments(
    id as string,
    20,
    0,
    {
      enabled: !!post,
      staleTime: Infinity,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: 0,
      retryDelay: 0,
      networkMode: 'offlineFirst', // Cache first for instant display
      placeholderData: (previousData) => previousData,
    }
  );

  // Get bookmark status from Redux store
  const bookmarkedPosts = useSelector(
    (state: RootState) => state.posts.bookmarkedPosts
  );
  const likedPosts = useSelector((state: RootState) => state.posts.likedPosts);
  const isBookmarked = post ? bookmarkedPosts[post.id] || post.is_bookmarked || false : false;
  const isLiked = post ? likedPosts[post.id] || post.is_liked || false : false;

  // Remove the manual comments enabling - it's automatic now
  // useEffect(() => {
  //   if (post && !commentsEnabled) {
  //     setCommentsEnabled(true);
  //   }
  // }, [post, commentsEnabled]);



  const handleLike = async () => {
    if (!userId || !post) return;

    // Animate the like button
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      // Dispatch Redux action first for immediate UI update
      dispatch(toggleLike(post.id));

      const { data: isLiked, error } = await supabase!.rpc("lightning_toggle_like_v4", {
        post_id_param: post.id,
        user_id_param: userId,
      } as any);

      if (error) throw error;

      // After successful like toggle, fetch the updated post data to ensure consistency
      const { data: updatedPost, error: fetchError } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles(username, avatar_url),
          likes!likes_post_id_fkey(user_id),
          bookmarks!bookmarks_post_id_fkey(user_id),
          comments:comments!comments_post_id_fkey(id)
          `
        )
        .eq("id", post.id as any)
        .single();

      if (fetchError) {
        console.error("Error fetching updated post:", fetchError);
        return;
      }

      if (updatedPost) {
        // Process the updated post data
        const isLikedUpdated =
          Array.isArray((updatedPost as any).likes) &&
          (updatedPost as any).likes.some((like: any) => like.user_id === userId);

        const isBookmarked =
          Array.isArray((updatedPost as any).bookmarks) &&
          (updatedPost as any).bookmarks.some((bookmark: any) => bookmark.user_id === userId);

        const actualCommentsCount = Array.isArray((updatedPost as any).comments)
          ? (updatedPost as any).comments.length
          : 0;

        const profileData = (updatedPost as any).profiles || {};
        const username = profileData.username || "Unknown User";
        const avatar_url =
          profileData.avatar_url || "https://via.placeholder.com/150";

        const processedPost = {
          ...(updatedPost as any),
          is_liked: isLikedUpdated,
          is_bookmarked: isBookmarked,
          comments_count: actualCommentsCount,
          user: { username, avatar_url },
        };

        // Update the specific post in Redux with the fresh data from database
        dispatch(updatePost(processedPost));

        // Note: Post data is now managed by TanStack Query
        // The query will be invalidated and refetched automatically
      }

      // Note: Notification creation is now handled centrally in postsAPI.toggleLike
      // to prevent duplicate notifications from multiple UI components


    } catch (__error) {
      // Revert the Redux state on error
      dispatch(toggleLike(post.id));
      console.error("Error toggling like:", __error);
    }
  };

  // Handle double tap - only like, never unlike
  const handleDoubleTapLike = () => {
    if (!userId || !post) return;
    // Only like if not already liked
    if (!isLiked) {
      handleLike();
    }
  };

  const handleBookmark = async () => {
    if (!userId || !post) return;

    try {
      // Dispatch the action to update Redux store
      dispatch(toggleBookmark(post.id));

      const { error } = await supabase!.rpc("lightning_toggle_bookmark_v3", {
        post_id_param: post.id,
        user_id_param: userId,
      } as any);

      if (error) throw error;
    } catch (__error) {
      // Revert the bookmark state in Redux if the API call fails
      dispatch(toggleBookmark(post.id));
      console.error("Error toggling bookmark:", __error);
    }
  };

  const handleComment = async () => {
    if (!userId || !post || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data: commentData, error } = await supabase!
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: userId,
          content: newComment,
        } as any)
        .select(
          `
          id,
          content,
          created_at,
          user:profiles!comments_user_id_fkey (
            username,
            avatar_url
          )
        `
        )
        .single();

      if (error) throw error;

      await (supabase!
        .from("posts") as any)
        .update({ comments_count: post.comments_count + 1 })
        .eq("id", post.id);

      // Create notification for the post owner
      if (post.user_id !== userId) {
        try {
          await supabase!.from("notifications").insert({
            recipient_id: post.user_id,
            sender_id: userId,
            type: "comment",
            post_id: post.id,
            comment_id: (commentData as any).id,
            created_at: new Date().toISOString(),
            is_read: false,
          } as any);
        } catch (notificationError) {
          console.error("Error creating comment notification:", notificationError);
          // Don't throw - comment was created successfully
        }
      }

      // Transform the comment data to match the Comment type
      const transformedComment = {
        id: (commentData as any).id,
        content: (commentData as any).content,
        created_at: (commentData as any).created_at,
        user: {
          username: (commentData as any)?.user?.username || "You",
          avatar_url: (commentData as any)?.user?.avatar_url || "https://via.placeholder.com/150"
        }
      };

      // Note: Comments are now managed by TanStack Query
      // We'll need to invalidate the query to refetch
      setNewComment("");
    } catch (__error) {
      console.error("Error adding comment:", __error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = handleComment;

  // INSTAGRAM-STYLE: Show cached data immediately
  const shouldShowSkeleton = postLoading && !post;

  if (shouldShowSkeleton) {
    return (
      <SafeAreaView style={[styles.container as any, { backgroundColor: colors.background }]}>
        <PostDetailSkeleton />
      </SafeAreaView>
    );
  }

  // Show error state
  if (postError || !post) {
    return (
      <SafeAreaView style={[styles.container as any, { backgroundColor: colors.background }]}>
        <View style={styles.centered as any}>
          <Text style={[styles.errorText as any, { color: colors.text }]}>
            {postError ? 'Error loading post' : 'Post not found'}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container as any, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
      <View style={styles.container as any}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container as any}
        >
          <ScrollView style={styles.scrollView as any}>
            <View style={styles.header as any}>
              <TouchableOpacity
                onPress={handleBack}
                style={[styles.backButton as any, {
                  backgroundColor: colors.background,
                  borderColor: colors.primary,
                }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.userInfo as any}>
                <Image
                  source={{
                    uri: post.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.username || 'User')}&background=E5E7EB&color=9CA3AF&size=36`
                  }}
                  style={[styles.avatar as any, { borderColor: colors.primary }]}
                />
                <Text style={[styles.username as any, { color: colors.text }]}>{post.user?.username || 'User'}</Text>
              </View>
            </View>

            {/* Post Image Carousel */}
            <ImageCarousel
              images={post.image_urls}
              onDoubleTap={handleDoubleTapLike}
              showPagination={post.image_urls.length > 1}
              paginationStyle="counter"
              height={IMAGE_HEIGHT}
            />

            <View style={styles.actions as any}>
              <View style={styles.leftActions as any}>
                <TouchableOpacity onPress={handleLike}>
                  <Ionicons
                    name={post.is_liked ? "heart" : "heart-outline"}
                    size={24}
                    color={post.is_liked ? "#FF3040" : colors.text}
                  />
                </TouchableOpacity>
                <Text style={[styles.count as any, { color: colors.textSecondary }]}>{post.likes_count} likes</Text>
              </View>

              <TouchableOpacity
                onPress={handleBookmark}
                style={styles.bookmarkButton as any}
              >
                <Ionicons
                  name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
                  size={24}
                  color={post.is_bookmarked ? colors.primary : colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.captionContainer as any, { borderBottomColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.1)` }]}>
              <Text style={[styles.username as any, { color: colors.text }]}>{post.user?.username || 'User'}</Text>
              <Text style={[styles.caption as any, { color: colors.textSecondary }]}>{post.caption}</Text>
              <Text style={[styles.timeAgo as any, { color: colors.textTertiary }]}>
                {moment(post.created_at).fromNow()}
              </Text>
            </View>

            <View style={styles.commentsSection as any}>
              <Text style={[styles.commentsHeader as any, { color: colors.text }]}>
                Comments ({comments.length})
              </Text>
              {comments.map((comment) => (
                <View key={comment.id} style={[styles.commentItem as any, {
                  backgroundColor: colors.background,
                  borderColor: colors.primary,
                }]}>
                  <Image
                    source={{
                      uri: comment.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user?.username || 'User')}&background=E5E7EB&color=9CA3AF&size=32`
                    }}
                    style={[styles.commentAvatar as any, {
                      borderColor: colors.primary,
                    }]}
                  />
                  <View style={styles.commentContent as any}>
                    <Text style={[styles.commentUsername as any, { color: colors.text }]}>
                      {comment.user?.username || 'User'}
                    </Text>
                    <Text style={[styles.commentText as any, { color: colors.textSecondary }]}>{comment.content}</Text>
                    <Text style={[styles.commentTime as any, { color: colors.textTertiary }]}>
                      {moment(comment.created_at).fromNow()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.commentInput as any, {
            backgroundColor: colors.background,
            borderTopColor: colors.primary,
          }]}>
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input as any, {
                backgroundColor: colors.background,
                borderColor: colors.primary,
                color: colors.text,
              }]}
            />
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
              style={[
                styles.postButton as any,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
                (!newComment.trim() || isSubmitting) && styles.disabledButton as any,
              ]}
            >
              <Text style={[styles.postButtonText as any, { color: colors.text }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    fontFamily: "Rubik-Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    marginRight: 16,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
  },
  username: {
    fontSize: 16,
    fontFamily: "Rubik-Bold",
  },
  activeDot: {
    // backgroundColor will be set dynamically
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    justifyContent: "space-between", // This will push items to the edges
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  bookmarkButton: {
    padding: 8,
  },
  count: {
    marginLeft: 12,
    fontSize: 14,
    fontFamily: "Rubik-Medium",
  },
  captionContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  caption: {
    fontSize: 14,
    marginTop: 6,
    fontFamily: "Rubik-Regular",
    lineHeight: 20,
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: "Rubik-Regular",
  },
  commentsSection: {
    padding: 16,
    paddingBottom: 32,
  },
  commentsHeader: {
    fontSize: 18,
    marginBottom: 16,
    fontFamily: "Rubik-Medium",
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: "Rubik-Medium",
  },
  commentText: {
    fontSize: 14,
    fontFamily: "Rubik-Regular",
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Rubik-Regular",
  },
  commentInput: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 120,
    fontSize: 14,
    fontFamily: "Rubik-Regular",
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 14,
    fontFamily: "Rubik-Medium",
  },
});

export default PostDetailScreen;


