import React, { useRef, useEffect, useCallback, useMemo, useState, memo } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import DateSeparator from './DateSeparator';
import { groupMessagesByDate, MessageListItem } from './utils/dateGrouping';
// Removed useUniversalRefresh import

import { Message } from '../../types/shared';



interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  // onReply: (message: Message) => void; // TODO: Implement reply functionality later
  onReaction: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  isTyping?: boolean;
  typingUsername?: string;
  reactions?: Record<string, { emoji: string; count: number; userReacted: boolean }[]>;
  optimisticReactions: Record<string, { emoji: string }>;
  onMediaPress?: (message: Message) => void;
  isInitialLoading?: boolean; // Instagram-like loading state
  onScrollToMessage?: (messageId: string) => void;
  messageListRef?: React.RefObject<any>;
}

const MessageList: React.FC<MessageListProps> = memo(({
  messages,
  currentUserId,
  // onReply, // TODO: Implement reply functionality later
  onReaction,
  onDelete,
  onLoadMore,
  onRefresh,
  isLoading,
  isRefreshing,
  hasMore,
  isTyping = false,
  typingUsername,
  reactions = {},
  optimisticReactions = {},
  onMediaPress,
  isInitialLoading = false,
  onScrollToMessage,
  messageListRef,
}) => {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  // Removed universal refresh hook - using standard refresh instead

  // Use external ref if provided, otherwise use internal ref
  const listRef = messageListRef || flatListRef;

  // Safety check for props - wrapped in useMemo to prevent re-renders
  const safeIsLoading = isLoading || false;
  const safeIsRefreshing = isRefreshing || false;
  const safeHasMore = hasMore || false;
  const safeMessages = useMemo(() => messages || [], [messages]);
  const safeReactions = useMemo(() => reactions || {}, [reactions]);
  const safeOptimisticReactions = useMemo(() => optimisticReactions || {}, [optimisticReactions]);

  // Create list items with date grouping
  const listItems = useMemo(() => {
    return groupMessagesByDate(safeMessages, isTyping, typingUsername);
  }, [safeMessages, isTyping, typingUsername]);

  // Instagram-like behavior: Start from bottom on initial load, auto-scroll only for new messages
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const previousMessageCount = useRef(safeMessages.length);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure chat starts at bottom with latest messages (Instagram behavior)
  useEffect(() => {
    if (listItems.length > 0 && !hasInitiallyScrolled) {
      // For normal FlatList, scroll to end to show latest messages at bottom
      // Use multiple attempts to ensure it works
      const scrollToBottom = () => {
        listRef.current?.scrollToEnd({ animated: false });
      };

      // Immediate scroll
      scrollToBottom();

      // Backup scrolls with delays
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 200);
      setTimeout(() => {
        scrollToBottom();
        setHasInitiallyScrolled(true);
        // Initial scroll to bottom completed
      }, 300);
    }
  }, [listItems.length, hasInitiallyScrolled, listRef]);

  // Track when loading older messages
  useEffect(() => {
    if (safeIsLoading) {
      setIsLoadingOlderMessages(true);
    } else {
      // Reset loading state after a delay to prevent auto-scroll
      setTimeout(() => setIsLoadingOlderMessages(false), 500);
    }
  }, [safeIsLoading]);

  // Auto-scroll for new messages with inverted FlatList (scroll to top of inverted list = bottom of chat)
  useEffect(() => {
    const messageCountDiff = safeMessages.length - previousMessageCount.current;

    // Detect if this is a bulk load (pagination) vs new messages
    const isBulkLoad = messageCountDiff > 10; // More than 10 messages = pagination

    // Message count changed: diff, isBulkLoad, isUserScrolling, isLoadingOlderMessages, hasInitiallyScrolled

    // Only auto-scroll if:
    // 1. We've initially scrolled
    // 2. User is not manually scrolling
    // 3. Not loading older messages
    // 4. Not a bulk load (pagination)
    // 5. Messages were actually added
    // 6. User is near the bottom of the chat
    if (hasInitiallyScrolled &&
        messageCountDiff > 0 &&
        !isBulkLoad &&
        !isUserScrolling &&
        !isLoadingOlderMessages &&
        isNearBottom) {
      // Auto-scrolling to bottom for new messages
      // For normal FlatList, scroll to end (which is the bottom of the chat)
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else if (messageCountDiff > 0) {
      // Skipping auto-scroll: reason based on conditions
    }

    previousMessageCount.current = safeMessages.length;
  }, [safeMessages.length, hasInitiallyScrolled, isUserScrolling, isLoadingOlderMessages, isNearBottom, listRef]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [listRef]);

  const renderItem = useCallback(({ item, index }: { item: MessageListItem; index: number }) => {
    switch (item.type) {
      case 'date':
        return <DateSeparator date={item.date!} />;

      case 'typing':
        return (
          <TypingIndicator
            isVisible={item.isTyping!}
            username={item.username}
          />
        );

      case 'message':
        const message = item.message!;

        // Combine server reactions with optimistic reactions
        let messageReactions = safeReactions[message.id] || [];
        const optimisticReaction = safeOptimisticReactions[message.id];

        if (optimisticReaction) {
          // Check if this emoji already exists in server reactions
          const existingReactionIndex = messageReactions.findIndex(r => r.emoji === optimisticReaction.emoji);

          if (existingReactionIndex >= 0) {
            // Update existing reaction if user hasn't reacted yet
            if (!messageReactions[existingReactionIndex].userReacted) {
              messageReactions = [...messageReactions];
              messageReactions[existingReactionIndex] = {
                ...messageReactions[existingReactionIndex],
                count: messageReactions[existingReactionIndex].count + 1,
                userReacted: true
              };
            }
          } else {
            // Add new optimistic reaction
            messageReactions = [
              ...messageReactions,
              {
                emoji: optimisticReaction.emoji,
                count: 1,
                userReacted: true
              }
            ];
          }
        }

        return (
          <MessageItem
            message={message}
            currentUserId={currentUserId}
            // onReply={onReply} // TODO: Implement reply functionality later
            onReaction={onReaction}
            onDelete={onDelete}
            reactions={messageReactions}
            onMediaPress={onMediaPress}
            onScrollToMessage={onScrollToMessage}
          />
        );

      default:
        return <View />; // Return empty view instead of null
    }
  }, [currentUserId, /* onReply, */ onReaction, onDelete, onMediaPress, onScrollToMessage, safeOptimisticReactions, safeReactions]);

  const keyExtractor = useCallback((item: MessageListItem) => item.id, []);

  // Handle scroll events to detect user scrolling
  const handleScrollBeginDrag = useCallback(() => {
    setIsUserScrolling(true);
    // Clear any existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    // User started scrolling
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    // Reset user scrolling flag after a longer delay to prevent auto-scroll
    // User stopped scrolling
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      // User scrolling state reset
    }, 5000) as any; // Much longer delay to prevent unwanted auto-scroll
  }, []);

  // Handle scroll to index failures
  const handleScrollToIndexFailed = useCallback((info: any) => {
    // Fallback to scrollToEnd if scrollToIndex fails
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [listRef]);

  // Handle FlatList layout to ensure proper initial positioning
  const handleLayout = useCallback(() => {
    if (listItems.length > 0 && !hasInitiallyScrolled) {
      // Only scroll to end on initial layout, not on every layout change
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
        // Initial layout-based scroll to bottom
      }, 50);
    }
  }, [listItems.length, hasInitiallyScrolled, listRef]);

  // Handle scroll to detect when user reaches top (for loading older messages) and track position
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const scrollHeight = contentSize.height;
    const viewHeight = layoutMeasurement.height;

    // Calculate if user is near bottom (within 100px)
    const distanceFromBottom = scrollHeight - (scrollY + viewHeight);
    const nearBottom = distanceFromBottom <= 100;
    setIsNearBottom(nearBottom);

    // If user scrolled to near the top, load more messages
    if (scrollY <= 100 && safeHasMore && !safeIsLoading) {
      // User scrolled to top, loading older messages
      onLoadMore();
    }
  }, [safeHasMore, safeIsLoading, onLoadMore]);

  const renderFooter = () => {
    // No loading footer - instant view
    return null;
  };

  // Handle refresh for chat messages
  const handleRefresh = useCallback(async () => {
    try {
      // Trigger the original refresh function
      onRefresh();
    } catch {
      // Error handling for production
    }
  }, [onRefresh]);

  // Memoized refresh control - disabled for instant view
  const refreshControl = useMemo(() => (
    <RefreshControl
      refreshing={false}
      onRefresh={handleRefresh}
      colors={[colors.primary]}
      tintColor={colors.primary}
    />
  ), [handleRefresh, colors.primary]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={[styles.flatList, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        inverted={false} // Use normal FlatList and scroll to end
        onLayout={handleLayout}
        onScroll={handleScroll} // Custom scroll handler for loading older messages
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onContentSizeChange={() => {
          // Only scroll to bottom when content size changes if user is near bottom and not scrolling
          if (!isUserScrolling && isNearBottom && hasInitiallyScrolled) {
            listRef.current?.scrollToEnd({ animated: false });
            // Content size changed, scrolling to bottom
          }
        }}
        ListHeaderComponent={renderFooter}
        removeClippedSubviews={true} // Enable for better performance
        maxToRenderPerBatch={10} // Optimized for smooth scrolling
        windowSize={10} // Balanced for performance and memory
        initialNumToRender={15} // Show enough messages initially
        updateCellsBatchingPeriod={50} // Smooth updates
        maintainVisibleContentPosition={{
          minIndexForVisible: 0, // Keep first visible item in place
        }}
        // Instagram-like optimizations
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Performance optimizations for infinite scroll
        getItemLayout={undefined} // Let FlatList calculate dynamically
        legacyImplementation={false}
        refreshControl={refreshControl}
      />
    </View>
  );
});

MessageList.displayName = 'MessageList';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  flatList: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end', // Align content to bottom when there are few messages
  },
});

export default MessageList;

