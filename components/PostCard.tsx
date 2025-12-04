import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Share,
  Animated,
  PanResponder,
  Pressable,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import { AntDesign, Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../src/context/ThemeContext';
import CachedImage from './CachedImage';
import ImageCarousel from './ImageCarousel';
import { formatTimeAgo } from '../lib/utils/formatUtils';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/authContext';
import { postsAPI } from '../lib/postsApi';
import { usersApi } from '../lib/usersApi';
import { Post } from '../src/types/post';
import { supabase } from '../lib/supabase';
import { usePrefetchPost } from '../lib/query/hooks/usePostsQuery';
import { queryKeys } from '../lib/query/queryKeys';
import { getOptimizer } from '../lib/performance/instagramStyleOptimizer';

const { width: screenWidth } = Dimensions.get('window');

interface PostCardProps {
  post: Post & { is_user_followed?: boolean };
  onLike?: (postId: string, isLiked: boolean) => void;
  onComment?: (postId: string) => void;
  onSave?: (postId: string, isSaved: boolean) => void;
  onFollow?: (userId: string, isFollowing: boolean) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onComment,
  onSave,
  onFollow,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const prefetchPost = usePrefetchPost();
  const queryClient = useQueryClient();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [isSaved, setIsSaved] = useState(post.is_bookmarked || false);
  const [isFollowing, setIsFollowing] = useState(post.is_user_followed || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [loading, setLoading] = useState(false);
  const pauseStartTime = useRef<number | null>(null);
  const isPauseTracked = useRef(false);

  // Sync local state with prop changes (for real-time updates)
  useEffect(() => {
    setIsLiked(post.is_liked || false);
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
    setIsSaved(post.is_bookmarked || false);
  }, [post.is_liked, post.likes_count, post.comments_count, post.is_bookmarked]);

  // **ZERO-SECOND LOADING**: Instantly prefetch post data when card becomes visible
  useEffect(() => {
    if (!user?.id) return;

    // IMMEDIATE prefetch (no delay) for instant navigation
    prefetchPost(post.id, user.id);
    
    // Also prefetch user profile and comments for zero-loading
    const prefetchComplete = async () => {
      try {
        // Prefetch post comments
        await queryClient.prefetchQuery({
          queryKey: ['post_comments', post.id, 20, 0],
          queryFn: async () => {
            const { data } = await supabase
              .from('comments')
              .select('*, user:profiles!comments_user_id_fkey(username, avatar_url)')
              .eq('post_id', post.id)
              .order('created_at', { ascending: false })
              .range(0, 19);
            return data || [];
          },
          staleTime: Infinity,
        });

        // Prefetch user profile
        await queryClient.prefetchQuery({
          queryKey: queryKeys.users.detail(post.user_id),
          queryFn: async () => {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', post.user_id)
              .single();
            return data;
          },
          staleTime: Infinity,
        });
      } catch (error) {
        // Silent fail
      }
    };

    prefetchComplete();
  }, [post.id, post.user_id, user?.id, prefetchPost, queryClient]);

  // Track user pause behavior for Instagram-style predictions
  useEffect(() => {
    if (!user?.id) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isPauseTracked.current) {
        // User paused on this post
        if (pauseStartTime.current) {
          const pauseDuration = Date.now() - pauseStartTime.current;
          if (pauseDuration > 1000) { // Only track if paused for > 1 second
            const optimizer = getOptimizer(queryClient, user.id);
            optimizer.onPostPause({
              postId: post.id,
              pauseDuration,
            });
            isPauseTracked.current = true;
          }
        }
      } else if (!document.hidden) {
        // User resumed viewing
        pauseStartTime.current = Date.now();
        isPauseTracked.current = false;
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      pauseStartTime.current = Date.now();

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user?.id, queryClient, post.id]);

  useEffect(() => {
    // Update follow status when prop changes
    setIsFollowing(post.is_user_followed || false);
  }, [post.is_user_followed]);

  // Use the prop value directly for follow status to ensure consistency
  const currentFollowStatus = post.is_user_followed !== undefined ? post.is_user_followed : isFollowing;

  const checkFollowingStatus = useCallback(async () => {
    if (!user?.id || user.id === post.user_id) return;
    
    try {
      const following = await usersApi.checkFollowing(post.user_id, user.id);
      setIsFollowing(following);
    } catch {
      // console.error('Error checking follow status:', error);
    }
  }, [user?.id, post.user_id]);

  useEffect(() => {
    // Only check following status if not provided in props
    if (post.is_user_followed === undefined) {
      checkFollowingStatus();
    }
  }, [checkFollowingStatus, post.is_user_followed]);

  const handleLike = async () => {
    if (!user?.id) return;
    
    // Don't block if already processing - allow rapid double-tap
    if (loading) {
      console.log('⚡ Like already in progress, queuing...');
    }

    // Optimistic update - update UI immediately
    const newIsLiked = !isLiked;
    const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1;

    setIsLiked(newIsLiked);
    setLikesCount(newLikesCount);

    // Update cache immediately for instant feedback across all screens
    queryClient.setQueriesData(
      { queryKey: queryKeys.posts.all },
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: any) =>
              p.id === post.id
                ? { ...p, is_liked: newIsLiked, likes_count: newLikesCount }
                : p
            ) || []
          }))
        };
      }
    );

    setLoading(true);
    try {
      // Use fast RPC function instead of slow API
      const { data: result, error } = await supabase.rpc('lightning_toggle_like_v4', {
        post_id_param: post.id,
        user_id_param: user.id,
      } as any);

      if (error) throw error;

      // Verify the result matches our optimistic update
      if (result !== newIsLiked) {
        // Revert if server returned different result
        setIsLiked(result);
        setLikesCount(prev => result ? prev + 1 : prev - 1);
      }

      onLike?.(post.id, result);
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(!newIsLiked);
      setLikesCount(likesCount);

      // Revert cache update
      queryClient.setQueriesData(
        { queryKey: queryKeys.posts.all },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts?.map((p: any) =>
                p.id === post.id
                  ? { ...p, is_liked: !newIsLiked, likes_count: likesCount }
                  : p
              ) || []
            }))
          };
        }
      );

      // console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setLoading(false);
    }
  };

  // Handle double tap - only like, never unlike
  const handleDoubleTapLike = () => {
    if (!isLiked) {
      handleLike();
    }
  };

  const handleSave = async () => {
    if (!user?.id || loading) return;

    // Optimistic update - update UI immediately
    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    // Update cache immediately for instant feedback across all screens
    queryClient.setQueriesData(
      { queryKey: queryKeys.posts.all },
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: any) =>
              p.id === post.id
                ? { ...p, is_bookmarked: newIsSaved }
                : p
            ) || []
          }))
        };
      }
    );

    setLoading(true);
    try {
      // Use fast RPC function instead of slow API
      const { data: result, error } = await supabase.rpc('lightning_toggle_bookmark_v3', {
        post_id_param: post.id,
        user_id_param: user.id,
      } as any);

      if (error) throw error;

      // Verify the result matches our optimistic update
      if (result !== newIsSaved) {
        // Revert if server returned different result
        setIsSaved(result);
      }

      onSave?.(post.id, result);
    } catch (error) {
      // Revert optimistic update on error
      setIsSaved(!newIsSaved);

      // Revert cache update
      queryClient.setQueriesData(
        { queryKey: queryKeys.posts.all },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts?.map((p: any) =>
                p.id === post.id
                  ? { ...p, is_bookmarked: !newIsSaved }
                  : p
              ) || []
            }))
          };
        }
      );

      // console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'Failed to update bookmark status');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    console.log('🔄 Follow button clicked!', {
      userId: user?.id,
      postUserId: post.user_id,
      loading,
      currentFollowStatus
    });
    
    if (!user?.id || user.id === post.user_id || loading) {
      console.log('❌ Follow action blocked:', {
        noUserId: !user?.id,
        sameUser: user?.id === post.user_id,
        loading
      });
      return;
    }
    
    // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
    const newIsFollowing = !currentFollowStatus;
    setIsFollowing(newIsFollowing);
    onFollow?.(post.user_id, newIsFollowing);
    console.log('⚡ Optimistic update: Following status ->', newIsFollowing);
    
    setLoading(true);
    try {
      console.log('📡 Calling usersApi.toggleFollow...');
      const startTime = Date.now();
      const result = await usersApi.toggleFollow(post.user_id, user.id);
      const duration = Date.now() - startTime;
      console.log(`✅ Follow API result: ${result} (took ${duration}ms)`);
      
      // Verify result matches optimistic update
      if (result !== newIsFollowing) {
        console.log('⚠️ Server result differs, reverting:', result);
        setIsFollowing(result);
        onFollow?.(post.user_id, result);
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      // Revert optimistic update on error
      setIsFollowing(!newIsFollowing);
      onFollow?.(post.user_id, !newIsFollowing);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setLoading(false);
    }
  };

  const handleComment = () => {
    onComment?.(post.id);
    // Navigate to comments screen
    router.push({
      pathname: '/(root)/posts-comments-screen',
      params: { 
        postId: post.id,
        postOwnerUsername: post.user.username,
        postOwnerId: post.user_id
      }
    });
  };

  const handleUserPress = () => {
    // Track profile view for Instagram-style prefetching
    if (user?.id && post.user_id !== user.id) {
      const optimizer = getOptimizer(queryClient, user.id);
      optimizer.onProfileView(post.user_id);
    }

    if (user?.id === post.user_id) {
      router.push('/(root)/(tabs)/profile');
    } else {
      router.push(`/(root)/userProfile/${post.user_id}`);
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      marginBottom: 0,
      width: screenWidth,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 12,
      borderWidth: 0.5,
      borderColor: isDarkMode ? '#FFFFFF' : '#000000',
    },
    userDetails: {
      flex: 1,
    },
    username: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    timestamp: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    followButton: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    followButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.background,
    },
    imageContainer: {
      width: screenWidth,
      aspectRatio: 1,
      backgroundColor: colors.border,
    },
    postImage: {
      width: '100%',
      height: '100%',
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    leftActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      marginRight: 16,
    },
    saveButton: {
      marginLeft: 'auto',
    },
    likesContainer: {
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    likesText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    captionContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    caption: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 18,
    },
    usernameInCaption: {
      fontWeight: '600',
    },
    commentsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    viewCommentsText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <Image
            source={{
              uri: post.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(post.user.username || 'User') + '&background=E5E7EB&color=9CA3AF&size=32',
            }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{post.user.username}</Text>
            <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        
        {user?.id !== post.user_id && !currentFollowStatus && (
          <TouchableOpacity
            style={styles.followButton}
            onPress={handleFollow}
            disabled={loading}
          >
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Post Image Carousel */}
      {post.image_urls && post.image_urls.length > 0 ? (
        <ImageCarousel
          images={post.image_urls}
          onDoubleTap={handleDoubleTapLike}
          showPagination={post.image_urls.length > 1}
          paginationStyle="dots"
        />
      ) : (
        <View style={[styles.postImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#999', fontSize: 16 }}>No Image</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLike}
            disabled={loading}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#E91E63' : colors.text}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleComment}
          >
            <Ionicons
              name="chatbubble-outline"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      {likesCount > 0 && (
        <View style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>
            <Text style={styles.usernameInCaption}>{post.user.username}</Text>{' '}
            {post.caption}
          </Text>
        </View>
      )}

      {/* Comments */}
      {commentsCount > 0 && (
        <TouchableOpacity style={styles.commentsContainer} onPress={handleComment}>
          <Text style={styles.viewCommentsText}>
            View all {commentsCount} comments
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default PostCard;
