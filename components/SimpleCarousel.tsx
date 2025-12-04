import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface SimpleCarouselProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  width?: number;
  height?: number;
  onSnapToItem?: (index: number) => void;
  defaultIndex?: number;
}

const SimpleCarousel: React.FC<SimpleCarouselProps> = ({
  data,
  renderItem,
  width = screenWidth,
  height = 200,
  onSnapToItem,
  defaultIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(defaultIndex);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    
    if (index !== currentIndex && index >= 0 && index < data.length) {
      setCurrentIndex(index);
      onSnapToItem?.(index);
    }
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContainer}
        style={styles.scrollView}
      >
        {data.map((item, index) => (
          <React.Fragment key={index}>
            <View style={[styles.itemContainer, { width, height }]}>
              {renderItem({ item, index })}
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    alignItems: 'center',
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SimpleCarousel;

