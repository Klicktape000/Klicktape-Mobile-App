import React, { useMemo, useCallback } from 'react';
import { FlatList, FlatListProps, ViewStyle } from 'react-native';

interface OptimizedFlatListProps<T> extends Omit<FlatListProps<T>, 'getItemLayout'> {
  itemHeight?: number;
  estimatedItemSize?: number;
  enableVirtualization?: boolean;
}

function OptimizedFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  itemHeight = 80,
  estimatedItemSize,
  enableVirtualization = true,
  maxToRenderPerBatch = 10,
  windowSize = 10,
  initialNumToRender = 10,
  removeClippedSubviews = true,
  ...props
}: OptimizedFlatListProps<T>) {
  
  // Memoized getItemLayout for better performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  // Memoized style to prevent unnecessary re-renders
  const flatListStyle = useMemo(() => ({
    flex: 1,
  } as ViewStyle), []);

  return (
    <FlatList
      {...props}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={flatListStyle}
      getItemLayout={getItemLayout}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      initialNumToRender={initialNumToRender}
      removeClippedSubviews={enableVirtualization ? removeClippedSubviews : false}
      // Performance optimizations
      disableVirtualization={!enableVirtualization}
      legacyImplementation={false}
      // Reduce memory usage
      onEndReachedThreshold={0.5}
      // Improve scroll performance
      scrollEventThrottle={16}
    />
  );
}

export default React.memo(OptimizedFlatList) as typeof OptimizedFlatList;