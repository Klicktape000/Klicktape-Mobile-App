/**
 * Comments Skeleton Loading Component
 * 
 * Displays a skeleton loader for comments section
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

interface CommentsSkeletonProps {
  numComments?: number;
}

const CommentsSkeleton: React.FC<CommentsSkeletonProps> = ({ numComments = 5 }) => {
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

  const CommentItemSkeleton = () => (
    <View style={styles.commentItem}>
      <Animated.View style={[styles.avatar, shimmerStyle]} />
      <View style={styles.commentContent}>
        <Animated.View style={[styles.username, shimmerStyle]} />
        <Animated.View style={[styles.commentText1, shimmerStyle]} />
        <Animated.View style={[styles.commentText2, shimmerStyle]} />
        <Animated.View style={[styles.timestamp, shimmerStyle]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[...Array(numComments)].map((_, index) => (
        <CommentItemSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  commentContent: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    width: 100,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 6,
  },
  commentText1: {
    width: '100%',
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 4,
  },
  commentText2: {
    width: '70%',
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 6,
  },
  timestamp: {
    width: 60,
    height: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
});

export default CommentsSkeleton;

