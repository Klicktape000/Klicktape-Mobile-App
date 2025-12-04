/**
 * Messages Skeleton Loading Component
 * 
 * Displays a skeleton loader for messages/chat list
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

interface MessagesSkeletonProps {
  numMessages?: number;
}

const MessagesSkeleton: React.FC<MessagesSkeletonProps> = ({ numMessages = 8 }) => {
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

  const MessageItemSkeleton = () => (
    <View style={styles.messageItem}>
      <Animated.View style={[styles.avatar, shimmerStyle]} />
      <View style={styles.messageContent}>
        <View style={styles.topRow}>
          <Animated.View style={[styles.username, shimmerStyle]} />
          <Animated.View style={[styles.timestamp, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.messageText, shimmerStyle]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[...Array(numMessages)].map((_, index) => (
        <MessageItemSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  messageItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
  },
  messageContent: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  username: {
    width: 120,
    height: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  timestamp: {
    width: 50,
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  messageText: {
    width: '80%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
});

export default MessagesSkeleton;

