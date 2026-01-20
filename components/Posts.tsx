import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ViewToken
} from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/lib/authContext";
import { useSmartFeed } from "@/hooks/usePostViewTracking";
import { useEnhancedRefresh } from "@/hooks/useEnhancedRefresh";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { usersApi } from "@/lib/usersApi";
import PostCard from "./PostCard";
import StoriesFixed from "./StoriesFixed";
import EnhancedRefreshIndicator from "./EnhancedRefreshIndicator";
import FeedSkeleton from "./skeletons/FeedSkeleton";
import { Post } from "@/src/types/post";
import { getOptimizer } from "@/lib/performance/instagramStyleOptimizer";
import { useQueryClient } from '@tanstack/react-query';

const { width } = Dimensions.get('window');

const Posts = () => {
  //// console.log('🚀 Posts: Component rendering with smart feed');

  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const scrollSpeedRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const currentVisibleIndexRef = useRef(0);

  const {
    posts,
    loading,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore
  } = useSmartFeed({
    limit: 20, // Load 20 posts per batch
    excludeViewedTwice: true,
    respect24hCooldown: false
  });

  // Track if we're currently refreshing to prevent duplicate refreshes
  const isRefreshingRef = React.useRef(false);

  // Real-time updates for posts (Instagram-style)
  const { invalidatePostQueries } = useRealtimePosts({
    enabled: isAuthenticated,
    onNewPost: (post) => {
      console.log('🆕 New post received in feed:', post.id);
      // Only refresh if not already refreshing
      if (!isRefreshingRef.current && !refreshing) {
        isRefreshingRef.current = true;
        refresh();
        // Reset flag after a short delay
        setTimeout(() => {
          isRefreshingRef.current = false;
        }, 1000);
      }
    },
  });

  // Enhanced refresh with Instagram-like animations and haptic feedback
  const enhancedRefresh = useEnhancedRefresh({
    onRefresh: async () => {
      // Prevent concurrent refreshes
      if (isRefreshingRef.current || refreshing) {
        return;
      }

      isRefreshingRef.current = true;
      try {
        // Invalidate all post queries to ensure fresh data
        invalidatePostQueries();
        // Trigger feed refresh
        await refresh();
      } finally {
        isRefreshingRef.current = false;
      }
    },
    enableHaptics: true,
    animationDuration: 300,
  });

  const { colors, isDarkMode } = useTheme();
  
  // Track follow status for users to update across all their posts
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);

  // OPTIMIZED: Removed Instagram optimizer initialization
  // It was adding unnecessary overhead with setTimeout on mount
  // The optimizer will initialize lazily when needed

  //// console.log('📊 Posts: Smart feed state -', {
