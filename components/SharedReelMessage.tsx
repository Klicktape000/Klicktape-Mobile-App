import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDispatch } from 'react-redux';
import { toggleLike } from '@/src/store/slices/reelsSlice';

import CachedImage from './CachedImage';

import { SharedReelData } from '../types/shared';

// Conditionally import react-native-reanimated
let Animated: any;
let useSharedValue: any;
let useAnimatedStyle: any;
let withSpring: any;

if (Platform.OS !== 'web') {
  const reanimated = require('react-native-reanimated');
  Animated = reanimated.default;
  useSharedValue = reanimated.useSharedValue;
  useAnimatedStyle = reanimated.useAnimatedStyle;
  withSpring = reanimated.withSpring;
} else {
  // Web fallbacks
  Animated = require('react-native').Animated;
  useSharedValue = (value: number) => ({ value });
  useAnimatedStyle = (callback: () => any) => callback();
  withSpring = (value: number) => value;
}

interface SharedReelMessageProps {
  reelId?: string;
  sharedReelData?: SharedReelData;
  isOwnMessage?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const maxMessageWidth = screenWidth * 0.8;

const SharedReelMessage: React.FC<SharedReelMessageProps> = ({
  reelId,
  sharedReelData,
  isOwnMessage = false,
}) => {
  const { colors, isDarkMode } = useTheme();
  const dispatch = useDispatch();

  // Use reelId if provided directly, otherwise use sharedReelData
  const actualReelId = reelId || sharedReelData?.reel_id;



  // State for reel data and like status
  const [reelData, setReelData] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Animation for like button - always call hooks unconditionally
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: likeScale.value }] };
  });

  // Fetch reel data and like status
  useEffect(() => {
    const fetchReelData = async () => {
      if (!actualReelId) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: reel, error } = await supabase
          .from('reels')
          .select(`
            *,
            profiles(username, avatar_url),
            reel_likes!reel_likes_reel_id_fkey(user_id)
          `)
          .eq('id', actualReelId)
          .single();

        if (error) {
          // Reel was deleted, continue without like functionality but show the shared content
          setLoading(false);
          return;
        }
        setReelData(reel);
        setLikesCount((reel as any).likes_count || 0);
        setIsLiked((reel as any).reel_likes?.some((like: any) => like.user_id === user.id) || false);
      } catch (__error) {
        // console.error('❌ Error in fetchReelData:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReelData();
  }, [actualReelId]);

  const handleReelPress = () => {
    if (actualReelId) {
      router.push(`/reel/${actualReelId}`);
    }
  };

  const handleLike = async () => {
    if (!actualReelId || !reelData) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
        return;
      }

      // Animate the like button
      if (Platform.OS !== 'web') {
        likeScale.value = withSpring(1.3, {}, () => {
          likeScale.value = withSpring(1);
        });
      }

      // Optimistic update
      const newIsLiked = !isLiked;
      const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1;

      setIsLiked(newIsLiked);
      setLikesCount(newLikesCount);

      // Update Redux store
      (dispatch as any)(toggleLike({ reelId: actualReelId, isLiked: !newIsLiked }));

      // Make API call
      const { error } = await (supabase as any).rpc('toggle_reel_like', {
        reel_id_param: actualReelId,
        user_id_param: user.id,
      });

      if (error) throw error;

    } catch (__error) {
      // console.error('Error toggling reel like:', error);
      // Revert optimistic update
      setIsLiked(!isLiked);
      setLikesCount(likesCount);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  // If we don't have reel data, show a simple placeholder
  if (!actualReelId) {
    return (
      <View style={[
        styles.sharedReelContainer,
        {
          backgroundColor: isOwnMessage
            ? isDarkMode
              ? 'rgba(128, 128, 128, 0.15)'
              : 'rgba(128, 128, 128, 0.08)'
            : isDarkMode
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.03)',
        },
      ]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Shared reel unavailable
        </Text>
      </View>
    );
  }

  // Show shared content even if database fetch failed
  const shouldShowLikeButton = !loading && reelData;

  const truncateCaption = (caption: string, maxLength: number = 150) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '...';
  };

  // Generate thumbnail URL from video URL if not provided
  const getThumbnailUrl = () => {
    if (sharedReelData?.reel_thumbnail) {
      return sharedReelData.reel_thumbnail;
    }
    // Fallback to a placeholder or try to extract thumbnail from video URL
    return 'https://via.placeholder.com/200x300/333333/FFFFFF?text=🎥';
  };

  // Get reel owner name
  const getReelOwner = () => {
    return sharedReelData?.reel_owner || 'Unknown User';
  };

  // Get reel caption
  const getReelCaption = () => {
    return sharedReelData?.reel_caption || 'Shared a reel';
  };

  return (
    <TouchableOpacity
      style={[
        styles.sharedReelContainer,
        {
          backgroundColor: isOwnMessage
            ? isDarkMode
              ? 'rgba(128, 128, 128, 0.15)'
              : 'rgba(128, 128, 128, 0.08)'
            : isDarkMode
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.03)',
          borderColor: isOwnMessage
            ? isDarkMode
              ? 'rgba(128, 128, 128, 0.25)'
              : 'rgba(128, 128, 128, 0.15)'
            : isDarkMode
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
      onPress={handleReelPress}
      activeOpacity={0.7}
    >
      {/* Shared Reel Header */}
      <View style={styles.sharedReelHeader}>
        <Feather 
          name="video" 
          size={16} 
          color={colors.textSecondary} 
          style={styles.videoIcon}
        />
        <Text 
          className="font-rubik-medium" 
          style={[styles.sharedText, { color: colors.textSecondary }]}
        >
          Shared a reel
        </Text>
      </View>

      {/* Reel Content */}
      <View style={styles.reelContent}>
        {/* Reel Thumbnail - Full Width */}
        <View style={styles.thumbnailContainer}>
          <CachedImage
            uri={getThumbnailUrl()}
            style={styles.reelThumbnail}
            showLoader={true}
            fallbackUri="https://via.placeholder.com/200x300/333333/FFFFFF?text=🎥"
          />
          {/* Play Icon Overlay */}
          <View style={styles.playIconOverlay}>
            <Feather 
              name="play" 
              size={32} 
              color="rgba(255, 255, 255, 0.9)" 
            />
          </View>
        </View>

        {/* Reel Details - Below Thumbnail */}
        <View style={styles.reelDetails}>
          <Text
            className="font-rubik-bold"
            style={[styles.reelOwner, { color: colors.text }]}
            numberOfLines={1}
          >
            @{getReelOwner()}
          </Text>

          <Text
            className="font-rubik-regular"
            style={[styles.reelCaption, { color: colors.textSecondary }]}
            numberOfLines={4}
          >
            {truncateCaption(getReelCaption(), 150)}
          </Text>

          {/* Like Section or Unavailable Notice */}
          {shouldShowLikeButton ? (
            <View style={styles.likeSection}>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Animated.View style={likeAnimatedStyle}>
                  {isLiked ? (
                    <AntDesign
                      name="heart"
                      size={18}
                      color="#E91E63"
                    />
                  ) : (
                    <Feather
                      name="heart"
                      size={18}
                      color={colors.textSecondary}
                    />
                  )}
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/(root)/reel-likes/${actualReelId}` as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.likesText as any, { color: colors.textSecondary }]}>
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : loading ? null : (
            <View style={styles.unavailableSection as any}>
              <Text style={[styles.unavailableText as any, { color: colors.textSecondary }]}>
                Reel no longer available
              </Text>
            </View>
          )}

          <View style={[
            styles.viewReelContainer as any,
            {
              backgroundColor: `${colors.primary}15`,
              borderColor: `${colors.primary}30`,
            }
          ]}>
            <Text
              className="font-rubik-medium"
              style={[styles.viewReelText as any, { color: colors.primary }]}
            >
              Watch Reel
            </Text>
            <Feather
              name="play-circle"
              size={14}
              color={colors.primary}
              style={styles.playCircleIcon as any}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sharedReelContainer: {
    maxWidth: maxMessageWidth,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 2,
  },
  sharedReelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  videoIcon: {
    marginRight: 6,
  },
  sharedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reelContent: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  thumbnailContainer: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  reelThumbnail: {
    width: maxMessageWidth - 48, // Account for container padding
    height: Math.min(240, (maxMessageWidth - 48) * 1.2), // Taller aspect ratio for reels
    borderRadius: 12,
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  reelDetails: {
    paddingHorizontal: 4,
  },
  reelOwner: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  reelCaption: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  likeButton: {
    marginRight: 8,
    padding: 4,
  },
  likesText: {
    fontSize: 13,
    fontWeight: '500',
  },
  unavailableSection: {
    marginBottom: 12,
  },
  unavailableText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  viewReelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewReelText: {
    fontSize: 14,
    fontWeight: '600',
  } as const,
  playCircleIcon: {
    marginLeft: 6,
  } as const,
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SharedReelMessage;

