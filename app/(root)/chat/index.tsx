import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { AntDesign } from "@expo/vector-icons";
import { messagesAPI } from "@/lib/messagesApi";
import { useTheme } from "@/src/context/ThemeContext";
import { ThemedGradient } from "@/components/ThemedGradient";
import CachedImage from "@/components/CachedImage";
import { useConversations } from "@/lib/query/hooks/useChatQuery";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
// Removed useUniversalRefresh import

// Memoized conversation item component for better performance
const ConversationItem = memo(({ item, colors, onPress }: {
  item: any;
  colors: any;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.userItem, {
      backgroundColor: colors.card,
      borderBottomColor: colors.cardBorder
    }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <CachedImage
      uri={item.avatar}
      style={[styles.avatar, { borderColor: colors.cardBorder }]}
      showLoader={true}
      fallbackUri="https://via.placeholder.com/50"
    />
    <View style={styles.userInfo}>
      <Text className="font-rubik-bold" style={[styles.username, { color: colors.text }]}>
        {item.username}
      </Text>
      <Text
        className="font-rubik-medium"
        style={[styles.lastMessage, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {item.lastMessage}
      </Text>
    </View>
  </TouchableOpacity>
));

ConversationItem.displayName = 'ConversationItem';

export default function ChatList() {
  return <ChatListContent />;
}

// Main chat list component
function ChatListContent() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { colors, isDarkMode } = useTheme();
  const queryClient = useQueryClient();

  // Removed universal refresh hook - using standard refresh instead

  // TanStack Query hook for conversations with instant cache loading
  const { data: conversations = [], error, isFetching } = useConversations(currentUserId || '', {
    staleTime: Infinity, // Never stale - rely on Socket.IO for updates
    gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
    enabled: !!currentUserId,
  });

  // Memoize current user fetching to prevent unnecessary re-renders
  const getCurrentUser = useCallback(async () => {
    try {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (__error) {
      console.error("Error getting current user:", __error);
    }
  }, []);

  // Get current user ID
  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  // INSTAGRAM OPTIMIZATION: Aggressively prefetch ALL conversation messages
  // This makes opening any chat instant
  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return;

    const prefetchAllConversations = async () => {
      // Prefetch ALL conversations for instant chat opening
      for (const conv of conversations) {
        const cacheKey = queryKeys.messages.messages(conv.userId);
        
        // Check if already cached
        const cachedData = queryClient.getQueryData(cacheKey);
        if (cachedData) continue; // Skip if already cached

        // Prefetch messages in background (parallel for speed)
        queryClient.prefetchInfiniteQuery({
          queryKey: cacheKey,
          queryFn: async () => {
            const { data, error } = await (supabase.rpc as any)('get_conversation_messages_optimized', {
              p_user_id: currentUserId,
              p_recipient_id: conv.userId,
              p_limit: 50, // Fetch more messages upfront
              p_offset: 0
            });

            if (error) throw error;

            const result = data as any;
            return {
              messages: result?.messages || [],
              nextCursor: result?.hasMore ? 1 : undefined,
              hasMore: result?.hasMore || false,
              pageParam: 0,
            };
          },
          initialPageParam: 0,
          staleTime: Infinity,
        }).catch(() => {
          // Silent fail for prefetch
        });
      }
    };

    // Start prefetching immediately (no delay)
    prefetchAllConversations();
  }, [conversations, currentUserId, queryClient]);

  // Handle refresh for chat list - silent background refresh
  const handleRefresh = useCallback(async () => {
    // Silent background refetch
    queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations() });
  }, [queryClient]);



  // Optimized render function using memoized component
  const renderConversation = useCallback(({ item }: any) => (
    <ConversationItem
      item={item}
      colors={colors}
      onPress={() => router.push(`/chats/${item.userId}`)}
    />
  ), [colors, router]);

  // Memoize FlatList props for better performance
  const flatListProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    windowSize: 21,
    initialNumToRender: 10,
    extraData: `${isDarkMode}-${conversations.length}`,
  }), [isDarkMode, conversations.length]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedGradient style={styles.container}>
      <View style={[styles.header, {
        borderBottomColor: colors.cardBorder,
        backgroundColor: colors.backgroundSecondary
      }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(root)/(tabs)/home');
            }
          }}
          style={[styles.backButton, {
            backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
            borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.3)'
          }]}
        >
          <AntDesign name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="font-rubik-bold" style={[styles.title, { color: colors.text }]}>
          Messages
        </Text>
      </View>
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.flatListContent}
          {...flatListProps}
        />
      </ThemedGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  userItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  username: {
    fontSize: 16,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
  },

  timestamp: {
    fontSize: 12,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  flatListContent: {
    paddingBottom: 20,
  },
});
