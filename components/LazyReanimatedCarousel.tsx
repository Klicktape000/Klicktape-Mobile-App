import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

// Lazy load the carousel component to reduce initial bundle size
const Carousel = Platform.OS !== 'web' 
  ? lazy(() => import('react-native-reanimated-carousel').then(module => ({ default: module.default })))
  : lazy(() => Promise.resolve({ default: () => null })); // Web fallback

interface LazyReanimatedCarouselProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  width: number;
  height: number;
  autoPlay?: boolean;
  scrollAnimationDuration?: number;
  onSnapToItem?: (index: number) => void;
  style?: any;
}

const CarouselLoadingFallback: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[
      styles.loadingContainer, 
      { 
        backgroundColor: colors.background,
        width,
        height
      }
    ]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const LazyReanimatedCarousel: React.FC<LazyReanimatedCarouselProps> = (props) => {
  const { width, height } = props;

  if (Platform.OS === 'web') {
    // Simple web fallback - render items in a horizontal scroll view
    return (
      <View style={{ width, height, flexDirection: 'row', overflow: 'hidden' }}>
        {props.data.map((item, index) => (
          <View key={index} style={{ width, height }}>
            {props.renderItem({ item, index })}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Suspense fallback={<CarouselLoadingFallback width={width} height={height} />}>
      <Carousel {...props} />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LazyReanimatedCarousel;