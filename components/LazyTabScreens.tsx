import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

// Lazy load tab screens to improve initial loading performance
const HomeScreen = lazy(() => import('@/app/(root)/(tabs)/home'));
const SearchScreen = lazy(() => import('@/app/(root)/(tabs)/search'));
const ReelsScreen = lazy(() => import('@/app/(root)/(tabs)/reels'));
const ProfileScreen = lazy(() => import('@/app/(root)/(tabs)/profile'));

interface TabScreenLoadingFallbackProps {
  tabName: string;
}

const TabScreenLoadingFallback: React.FC<TabScreenLoadingFallbackProps> = ({ tabName }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

interface LazyTabScreenProps {
  screen: 'home' | 'search' | 'reels' | 'profile';
  [key: string]: any;
}

const LazyTabScreen: React.FC<LazyTabScreenProps> = ({ screen, ...props }) => {
  const getScreenComponent = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen {...props} />;
      case 'search':
        return <SearchScreen {...props} />;
      case 'reels':
        return <ReelsScreen {...props} />;
      case 'profile':
        return <ProfileScreen {...props} />;
      default:
        return null;
    }
  };

  return (
    <Suspense fallback={<TabScreenLoadingFallback tabName={screen} />}>
      {getScreenComponent()}
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LazyTabScreen;
export { HomeScreen, SearchScreen, ReelsScreen, ProfileScreen };