import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Image,
  Pressable,
  BackHandler,
  StatusBar,
  Platform,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector , useDispatch as useReduxDispatch } from "react-redux";
// Lazy load video components for better performance
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import NetInfo from "@react-native-community/netinfo";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import {
  fetchReels,
  resetReels,
  selectHasMore,
  selectLoading,
  selectReels,
  toggleLike,
  optimisticToggleLike,
} from "@/src/store/slices/reelsSlice";
import { Reel } from "@/types/type";
import { AppDispatch } from "@/src/store/store";

import { router } from "expo-router";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/lib/authContext";
import { usersApi } from "@/lib/usersApi";
import { ThemedGradient } from "@/components/ThemedGradient";
import ReelsSkeleton from "@/components/skeletons/ReelsSkeleton";
import { useEnhancedRefresh } from "@/hooks/useEnhancedRefresh";
import { getOptimizer } from "@/lib/performance/instagramStyleOptimizer";
import { useQueryClient } from '@tanstack/react-query';
// Conditional import for react-native-reanimated (native only)
let Animated: any;
let useSharedValue: any;
let useAnimatedStyle: any;
let withSpring: any;

if (Platform.OS !== 'web') {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default;
  useSharedValue = reanimated.useSharedValue;
  useAnimatedStyle = reanimated.useAnimatedStyle;
  withSpring = reanimated.withSpring;
} else {
  // Web fallbacks
  Animated = require("react-native").Animated;
  useSharedValue = (value: number) => ({ value });
  useAnimatedStyle = (callback: () => any) => callback();
  withSpring = (value: number) => value;
}

const { width, height } = Dimensions.get("window");
const REELS_PER_PAGE = 5;

const Reels = () => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useReduxDispatch<AppDispatch>();
  const reels = useSelector(selectReels);
  const loading = useSelector(selectLoading);
  const hasMore = useSelector(selectHasMore);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleReelId, setVisibleReelId] = useState<string | null>(null);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const currentIndexRef = useRef(0);

  // Initialize Instagram-style optimizer for reels
  useEffect(() => {
    if (user?.id && queryClient) {
      const optimizer = getOptimizer(queryClient, user.id);
      
      // **ZERO-SECOND LOADING**: Prefetch initial reels IMMEDIATELY (no delay)
      if (reels.length > 0) {
        optimizer.prefetcher.prefetchReels(0, reels);
      }
    }
  }, [user?.id, queryClient, reels.length]);

  // Double tap functionality
  const lastTap = useRef<number | null>(null);
  const doubleTapDelay = 300; // milliseconds

  // Handle tab focus/blur for video playback control
  useFocusEffect(
    useCallback(() => {
      // Tab is focused - allow video playback
      setIsTabFocused(true);
      
      return () => {
        // Tab is blurred - pause all videos
        setIsTabFocused(false);
      };
    }, [])
  );

  // Removed universal refresh hook - using standard refresh instead

  useEffect(() => {
    const checkAndFetch = async () => {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert(
          "No Internet",
          "Please check your network connection and try again."
        );
        return;
      }
      dispatch(
        fetchReels({ offset: 0, limit: REELS_PER_PAGE, forceRefresh: false })
      );
    };
    checkAndFetch();
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Local reels refresh
      dispatch(resetReels());
      await dispatch(
        fetchReels({ offset: 0, limit: REELS_PER_PAGE, forceRefresh: true })
      ).unwrap();
    } catch (__error) {
      console.error("Error refreshing reels:", __error);
      Alert.alert("Error", "Failed to refresh reels. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  // Enhanced refresh hook for Instagram-like pull-to-refresh
  const enhancedRefresh = useEnhancedRefresh({
    onRefresh: onRefresh,
    enableHaptics: true,
    animationDuration: 300,
  });

  const loadMoreReels = useCallback(() => {
    if (!loading && hasMore) {
      dispatch(
        fetchReels({
          offset: reels.length,
          limit: REELS_PER_PAGE,
          forceRefresh: false,
        })
      );
    }
  }, [dispatch, loading, hasMore, reels.length]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0].item as Reel;
      setVisibleReelId(visibleItem.id);
      
      if (viewableItems[0].index !== null) {
        currentIndexRef.current = viewableItems[0].index;
        
        // **ZERO-SECOND LOADING**: Prefetch next reels IMMEDIATELY (Instagram-style)
        if (user?.id) {
          const optimizer = getOptimizer(queryClient, user.id);
          // IMMEDIATE execution for zero-second loading
          // Use the latest reels from a ref to keep this function stable
          optimizer.prefetcher.prefetchReels(viewableItems[0].index!, reelsRef.current);
        }
      }
    }
  }).current;

  // Keep reelsRef updated
  const reelsRef = useRef(reels);
  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 500,
  }).current;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    []
  );

  const renderReel = useCallback(
    ({ item }: { item: Reel }) => {
      const isVisible = item.id === visibleReelId;
      return <ReelItem reel={item} isVisible={isVisible} isTabFocused={isTabFocused} queryClient={queryClient} />;
    },
    [visibleReelId, isTabFocused, queryClient]
  );

  if (!loading && reels.length === 0) {
    return (
      <ThemedGradient style={styles.container}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No tapes available</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={enhancedRefresh.onRefresh}
          >
            <Text style={[styles.retryButtonText, { color: colors.background }]}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReel}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.1}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        refreshControl={
          <RefreshControl
            {...enhancedRefresh.refreshControlProps}
          />
        }
        ListFooterComponent={
          loading && reels.length > 0 ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : null
        }
      />
      {loading && reels.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ReelsSkeleton />
        </View>
      )}
    </View>
  );
};

