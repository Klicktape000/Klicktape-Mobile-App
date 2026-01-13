import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
  StatusBar,
  Modal,
} from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/authContext";
import { VideoView, useVideoPlayer } from "expo-video";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSupabaseFetch } from "@/hooks/useSupabaseFetch";
import { useEnhancedRefresh } from "@/hooks/useEnhancedRefresh";
import DeleteModal from "@/components/DeleteModal";
import ProfileRedesign from "@/components/ProfileRedesign";
import { leaderboardAPI, UserLeaderboardStats } from "@/lib/leaderboardApi";

import CachedImage from "@/components/CachedImage";
import { useTheme } from "@/src/context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import BadgeDisplay from "@/components/BadgeDisplay";
import { generateShareContent } from "@/utils/deepLinkHelper";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";
import { useCompleteProfileData, useProfilePosts, useProfileReels, useProfileBookmarks } from "@/lib/query/hooks/useProfileQuery";
import { useQueryClient } from "@tanstack/react-query";
import FallbackCache from "@/lib/utils/fallbackCache";

const Profile = () => {
  const { colors, isDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [refreshing, setRefreshing] = useState(false);

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: 'post' | 'reel';
  } | null>(null);
  const [isPostOptionsVisible, setIsPostOptionsVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // INSTAGRAM-STYLE: Ultra-aggressive cache-first loading - INSTANT display
  const {
    data: profileData,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
    isFetched: isProfileFetched
  } = useCompleteProfileData(userId || '', userId || undefined, {
    enabled: !!userId,
    staleTime: Infinity, // Never consider data stale - always use cache
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours cache
  });

  // OPTIMIZED: Only load posts for posts tab initially
  const {
    data: posts = [],
    isLoading: isPostsLoading,
    refetch: refetchPosts,
    isFetched: isPostsFetched
  } = useProfilePosts(userId || '', 12, 0, {
    enabled: !!userId && activeTab === 'posts', // ONLY load when posts tab is active
    staleTime: Infinity, // Never stale - instant from cache
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // OPTIMIZED: Only load reels when reels tab is active
  const {
    data: reels = [],
    isLoading: isReelsLoading,
    refetch: refetchReels,
    isFetched: isReelsFetched
  } = useProfileReels(userId || '', 12, 0, {
    enabled: !!userId && activeTab === 'reels', // ONLY load when reels tab is active
    staleTime: Infinity, // Never stale
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // OPTIMIZED: Only load bookmarks when saved tab is active
  const {
    data: bookmarks = [],
    isLoading: isBookmarksLoading,
    refetch: refetchBookmarks,
    isFetched: isBookmarksFetched
  } = useProfileBookmarks(userId || '', 12, 0, {
    enabled: !!userId && activeTab === 'saved', // CRITICAL: Only when userId exists AND saved tab is active
    staleTime: Infinity, // Never stale
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Ref to store video refs for controlling playback
  const videoRefs = useRef<Map<string, any>>(new Map());

  // Pause all videos
  const pauseAllVideos = useCallback(() => {
    videoRefs.current.forEach((videoRef) => {
      videoRef.current?.pauseAsync().catch((__err: any) => {
// console.warn("Error pausing video:", __err);
      });
    });
  }, []);

  // Handle screen focus/unfocus
  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseAllVideos();
      };
    }, [pauseAllVideos])
  );

  // Optimized refresh using TanStack Query
  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProfile(),
        refetchPosts(),
        refetchBookmarks(),
        refetchReels(),
      ]);
    } catch (__error) {
      console.error("Error refreshing data:", __error);
    } finally {
      setRefreshing(false);
    }
  };

  // Initialize enhanced refresh hook
  const enhancedRefresh = useEnhancedRefresh({
    onRefresh: loadData,
    enableHaptics: true,
    animationDuration: 300,
  });

  // OPTIMIZED: Memoize user info to prevent re-computation on every render
  const userInfo = useMemo(() => {
    if (!profileData) {
      return {
        username: "Username",
        name: "Full Name",
        bio: "Bio goes here",
        followers: 0,
        following: 0,
        avatar: "https://via.placeholder.com/150",
        accountType: "PERSONAL",
        gender: "",
        website: "",
        current_tier: "",
        headline: "",
        extra_line: "",
      };
    }
    
    return {
      username: profileData.profile.username || "Username",
      name: profileData.profile.name || "Full Name",
      bio: profileData.profile.bio || "Bio goes here",
      followers: profileData.followers_count || 0,
      following: profileData.following_count || 0,
      avatar: profileData.profile.avatar_url || "https://via.placeholder.com/150",
      accountType: profileData.profile.account_type || "PERSONAL",
      gender: profileData.profile.gender || "",
      website: profileData.profile.website || "",
      current_tier: profileData.profile.current_tier || "",
      headline: profileData.profile.headline || "",
      extra_line: profileData.profile.extra_line || "",
    };
  }, [profileData]);

  // OPTIMIZED: Memoize rank stats to prevent re-computation
  const userRankStats = useMemo(() => {
    return profileData?.rank_data || {
      rank_position: null,
      total_points: 0,
      points_to_next_rank: 0,
      is_in_top_50: false
    };
  }, [profileData]);

  const handleShare = async () => {
    try {
      if (!userId) {
        console.error("User ID is required for sharing");
        return;
      }

      const shareContent = generateShareContent({
        type: 'profile',
        username: userInfo.username,
        id: userId,
      });

      await Share.share(shareContent);
    } catch (__error) {
      console.error("Error sharing profile:", __error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace("/sign-up");
    } catch (__error) {
      console.error("Error logging out:", __error);
    }
  };

  const handleDelete = async (id: string, type: 'post' | 'reel') => {
    setItemToDelete({ id, type });
    setIsDeleteModalVisible(true);
  };

  const handlePostOptions = (post: any) => {
    setSelectedPost(post);
    setIsPostOptionsVisible(true);
  };

  const handleSharePost = async (post: any) => {
    try {
      const shareContent = await generateShareContent({
        type: 'post',
        username: userInfo.username,
        id: post.id,
        caption: post.caption || 'Amazing post!',
        mediaUrl: post.image_urls?.[0]
      });
      await Share.share(shareContent);
    } catch (__error) {
      console.error("Error sharing post:", __error);
    }
    setIsPostOptionsVisible(false);
  };

  const handleEditPost = (post: any) => {
    setIsPostOptionsVisible(false);
    // Navigate to edit post screen (you can implement this later)
    router.push({
      pathname: "/post/[id]",
      params: { id: post.id, edit: "true" }
    });
  };

  const handleDeleteFromOptions = (post: any) => {
    setIsPostOptionsVisible(false);
    handleDelete(post.id, 'post');
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !userId) return;

    try {
      if (itemToDelete.type === 'post') {
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select("image_urls")
          .eq("id", itemToDelete.id as any)
          .eq("user_id", userId as any)
          .single();

        if (postError || !post) throw postError || new Error("Post not found");

        // Type guard to ensure post has image_urls property
        if (post && 'image_urls' in post && (post as any).image_urls && (post as any).image_urls.length > 0) {
          const filePaths = (post as any).image_urls.map((url: string) =>
            url.split("/").slice(-2).join("/")
          );
          await supabase.storage.from("posts").remove(filePaths);
        }

        await supabase
          .from("posts")
          .delete()
          .eq("id", itemToDelete.id as any)
          .eq("user_id", userId as any);

        // Refetch posts after deletion
        await refetchPosts();
      } else {
        const { data: reel, error: reelError } = await supabase
          .from("reels")
          .select("video_url")
          .eq("id", itemToDelete.id as any)
          .eq("user_id", userId as any)
          .single();

        if (reelError || !reel) throw reelError || new Error("Reel not found");

        // Type guard to ensure reel has video_url property
        if (reel && 'video_url' in reel && (reel as any).video_url) {
          const filePath = (reel as any).video_url.split("/").slice(-2).join("/");
          await supabase.storage.from("reels").remove([filePath]);
        }

        await supabase
          .from("reels")
          .delete()
          .eq("id", itemToDelete.id as any)
          .eq("user_id", userId as any);

        // Refetch reels after deletion
        await refetchReels();
      }

      Alert.alert("Success", `${itemToDelete.type} deleted successfully.`);
    } catch (__error) {
      console.error(`Error deleting ${itemToDelete.type}:`, __error);
      Alert.alert("Error", `Failed to delete ${itemToDelete.type}. Please try again.`);
    } finally {
      setIsDeleteModalVisible(false);
      setItemToDelete(null);
    }
  };

  // Unused function - keeping for reference
  /*
  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: post, error: postError } = await supabase
                .from("posts")
                .select("image_urls")
                .eq("id", postId)
                .eq("user_id", userId)
                .single();

              if (postError || !post)
                throw postError || new Error("Post not found");

              if (post.image_urls && post.image_urls.length > 0) {
                const filePaths = post.image_urls.map((url) =>
                  url.split("/").slice(-2).join("/")
                );
                const { error: storageError } = await supabase.storage
                  .from("media")
                  .remove(filePaths);

                if (storageError) throw storageError;
              }

              const { error: postDeleteError } = await supabase
                .from("posts")
                .delete()
                .eq("id", postId)
                .eq("user_id", userId);

              if (postDeleteError) throw postDeleteError;

              setPosts(posts.filter((post) => post.id !== postId));
              Alert.alert("Success", "Post deleted successfully.");
            } catch (__error) {
              console.error(
                "Error deleting post:",
                JSON.stringify(error, null, 2)
              );
              Alert.alert("Error", "Failed to delete post. Please try again.");
            }
          },
        },
      ]
    );
  };
  */

  // Unused function - keeping for reference
  /*
  const handleDeleteReel = async (reelId: string) => {
    Alert.alert(
      "Delete Reel",
      "Are you sure you want to delete this reel? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: reel, error: reelError } = await supabase
                .from("reels")
                .select("video_url")
                .eq("id", reelId)
                .eq("user_id", userId)
                .single();

              if (reelError || !reel)
                throw reelError || new Error("Reel not found");

              if (reel.video_url) {
                const filePath = reel.video_url.split("/").slice(-2).join("/");
                const { error: storageError } = await supabase.storage
                  .from("media")
                  .remove([filePath]);

                if (storageError) throw storageError;
              }

              const { error: deleteError } = await supabase
                .from("reels")
                .delete()
                .eq("id", reelId)
                .eq("user_id", userId);

              if (deleteError) throw deleteError;

              setReels(reels.filter((reel) => reel.id !== reelId));
              Alert.alert("Success", "Reel deleted successfully.");
            } catch (__error) {
              console.error(
                "Error deleting reel:",
                JSON.stringify(error, null, 2)
              );
              Alert.alert("Error", "Failed to delete reel. Please try again.");
            }
          },
        },
      ]
    );
  };
  */

  useEffect(() => {
    const getUserData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          setUserId(authData.user.id);
        }
        const userData = await AsyncStorage.getItem("user");

        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id);
        }
      } catch (__error) {
        console.error("❌ DEBUG: Error getting user data from AsyncStorage:", __error);
      }
    };
    getUserData();
  }, []);

  // OPTIMIZED: Lazy load snapshots - don't block initial render
  useEffect(() => {
    if (!userId) return;
    
    // Fire and forget - load in background
    const hydrateSnapshots = async () => {
      try {
        const profileSnap = await FallbackCache.get<any>(`profile:complete:${userId}`);
        if (profileSnap) {
          queryClient.setQueryData(['profile', 'complete', userId], profileSnap);
        }
        const postsSnap = await FallbackCache.get<any[]>(`profile:posts:${userId}:12:0`);
        if (postsSnap) {
          queryClient.setQueryData(['profile', 'posts', userId, 12, 0], postsSnap);
        }
        const reelsSnap = await FallbackCache.get<any[]>(`profile:reels:${userId}:12:0`);
        if (reelsSnap) {
          queryClient.setQueryData(['profile', 'reels', userId, 12, 0], reelsSnap);
        }
        const bookmarksSnap = await FallbackCache.get<any[]>(`profile:bookmarks:${userId}:12:0`);
        if (bookmarksSnap) {
          queryClient.setQueryData(['profile', 'bookmarks', userId, 12, 0], bookmarksSnap);
        }
      } catch (error) {
        // Silent fail - queries will load from network
      }
    };
    
    // Don't await - let it run in background
    hydrateSnapshots();
  }, [userId, queryClient]);

  useEffect(() => {
    const persistSnapshots = async () => {
      if (userId && profileData) {
        await FallbackCache.set<any>(`profile:complete:${userId}`, profileData, 1800);
      }
      if (userId && posts) {
        await FallbackCache.set<any[]>(`profile:posts:${userId}:12:0`, posts, 1800);
      }
      if (userId && reels) {
        await FallbackCache.set<any[]>(`profile:reels:${userId}:12:0`, reels, 1800);
      }
      if (userId && bookmarks) {
        await FallbackCache.set<any[]>(`profile:bookmarks:${userId}:12:0`, bookmarks, 1800);
      }
    };
    persistSnapshots();
  }, [userId, profileData, posts, reels, bookmarks]);

  // OPTIMIZED: Removed aggressive prefetching - causes slowdown on profile load
  // Tabs will load on-demand when user switches to them

  useEffect(() => {
    return () => {
      pauseAllVideos();
      videoRefs.current.clear();
    };
  }, [pauseAllVideos]);

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postContainer}>
      <TouchableOpacity
        style={[styles.postThumbnail, {
          backgroundColor: `${colors.primary}10`,
          shadowOpacity: 0
        }]}
        onPress={() => router.navigate(`/post/${item.id}`)}
      >
        <Image
          source={{ uri: item.image_urls[0] }}
          style={styles.thumbnailImage}
        />
        {/* Multiple images indicator */}
        {item.image_urls && item.image_urls.length > 1 && (
          <View style={styles.multipleImagesIndicator}>
            <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
      {activeTab === "posts" && item.user_id === userId && (
        <TouchableOpacity
          style={[styles.optionsButton, { backgroundColor: `${colors.backgroundSecondary}99` }]}
          onPress={() => handlePostOptions(item)}
        >
          <Feather name="more-horizontal" size={16} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Reel Thumbnail Video Component using expo-video
  const ReelThumbnailVideo = ({ videoUri }: { videoUri: string }) => {
    const player = useVideoPlayer(videoUri, (player) => {
      player.loop = false;
      player.muted = true;
      if (activeTab === "reels") {
        player.play();
      }
    });

    React.useEffect(() => {
      if (activeTab === "reels") {
        player.play();
      } else {
        player.pause();
      }
    }, [activeTab]);

    return (
      <VideoView
        style={styles.thumbnailImage}
        player={player}
        contentFit="contain"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    );
  };

  const ReelItem = React.memo(({ item }: { item: any }) => {
    return (
      <View style={styles.postContainer}>
        <TouchableOpacity
          style={[styles.postThumbnail, {
            backgroundColor: `${colors.primary}10`,
            shadowOpacity: 0
          }]}
          onPress={() => {
            pauseAllVideos();
            router.navigate(`/reel/${item.id}`);
          }}
        >
          <ReelThumbnailVideo videoUri={item.video_url} />
        </TouchableOpacity>
        {activeTab === "reels" && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: `${colors.backgroundSecondary}99` }]}
            onPress={() => handleDelete(item.id, 'reel')}
          >
            <Feather name="trash-2" size={16} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  });
  
  ReelItem.displayName = 'ReelItem';

  // Show skeleton loader ONLY when loading AND no cached data exists
  if (isProfileLoading && !isProfileFetched && !profileData) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#000000' }]}>
        <StatusBar 
          barStyle="light-content"
          backgroundColor="#000000"
        />
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#000000' }]}>
      <StatusBar 
        barStyle="light-content"
        backgroundColor="#000000"
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: `${colors.primary}20` }]}>
        <View style={styles.headerUserInfo}>
          <Text className="font-rubik-bold" style={[styles.headerTitle, { color: colors.text }]}>
            {userInfo.username}
          </Text>
          
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => router.navigate("/create")}
            style={[styles.headerIconButton, {
              backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
              borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.3)'
            }]}
          >
            <Feather name="plus-square" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerIconButton, {
              backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
              borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.3)'
            }]}
          >
            <Feather name="share-2" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.headerIconButton, {
              backgroundColor: `${colors.error}20`,
              borderColor: `${colors.error}50`
            }]}
          >
            <Feather name="log-out" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {isProfileLoading && !profileData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              {...enhancedRefresh.refreshControlProps}
            />
          }
        >
          <ProfileRedesign
            username={userInfo.username || ''}
            avatar={userInfo.avatar}
            stats={{
              posts: (posts?.length || 0) + (reels?.length || 0),
              followers: userInfo.followers ?? 0,
              following: userInfo.following ?? 0,
              rank: userRankStats?.rank_position || null,
              points: userRankStats?.total_points || 0,
            }}
            name={userInfo.name || ''}
            description={userInfo.bio || ''}
            website={userInfo.website || ''}
            rankTag={(userInfo as any).current_tier || ''}
            accountType={userInfo.accountType}
            gender={userInfo.gender}
            badgeUserId={userId}
            userRankStats={userRankStats}
            onEditProfile={() => router.navigate("/edit-profile")}
            onFollowersPress={() => userId && router.push(`/(root)/followers/${userId}`)}
            onFollowingPress={() => userId && router.push(`/(root)/following/${userId}`)}
          />
          {/* Legacy profile info and bio sections removed in favor of redesigned card. Header remains intact. */}

          <View style={[styles.tabsContainer, {
            borderTopColor: `${colors.primary}20`,
            backgroundColor: `${colors.backgroundSecondary}80`
          }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "posts" && [styles.activeTab, { borderBottomColor: colors.text }]
              ]}
              onPress={() => {
                pauseAllVideos();
                setActiveTab("posts");
              }}
            >
              <MaterialCommunityIcons
                name="grid"
                size={24}
                color={
                  activeTab === "posts" ? colors.text : colors.textTertiary
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "saved" && [styles.activeTab, { borderBottomColor: colors.text }]
              ]}
              onPress={() => {
                pauseAllVideos();
                setActiveTab("saved");
              }}
            >
              <Feather
                name="bookmark"
                size={24}
                color={
                  activeTab === "saved" ? colors.text : colors.textTertiary
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "reels" && [styles.activeTab, { borderBottomColor: colors.text }]
              ]}
              onPress={() => {
                pauseAllVideos();
                setActiveTab("reels");
              }}
            >
              <Feather
                name="video"
                size={24}
                color={
                  activeTab === "reels" ? colors.text : colors.textTertiary
                }
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={
              activeTab === "posts"
                ? posts
                : activeTab === "saved"
                ? bookmarks
                : reels
            }
            renderItem={({ item }: { item: any }) =>
              activeTab === "reels" ? (
                <ReelItem item={item} />
              ) : (
                renderPost({ item })
              )
            }
            numColumns={3}
            keyExtractor={(item: any) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.postsContainer}
          />
        </ScrollView>
      )}
      <DeleteModal
        isVisible={isDeleteModalVisible}
        title={`Delete ${itemToDelete?.type || ''}`}
        desc={itemToDelete?.type || ''}
        cancel={() => {
          setIsDeleteModalVisible(false);
          setItemToDelete(null);
        }}
        confirm={handleConfirmDelete}
      />

      {/* Post Options Modal */}
      <Modal
        visible={isPostOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPostOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsPostOptionsVisible(false)}
        >
          <View style={[styles.optionsModal, { backgroundColor: colors.backgroundSecondary }]}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => handleSharePost(selectedPost)}
            >
              <Feather name="share" size={20} color={colors.text} />
              <Text style={[styles.optionText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>

            <View style={[styles.optionSeparator, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => handleEditPost(selectedPost)}
            >
              <Feather name="edit-2" size={20} color={colors.text} />
              <Text style={[styles.optionText, { color: colors.text }]}>Edit</Text>
            </TouchableOpacity>

            <View style={[styles.optionSeparator, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => handleDeleteFromOptions(selectedPost)}
            >
              <Feather name="trash-2" size={20} color={colors.error} />
              <Text style={[styles.optionText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerUserInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Rubik-Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  headerIconButton: {
    padding: 10,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  profileInfo: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 16,
  },
  statsContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
  },
  statLabel: {
    fontSize: 14,
  },
  username: {
    fontSize: 16,
  },
  bio: {
    marginTop: 6,
    fontSize: 14,
  },
  bioSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bioTextContainer: {
    flex: 1,
  },
  infoContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginLeft: 16,
  },
  infoText: {
    fontSize: 14,
  },
  editButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    // borderBottomColor is set inline
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  postThumbnail: {
    width: (Dimensions.get("window").width - 36) / 3,
    height: (Dimensions.get("window").width - 36) / 3,
    margin: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  postContainer: {
    position: "relative",
  },
  postsContainer: {
    paddingHorizontal: 1,
    paddingBottom: 16,
  },
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 12,
    padding: 6,
    zIndex: 1,
  },
  multipleImagesIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    padding: 4,
  },
  optionsButton: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 12,
    padding: 6,
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
    marginLeft: 12,
  },
  optionSeparator: {
    height: 1,
    marginHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
});

export default Profile;
