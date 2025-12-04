import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

// Lazy load image-related components to reduce initial bundle size
const ExpoImage = lazy(() => 
  import('expo-image').then(module => ({ default: module.Image }))
);

interface LazyImageProps {
  source: { uri: string } | number;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

const ImageLoadingFallback: React.FC<{ style?: any }> = ({ style }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[
      styles.loadingContainer, 
      { backgroundColor: colors.backgroundSecondary },
      style
    ]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
};

const LazyExpoImage: React.FC<LazyImageProps> = (props) => {
  return (
    <Suspense fallback={<ImageLoadingFallback style={props.style} />}>
      <ExpoImage {...props} />
    </Suspense>
  );
};

// Lazy wrapper for image picker functionality
const LazyImagePickerService = {
  async launchImageLibraryAsync(options?: any) {
    const ImagePickerModule = await import('expo-image-picker');
    return ImagePickerModule.launchImageLibraryAsync(options);
  },
  
  async launchCameraAsync(options?: any) {
    const ImagePickerModule = await import('expo-image-picker');
    return ImagePickerModule.launchCameraAsync(options);
  },
  
  async requestMediaLibraryPermissionsAsync() {
    const ImagePickerModule = await import('expo-image-picker');
    return ImagePickerModule.requestMediaLibraryPermissionsAsync();
  },
  
  async requestCameraPermissionsAsync() {
    const ImagePickerModule = await import('expo-image-picker');
    return ImagePickerModule.requestCameraPermissionsAsync();
  }
};

// Lazy wrapper for image manipulation
const LazyImageManipulatorService = {
  async manipulateAsync(uri: string, actions: any[], saveOptions?: any) {
    const ImageManipulatorModule = await import('expo-image-manipulator');
    return ImageManipulatorModule.manipulateAsync(uri, actions, saveOptions);
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    minWidth: 100,
  },
});

export default LazyExpoImage;
export { LazyImagePickerService, LazyImageManipulatorService };