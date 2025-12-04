/**
 * Notifications Skeleton Loading Component
 * 
 * Displays a skeleton loader for notifications screen
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

interface NotificationsSkeletonProps {
  numNotifications?: number;
}

const NotificationsSkeleton: React.FC<NotificationsSkeletonProps> = ({ numNotifications = 10 }) => {
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

  const NotificationItemSkeleton = () => (
    <View style={styles.notificationItem}>
      <Animated.View style={[styles.avatar, shimmerStyle]} />
      <View style={styles.notificationContent}>
        <Animated.View style={[styles.username, shimmerStyle]} />
        <Animated.View style={[styles.notificationText, shimmerStyle]} />
        <Animated.View style={[styles.timestamp, shimmerStyle]} />
      </View>
      <Animated.View style={[styles.thumbnail, shimmerStyle]} />
    </View>
  );

  return (
    <View style={styles.container}>
      {[...Array(numNotifications)].map((_, index) => (
        <NotificationItemSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
  },
  notificationContent: {
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
  notificationText: {
    width: '90%',
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
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    marginLeft: 8,
  },
});

export default NotificationsSkeleton;

