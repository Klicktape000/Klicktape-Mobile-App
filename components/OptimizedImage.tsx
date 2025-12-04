import React, { useState, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/src/context/ThemeContext';

interface OptimizedImageProps {
  source: { uri: string } | number;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
  priority?: 'low' | 'normal' | 'high';
  lazy?: boolean;
  progressive?: boolean;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk';
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  contentFit = 'cover',
  placeholder,
  onLoad,
  onError,
  priority = 'normal',
  lazy = true,
  progressive = true,
  cachePolicy = 'memory-disk',
  ...props
}) => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);

  // Optimize image source based on platform and screen density
  const optimizedSource = useMemo(() => {
    if (typeof source === 'number') return source;
    
    const { uri } = source;
    if (!uri) return source;

    // Add optimization parameters for web
    if (Platform.OS === 'web') {
      const url = new URL(uri);
      
      // Add quality and format optimizations
      if (!url.searchParams.has('q')) {
        url.searchParams.set('q', '85'); // 85% quality
      }
      
      if (!url.searchParams.has('f')) {
        url.searchParams.set('f', 'webp'); // Prefer WebP format
      }
      
      return { uri: url.toString() };
    }
    
    return source;
  }, [source]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback((error: any) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  }, [onError]);

  const handleViewableChange = useCallback(() => {
    if (lazy && !isVisible) {
      setIsVisible(true);
    }
  }, [lazy, isVisible]);

  // Progressive loading placeholder
  const renderPlaceholder = () => {
    if (hasError) {
      return (
        <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
          <View style={[styles.errorIcon, { backgroundColor: colors.error }]} />
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
          <ActivityIndicator 
            size="small" 
            color={colors.primary}
            style={styles.loadingIndicator}
          />
        </View>
      );
    }

    return null;
  };

  // Don't render image if lazy loading and not visible
  if (lazy && !isVisible) {
    return (
      <View 
        style={[styles.lazyContainer, style]}
        onLayout={handleViewableChange}
      >
        {renderPlaceholder()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={optimizedSource}
        style={[StyleSheet.absoluteFillObject, { opacity: isLoading ? 0 : 1 }]}
        contentFit={contentFit}
        placeholder={placeholder}
        onLoad={handleLoad}
        onError={handleError}
        priority={priority}
        cachePolicy={cachePolicy}
        transition={progressive ? 200 : 0}
        {...props}
      />
      {renderPlaceholder()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  lazyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    opacity: 0.7,
  },
  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.5,
  },
});

export default OptimizedImage;