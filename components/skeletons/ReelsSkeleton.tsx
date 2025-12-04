/**
 * Reels Skeleton Loading Component
 * 
 * Displays a skeleton loader for reels screen
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const ReelsSkeleton: React.FC = () => {
  // Shimmer animation
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + shimmer.value * 0.5,
  }));

  return (
    <View style={styles.container}>
      {/* Video placeholder */}
      <Animated.View style={[styles.videoPlaceholder, shimmerStyle]} />

      {/* Right side actions */}
      <View style={styles.rightActions}>
        <Animated.View style={[styles.actionButton, shimmerStyle]} />
        <Animated.View style={[styles.actionButton, shimmerStyle]} />
        <Animated.View style={[styles.actionButton, shimmerStyle]} />
        <Animated.View style={[styles.actionButton, shimmerStyle]} />
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <View style={styles.userInfo}>
          <Animated.View style={[styles.avatar, shimmerStyle]} />
          <Animated.View style={[styles.username, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.caption1, shimmerStyle]} />
        <Animated.View style={[styles.caption2, shimmerStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: height,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    gap: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 80,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 10,
  },
  username: {
    width: 120,
    height: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  caption1: {
    width: '100%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 6,
  },
  caption2: {
    width: '70%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
});

export default ReelsSkeleton;

