import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import debounce from 'lodash/debounce';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedGradient } from '@/components/ThemedGradient';
import GridSkeleton from '@/components/skeletons/GridSkeleton';
import { useInfiniteExploreFeed, useInfiniteSearchUsers } from '@/lib/query/hooks/useExploreQuery';

interface User {
  id: string;
  username: string;
  avatar_url: string;
  bio?: string;
  name?: string;
}

interface Post {
  id: string;
  image_urls?: string[];
  caption: string;
  user: {
    username: string;
    avatar: string;
  };
  type: 'image';
}

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption: string;
  user: {
    username: string;
    avatar: string;
  };
  type: 'video';
}

type PostOrReel = Post | Reel;

const Search = () => {
  const { colors, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Use infinite scroll explore feed hook
  const {
    data: exploreData,
    isLoading: exploreLoading,
    isFetchingNextPage: isFetchingNextExplore,
    hasNextPage: hasNextExplore,
    fetchNextPage: fetchNextExplore,
    refetch: refetchExplore
  } = useInfiniteExploreFeed();

  // Flatten paginated data
  const exploreItems = exploreData?.pages.flatMap(page => page) || [];

  // Use infinite scroll search users hook
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetchingNextPage: isFetchingNextSearch,
    hasNextPage: hasNextSearch,
    fetchNextPage: fetchNextSearch,
    refetch: refetchSearch
  } = useInfiniteSearchUsers(searchQuery);

  // Flatten search results
  const users = searchData?.pages.flatMap(page => page) || [];

  // Refresh function for explore content
  const handleRefreshExplore = useCallback(async () => {
    await refetchExplore();
  }, [refetchExplore]);

  // Refresh function for search results
  const handleRefreshSearch = useCallback(async () => {
    await refetchSearch();
  }, [refetchSearch]);

  // Load more explore items when reaching end
  const handleLoadMoreExplore = useCallback(() => {
    if (hasNextExplore && !isFetchingNextExplore) {
      fetchNextExplore();
    }
  }, [hasNextExplore, isFetchingNextExplore, fetchNextExplore]);

  // Load more search results when reaching end
  const handleLoadMoreSearch = useCallback(() => {
    if (hasNextSearch && !isFetchingNextSearch) {
      fetchNextSearch();
    }
  }, [hasNextSearch, isFetchingNextSearch, fetchNextSearch]);

  // Search query is now handled automatically by useSearchUsers hook
  // No need for debounced search function or useEffect

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const navigateToProfile = (user: User) => {
    router.push({
      pathname: `/userProfile/${user.id}` as any,
      params: {
        id: user.id,
        avatar: user.avatar_url,
      },
    } as any);
  };

  const navigateToPost = (item: PostOrReel) => {
    if (item.type === 'image') {
      router.push(`/post/${item.id}`);
    } else {
      router.push(`/reel/${item.id}`);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem as any}
      onPress={() => navigateToProfile(item)}
    >
      <Image 
        source={{ 
          uri: item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=E5E7EB&color=9CA3AF&size=50`
        }} 
        style={styles.avatar as any} 
      />
      <View style={styles.userInfo as any}>
        <Text className="font-rubik-bold" style={[styles.username as any, { color: colors.text }]}>
          {item.username}
        </Text>
        {item.bio && (
          <Text className="font-rubik-regular" style={[styles.bio as any, { color: colors.textSecondary }]}>
            {item.bio}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPostItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.postItem as any}
      onPress={() => navigateToPost(item)}
    >
      <Image
        source={{
          uri:
            item.type === 'image'
              ? item.image_urls?.[0]
              : item.thumbnail_url || 'https://via.placeholder.com/150',
        }}
        style={styles.postImage as any}
        resizeMode="cover"
      />
      {item.type === 'video' && (
        <Feather
          name="play-circle"
          size={24}
          color="#FFD700"
          style={styles.playIcon as any}
        />
      )}
      {/* Multiple images indicator */}
      {item.type === 'image' && item.image_urls && item.image_urls.length > 1 && (
        <View style={styles.multipleImagesIndicator as any}>
          <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea as any}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ThemedGradient style={styles.container as any}>
      <View style={[styles.searchContainer as any, {
        backgroundColor: colors.input,
        borderColor: colors.inputBorder
      }]}>
        <Feather
          name="search"
          size={20}
          color={colors.text}
          style={styles.searchIcon as any}
        />
        <TextInput
          className="font-rubik-medium"
          style={[styles.searchInput as any, { color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {searchQuery.length > 0 ? (
        searchLoading && users.length === 0 ? (
          <ActivityIndicator style={styles.loader as any} color="#FFD700" />
        ) : (
          <FlatList
            key="searchList"
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.listContainer as any}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefreshSearch}
            refreshing={searchLoading}
            onEndReached={handleLoadMoreSearch}
            onEndReachedThreshold={0.1}
            ListFooterComponent={
              isFetchingNextSearch ? (
                <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
              ) : null
            }
          />
        )
      ) : exploreLoading && exploreItems.length === 0 ? (
        <GridSkeleton numColumns={2} numRows={6} />
      ) : (
        <FlatList
          key="exploreGrid"
          data={exploreItems}
          renderItem={renderPostItem}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.postListContainer as any}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper as any}
          onRefresh={handleRefreshExplore}
          refreshing={exploreLoading}
          onEndReached={handleLoadMoreExplore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={
            isFetchingNextExplore ? (
              <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
            ) : null
          }
        />
      )}
      </ThemedGradient>
    </SafeAreaView>
  );
};

export default Search;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
  },
  bio: {
    fontSize: 14,
    marginTop: 2,
  },
  loader: {
    marginTop: 20,
  },
  postListContainer: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  postItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 4,
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    opacity: 0.8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});
