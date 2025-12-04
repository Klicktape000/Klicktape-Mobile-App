import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import CachedImage from "@/components/CachedImage";
import { usersApi } from "@/lib/usersApi";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface User {
  follower_id?: string;
  following_id?: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

interface FollowListProps {
  userId: string;
  type: "followers" | "following";
  title: string;
}

const FollowList: React.FC<FollowListProps> = ({ userId, type, title }) => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    } catch {
      setCurrentUserId(null);
    }
  };

  // INSTAGRAM-STYLE: Ultra-aggressive cache for instant loading
  const { 
    data: users = [], 
    isLoading, 
    refetch,
    isFetched 
  } = useQuery({
    queryKey: ['follow-list', type, userId],
    queryFn: async () => {
      if (type === "followers") {
        return await usersApi.getFollowers(userId);
      } else {
        return await usersApi.getFollowing(userId);
      }
    },
    enabled: !!userId,
    staleTime: Infinity, // Never stale - always instant from cache
    gcTime: 24 * 60 * 1000, // 24 hours cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Check following status after users are loaded
  useEffect(() => {
    if (users.length > 0 && currentUserId) {
      checkFollowingStatus(users);
    }
  }, [users, currentUserId]);

  // OPTIMIZED: Batch check following status (1 query instead of N queries)
  const checkFollowingStatus = useCallback(async (userList: User[]) => {
    if (!currentUserId) return;

    try {
      const targetUserIds = userList
        .map(user => user.follower_id || user.following_id)
        .filter((id): id is string => !!id && id !== currentUserId);

      if (targetUserIds.length === 0) {
        setFollowingStatus({});
        return;
      }

      const statusMap = await usersApi.checkFollowingBatch(targetUserIds, currentUserId);
      setFollowingStatus(statusMap);
    } catch (error) {
      setFollowingStatus({});
    }
  }, [currentUserId]);

  const handleRefresh = async () => {
    await refetch();
  };

  const handleFollow = async (targetUserId: string) => {
    if (!currentUserId || targetUserId === currentUserId) return;

    try {
      // Optimistic update: immediately update UI
      const wasFollowing = type === 'following' ? true : (followingStatus[targetUserId] || false);
      const newFollowingStatus = !wasFollowing;
      
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: newFollowingStatus
      }));

      // If unfollowing on the "following" tab, remove from list immediately
      if (type === 'following' && wasFollowing) {
        queryClient.setQueryData(['follow-list', type, userId], (old: User[] | undefined) => {
          if (!old) return old;
          return old.filter(user => {
            const id = user.follower_id || user.following_id;
            return id !== targetUserId;
          });
        });
      }

      // Make actual API call
      const actualStatus = await usersApi.toggleFollow(targetUserId, currentUserId);
      
      // Update with actual status from server
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: actualStatus
      }));

      // Refetch to ensure data is in sync
      if (type === 'following' && !actualStatus) {
        // User was removed, refetch to confirm
        await refetch();
      }
    } catch (error) {
      // Revert optimistic update on error
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: type === 'following' ? true : (prev[targetUserId] || false)
      }));
      
      // Refetch to restore correct state
      await refetch();
      
      Alert.alert("Error", "Failed to update follow status");
    }
  };

  const navigateToProfile = (targetUserId: string) => {
    if (targetUserId === currentUserId) {
      router.push("/(root)/(tabs)/profile");
    } else {
      router.push(`/(root)/userProfile/${targetUserId}`);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const targetUserId = item.follower_id || item.following_id;
    if (!targetUserId) return null;

    const isCurrentUser = targetUserId === currentUserId;
    
    // For "following" tab, user is definitely following these people
    // For "followers" tab, check the followingStatus
    const isFollowing = type === 'following' ? true : (followingStatus[targetUserId] || false);

    return (
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: colors.backgroundSecondary }]}
        onPress={() => navigateToProfile(targetUserId)}
      >
        <View style={styles.userInfo}>
          <CachedImage
            uri={item.avatar_url || "https://via.placeholder.com/150"}
            style={styles.avatar}
            showLoader={true}
            fallbackUri="https://via.placeholder.com/150"
          />
          <View style={styles.userDetails}>
            <Text className="font-rubik-bold" style={[styles.username, { color: colors.text }]}>
              {item.username}
            </Text>
          </View>
        </View>
        
        {/* Don't show follow button for current user */}
        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing 
                  ? `rgba(${isDarkMode ? '128, 128, 128' : '128, 128, 128'}, 0.2)`
                  : `rgba(${isDarkMode ? '128, 128, 128' : '128, 128, 128'}, 0.2)`,
                borderColor: `rgba(${isDarkMode ? '128, 128, 128' : '128, 128, 128'}, 0.3)`
              }
            ]}
            onPress={() => handleFollow(targetUserId)}
          >
            <Text
              className="font-rubik-medium"
              style={[styles.followButtonText, { color: colors.text }]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Show skeleton only when loading AND no cached data
  const shouldShowLoading = isLoading && !isFetched;

  // Skeleton loader component
  const SkeletonItem = () => (
    <View style={[styles.userItem, { backgroundColor: colors.backgroundSecondary }]}>
      <View style={styles.userInfo}>
        <View style={[styles.avatar, { backgroundColor: `${colors.textSecondary}30` }]} />
        <View style={styles.userDetails}>
          <View style={{ width: 120, height: 16, backgroundColor: `${colors.textSecondary}30`, borderRadius: 4 }} />
        </View>
      </View>
      <View style={[styles.followButton, { backgroundColor: `${colors.textSecondary}20` }]}>
        <View style={{ width: 60, height: 14, backgroundColor: `${colors.textSecondary}30`, borderRadius: 4 }} />
      </View>
    </View>
  );

  if (shouldShowLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: (colors as any).border || colors.textSecondary }]}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(root)/(tabs)/home');
            }
          }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="font-rubik-bold" style={[styles.headerTitle, { color: colors.text }]}>
            {title}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.listContainer}>
          {[...Array(8)].map((_, i) => <SkeletonItem key={i} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: (colors as any).border || colors.textSecondary }]}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(root)/(tabs)/home');
          }
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="font-rubik-bold" style={[styles.headerTitle, { color: colors.text }]}>
          {title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => (item.follower_id || item.following_id || `fallback-${Math.random().toString(36).substr(2, 9)}`)}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text className="font-rubik-medium" style={[styles.emptyText, { color: colors.textSecondary }]}>
              No {type} yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: "bold",
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default FollowList;

