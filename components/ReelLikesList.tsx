import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { reelsAPI } from "@/lib/reelsApi";
import { usersApi } from "@/lib/usersApi";
import CachedImage from "@/components/CachedImage";

interface LikeUser {
  user_id: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

interface ReelLikesListProps {
  reelId: string;
  title?: string;
}

// Memoized user item component to prevent unnecessary re-renders
const UserItem = React.memo(({ 
  item, 
  currentUserId, 
  followingStatus, 
  colors, 
  onFollow, 
  onNavigateToProfile 
}: {
  item: LikeUser;
  currentUserId: string | null;
  followingStatus: Record<string, boolean>;
  colors: any;
  onFollow: (userId: string) => void;
  onNavigateToProfile: (userId: string) => void;
}) => {
  const isOwnProfile = item.user_id === currentUserId;
  const isFollowing = followingStatus[item.user_id];

  const handlePress = useCallback(() => {
    onNavigateToProfile(item.user_id);
  }, [item.user_id, onNavigateToProfile]);

  const handleFollowPress = useCallback(() => {
    onFollow(item.user_id);
  }, [item.user_id, onFollow]);

  return (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: `${colors.primary}20` }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.userInfo}>
        <CachedImage
          uri={item.avatar_url || "https://via.placeholder.com/150"}
          style={styles.avatar}
          showLoader={true}
          fallbackUri="https://via.placeholder.com/150"
        />
        <View style={styles.userDetails}>
          <Text style={[styles.username, { color: colors.text }]}>
            {item.username}
          </Text>
          <Text style={[styles.likedAt, { color: colors.textSecondary }]}>
            Liked {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {!isOwnProfile && (
        <TouchableOpacity
          style={[
            styles.followButton,
            {
              backgroundColor: isFollowing ? colors.backgroundSecondary : '#22C55E',
              borderColor: isFollowing ? colors.textSecondary : '#22C55E',
            },
          ]}
          onPress={handleFollowPress}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.followButtonText,
              {
                color: isFollowing ? colors.text : "white",
              },
            ]}
          >
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

// Add display name for UserItem component
UserItem.displayName = 'UserItem';

const ReelLikesList = React.memo(({
  reelId,
  title = "Likes",
}: ReelLikesListProps) => {
  const { colors } = useTheme();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      // console.error("Error getting current user:", error);
      setCurrentUserId(null);
    }
  };

  const checkFollowingStatus = useCallback(async (users: LikeUser[]) => {
    if (!currentUserId) return;

    try {
      const statusPromises = users.map(async (user) => {
        if (user.user_id === currentUserId) return { userId: user.user_id, isFollowing: false };
        
        try {
          const isFollowing = await usersApi.checkFollowing(user.user_id, currentUserId);
          return { userId: user.user_id, isFollowing };
        } catch {
          // console.error(`Error checking follow status for ${user.username}:`, error);
          return { userId: user.user_id, isFollowing: false };
        }
      });

      const results = await Promise.all(statusPromises);
      const statusMap = results.reduce((acc, { userId, isFollowing }) => {
        acc[userId] = isFollowing;
        return acc;
      }, {} as Record<string, boolean>);

      setFollowingStatus(statusMap);
    } catch {
      // console.error("Error checking following status:", error);
    }
  }, [currentUserId]);

  const fetchLikes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reelsAPI.getReelLikes(reelId);
      setUsers(data);
      
      // Check following status for each user
      if (currentUserId) {
        await checkFollowingStatus(data);
      }
    } catch {
      // console.error("Error fetching reel likes:", error);
      Alert.alert("Error", "Failed to load likes");
    } finally {
      setLoading(false);
    }
  }, [reelId, currentUserId, checkFollowingStatus]);

  useEffect(() => {
    if (currentUserId) {
      fetchLikes();
    }
  }, [currentUserId, reelId, fetchLikes]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLikes().finally(() => setRefreshing(false));
  };

  // Memoized navigation handler
  const navigateToProfile = useCallback((userId: string) => {
    router.push(`/userProfile/${userId}`);
  }, []);

  // Memoized follow handler
  const handleFollow = useCallback(async (targetUserId: string) => {
    if (!currentUserId || targetUserId === currentUserId) return;

    try {
      const currentStatus = followingStatus[targetUserId];
      const newFollowingStatus = !currentStatus;
      
      // Optimistic update
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: newFollowingStatus
      }));

      // Use toggleFollow method which handles both follow and unfollow
      await usersApi.toggleFollow(targetUserId, currentUserId);
    } catch {
      // Revert optimistic update on error
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: !prev[targetUserId]
      }));
      Alert.alert("Error", "Failed to update follow status");
    }
  }, [currentUserId, followingStatus]);

  // Memoized render function
  const renderUserItem = useCallback(({ item }: { item: LikeUser }) => (
    <UserItem
      item={item}
      currentUserId={currentUserId}
      followingStatus={followingStatus}
      colors={colors}
      onFollow={handleFollow}
      onNavigateToProfile={navigateToProfile}
    />
  ), [currentUserId, followingStatus, colors, handleFollow, navigateToProfile]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: LikeUser) => item.user_id, []);

  // Memoized styles
  const containerStyle = useMemo(() => [
    styles.container,
    { backgroundColor: colors.background }
  ], [colors.background]);

  const headerStyle = useMemo(() => [
    styles.header,
    { backgroundColor: colors.background, borderBottomColor: `${colors.primary}20` }
  ], [colors.background, colors.primary]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: `${colors.primary}20` }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading likes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle}>
      <View style={headerStyle}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(root)/(tabs)/reels');
          }
        }} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          getItemLayout={(data, index) => ({
            length: 80,
            offset: 80 * index,
            index,
          })}
        />
      )}
    </SafeAreaView>
  );
});

// Add display name for ReelLikesList component
ReelLikesList.displayName = 'ReelLikesList';

export default ReelLikesList;

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
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    fontWeight: "600",
    marginBottom: 2,
  },
  likedAt: {
    fontSize: 14,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyList: {
    flex: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});

