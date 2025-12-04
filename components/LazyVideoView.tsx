import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useVideoPlayer } from 'expo-video';

// Lazy load the video components to reduce initial bundle size
const VideoView = lazy(() => 
  import('expo-video').then(module => ({ default: module.VideoView }))
);

interface LazyVideoViewProps {
  source: string;
  style?: any;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  onPlaybackStatusUpdate?: (status: any) => void;
  children?: React.ReactNode;
}

const VideoLoadingFallback: React.FC = () => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const LazyVideoView: React.FC<LazyVideoViewProps> = ({ 
  source, 
  shouldPlay = false, 
  isLooping = false, 
  isMuted = false, 
  ...otherProps 
}) => {
  // Create video player with the source
  const player = useVideoPlayer(source, (player) => {
    player.loop = isLooping;
    player.muted = isMuted;
    if (shouldPlay) {
      player.play();
    }
  });

  return (
    <Suspense fallback={<VideoLoadingFallback />}>
      <VideoView player={player} {...otherProps} />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});

export default LazyVideoView;
export { useVideoPlayer };