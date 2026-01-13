import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Share,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

import { VideoView, useVideoPlayer } from "expo-video";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { useSupabaseFetch } from "@/hooks/useSupabaseFetch";
import CachedImage from "@/components/CachedImage";
import { useTheme } from "@/src/context/ThemeContext";
import { SupabaseNotificationBroadcaster } from "@/lib/supabaseNotificationManager";
import BadgeDisplay from "@/components/BadgeDisplay";
import { authManager } from "@/lib/authManager";
import { generateShareContent } from "@/utils/deepLinkHelper";
import { profileViewsAPI } from "@/lib/referralApi";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";
import { useCompleteProfileData, useProfilePosts, useProfileReels, useProfileBookmarks, useToggleFollow } from "@/lib/query/hooks/useProfileQuery";
import { useQueryClient } from "@tanstack/react-query";
import FallbackCache from "@/lib/utils/fallbackCache";

interface ProfileParams extends Record<string, string | string[]> {
  id: string;
  avatar_url: string;
}

// Reel Thumbnail Video Component
const ReelThumbnailVideo = ({ videoUri }: { videoUri: string }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = true;
    player.play();
  });

  return (
    <VideoView
      style={styles.thumbnailImage}
      player={player}
      contentFit="cover"
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
};

const UserProfile = () => {
  const params = useLocalSearchParams<ProfileParams>();
  const id = params.id;
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isDarkMode, colors } = useTheme();
  const queryClient = useQueryClient();

  // Debug: Log initial state
  useEffect(() => {
    console.log('👤 UserProfile mounted:', {
      profileId: id,
      currentUserId,
      activeTab
    });
  }, []);

  // Debug: Log the profile ID being viewed
  useEffect(() => {
    console.log('👤 UserProfile: Viewing profile ID:', id);
    console.log('👤 UserProfile: Current user ID:', currentUserId);
    console.log('👤 UserProfile: Is viewing own profile?', id === currentUserId);
  }, [id, currentUserId]);

  // MAXIMUM SPEED: Ultra-aggressive cache for instant loading
  const {
    data: profileData,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
    isFetched: isProfileFetched
  } = useCompleteProfileData(id, currentUserId || undefined, {
    enabled: !!id,
    staleTime: Infinity, // Never stale - instant from cache
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // OPTIMIZED: Only load posts when posts tab is active
  const {
    data: userPosts = [],
    isLoading: isPostsLoading,
    refetch: refetchPosts
  } = useProfilePosts(id, 12, 0, {
    enabled: !!id && activeTab === 'posts', // ONLY load when posts tab active
    staleTime: Infinity,
    cacheTime: 24 * 60 * 60 * 1000,
  });

  // OPTIMIZED: Only load reels when reels tab is active
  const {
    data: userReels = [],
    isLoading: isReelsLoading,
    refetch: refetchReels
  } = useProfileReels(id, 12, 0, {
    enabled: !!id && activeTab === 'reels', // ONLY load when reels tab active
    staleTime: Infinity,
    cacheTime: 24 * 60 * 60 * 1000,
  });

  // OPTIMIZED: Lazy load snapshots - don't block initial render
  useEffect(() => {
    if (!id) return;
    
    // Fire and forget - load in background
    const hydrateSnapshots = async () => {
      try {
        const profileSnap = await FallbackCache.get<any>(`profile:complete:${id}`);
        if (profileSnap) {
          queryClient.setQueryData(['profile', 'complete', id], profileSnap);
        }
        const postsSnap = await FallbackCache.get<any[]>(`profile:posts:${id}:12:0`);
        if (postsSnap) {
          queryClient.setQueryData(['profile', 'posts', id, 12, 0], postsSnap);
        }
        const reelsSnap = await FallbackCache.get<any[]>(`profile:reels:${id}:12:0`);
        if (reelsSnap) {
          queryClient.setQueryData(['profile', 'reels', id, 12, 0], reelsSnap);
        }
      } catch (error) {
        // Silent fail - queries will load from network
      }
    };
    
    // Don't await - let it run in background
    hydrateSnapshots();
  }, [id, queryClient]);

  // Persist snapshots when fresh data arrives
  useEffect(() => {
    const persistSnapshots = async () => {
      if (id && profileData) {
        await FallbackCache.set<any>(`profile:complete:${id}`, profileData, 1800);
      }
      if (id && userPosts) {
        await FallbackCache.set<any[]>(`profile:posts:${id}:12:0`, userPosts, 1800);
      }
      if (id && userReels) {
        await FallbackCache.set<any[]>(`profile:reels:${id}:12:0`, userReels, 1800);
      }
    };
    persistSnapshots();
  }, [id, profileData, userPosts, userReels]);

  // OPTIMIZED: Only load bookmarks when saved tab is active AND viewing own profile
  const {
    data: userBookmarks = [],
    isLoading: isBookmarksLoading,
    refetch: refetchBookmarks
  } = useProfileBookmarks(id, 12, 0, {
    enabled: !!id && id === currentUserId && activeTab === 'saved', // ONLY when viewing saved tab on own profile
  });

  // Debug: Log bookmarks data
  useEffect(() => {
    console.log('📚 Bookmarks Debug:', {
      activeTab,
      isOwnProfile: id === currentUserId,
      bookmarksCount: userBookmarks.length,
      isLoading: isBookmarksLoading,
      enabled: !!id && id === currentUserId,
      userId: id,
      currentUserId,
      isViewingOwnProfile: id === currentUserId
    });
    if (userBookmarks.length > 0) {
      console.log('📚 First bookmark:', userBookmarks[0]);
      console.log('📚 Bookmark has image_urls:', !!userBookmarks[0]?.image_urls);
      console.log('📚 Bookmark image_urls length:', userBookmarks[0]?.image_urls?.length);
    } else {
      console.log('📚 No bookmarks in array - check database');
    }
  }, [userBookmarks, isBookmarksLoading, activeTab, id, currentUserId]);

  // Use optimized follow mutation
  const toggleFollowMutation = useToggleFollow();

  // Compute derived state from profile data
  const userProfile = profileData?.profile;
  const isFollowing = profileData?.is_following || false;
  
  // Debug: Log profile data
  useEffect(() => {
    if (userProfile) {
      console.log('📊 UserProfile: Loaded profile data:', {
        id: userProfile.id,
        username: userProfile.username,
        name: userProfile.name,
        isOwnProfile: userProfile.id === currentUserId
      });
    }
  }, [userProfile, currentUserId]);
  
  // Show skeleton only when loading AND no cached data
  const shouldShowSkeleton = isProfileLoading && !isProfileFetched && !userProfile;

  // Function to get tier icon based on mythological tier
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape':
        return '🎭'; // Trickster mask
      case 'Odin of Klicktape':
        return '👁️'; // All-seeing eye
      case 'Poseidon of Klicktape':
        return '🔱'; // Trident
      case 'Zeus of Klicktape':
        return '⚡'; // Lightning bolt
      case 'Hercules of Klicktape':
        return '💪'; // Strength
      default:
        return '🏆'; // Default trophy
    }
  };

  // Function to get tier name based on mythological tier
  const getTierName = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape': // Top 10
        return 'Loki of Klicktape';
      case 'Odin of Klicktape': // 11-20
        return 'Odin of Klicktape';
      case 'Poseidon of Klicktape': // 21-30
        return 'Poseidon of Klicktape';
      case 'Zeus of Klicktape': // 31-40
        return 'Zeus of Klicktape';
      case 'Hercules of Klicktape': // 41-50
        return 'Hercules of Klicktape';
      default:
        return tier; // Return the tier as is if not in the list
    }
  };



  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Use cached auth manager instead of direct Supabase call
        const user = await authManager.getCurrentUser();
        setCurrentUserId(user?.id || null);
      } catch (__error) {
        console.error("Error in fetchUser:", __error);
        // Fallback to direct Supabase call with proper error handling
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError) {
            if (authError.message?.includes('Auth session missing')) {
// console.log("🔐 Auth: No session found in userProfile");
              setCurrentUserId(null);
            } else {
              console.error("Fallback auth error:", authError);
              setCurrentUserId(null);
            }
          } else {
            setCurrentUserId(user?.id || null);
          }
        } catch (fallbackError) {
// console.warn("Fallback auth call failed:", fallbackError);
          setCurrentUserId(null);
        }
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    // OPTIMIZED: Track profile view in background - don't block render
    const trackView = async () => {
      // Track profile view after a delay to ensure user data is loaded
      if (currentUserId && id && currentUserId !== id) {
        try {
          if (__DEV__) {
// console.log('Tracking profile view:', { viewerId: currentUserId, viewedProfileId: id });
          }
          await profileViewsAPI.trackProfileView(currentUserId, id);
          if (__DEV__) {
// console.log('Profile view tracked successfully');
          }
        } catch (__error) {
          if (__DEV__) {
            console.error('Failed to track profile view:', __error);
          }
        }
      }
    };

    if (currentUserId !== null && id) {
      // OPTIMIZED: Fire and forget - don't block render
      setTimeout(trackView, 1000); // Increased delay to not interfere with initial render
    }
  }, [id, currentUserId]);

  // Optimized refresh using TanStack Query
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const promises = [
        refetchProfile(),
        refetchPosts(),
        refetchReels(),
      ];
      
      // Only refetch bookmarks if viewing saved tab on own profile
      if (activeTab === 'saved' && id === currentUserId) {
        promises.push(refetchBookmarks());
      }
      
      await Promise.all(promises);
    } catch (__error) {
      console.error("Error refreshing data:", __error);
    } finally {
      setRefreshing(false);
    }
  };

  // Optimized follow handler using fast RPC function with optimistic updates
  const handleFollow = async () => {
    if (!currentUserId) return;

    toggleFollowMutation.mutate({
      targetUserId: id,
      currentUserId: currentUserId,
    });
  };

  const handleShare = async () => {
    try {
      if (userProfile) {
        const shareContent = generateShareContent({
          type: 'profile',
          username: userProfile.username,
          id: userProfile.id,
        });

        await Share.share(shareContent);
      }
    } catch (error) {
      console.error("Error sharing profile:", error);
    }
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postContainer}>
      <TouchableOpacity
        style={[styles.postThumbnail, {
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"
        }]}
        onPress={() => item?.id ? router.push(`/post/${item.id}`) : null}
        disabled={!item?.id}
      >
        {item?.image_urls?.[0] ? (
          <>
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
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: isDarkMode ? "#111" : "#000" }} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderReel = ({ item }: { item: any }) => (
    <View style={styles.postContainer}>
      <TouchableOpacity
        style={[styles.postThumbnail, {
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"
        }]}
        onPress={() => router.push(`/reel/${item.id}`)}
      >
        <ReelThumbnailVideo videoUri={item.video_url} />
      </TouchableOpacity>
    </View>
  );

  // Show skeleton loader while initial data is loading
  if (shouldShowSkeleton) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <ProfileSkeleton />
        </SafeAreaView>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={[styles.header, { borderBottomColor: `${colors.primary}20` }]}>
            <Text className="font-rubik-bold" style={[styles.headerTitle, { color: '#FFFFFF' }]}>
              {userProfile.username || ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(root)/(tabs)/home');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.headerIconButton, {
                backgroundColor: `${colors.primary}20`,
                borderColor: `${colors.primary}50`
              }]}
            >
              <Feather name="x" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <FlatList
          data={activeTab === "posts" ? userPosts : activeTab === "reels" ? userReels : userBookmarks}
          renderItem={activeTab === "reels" ? renderReel : renderPost}
          numColumns={3}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.postsContainer}
          ListHeaderComponent={
            <>
              <View style={styles.profileInfo}>
                <View style={styles.avatarWrapper}>
                  <CachedImage
                    uri={userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.username || 'User')}&background=E5E7EB&color=9CA3AF&size=100`}
                    style={[styles.profileImage, { borderColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
                    showLoader={true}
                    fallbackUri={`https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.username || 'User')}&background=E5E7EB&color=9CA3AF&size=100`}
                  />
                </View>
                <View style={styles.statsContainer}>
                  <View style={styles.stat}>
                    <Text className="font-rubik-bold" style={[styles.statNumber, { color: colors.text }]}>
                      {profileData?.posts_count || 0}
                    </Text>
                    <Text className="font-rubik-medium" style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Posts
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stat}
                    onPress={() => router.push(`/(root)/followers/${id}`)}
                  >
                    <Text className="font-rubik-bold" style={[styles.statNumber, { color: colors.text }]}>
                      {profileData?.followers_count || 0}
                    </Text>
                    <Text className="font-rubik-medium" style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Followers
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stat}
                    onPress={() => router.push(`/(root)/following/${id}`)}
                  >
                    <Text className="font-rubik-bold" style={[styles.statNumber, { color: colors.text }]}>
                      {profileData?.following_count || 0}
                    </Text>
                    <Text className="font-rubik-medium" style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Following
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.bioSection}>
                <View style={styles.nameLine}>
                  <Text className="font-rubik-bold" style={[styles.username, { color: colors.text }]}>
                    {userProfile.name || userProfile.username}
                  </Text>
                </View>
                {userProfile?.current_tier && (
                  <View style={[styles.rewardTag, {
                    backgroundColor: `${colors.primary}20`,
                    borderColor: `${colors.primary}40`,
                    borderWidth: 1,
                  }]}>
                    <Text style={styles.tierIcon}>{getTierIcon(userProfile.current_tier)}</Text>
                    <Text className="font-rubik-medium" style={[styles.rewardText, { color: colors.primary }]}>
                      {getTierName(userProfile.current_tier)}
                    </Text>
                  </View>
                )}

                <Text className="font-rubik-medium" style={[styles.bio, { color: colors.textSecondary }]}>
                  {userProfile.headline}
                </Text>
               
                {!!userProfile.bio && (
                  <Text className="font-rubik-medium" style={[styles.bio, { color: colors.textSecondary }]}>
                    {userProfile.bio}
                  </Text>
                )}

                {/* Only show website if available */}
                {userProfile?.website && (
                  <TouchableOpacity onPress={() => Linking.openURL(userProfile.website)} style={{ marginTop: 8 }}>
                    <Text className="font-rubik-medium" style={[styles.externalLink, { color: "#1B74E4" }]}>
                      {userProfile.website}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Badges */}
                <View style={styles.badgeContainer}>
                  <BadgeDisplay userId={id as string} showTitle={false} maxBadges={3} />
                </View>
                {currentUserId !== id && (
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.followButton,
                        {
                          backgroundColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.2)`,
                          borderColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.3)`
                        },
                        isFollowing && [styles.followingButton, {
                          backgroundColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.1)`
                        }],
                      ]}
                      onPress={handleFollow}
                    >
                      <Text
                        className="font-rubik-bold"
                        style={[styles.followButtonText, { color: colors.text }]}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.messageButton, {
                        backgroundColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.1)`,
                        borderColor: `rgba(${isDarkMode ? '255, 215, 0' : '184, 134, 11'}, 0.3)`
                      }]}
                      onPress={() => router.push(`/chats/${id}`)}
                    >
                      <Text
                        className="font-rubik-bold"
                        style={[styles.followButtonText, { color: colors.text }]}
                      >
                        Message
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[styles.tabsContainer, {
                borderTopColor: `${colors.primary}20`,
                backgroundColor: `${colors.backgroundSecondary}80`
              }]}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === "posts" && [styles.activeTab, { borderBottomColor: '#FFFFFF' }]
                  ]}
                  onPress={() => setActiveTab("posts")}
                >
                  <MaterialCommunityIcons
                    name="grid"
                    size={24}
                    color={activeTab === "posts" ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === "reels" && [styles.activeTab, { borderBottomColor: '#FFFFFF' }]
                  ]}
                  onPress={() => setActiveTab("reels")}
                >
                  <Feather
                    name="video"
                    size={24}
                    color={activeTab === "reels" ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'}
                  />
                </TouchableOpacity>
                {/* Only show saved tab if viewing own profile */}
                {currentUserId === id && (
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === "saved" && [styles.activeTab, { borderBottomColor: '#FFFFFF' }]
                    ]}
                    onPress={() => {
                      console.log('📚 Saved tab clicked, switching to saved tab');
                      console.log('📚 Current bookmarks count:', userBookmarks.length);
                      setActiveTab("saved" as any);
                    }}
                  >
                    <Text
                      className="font-rubik-medium"
                      style={{ color: activeTab === "saved" ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)' }}
                    >
                      Saved
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text className="font-rubik-medium" style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {activeTab} yet
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    letterSpacing: 0.5,
  },
  headerIconButton: {
    padding: 10,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  profileInfo: {
    flexDirection: "column",
    padding: 20,
    alignItems: "center",
  },
  avatarWrapper: {
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.15)",
    elevation: 6,
    borderRadius: 50,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 0,
    marginBottom: 16,
    borderWidth: 2.5, // Added border width for visibility
  },
  statsContainer: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
  },
  bioSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  username: {
    fontSize: 18,
    textAlign: "center",
  },
  // Wrapper for the top gradient
  headerGradient: {
    // Intentionally left minimal to fix TS style reference
  },
  bio: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  rewardTag: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardText: {
    color: '#fff',
    fontSize: 12.5,
  },
  tierIcon: {
    fontSize: 14,
  },
  externalLink: {
    marginTop: 6,
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  badgeContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  followButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  followingButton: {
    // Will be set dynamically
  },
  messageButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  followButtonText: {
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    // borderBottomColor will be set dynamically
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  postThumbnail: {
    width: (Dimensions.get("window").width - 36) / 3,
    height: (Dimensions.get("window").width - 36) / 3,
    margin: 6,
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
    elevation: 3,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  multipleImagesIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    padding: 4,
  },
  postContainer: {
    position: "relative",
  },
  postsContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    width: Dimensions.get("window").width,
  },
  emptyText: {
    fontSize: 16,
  },
});

export default UserProfile;