// //   postsCount: posts?.length || 0,
// //   loading,
// //   hasError: !!error,
// //   errorMessage: error,
// //   isAuthenticated,
// //   userId: user?.id,
// //   followedUsersCount: followedUsers.size,
// //   followStatusLoaded
// // });

  // OPTIMIZED: Lazy load follow status - don't block feed rendering
  // Follow buttons will show after posts are visible
  useEffect(() => {
    const loadInitialFollowStatus = async () => {
      if (!user?.id || !posts || posts.length === 0 || followStatusLoaded) return;

      // Delay follow status check to not block initial render
      setTimeout(async () => {
        try {
          // Get unique user IDs from posts (excluding current user)
          const userIds = Array.from(new Set(posts
            .map(post => post.user_id)
            .filter(userId => userId !== user.id)
          ));

          if (userIds.length === 0) {
            setFollowStatusLoaded(true);
            return;
          }

          //// console.log('🔍 Loading follow status for users:', userIds);

          // OPTIMIZED: Batch check follow status in chunks of 5 to reduce parallel queries
          const chunkSize = 5;
          const initialFollowedUsers = new Set<string>();
          
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const followStatusPromises = chunk.map(async (userId) => {
              try {
                const isFollowing = await usersApi.checkFollowing(userId, user.id);
                return { userId, isFollowing };
              } catch (__error) {
                return { userId, isFollowing: false };
              }
            });

            const followResults = await Promise.all(followStatusPromises);
            followResults.forEach(({ userId, isFollowing }) => {
              if (isFollowing) {
                initialFollowedUsers.add(userId);
              }
            });
          }

          //// console.log('✅ Initial follow status loaded:', {
  // //   totalUsers: userIds.length,
  // //   followedUsers: Array.from(initialFollowedUsers)
  // // });

          setFollowedUsers(initialFollowedUsers);
          setFollowStatusLoaded(true);
        } catch (__error) {
          // console.error('❌ Error loading initial follow status:', error);
          setFollowStatusLoaded(true); // Set to true to prevent infinite retries
        }
      }, 1000); // Delay 1 second to let feed render first
    };

    loadInitialFollowStatus();
  }, [user?.id, posts, followStatusLoaded]);

  const handleLike = useCallback((postId: string, isLiked: boolean) => {
    //// console.log(`Post ${postId} ${isLiked ? 'liked' : 'unliked'}`);
  }, []);

  const handleComment = useCallback((postId: string) => {
    //// console.log(`Comment on post ${postId}`);
  }, []);

  const handleSave = useCallback((postId: string, isSaved: boolean) => {
    //// console.log(`Post ${postId} ${isSaved ? 'saved' : 'unsaved'}`);
  }, []);

  const handleFollow = useCallback((userId: string, isFollowing: boolean) => {
    //// console.log('📢 Posts.handleFollow called:', {
// //   userId,
// //   isFollowing,
// //   currentFollowedUsers: Array.from(followedUsers)
// // });
    
    // Update the followed users set to instantly hide follow buttons
    setFollowedUsers(prev => {
      const newSet = new Set(prev);
      if (isFollowing) {
        newSet.add(userId);
        //// console.log('➕ Added user to followed set:', userId);
      } else {
        newSet.delete(userId);
        //// console.log('➖ Removed user from followed set:', userId);
      }
      //// console.log('🔄 Updated followed users set:', Array.from(newSet));
      return newSet;
    });
  }, []);

  const renderPost = useCallback(({ item }: { item: any }) => {
    // Handle different data structures from smart feed vs regular feed
    const username = item.user?.username || item.username || item.profiles?.username;
    const avatar_url = item.user?.avatar_url || item.avatar_url || item.profiles?.avatar_url;
    
    // Transform the post data to match the expected Post interface
    const post = {
      id: item.id,
      user_id: item.user_id,
      image_urls: item.image_urls || [item.image_url].filter(Boolean), // Handle both formats
      caption: item.caption,
      created_at: item.created_at,
      likes_count: item.likes_count,
      comments_count: item.comments_count,
      is_liked: item.is_liked,
      is_bookmarked: item.is_bookmarked,
      user: {
        id: item.user_id,
        username: username,
        avatar_url: avatar_url,
      },
      // Add the follow status from our local state
      is_user_followed: followedUsers.has(item.user_id),
    };

    return (
      <PostCard
        post={post}
        onLike={handleLike}
        onComment={handleComment}
        onSave={handleSave}
        onFollow={handleFollow}
      />
    );
  }, [handleLike, handleComment, handleSave, handleFollow, followedUsers]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  // Handle scroll for Instagram-style prefetching
  const handleScroll = useCallback((event: any) => {
    if (!user?.id) return;

    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const timeDiff = currentTime - lastScrollTimeRef.current;
    
    if (timeDiff > 0) {
      // Calculate scroll speed (pixels per second)
      const yDiff = Math.abs(currentY - lastScrollYRef.current);
      scrollSpeedRef.current = (yDiff / timeDiff) * 1000;
      
      lastScrollYRef.current = currentY;
      lastScrollTimeRef.current = currentTime;

      // Notify optimizer about scroll behavior
      const optimizer = getOptimizer(queryClient, user.id);
      optimizer.onScroll({
        currentIndex: currentVisibleIndexRef.current,
        posts: posts || [],
        scrollSpeed: scrollSpeedRef.current,
      });
    }
  }, [user?.id, queryClient, posts]);

  // Track viewable items for prefetching and pagination
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const currentIndex = viewableItems[0].index;
      currentVisibleIndexRef.current = currentIndex;
      
      // **ZERO-SECOND LOADING**: Aggressively prefetch next posts IMMEDIATELY (no delay)
      if (user?.id && postsRef.current) {
        const optimizer = getOptimizer(queryClient, user.id);
        // IMMEDIATE execution for zero-second loading
        optimizer.prefetcher.prefetchNextPosts(currentIndex, postsRef.current);
      }

      // Instagram-style pagination: Load more when user crosses 75%
      if (postsRef.current && postsRef.current.length > 0 && hasMoreRef.current && !loadingRef.current) {
        const totalPosts = postsRef.current.length;
        const scrollPercentage = (currentIndex + 1) / totalPosts;
        
        if (scrollPercentage >= 0.75) {
          // Trigger load more in background
          loadMoreRef.current();
        }
      }
    }
  }).current;

  // Keep refs updated for the stable callback
  const postsRef = useRef(posts);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  const loadMoreRef = useRef(loadMore);

  useEffect(() => {
    postsRef.current = posts;
    hasMoreRef.current = hasMore;
    loadingRef.current = loading;
    loadMoreRef.current = loadMore;
  }, [posts, hasMore, loading, loadMore]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
  }).current;

  // Show skeleton loader on initial load
  if (loading && (!posts || posts.length === 0)) {
    return (
      <View style={{ backgroundColor: colors.background, flex: 1 }}>
        <StoriesFixed />
        <FeedSkeleton numPosts={3} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={enhancedRefresh.onRefresh}
        >
          <Text style={[styles.retryButtonText, { color: colors.background }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    // Show normal home page layout with Stories and pull-to-refresh functionality
    return (
      <View style={{ backgroundColor: colors.background, flex: 1 }}>
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              {...enhancedRefresh.refreshControlProps}
            />
          }
          ListHeaderComponent={<StoriesFixed />}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            {...enhancedRefresh.refreshControlProps}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.25}
        ListHeaderComponent={<StoriesFixed />}
        ListFooterComponent={
          loading && posts.length > 0 ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({
          length: 600,
          offset: 600 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  postContainer: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  postHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  caption: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postFooter: {
    padding: 16,
  },
  stats: {
    fontSize: 12,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});

export default Posts;

