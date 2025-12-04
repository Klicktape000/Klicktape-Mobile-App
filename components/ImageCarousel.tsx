import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageCarouselProps {
  images: string[];
  height?: number;
  onDoubleTap?: () => void;
  showPagination?: boolean;
  paginationStyle?: 'dots' | 'counter';
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  height = SCREEN_WIDTH * 0.9,
  onDoubleTap,
  showPagination = true,
  paginationStyle = 'dots',
}) => {
  const { colors, isDarkMode } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const lastTap = useRef<number | null>(null);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_TAP_DELAY = 250; // Reduced for faster response

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const handleDoubleTap = () => {
    const now = Date.now();

    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      
      console.log('✨ Double tap detected on image!');
      onDoubleTap?.();
      lastTap.current = null;
    } else {
      // First tap
      lastTap.current = now;

      // Clear existing timeout
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
      }
      
      // Reset after delay
      tapTimeout.current = setTimeout(() => {
        lastTap.current = null;
        tapTimeout.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Single image - no carousel needed
  if (images.length === 1) {
    return (
      <View style={[styles.container, { height }]}>
        <TouchableWithoutFeedback onPress={handleDoubleTap}>
          <View style={{ width: SCREEN_WIDTH, height }}>
            <Image
              source={{ uri: images[0] }}
              style={[styles.image, { height }]}
              resizeMode="cover"
            />
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  // Multiple images - carousel
  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
      >
        {images.map((imageUrl, index) => (
          <TouchableWithoutFeedback key={index} onPress={handleDoubleTap}>
            <View style={{ width: SCREEN_WIDTH, height }}>
              <Image
                source={{ uri: imageUrl }}
                style={[styles.image, { width: SCREEN_WIDTH, height }]}
                resizeMode="cover"
              />
            </View>
          </TouchableWithoutFeedback>
        ))}
      </ScrollView>

      {/* Pagination Indicators */}
      {showPagination && (
        <View style={styles.paginationContainer}>
          {paginationStyle === 'dots' ? (
            // Dot indicators
            <View style={styles.dotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === currentIndex
                          ? '#FFFFFF'
                          : 'rgba(255, 255, 255, 0.5)',
                      width: index === currentIndex ? 8 : 6,
                      height: index === currentIndex ? 8 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            // Counter indicator (e.g., "1/3")
            <View style={styles.counterContainer}>
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {currentIndex + 1}/{images.length}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
  },
  paginationContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    borderRadius: 4,
  },
  counterContainer: {
    alignItems: 'flex-end',
  },
  counterBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ImageCarousel;

