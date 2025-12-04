import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import moment from "moment";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { notificationsAPI } from "@/lib/notificationsApi";
import { useTheme } from "@/src/context/ThemeContext";
import { ThemedGradient } from "@/components/ThemedGradient";
import CachedImage from "@/components/CachedImage";
import NotificationsSkeleton from "@/components/skeletons/NotificationsSkeleton";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/src/store/store";
import { removeNotification, markNotificationAsRead } from "@/src/store/slices/notificationSlice";
import { useEnhancedRefresh } from "@/hooks/useEnhancedRefresh";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
// Removed useUniversalRefresh import

interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention"; // Added "mention" type
  sender_id: string;
  sender: {
    username: string;
    avatar_url: string;
  };
  post_id?: string;
  reel_id?: string; // Add reel_id support
  comment_id?: string;
  created_at: string;
  is_read: boolean;
}

// Memoized notification item component for better performance
const NotificationItem = memo(({ notification, colors, isDarkMode, onPress, onDelete }: {
  notification: Notification;
  colors: any;
  isDarkMode: boolean;
  onPress: (notification: Notification) => void;
  onDelete: (id: string) => void;
}) => {
  const timeAgo = moment(notification.created_at).fromNow();

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          borderBottomColor: colors.cardBorder,
          backgroundColor: colors.card
        },
        !notification.is_read && {
          backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.05)'
        },
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <CachedImage
        uri={notification.sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.sender?.username || 'User')}&background=E5E7EB&color=9CA3AF&size=48`}
        style={[styles.avatar, { borderColor: colors.cardBorder }]}
        showLoader={true}
        fallbackUri={`https://ui-avatars.com/api/?name=${encodeURIComponent(notification.sender?.username || 'User')}&background=E5E7EB&color=9CA3AF&size=48`}
      />
      <View style={styles.notificationContent}>
        <Text className="font-rubik-bold" style={[styles.username, { color: colors.text }]}>
          {notification.sender.username}
        </Text>
        <Text className="font-rubik-medium" style={[styles.notificationText, { color: colors.textSecondary }]}>
          {notification.type === "like" && notification.reel_id ? "liked your reel" : ""}
          {notification.type === "like" && notification.post_id ? "liked your post" : ""}
          {notification.type === "comment" && notification.reel_id ? "commented on your reel" : ""}
          {notification.type === "comment" && notification.post_id ? "commented on your post" : ""}
          {notification.type === "follow" ? "started following you" : ""}
          {notification.type === "mention" ? "mentioned you in a post" : ""}
        </Text>
        <Text className="font-rubik-medium" style={[styles.timeAgo, { color: colors.textTertiary }]}>
          {timeAgo}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
      {!notification.is_read && (
        <View style={styles.unreadDot}>
          <Ionicons name="ellipse" size={10} color={isDarkMode ? '#808080' : '#606060'} />
        </View>
      )}
    </TouchableOpacity>
  );
});

