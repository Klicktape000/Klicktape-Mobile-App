import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import OptimizedImage from './OptimizedImage';
import { useTheme } from '@/src/context/ThemeContext';

interface LazyImageProps {
  source: { uri: string } | number;
  placeholder?: string;
  blurhash?: string;
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'memory' | 'disk' | 'memory-disk';
  enableNativeOptimization?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
  fallbackSource?: { uri: string } | number;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
}

const LazyImage: React.FC<LazyImageProps> = ({
  source,
  placeholder,
  blurhash,
  priority = 'normal',
  cachePolicy = 'memory-disk',
  enableNativeOptimization = true,
  onLoadStart,
  onLoadEnd,
  onError,
  fallbackSource,
  style,
  contentFit = 'cover',
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSource, setImageSource] = useState(source);
  const { colors } = useTheme();

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleError = useCallback((error: any) => {
    setIsLoading(false);
    setHasError(true);
    
    // Try fallback source if available
    if (fallbackSource && imageSource !== fallbackSource) {
      setImageSource(fallbackSource);
      setHasError(false);
      setIsLoading(true);
      return;
    }
    
    onError?.(error);
  }, [fallbackSource, imageSource, onError]);

  // Use OptimizedImage for better performance
  return (
    <OptimizedImage
      source={imageSource}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      onLoad={handleLoad}
      onError={handleError}
      priority={priority}
      cachePolicy={cachePolicy}
      lazy={true}
      progressive={true}
      {...props}
    />
  );
};

export default React.memo(LazyImage);