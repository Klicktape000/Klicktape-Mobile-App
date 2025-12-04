/**
 * Edge-to-Edge Configuration for Android 16+ Compatibility
 * Ensures proper handling of system UI and safe areas
 */

import { Platform, StatusBar, Dimensions, StatusBarStyle } from 'react-native';

export interface EdgeToEdgeConfig {
  statusBarHeight: number;
  navigationBarHeight: number;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  isEdgeToEdgeEnabled: boolean;
}

/**
 * Get current edge-to-edge configuration
 */
export const getEdgeToEdgeConfig = (): EdgeToEdgeConfig => {
  const { height } = Dimensions.get('window');
  const screenHeight = Dimensions.get('screen').height;

  // Calculate status bar height
  const statusBarHeight = Platform.OS === 'android'
    ? StatusBar.currentHeight || 24
    : 44; // iOS default

  // Calculate navigation bar height (Android only)
  const navigationBarHeight = Platform.OS === 'android'
    ? screenHeight - height - statusBarHeight
    : 0;

  return {
    statusBarHeight,
    navigationBarHeight,
    safeAreaInsets: {
      top: statusBarHeight,
      bottom: navigationBarHeight,
      left: 0,
      right: 0,
    },
    isEdgeToEdgeEnabled: true, // Always enabled for future compatibility
  };
};

/**
 * Get theme-aware status bar configuration for edge-to-edge
 */
export const getEdgeToEdgeStatusBarConfig = (isDarkMode: boolean) => ({
  barStyle: (isDarkMode ? 'light-content' : 'dark-content') as 'light-content' | 'dark-content',
  backgroundColor: 'transparent',
  translucent: true,
  hidden: false,
});

/**
 * Get safe area styles for edge-to-edge layouts
 */
export const getEdgeToEdgeSafeAreaStyles = (isDarkMode: boolean) => {
  const config = getEdgeToEdgeConfig();

  return {
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
    },
    safeAreaContainer: {
      flex: 1,
      paddingTop: config.safeAreaInsets.top,
      paddingBottom: config.safeAreaInsets.bottom,
      paddingLeft: config.safeAreaInsets.left,
      paddingRight: config.safeAreaInsets.right,
    },
    statusBarSpacer: {
      height: config.statusBarHeight,
      backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
    },
    navigationBarSpacer: {
      height: config.navigationBarHeight,
      backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
    },
  };
};

/**
 * Configure status bar for edge-to-edge display
 */
export const configureEdgeToEdgeStatusBar = (isDarkMode: boolean) => {
  const config = getEdgeToEdgeStatusBarConfig(isDarkMode);

  if (Platform.OS === 'android') {
    StatusBar.setBarStyle(config.barStyle, true);
    StatusBar.setBackgroundColor(config.backgroundColor, true);
    StatusBar.setTranslucent(config.translucent);
  } else {
    StatusBar.setBarStyle(config.barStyle, true);
  }
};

/**
 * Utility to check if device supports edge-to-edge
 */
export const isEdgeToEdgeSupported = (): boolean => {
  if (Platform.OS === 'ios') {
    return true; // iOS has always supported edge-to-edge
  }

  if (Platform.OS === 'android') {
    // Android 16+ (API 36+) will require edge-to-edge
    return Platform.Version >= 21; // Minimum supported version
  }

  return false;
};

/**
 * Get recommended padding for edge-to-edge content
 */
export const getEdgeToEdgeContentPadding = () => {
  const config = getEdgeToEdgeConfig();

  return {
    paddingTop: config.isEdgeToEdgeEnabled ? config.safeAreaInsets.top : 0,
    paddingBottom: config.isEdgeToEdgeEnabled ? config.safeAreaInsets.bottom : 0,
    paddingLeft: config.safeAreaInsets.left,
    paddingRight: config.safeAreaInsets.right,
  };
};

export default {
  getEdgeToEdgeConfig,
  getEdgeToEdgeStatusBarConfig,
  getEdgeToEdgeSafeAreaStyles,
  configureEdgeToEdgeStatusBar,
  isEdgeToEdgeSupported,
  getEdgeToEdgeContentPadding,
};