NotificationItem.displayName = 'NotificationItem';

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // **INSTAGRAM-STYLE**: Use React Query to read from PREFETCHED cache for instant display
  const { data: notificationsData, isLoading, isFetched, refetch } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(*)')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!userId,
    staleTime: Infinity, // Never stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Sync React Query data to Redux for compatibility
  useEffect(() => {
    if (notificationsData) {
      dispatch({
        type: 'notifications/setNotifications',
        payload: notificationsData
      });
      const unreadCount = notificationsData.filter((n: any) => !n.is_read).length;
      dispatch({
        type: 'notifications/setUnreadCount',
        payload: unreadCount
      });
    }
  }, [notificationsData, dispatch]);

  // Debug: Track screen focus and navigation events
  useEffect(() => {
    // NotificationsScreen: Component mounted
    
    return () => {
      // NotificationsScreen: Component unmounted
    };
  }, []);

  // Debug: Track when close button is pressed
  const handleClosePress = () => {
    // NotificationsScreen: Close button pressed - navigating back
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(root)/(tabs)/home');
    }
  };

  // Get notifications from React Query (will be instantly available from prefetch)
  const notificationsFromStore = useSelector((state: RootState) => state.notifications.notifications);
  const notifications = notificationsData || notificationsFromStore || [];
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);

  // Debug logging
  // Notifications Screen Debug: notificationsCount, unreadCount, userId, loading, notifications

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };

    fetchUser();
  }, []);

  // MAXIMUM SPEED: Ultra-fast prefetch with minimal queries
  const prefetchNotificationContent = useCallback(async (notificationList: any[]) => {
    if (!userId || notificationList.length === 0) return;

    // ULTRA FAST: Batch all IDs and fetch in single queries
    const postIds = notificationList.filter(n => n.post_id).map(n => n.post_id);
    const reelIds = notificationList.filter(n => n.reel_id).map(n => n.reel_id);
    const profileIds = notificationList.filter(n => n.type === 'follow').map(n => n.sender_id);

    // Batch fetch all posts in ONE query
    if (postIds.length > 0) {
      (async () => {
        try {
          const { data } = await supabase
            .from('posts')
            .select('id, user_id, caption, image_urls, created_at, likes_count, comments_count')
            .in('id', postIds)
            .limit(50);

          // Cache each post immediately
          (data || []).forEach((post: any) => {
            const postKey = queryKeys.posts.detail(post.id);
            queryClient.setQueryData(postKey, {
              ...post,
              user: { username: 'User', avatar_url: '' },
              is_liked: false,
              is_bookmarked: false,
            });
          });
        } catch {}
      })();
    }

    // Batch fetch all reels in ONE query
    if (reelIds.length > 0) {
      (async () => {
        try {
          const { data } = await supabase
            .from('reels')
            .select('id, user_id, video_url, thumbnail_url, caption, likes_count, comments_count, created_at')
            .in('id', reelIds)
            .limit(50);

          // Cache each reel immediately
          (data || []).forEach((reel: any) => {
            const reelKey = queryKeys.reels.detail(reel.id);
            queryClient.setQueryData(reelKey, reel);
          });
        } catch {}
      })();
    }

    // Batch fetch all profiles in ONE query for instant profile views
    if (profileIds.length > 0) {
      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, bio, name, website, account_type, gender')
            .in('id', profileIds)
            .limit(50);

          // Also fetch follow status and stats in parallel for each profile
          (data || []).forEach(async (profile: any) => {
            const profileKey = ['profile', 'complete', profile.id, userId];
            
            // Fetch stats in parallel
            const [postsResult, reelsResult, followersResult, followingResult, isFollowingResult] = await Promise.all([
              supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
              supabase.from('reels').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
              supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
              supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
              supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', profile.id).maybeSingle(),
            ]);

            // Cache complete profile data
            queryClient.setQueryData(profileKey, {
              profile: {
                ...profile,
                posts_count: postsResult.count || 0,
                reels_count: reelsResult.count || 0,
                followers_count: followersResult.count || 0,
                following_count: followingResult.count || 0,
              },
              is_following: !!isFollowingResult.data,
            });
          });
        } catch {}
      })();
    }
  }, [userId, queryClient]);



  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      // Use React Query refetch instead of direct API call
      await refetch();
    } catch (__error) {
      console.error("Error fetching notifications:", __error);
    }
  };

  // Handle refresh for notifications
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Refetch using React Query
      await refetch();
    } catch (__error) {
      console.error('❌ Notifications refresh failed:', __error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Enhanced refresh hook for Instagram-like pull-to-refresh
  const enhancedRefresh = useEnhancedRefresh({
    onRefresh: handleRefresh,
    enableHaptics: true,
    animationDuration: 300,
    minDurationMs: 0,
  });

  useEffect(() => {
    if (userId) {
      // MAXIMUM SPEED: Prefetch existing Redux notifications IMMEDIATELY
      if (notifications.length > 0) {
        prefetchNotificationContent(notifications as any); // Direct call - no setTimeout
      }
      // Then fetch new notifications
      fetchNotifications();
    }
  }, [userId]);

  // MAXIMUM SPEED: Prefetch IMMEDIATELY on any notification change
  useEffect(() => {
    if (userId && notifications.length > 0) {
      // Direct call - no setTimeout for maximum speed
      prefetchNotificationContent(notifications as any);
    }
  }, [notifications, userId, prefetchNotificationContent]); // Watch notifications array directly

  const handleNotificationPress = async (notification: Notification) => {
    try {

      await notificationsAPI.markAsRead(notification.id);


      if (notification.type === "follow") {
        router.replace({
          pathname: "/userProfile/[id]",
          params: {
            id: notification.sender_id,
            from: 'notifications'
          },
        });
      } else if (notification.reel_id) {
        // Use replace to avoid navigation stack buildup
        router.replace({
          pathname: "/reel/[id]",
          params: { 
            id: notification.reel_id,
            from: 'notifications'
          },
        });
      } else if (notification.post_id) {
        // Use replace to avoid navigation stack buildup
        router.replace({
          pathname: "/post/[id]",
          params: { 
            id: notification.post_id,
            from: 'notifications'
          },
        });
      }

      // Update Redux store to mark as read
      dispatch(markNotificationAsRead(notification.id));
    } catch (__error) {
      console.error("Error handling notification:", __error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      // Remove from Redux store
      dispatch(removeNotification(notificationId));
    } catch (__error) {
      console.error("Error deleting notification:", __error);
    }
  };

  // Optimized render function using memoized component
  const renderNotification = useCallback(({
    item: notification,
  }: {
    item: Notification;
  }) => (
    <NotificationItem
      notification={notification}
      colors={colors}
      isDarkMode={isDarkMode}
      onPress={handleNotificationPress}
      onDelete={handleDelete}
    />
  ), [colors, isDarkMode, handleNotificationPress, handleDelete]);

  // Memoize FlatList props for better performance
  const flatListProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    windowSize: 21,
    initialNumToRender: 10,
    extraData: `${isDarkMode}-${notifications.length}`,
  }), [isDarkMode, notifications.length]);

  const showEmpty = isFetched && !isLoading && notifications.length === 0;

  const showSkeleton = (notifications.length === 0) && ((!userId) || (isLoading && !isFetched));
  if (showSkeleton) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ThemedGradient style={styles.container}>
          <View style={[styles.header, {
            borderBottomColor: colors.cardBorder,
            backgroundColor: colors.backgroundSecondary
          }]}>
            <Text className="font-rubik-bold" style={[styles.headerTitle, { color: colors.text }]}>
              Notifications
            </Text>
            <TouchableOpacity
              onPress={handleClosePress}
              style={[styles.closeButton, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.3)'
              }]}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <NotificationsSkeleton numNotifications={10} />
        </ThemedGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedGradient style={styles.container}>
      <View style={[styles.header, {
        borderBottomColor: colors.cardBorder,
        backgroundColor: colors.backgroundSecondary
      }]}>
        <Text className="font-rubik-bold" style={[styles.headerTitle, { color: colors.text }]}>
          Notifications
        </Text>
        <TouchableOpacity
          onPress={handleClosePress}
          style={[styles.closeButton, {
            backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
            borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.3)'
          }]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications as any}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            {...enhancedRefresh.refreshControlProps}
          />
        }
        ListEmptyComponent={showEmpty ? (
          <View style={styles.emptyContainer}>
            <Text className="font-rubik-medium" style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notifications yet
            </Text>
          </View>
        ) : null}
        // Performance optimizations using memoized props
        {...flatListProps}
      />
      </ThemedGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 14,
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 8,
  },
});

