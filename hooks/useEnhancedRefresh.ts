import { useState, useCallback, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface EnhancedRefreshConfig {
  onRefresh: () => Promise<void>;
  enableHaptics?: boolean;
  refreshThreshold?: number;
  animationDuration?: number;
  minDurationMs?: number;
  showCustomIndicator?: boolean;
}

export interface EnhancedRefreshReturn {
  refreshing: boolean;
  onRefresh: () => void;
  refreshControlProps: {
    refreshing: boolean;
    onRefresh: () => void;
    progressViewOffset?: number;
    colors?: string[];
    tintColor?: string;
    titleColor?: string;
    title?: string;
  };
  // Animation values for custom indicators
  pullDistance: Animated.Value;
  refreshOpacity: Animated.Value;
  refreshRotation: Animated.Value;
}

export const useEnhancedRefresh = ({
  onRefresh,
  enableHaptics = true,
  refreshThreshold = 60,
  animationDuration = 300,
  minDurationMs = 800,
  showCustomIndicator = false,
}: EnhancedRefreshConfig): EnhancedRefreshReturn => {
  const [refreshing, setRefreshing] = useState(false);
  
  // Animation values
  const pullDistance = useRef(new Animated.Value(0)).current;
  const refreshOpacity = useRef(new Animated.Value(0)).current;
  const refreshRotation = useRef(new Animated.Value(0)).current;
  
  // Track refresh state for haptic feedback
  const hasTriggeredHaptic = useRef(false);
  const refreshStartTime = useRef<number>(0);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    // Trigger haptic feedback at start
    if (enableHaptics && Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        //// console.log('Haptic feedback not available');
      }
    }

    setRefreshing(true);
    refreshStartTime.current = Date.now();
    hasTriggeredHaptic.current = false;

    // Start loading animations
    Animated.parallel([
      Animated.timing(refreshOpacity, {
        toValue: 1,
        duration: animationDuration / 2,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(refreshRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ),
    ]).start();

    try {
      await onRefresh();
      
      // Success haptic feedback
      if (enableHaptics && Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          //// console.log('Success haptic feedback not available');
        }
      }
    } catch {
      // console.error('Refresh failed');
      
      // Error haptic feedback
      if (enableHaptics && Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {
          //// console.log('Error haptic feedback not available');
        }
      }
    } finally {
      // Ensure minimum refresh duration for better UX (like Instagram)
      const refreshDuration = Date.now() - refreshStartTime.current;
      if (refreshDuration < minDurationMs) {
        await new Promise(resolve => setTimeout(resolve, minDurationMs - refreshDuration));
      }

      // End loading animations
      Animated.parallel([
        Animated.timing(refreshOpacity, {
          toValue: 0,
          duration: animationDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(refreshRotation, {
          toValue: 0,
          duration: animationDuration / 2,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRefreshing(false);
        refreshRotation.setValue(0);
      });
    }
  }, [refreshing, onRefresh, enableHaptics, animationDuration, refreshOpacity, refreshRotation]);

  // Enhanced refresh control props with Instagram-like styling
  const refreshControlProps = {
    refreshing,
    onRefresh: handleRefresh,
    // iOS specific props
    ...(Platform.OS === 'ios' && {
      tintColor: '#666666',
      titleColor: '#666666',
      title: refreshing ? 'Refreshing...' : 'Pull to refresh',
    }),
    // Android specific props
    ...(Platform.OS === 'android' && {
      colors: ['#666666', '#888888', '#AAAAAA'],
      progressViewOffset: showCustomIndicator ? 60 : undefined,
    }),
  };

  return {
    refreshing,
    onRefresh: handleRefresh,
    refreshControlProps,
    pullDistance,
    refreshOpacity,
    refreshRotation,
  };
};

// Custom refresh indicator component data
export const getRefreshIndicatorStyle = (
  opacity: Animated.Value,
  rotation: Animated.Value,
  colors: { primary: string; text: string }
) => ({
  opacity,
  transform: [
    {
      rotate: rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    },
    {
      scale: opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1],
      }),
    },
  ],
});

// Pull distance indicator for custom implementations
export const getPullDistanceStyle = (
  pullDistance: Animated.Value,
  threshold: number = 60
) => ({
  transform: [
    {
      translateY: pullDistance.interpolate({
        inputRange: [0, threshold, threshold * 2],
        outputRange: [0, 0, 10],
        extrapolate: 'clamp',
      }),
    },
  ],
  opacity: pullDistance.interpolate({
    inputRange: [0, threshold / 2, threshold],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  }),
});