const ReelItem: React.FC<{
  reel: Reel;
  isVisible: boolean;
  isTabFocused: boolean;
  queryClient: any;
}> = ({ reel, isVisible, isTabFocused, queryClient }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const dispatch = useReduxDispatch<AppDispatch>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const playerRef = useRef<any>(null);
  const isMounted = useRef(true);
  const lastTap = useRef<number | null>(null);
  const doubleTapDelay = 300; // milliseconds
  const pauseStartTime = useRef<number | null>(null);

  const player = useVideoPlayer(reel.video_url, (player) => {
    player.loop = true;
    player.muted = false;
    playerRef.current = player;
  });

  // Initialize shared values unconditionally
  const likeScale = useSharedValue(1);
  const commentScale = useSharedValue(1);
  const muteScale = useSharedValue(1);
  const playPauseScale = useSharedValue(1);
  const followScale = useSharedValue(1);

  const scaleValues = Platform.OS === 'web' ? {
    like: { value: 1 },
    comment: { value: 1 },
    mute: { value: 1 },
    playPause: { value: 1 },
    follow: { value: 1 },
  } : {
    like: likeScale,
    comment: commentScale,
    mute: muteScale,
    playPause: playPauseScale,
    follow: followScale,
  };

  // Check following status on mount
  useEffect(() => {
    const checkFollowingStatus = async () => {
      if (!user?.id || user.id === reel.user_id) return;
      
      try {
        const following = await usersApi.checkFollowing(reel.user_id, user.id);
        setIsFollowing(following);
      } catch (__error) {
        console.error('Error checking follow status:', __error);
      }
    };

    checkFollowingStatus();
  }, [user?.id, reel.user_id]);

  useEffect(() => {
    isMounted.current = true;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (playerRef.current && isMounted.current) {
          try {
            playerRef.current.pause();
            setIsPlaying(false);
          } catch (__error) {
// console.warn("Error pausing video on back press:", __error);
          }
        }
        return false;
      }
    );

    return () => {
      isMounted.current = false;
      backHandler.remove();
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current = null;
        } catch (__error) {
// console.warn("Error cleaning up video player:", __error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;

    try {
      if (isVisible && isTabFocused && playerRef.current) {
        playerRef.current.play();
        setIsPlaying(true);
        pauseStartTime.current = Date.now();
      } else if (playerRef.current) {
        playerRef.current.pause();
        setIsPlaying(false);
        
        // Track pause behavior for Instagram-style predictions
        if (pauseStartTime.current && user?.id) {
          const pauseDuration = Date.now() - pauseStartTime.current;
          if (pauseDuration > 2000) { // Paused for > 2 seconds
            const optimizer = getOptimizer(queryClient, user.id);
            optimizer.predictor.trackBehavior({
              pauseDuration,
              scrollSpeed: 0,
              interactionType: 'reel_pause',
              timestamp: Date.now(),
            });
          }
        }
      }
    } catch (__error) {
// console.warn("Error controlling video playback:", __error);
    }
  }, [isVisible, isTabFocused, user?.id, queryClient]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      if (isMounted.current && playerRef.current) {
        try {
          playerRef.current.pause();
          setIsPlaying(false);
        } catch (__error) {
// console.warn("Error pausing video on navigation:", __error);
        }
      }
    });

    return () => {
      unsubscribe();
      if (isMounted.current && playerRef.current) {
        try {
          playerRef.current.pause();
          setIsPlaying(false);
        } catch (__error) {
// console.warn("Error pausing video on cleanup:", __error);
        }
      }
    };
  }, [navigation]);

  const handleToggleLike = async () => {
    if (!reel.id || typeof reel.id !== "string" || reel.id === "undefined") {
      console.error("Invalid reel ID:", reel.id, "Reel:", reel);
      Alert.alert("Error", "Cannot like this reel due to an invalid ID.");
      return;
    }

    // Calculate new state for optimistic update
    const newIsLiked = !reel.is_liked;
    const newLikesCount = reel.is_liked ? reel.likes_count - 1 : reel.likes_count + 1;

    // Animate the like button
    if (Platform.OS !== 'web') {
      scaleValues.like.value = withSpring(1.2, {}, () => {
        scaleValues.like.value = withSpring(1);
      });
    }

    // Store original values in case we need to revert
    const originalIsLiked = reel.is_liked;
    const originalLikesCount = reel.likes_count;

    // Apply optimistic update
    dispatch(optimisticToggleLike({
      reelId: reel.id,
      is_liked: newIsLiked,
      likes_count: newLikesCount,
    }));

    try {
      // Make the actual API call
      await dispatch(
        toggleLike({
          reelId: reel.id,
          isLiked: originalIsLiked // Pass the original state, not the optimistically updated one
        })
      ).unwrap();


    } catch (__error: any) {
      console.error("Error toggling like:", __error);

      // Revert the optimistic update if the API call fails
      dispatch(optimisticToggleLike({
        reelId: reel.id,
        is_liked: originalIsLiked,
        likes_count: originalLikesCount,
      }));

      if (!__error.message?.includes("duplicate key value")) {
        Alert.alert(
          "Error",
          `Failed to toggle like: ${__error.message || "Unknown error"}`
        );
      }
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < doubleTapDelay) {
      // Double tap detected - only like if not already liked
      if (!reel.is_liked) {
        handleToggleLike();
      }
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  };

  const handleFollow = async () => {
    if (!user?.id || user.id === reel.user_id || followLoading) {
      return;
    }
    
    setFollowLoading(true);
    
    // Animate the follow button
    if (Platform.OS !== 'web') {
      scaleValues.follow.value = withSpring(1.2, {}, () => {
        scaleValues.follow.value = withSpring(1);
      });
    }
    
    try {
      const result = await usersApi.toggleFollow(reel.user_id, user.id);
      setIsFollowing(result);
    } catch (__error) {
      console.error('Error toggling follow:', __error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleComment = () => {
    if (!isMounted.current) return;

    if (Platform.OS !== 'web') {
      scaleValues.comment.value = withSpring(1.2, {}, () => {
        scaleValues.comment.value = withSpring(1);
      });
    }

    if (playerRef.current) {
      try {
        playerRef.current.pause();
        setIsPlaying(false);
      } catch (__error) {
// console.warn("Error pausing video before comment navigation:", __error);
      }
    }

    router.push({
      pathname: "/reels-comments-screen",
      params: {
        reelId: reel.id,
        reelOwnerUsername: reel.user.username,
        reelOwnerId: reel.user_id,
      },
    });
  };

  const handleMute = () => {
    if (!isMounted.current) return;

    setIsMuted(!isMuted);
    if (playerRef.current) {
      try {
        playerRef.current.muted = !isMuted;
      } catch (__error) {
// console.warn("Error toggling mute:", __error);
      }
    }
    if (Platform.OS !== 'web') {
      scaleValues.mute.value = withSpring(1.2, {}, () => {
        scaleValues.mute.value = withSpring(1);
      });
    }
  };

  const handlePlayPause = () => {
    if (!isMounted.current) return;

    try {
      if (isPlaying && playerRef.current) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else if (playerRef.current) {
        playerRef.current.play();
        setIsPlaying(true);
      }
    } catch (__error) {
// console.warn("Error toggling play/pause:", __error);
    }
    if (Platform.OS !== 'web') {
      scaleValues.playPause.value = withSpring(1.2, {}, () => {
        scaleValues.playPause.value = withSpring(1);
      });
    }
  };

  const handleProfilePress = () => {
    if (!isMounted.current) return;

    // Track profile view for Instagram-style prefetching
    if (user?.id && reel.user_id !== user.id) {
      const optimizer = getOptimizer(queryClient, user.id);
      optimizer.onProfileView(reel.user_id);
    }

    if (playerRef.current) {
      try {
        playerRef.current.pause();
        setIsPlaying(false);
      } catch (__error) {
// console.warn("Error pausing video before profile navigation:", __error);
      }
    }
    router.push(`/userProfile/${reel.user_id}`);
  };

  // Initialize animated styles - always call hooks unconditionally
  const likeAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: scaleValues.like.value }] };
  });
  
  const commentAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: scaleValues.comment.value }] };
  });
  
  const muteAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: scaleValues.mute.value }] };
  });
  
  const playPauseAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: scaleValues.playPause.value }] };
  });
  
  const followAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: scaleValues.follow.value }] };
  });

  const animatedStyles = Platform.OS === 'web' ? {
    like: { transform: [{ scale: 1 }] },
    comment: { transform: [{ scale: 1 }] },
    mute: { transform: [{ scale: 1 }] },
    playPause: { transform: [{ scale: 1 }] },
    follow: { transform: [{ scale: 1 }] },
  } : {
    like: likeAnimatedStyle,
    comment: commentAnimatedStyle,
    mute: muteAnimatedStyle,
    playPause: playPauseAnimatedStyle,
    follow: followAnimatedStyle,
  };

  const caption =
    reel.caption.length > 100 && !showFullCaption
      ? reel.caption.slice(0, 100) + "..."
      : reel.caption;

  return (
    <View style={[styles.reelContainer, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(0,0,0,0.4)", "transparent"]}
        style={styles.headerGradient}
      >
        <SafeAreaView style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (playerRef.current) {
                try {
                  playerRef.current.pause();
                  setIsPlaying(false);
                } catch (__error) {
// console.warn("Error pausing video on back:", __error);
                }
              }
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(root)/(tabs)/home');
              }
            }}
            style={[
              styles.backButton,
              {
                backgroundColor: `${colors.primary}10`,
                borderColor: `${colors.primary}30`
              }
            ]}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: "#FFFFFF" }]}>Tapes</Text>
          <View style={styles.headerRightPlaceholder} />
        </SafeAreaView>
      </LinearGradient>

      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
        />
      </TouchableWithoutFeedback>

      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.5)"]}
        style={styles.gradientOverlay}
      >
        <View style={styles.contentContainer}>
          <View style={styles.mainContent}>
            <Pressable
              style={[
                styles.userInfo,
                {
                  backgroundColor: `${colors.primary}05`,
                  borderColor: `${colors.primary}20`
                }
              ]}
              onPress={handleProfilePress}
            >
              <Image source={{ uri: reel.user.avatar_url || "https://via.placeholder.com/150" }} style={styles.avatar} />
              <Text style={[styles.username, { color: "white" }]}>@{reel.user.username}</Text>
              
              {user?.id !== reel.user_id && !isFollowing && (
                <Animated.View style={[animatedStyles.follow, { marginLeft: 12 }]}>
                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      }
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    <Text style={[styles.followButtonText, { color: "white" }]}>
                      {followLoading ? "..." : "Follow"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Pressable>

            <View style={styles.captionContainer}>
              <Text style={[styles.caption, { color: "white" }]}>{caption}</Text>
              {reel.caption.length > 100 && (
                <TouchableOpacity
                  onPress={() => setShowFullCaption(!showFullCaption)}
                >
                  <Text style={[styles.showMore, { color: "white" }]}>
                    {showFullCaption ? "Show less" : "Show more"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.actionWrapper}>
              <Animated.View style={[
                styles.actionButton,
                {
                  backgroundColor: `${colors.primary}05`,
                  borderColor: `${colors.primary}20`
                },
                animatedStyles.like
              ]}>
                <TouchableOpacity
                  onPress={handleToggleLike}
                  accessibilityLabel={`Like reel, ${reel.likes_count} likes`}
                >
                  {reel.is_liked ? (
                    <AntDesign
                      name="heart"
                      size={28}
                      color="#E91E63"
                    />
                  ) : (
                    <Feather
                      name="heart"
                      size={28}
                      color="white"
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                onPress={() => router.push(`/(root)/reel-likes/${reel.id}` as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionCount, { color: "white" }]}>{reel.likes_count}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionWrapper}>
              <Animated.View
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: `${colors.primary}05`,
                    borderColor: `${colors.primary}20`
                  },
                  animatedStyles.comment
                ]}
              >
                <TouchableOpacity onPress={handleComment}>
                  <Feather name="message-circle" size={28} color="white" />
                </TouchableOpacity>
              </Animated.View>
              <Text style={[styles.actionCount, { color: "white" }]}>{reel.comments_count}</Text>
            </View>

            <Animated.View style={[
              styles.actionButton,
              {
                backgroundColor: `${colors.primary}05`,
                borderColor: `${colors.primary}20`
              },
              animatedStyles.mute
            ]}>
              <TouchableOpacity onPress={handleMute}>
                <Feather
                  name={isMuted ? "volume-x" : "volume-2"}
                  size={28}
                  color="white"
                />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.actionButton,
                {
                  backgroundColor: `${colors.primary}05`,
                  borderColor: `${colors.primary}20`
                },
                animatedStyles.playPause
              ]}
            >
              <TouchableOpacity onPress={handlePlayPause}>
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={28}
                  color="white"
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reelContainer: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Rubik-Bold",
    // textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)", // Commented out as it's not supported in React Native
  },
  headerRightPlaceholder: {
    width: 36,
  },
  video: {
    width: "100%",
    height: "100%",
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
    padding: 16,
    paddingBottom: 80,
    justifyContent: "flex-end",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  mainContent: {
    flex: 1,
    marginRight: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  username: {
    fontSize: 16,
    fontFamily: "Rubik-Bold",
    marginLeft: 8,
  },
  captionContainer: {
    marginBottom: 16,
  },
  caption: {
    fontSize: 16,
    fontFamily: "Rubik-Regular",
    lineHeight: 22,
  },
  showMore: {
    fontSize: 14,
    fontFamily: "Rubik-Medium",
    marginTop: 4,
  },
  actions: {
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
  },
  actionWrapper: {
    alignItems: "center",
    gap: 4,
  },
  actionButton: {
    alignItems: "center",
    padding: 8,
    borderRadius: 24,
    borderWidth: 1,
    width: 48,
    height: 48,
    justifyContent: "center",
  },
  actionCount: {
    fontSize: 14,
    fontFamily: "Rubik-Medium",
    color: "white",
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: "Rubik-Medium",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loader: {
    marginVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Rubik-Medium",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: "Rubik-Medium",
  },
});

export default Reels;