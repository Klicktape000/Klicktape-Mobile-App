/**
 * Profile Skeleton Loading Component
 * 
 * Displays a skeleton loader while profile data is being fetched
 * Improves perceived performance by showing content structure immediately
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

const ProfileSkeleton: React.FC = () => {
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
      {/* Header Section */}
      <View style={styles.header}>
        {/* Avatar */}
        <Animated.View style={[styles.avatar, shimmerStyle]} />

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Animated.View style={[styles.statNumber, shimmerStyle]} />
            <Animated.View style={[styles.statLabel, shimmerStyle]} />
          </View>
          <View style={styles.statItem}>
            <Animated.View style={[styles.statNumber, shimmerStyle]} />
            <Animated.View style={[styles.statLabel, shimmerStyle]} />
          </View>
          <View style={styles.statItem}>
            <Animated.View style={[styles.statNumber, shimmerStyle]} />
            <Animated.View style={[styles.statLabel, shimmerStyle]} />
          </View>
        </View>
      </View>

      {/* Name and Bio */}
      <View style={styles.info}>
        <Animated.View style={[styles.name, shimmerStyle]} />
        <Animated.View style={[styles.username, shimmerStyle]} />
        <Animated.View style={[styles.bio, shimmerStyle]} />
        <Animated.View style={[styles.bioLine2, shimmerStyle]} />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Animated.View style={[styles.button, shimmerStyle]} />
        <Animated.View style={[styles.button, shimmerStyle]} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Animated.View style={[styles.tab, shimmerStyle]} />
        <Animated.View style={[styles.tab, shimmerStyle]} />
        <Animated.View style={[styles.tab, shimmerStyle]} />
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {[...Array(9)].map((_, index) => (
          <Animated.View key={index} style={[styles.gridItem, shimmerStyle]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1a1a1a',
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    width: 40,
    height: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 5,
  },
  statLabel: {
    width: 50,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  info: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  name: {
    width: 150,
    height: 18,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 5,
  },
  username: {
    width: 100,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 10,
  },
  bio: {
    width: '100%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 5,
  },
  bioLine2: {
    width: '70%',
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    height: 35,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 20,
  },
  tab: {
    width: 30,
    height: 30,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 1,
  },
  gridItem: {
    width: (width - 4) / 3,
    height: (width - 4) / 3,
    backgroundColor: '#1a1a1a',
    margin: 1,
  },
});

export default ProfileSkeleton;

