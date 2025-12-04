/**
 * Grid Skeleton Loading Component
 * 
 * Displays a skeleton loader for grid layouts (posts, reels, explore)
 * Used in search/explore screens
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

interface GridSkeletonProps {
  numColumns?: number;
  numRows?: number;
}

const GridSkeleton: React.FC<GridSkeletonProps> = ({ 
  numColumns = 3, 
  numRows = 4 
}) => {
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

  const itemWidth = (width - (numColumns + 1) * 2) / numColumns;
  const totalItems = numColumns * numRows;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {[...Array(totalItems)].map((_, index) => (
          <Animated.View 
            key={index} 
            style={[
              styles.gridItem, 
              { width: itemWidth, height: itemWidth },
              shimmerStyle
            ]} 
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
  },
  gridItem: {
    backgroundColor: '#1a1a1a',
    margin: 2,
    borderRadius: 4,
  },
});

export default GridSkeleton;

