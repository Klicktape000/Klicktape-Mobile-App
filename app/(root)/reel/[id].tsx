import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';

import { Feather, AntDesign, Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { supabase } from '@/lib/supabase';
import { useDispatch as useReduxDispatch } from 'react-redux';
import { AppDispatch } from '@/src/store/store';
import { toggleLike } from '@/src/store/slices/reelsSlice';

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

const { width, height } = Dimensions.get('window');

// Define a custom reel type that matches our local state structure
interface ReelDetail {
  id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  user: {
    username: string;
    avatar: string;
  };
  is_liked: boolean;
}

const ReelDetail = () => {
  const { id, from } = useLocalSearchParams(); // Get 'from' parameter
  const [reel, setReel] = useState<ReelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const isMounted = useRef(true);
  const dispatch = useReduxDispatch<AppDispatch>();

  // Initialize VideoPlayer with null source
  const player = useVideoPlayer(null, player => {
    player.loop = true;
    player.muted = false;
  });

  // Animated values for button scaling
  // Initialize shared values unconditionally
  const likeSharedValue = useSharedValue(1);
  const commentSharedValue = useSharedValue(1);
  const muteSharedValue = useSharedValue(1);
  const playPauseSharedValue = useSharedValue(1);

  // Assign scale values
  const scaleValues = {
    like: likeSharedValue,
    comment: commentSharedValue,
    mute: muteSharedValue,
    playPause: playPauseSharedValue,
  };

  // Listen to player status changes
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { error: playerError } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined,
  });

  useEffect(() => {
    isMounted.current = true;

    const fetchReel = async () => {
      try {
        if (!supabase) throw new Error('Supabase client not initialized');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Updated query to use profiles instead of users
        const { data, error } = await supabase
          .from('reels')
          .select(`
            id,
            user_id,
            video_url,
            thumbnail_url,
            caption,
            likes_count,
            comments_count,
            created_at,
            user:profiles!reels_user_id_fkey(username, avatar_url)
          `)
          .eq('id', id)
          .single();

        if (error || !data) throw new Error(`Failed to fetch reel: ${error?.message || 'No data'}`);

        // Check if user has liked the reel
        const { data: likeData } = await supabase
          .from('reel_likes')
          .select('id')
          .eq('reel_id', id)
          .eq('user_id', user.id)
          .single();

        // Extract user data safely with type assertion
        let username = 'Unknown User';
        let avatarUrl = 'https://via.placeholder.com/150';

        // Use type assertion to handle the user data
        const userObj = (data as any).user;
        if (userObj) {
          if (Array.isArray(userObj) && userObj.length > 0) {
            username = userObj[0]?.username || username;
            avatarUrl = userObj[0]?.avatar_url || avatarUrl;
          } else if (typeof userObj === 'object') {
            username = userObj.username || username;
            avatarUrl = userObj.avatar_url || avatarUrl;
          }
        }

        const reelData = {
          id: (data as any).id,
          userId: (data as any).user_id,
          videoUrl: (data as any).video_url,
          thumbnailUrl: (data as any).thumbnail_url,
          caption: (data as any).caption || '',
          likesCount: (data as any).likes_count || 0,
          commentsCount: (data as any).comments_count || 0,
          user: {
            username: username,
            avatar: avatarUrl
          },
          is_liked: !!likeData,
        };

        if (!isMounted.current) return;

        setReel(reelData);
        setIsLiked(reelData.is_liked);

        // Load video source into player
        try {
          player.replace(reelData.videoUrl);
          player.play();
        } catch (__err) {
          console.error('Error loading video:', __err);
          throw new Error('Failed to load video');
        }

        setLoading(false);
      } catch (__error) {
        console.error('Error fetching reel:', __error);
        if (!isMounted.current) return;

        if (retryCount < 3) {
          setTimeout(() => setRetryCount(prev => prev + 1), 2000);
        } else {
          setError('Failed to load reel. Please try again.');
          setLoading(false);
        }
      }
    };

    fetchReel();

    return () => {
      isMounted.current = false;
      try {
        player.pause();
      } catch (__err) {
// console.warn('Error pausing player on unmount:', __err);
      }
    };
  }, [id, retryCount, player]);

  useFocusEffect(
    React.useCallback(() => {
      if (isMounted.current && reel) {
        try {
          player.play();
        } catch (__err) {
// console.warn('Error playing video on focus:', __err);
        }
      }
      return () => {
        if (isMounted.current) {
          try {
            player.pause();
          } catch (__err) {
// console.warn('Error pausing video on blur:', __err);
          }
        }
      };
    }, [player, reel])
  );

  useEffect(() => {
    if (playerError && isMounted.current) {
      console.error('Video player error:', playerError);
      if (retryCount < 3) {
        setTimeout(() => setRetryCount(prev => prev + 1), 2000);
      } else {
        setError('Video format not supported on this device. Please try another video.');
      }
    }
  }, [playerError, retryCount]);

  const handleLike = async () => {
    if (!reel || !reel.id) {
      console.error('Invalid reel ID:', reel?.id);
      Alert.alert('Error', 'Cannot like this reel due to an invalid ID.');
      return;
    }

    // Calculate new state for optimistic update
    const newIsLiked = !isLiked;
    const newLikesCount = isLiked ? reel.likesCount - 1 : reel.likesCount + 1;

    // Animate the like button
    if (Platform.OS !== 'web') {
      scaleValues.like.value = withSpring(1.2, {}, () => {
        scaleValues.like.value = withSpring(1);
      });
    }

    // Store original values in case we need to revert
    const originalIsLiked = isLiked;
    const originalLikesCount = reel.likesCount;

    // Apply optimistic update locally
    setIsLiked(newIsLiked);
    setReel(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        likesCount: newLikesCount,
      };
    });

    try {
      // Make the actual API call
      await dispatch(
        toggleLike({
          reelId: reel.id,
          isLiked: originalIsLiked // Pass the original state, not the optimistically updated one
        })
      ).unwrap();


    } catch (__error: any) {
      console.error('Error toggling like:', __error);

      // Revert the optimistic update if the API call fails
      setIsLiked(originalIsLiked);
      setReel(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          likesCount: originalLikesCount,
        };
      });

      if (__error?.message && !__error.message.includes('duplicate key value')) {
        Alert.alert(
          'Error',
          `Failed to toggle like: ${__error.message || 'Unknown error'}`
        );
      }
    }
  };

  const handleComment = () => {
    if (!isMounted.current || !reel) return;

    if (Platform.OS !== 'web') {
      scaleValues.comment.value = withSpring(1.2, {}, () => {
        scaleValues.comment.value = withSpring(1);
      });
    }
    try {
      player.pause();
    } catch (__err) {
// console.warn('Error pausing video before comment navigation:', __err);
    }
    router.push({
      pathname: "/reels-comments-screen",
      params: {
        reelId: reel.id,
        reelOwnerUsername: reel.user.username,
        reelOwnerId: reel.userId,
      },
    });
  };

  const handleMute = () => {
    if (!isMounted.current) return;

    setIsMuted(!isMuted);
    try {
      player.muted = !isMuted;
    } catch (__err) {
// console.warn('Error toggling mute:', __err);
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
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (__err) {
// console.warn('Error toggling play/pause:', __err);
    }
    if (Platform.OS !== 'web') {
      scaleValues.playPause.value = withSpring(1.2, {}, () => {
        scaleValues.playPause.value = withSpring(1);
      });
    }
  };

  const handleProfilePress = () => {
    if (!isMounted.current || !reel) return;


    try {
      player.pause();
    } catch (__err) {
// console.warn('Error pausing video before profile navigation:', __err);
    }
    router.push(`/userProfile/${reel.userId}`);
  };

  const handleBack = () => {
    if (!isMounted.current) return;

    try {
      player.pause();
    } catch (__err) {
// console.warn('Error pausing video before back navigation:', __err);
    }
    
    // OPTIMIZED: Smart back navigation
    if (from === 'notifications') {
      router.replace('/(root)/notifications');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(root)/(tabs)/reels');
    }
  };

  // Initialize animated styles for all platforms - always call hooks unconditionally
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

  // Assign animated styles
  const animatedStyles = {
    like: likeAnimatedStyle,
    comment: commentAnimatedStyle,
    mute: muteAnimatedStyle,
    playPause: playPauseAnimatedStyle,
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#000000' }]}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: '#000000' }]}>
        <Text className="font-rubik-regular" style={styles.errorText}>
          {error}
        </Text>
        <TouchableOpacity onPress={handleBack}>
          <Text className="font-rubik-medium" style={styles.backText}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!reel) {
    return null;
  }

  const caption = reel.caption.length > 100 && !showFullCaption
    ? reel.caption.slice(0, 100) + '...'
    : reel.caption;

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}
    >
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />

      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View style={styles.gradientOverlay}>
        <TouchableOpacity style={styles.userInfo} onPress={handleProfilePress} activeOpacity={0.7}>
          <Image 
            source={{ 
              uri: reel.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user?.username || 'User')}&background=E5E7EB&color=9CA3AF&size=40`
            }} 
            style={styles.avatar} 
          />
          <Text className="font-rubik-bold" style={styles.username}>
            {reel.user.username}
          </Text>
        </TouchableOpacity>

        <View style={styles.captionContainer}>
          <Text className="font-rubik-regular" style={styles.caption}>
            {caption}
          </Text>
          {reel.caption.length > 100 && (
            <TouchableOpacity onPress={() => setShowFullCaption(!showFullCaption)}>
              <Text className="font-rubik-medium" style={styles.showMore}>
                {showFullCaption ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Animated.View style={animatedStyles.like}>
              {isLiked ? (
                <AntDesign
                  name="heart"
                  size={24}
                  color="red"
                />
              ) : (
                <Feather
                  name="heart"
                  size={24}
                  color="white"
                />
              )}
              <TouchableOpacity
                onPress={() => router.push(`/(root)/reel-likes/${reel.id}` as any)}
                activeOpacity={0.7}
              >
                <Text className="font-rubik-regular" style={styles.actionText}>
                  {reel.likesCount}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={handleComment}
            activeOpacity={0.7}
          >
            <Animated.View style={animatedStyles.comment}>
              <Feather name="message-circle" size={24} color="#FFFFFF" />
              <Text className="font-rubik-regular" style={styles.actionText}>
                {reel.commentsCount}
              </Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={handleMute}
            activeOpacity={0.7}
          >
            <Animated.View style={animatedStyles.mute}>
              <Feather
                name={isMuted ? 'volume-x' : 'volume-2'}
                size={24}
                color="#FFFFFF"
              />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={handlePlayPause}
            activeOpacity={0.7}
          >
            <Animated.View style={animatedStyles.playPause}>
              <Feather
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#FFFFFF"
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 20,
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)', // Commented out as it's not supported in React Native
  },
  backText: {
    color: '#FFD700',
    fontSize: 16,
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)', // Commented out as it's not supported in React Native
  },
  video: {
    width: width,
    height: height,
    backgroundColor: 'black',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 16,
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    padding: 16,
    justifyContent: 'flex-end',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  username: {
    color: '#ffffff',
    fontSize: 16,
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)', // Commented out as it's not supported in React Native
  },
  captionContainer: {
    marginBottom: 16,
  },
  caption: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)', // Commented out as it's not supported in React Native
  },
  showMore: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)', // Commented out as it's not supported in React Native
    textAlign: 'center',
  },
});

export default ReelDetail;
