/**
 * Feed Skeleton Loading Component
 * 
 * Displays a skeleton loader for feed layouts (home feed, posts feed)
 * Shows multiple post card skeletons
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

const { width } = Dimensions.get('window');

interface FeedSkeletonProps {
  numPosts?: number;
}

const FeedSkeleton: React.FC<FeedSkeletonProps> = ({ numPosts = 3 }) => {
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

  const PostCardSkeleton = () => (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.avatar, shimmerStyle]} />
        <View style={styles.headerInfo}>
          <Animated.View style={[styles.username, shimmerStyle]} />
          <Animated.View style={[styles.timestamp, shimmerStyle]} />
        </View>
      </View>

      {/* Image */}
      <Animated.View style={[styles.image, shimmerStyle]} />

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <Animated.View style={[styles.actionIcon, shimmerStyle]} />
          <Animated.View style={[styles.actionIcon, shimmerStyle]} />
          <Animated.View style={[styles.actionIcon, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.actionIcon, shimmerStyle]} />
      </View>

      {/* Likes */}
      <Animated.View style={[styles.likes, shimmerStyle]} />

      {/* Caption */}
      <View style={styles.caption}>
        <Animated.View style={[styles.captionLine1, shimmerStyle]} />
        <Animated.View style={[styles.captionLine2, shimmerStyle]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[...Array(numPosts)].map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  postCard: {
    marginBottom: 20,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    width: 120,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 5,
  },
  timestamp: {
    width: 80,
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  image: {
    width: width,
    height: width,
    backgroundColor: '#1a1a1a',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 15,
  },
  actionIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  likes: {
    width: 100,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  caption: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  captionLine1: {
    width: '100%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 5,
  },
  captionLine2: {
    width: '70%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
});

export default FeedSkeleton;

