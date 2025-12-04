import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/src/context/ThemeContext';
import { RootState } from '@/src/store/store';
import { useSocketChat } from '@/hooks/useSocketChat';
import {
  useChatMessages,
  useSendMessage,
  useSendReply,
  useReactionMutation,
  useDeleteMessage
} from '@/lib/query/hooks/useChatQuery';
import { messagesAPI } from '@/lib/messagesApi';
import { queryKeys } from '@/lib/query/queryKeys';
import {
  addOptimisticReaction,
  removeOptimisticReaction
} from '@/src/store/slices/chatUISlice';
import { supabase } from '@/lib/supabase';

import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { chatDebug } from '@/utils/chatDebug';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  status?: 'sent' | 'delivered' | 'read';
  message_type?: 'text' | 'image' | 'shared_post' | 'shared_reel';
  reply_to_message_id?: string;
  reply_to_message?: {
    id: string;
    content: string;
    sender_id: string;
    message_type?: string;
    sender?: {
      username: string;
    };
  };
  image_url?: string;
  post_id?: string;
  reel_id?: string;
}

interface CustomChatContainerProps {
  userId: string;
  recipientId: string;
  userProfiles: Record<string, any>;
}

const CustomChatContainer: React.FC<CustomChatContainerProps> = ({
  userId,
  recipientId,
  userProfiles,
}) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  
  // Local state
  const [replyToMessage, setReplyToMessage] = useState<any | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsername, setTypingUsername] = useState<string>();

  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; userReacted: boolean }[]>>({});

  // Refs for performance optimization
  const reactionTimeouts = useRef<Record<string, number>>({});
  const debounceTimeout = useRef<number | null>(null);

  // Redux selectors
  const optimisticReactions = useSelector((state: RootState) => state.chatUI.optimisticReactions);

  // Create chat ID for Socket.IO
  const chatId = [userId, recipientId].sort().join('-');

  // TanStack Query hooks - aggressive fetching for instant display
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useChatMessages(userId, recipientId);

  // INSTANT VIEW: Show loading only on first fetch with no data
  const isFirstLoad = isFetching && (!messagesData?.pages || messagesData.pages.length === 0);

  const sendMessageMutation = useSendMessage();
  const sendReplyMutation = useSendReply();
  const reactionMutation = useReactionMutation();
  const deleteMessageMutation = useDeleteMessage();

  // Debug mutation state - using existing deleteMessageMutation
  // const deleteMutation = useMutation({
  //   mutationFn: deleteMessage,
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
  //   },
  // });

  // Flatten and properly order messages from pages for infinite scroll
  const messages = useMemo(() => {
    if (!messagesData?.pages) return [];

    // Flatten all pages and sort by created_at (oldest to newest for chat display)
    const allMessages = messagesData.pages.flatMap(page => page.messages);

    // Sort by created_at ascending (oldest first) for proper chat order
    const sortedMessages = allMessages.sort((a: any, b: any) =>
      new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime()
    );

    // Total messages loaded across pages
    // Sample message IDs for debugging

    return sortedMessages;
  }, [messagesData]);

  // Ref for MessageList to access scroll function
  const messageListRef = useRef<any>(null);

  // Handle scroll to message for reply functionality
  const handleScrollToMessage = useCallback((messageId: string) => {
    // Scroll to message requested

    // Find the message index in the messages array
    const messageIndex = messages.findIndex((msg: any) => (msg as any).id === messageId);

    if (messageIndex !== -1 && messageListRef.current) {
      // Scrolling to message at index

      // Scroll to the message with some offset to center it
      messageListRef.current.scrollToIndex({
        index: messageIndex,
        animated: true,
        viewPosition: 0.5, // Center the message in view
      });
    } else {
      // Message not found for scrolling
    }
  }, [messages]);

  // Fetch reactions only when message IDs change (not on every message update)
  const messageIds = useMemo(() => {
    const validIds = messages.map((m: any) => (m as any).id).filter((id: string) => !id.startsWith('temp_') && id.length === 36 && id.includes('-'));
    // Message IDs for reactions: validIds.length valid IDs from messages.length total messages
    return validIds;
  }, [messages]);

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) {
      // No message IDs to fetch reactions for
      setReactions({});
      return;
    }

    try {
      // Fetching reactions for messages: messageIds.length
      const serverReactions = await messagesAPI.getMessagesReactions(messageIds);
      // Server reactions received: Object.keys(serverReactions).length messages

      // Process server reactions
      const combinedReactions: Record<string, { emoji: string; count: number; userReacted: boolean }[]> = {};

      Object.entries(serverReactions).forEach(([messageId, messageReactions]: [string, any]) => {
        const groupedByEmoji = messageReactions.reduce((acc: any, reaction: any) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
          }
          acc[reaction.emoji].push(reaction);
          return acc;
        }, {} as Record<string, any[]>);

        combinedReactions[messageId] = Object.entries(groupedByEmoji).map(([emoji, emojiReactions]) => ({
          emoji,
          count: (emojiReactions as any[]).length,
          userReacted: (emojiReactions as any[]).some((r: any) => r.user_id === userId)
        }));

        if (combinedReactions[messageId].length > 0) {
          // Message has reaction types
        }
      });

      // Setting reactions state with messages
      setReactions(combinedReactions);
    } catch {
      // Failed to fetch reactions - error handled silently
    }
  }, [messageIds, userId]);

  // OPTIMIZED: Lazy load reactions after messages are displayed (improves initial load speed)
  const messageIdsString = useMemo(() => messageIds.join(','), [messageIds]);

  useEffect(() => {
    if (messageIds.length === 0) {
      return;
    }

    // Fetch reactions silently in background
    debounceTimeout.current = setTimeout(() => {
      fetchReactions();
    }, 300); // Reduced delay for faster display

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [messageIdsString, messageIds.length, userId, fetchReactions]);

  // Socket.IO real-time chat
  const {
    isConnected,
    sendMessage: sendSocketMessage,
    sendTypingStatus,
    markAsRead,
    sendReaction: sendSocketReaction,
  } = useSocketChat({
    userId,
    chatId,
    // Smart polling callback for Expo Go fallback - updates cache directly without refresh
    onPollMessages: useCallback(async () => {
      try {
        // Get the latest message timestamp from current cache
        const currentData = queryClient.getQueryData(queryKeys.messages.messages(recipientId)) as any;
        let lastMessageTime = new Date(0).toISOString(); // Default to epoch
        
        if (currentData?.pages?.length > 0) {
          const allMessages = currentData.pages.flatMap((page: any) => page.messages);
          if (allMessages.length > 0) {
            // Get the most recent message timestamp
            const sortedMessages = allMessages.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            lastMessageTime = sortedMessages[0].created_at;
          }
        }

        // Fetch only new messages since last timestamp
        const newMessages = await messagesAPI.getMessagesSince(userId, recipientId, lastMessageTime);
        
        if (newMessages && newMessages.length > 0) {
          // Update cache directly with new messages (no refresh)
          queryClient.setQueryData(
            queryKeys.messages.messages(recipientId),
            (oldData: any) => {
              if (!oldData) return oldData;

              const newPages = [...oldData.pages];
              if (newPages.length > 0) {
                const lastPage = newPages[newPages.length - 1];
                
                // Filter out messages that already exist
                const uniqueNewMessages = newMessages.filter((newMsg: any) =>
                  !lastPage.messages.some((existingMsg: any) => existingMsg.id === newMsg.id)
                );

                if (uniqueNewMessages.length > 0) {
                  // Add new messages to the last page
                  newPages[newPages.length - 1] = {
                    ...lastPage,
                    messages: [...lastPage.messages, ...uniqueNewMessages].sort((a: any, b: any) =>
                      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    ),
                  };
                }
              }

              return { ...oldData, pages: newPages };
            }
          );
        }
      } catch {
        // Smart polling fallback handling for production
      }
    }, [queryClient, recipientId, userId]),
    onNewMessage: (message: any) => {
      // New message received via Socket.IO - handle optimistically

      // Add message directly to cache instead of invalidating
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
            const lastPage = newPages[newPages.length - 1];

            // Check if this exact message already exists in ANY page
            const messageExistsInAnyPage = newPages.some(page =>
              page.messages.some((m: any) =>
                m.id === message.id ||
                // Also check for content/sender/time match (for API messages with new UUIDs)
                (m.content === message.content &&
                 m.sender_id === message.sender_id &&
                 Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 5000)
              )
            );

            if (!messageExistsInAnyPage) {
              // Look for optimistic/socket message to replace in the last page
              const tempMessageIndex = lastPage.messages.findIndex((m: any) =>
                (m.id.startsWith('temp_') || m.id.startsWith('msg_')) &&
                m.content === message.content &&
                m.sender_id === message.sender_id &&
                Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 10000
              );

              if (tempMessageIndex !== -1) {
                // Replace optimistic/socket message with real API message
                const updatedMessages = [...lastPage.messages];
                updatedMessages[tempMessageIndex] = message;
                newPages[newPages.length - 1] = {
                  ...lastPage,
                  messages: updatedMessages,
                };
              } else {
                // Add new message (from other user)
                newPages[newPages.length - 1] = {
                  ...lastPage,
                  messages: [...lastPage.messages, message],
                };
              }
            } else {
              // Message already exists in cache, skipping
            }
          }

          // Final deduplication check to ensure no duplicate IDs
          if (newPages.length > 0) {
            const lastPage = newPages[newPages.length - 1];
            const uniqueMessages = lastPage.messages.filter((msg: any, index: number, arr: any[]) =>
              arr.findIndex((m: any) => m.id === msg.id) === index
            );

            if (uniqueMessages.length !== lastPage.messages.length) {
              // Removed duplicate messages for optimization
              newPages[newPages.length - 1] = {
                ...lastPage,
                messages: uniqueMessages,
              };
            }
          }

          return { ...oldData, pages: newPages };
        }
      );

      // Only mark as read if it's not our message and user is actively viewing chat
      if (message.sender_id !== userId) {
        // Message received from other user

        // Mark as read after a short delay (simulating user seeing the message)
        // Only if the chat is currently active/visible
        setTimeout(() => {
          // Marking message as read (user is viewing chat)
          markAsRead(message.id);
        }, 2000);
      }
    },
    onTypingUpdate: (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== userId) {
        setIsTyping(data.isTyping);
        setTypingUsername(data.isTyping ? userProfiles[data.userId]?.username : undefined);
      }
    },
    onMessageStatusUpdate: (data: { messageId: string; status: string; isRead: boolean }) => {
      // Socket.IO: Message status update received

      // Update the message status in cache immediately
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          // Looking for message ID to update status
          // Available message IDs in cache

          let messageFound = false;
          let statusChanged = false;
          const newPages = oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) => {
              if (msg.id === data.messageId) {
                messageFound = true;

                // Check if status actually needs to change
                if (msg.status === data.status && msg.is_read === data.isRead) {
                  // Message already has target status: msg.id, status: msg.status, isRead: msg.is_read
                  return msg; // No change needed
                }

                statusChanged = true;
                // Found message to update: msg.id, from msg.status to data.status
                return {
                  ...msg,
                  status: data.status,
                  is_read: data.isRead,
                  delivered_at: data.status === 'delivered' ? new Date().toISOString() : msg.delivered_at,
                  read_at: data.status === 'read' ? new Date().toISOString() : msg.read_at
                };
              }
              return msg;
            })
          }));

          if (!messageFound) {
            // Message not found in cache for status update: data.messageId
            return oldData; // No change
          }

          if (!statusChanged) {
            // No status change needed, skipping update
            return oldData; // No change
          }

          // Status update applied successfully
          return { ...oldData, pages: newPages };
        }
      );
    },
    onNewReaction: async (data: { messageId: string; reaction: any }) => {
      // Socket.IO: Reaction update received: data

      // Fetch reactions for ONLY this specific message to avoid overwriting others
      try {
        const serverReactions = await messagesAPI.getMessagesReactions([data.messageId]);
        const messageReactions = serverReactions[data.messageId] || [];

        // Process reactions for this specific message
        const groupedByEmoji = messageReactions.reduce((acc: any, reaction: any) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
          }
          acc[reaction.emoji].push(reaction);
          return acc;
        }, {} as Record<string, any[]>);

        const processedReactions = Object.entries(groupedByEmoji).map(([emoji, emojiReactions]) => ({
          emoji,
          count: (emojiReactions as any[]).length,
          userReacted: (emojiReactions as any[]).some((r: any) => r.user_id === userId)
        }));

        // Update ONLY this message's reactions, preserve others
        setReactions(prevReactions => ({
          ...prevReactions,
          [data.messageId]: processedReactions
        }));

        // Updated reactions for message data.messageId: processedReactions.length reaction types
      } catch {
        // Failed to fetch specific message reactions - error handled silently
        // Fallback to optimistic update
        setReactions(prevReactions => {
          const messageReactions = prevReactions[data.messageId] || [];

          if ((data.reaction as any)?.action === 'removed') {
            const updatedReactions = messageReactions.filter((r: any) => r.emoji !== (data.reaction as any)?.emoji);
            return {
              ...prevReactions,
              [data.messageId]: updatedReactions
            };
          } else {
            const existingIndex = messageReactions.findIndex((r: any) => r.emoji === (data.reaction as any)?.emoji);
            let updatedReactions;

            if (existingIndex >= 0) {
              updatedReactions = messageReactions.map((reaction: any, index: number) =>
                index === existingIndex
                  ? { ...reaction, count: reaction.count + ((data.reaction as any)?.userId === userId ? 0 : 1) }
                  : reaction
              );
            } else {
              updatedReactions = [...messageReactions, {
                emoji: (data.reaction as any)?.emoji,
                count: 1,
                userReacted: (data.reaction as any)?.userId === userId
              }];
            }

            return {
              ...prevReactions,
              [data.messageId]: updatedReactions
            };
          }
        });
      }
    },
  });

  // Supabase real-time subscriptions for new messages, message status updates and reactions
  useEffect(() => {
    if (!userId || !recipientId) return;

    // Setting up Supabase real-time subscriptions for chat

    // Create a single channel for all real-time events to reduce overhead
    const chatChannel = supabase
      .channel(`chat_${userId}_${recipientId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `and(sender_id=eq.${recipientId},receiver_id=eq.${userId})`,
        },
        (payload) => {
          // New message received via real-time

          // Optimized cache update - batch operations
          queryClient.setQueryData(
            queryKeys.messages.messages(recipientId),
            (oldData: any) => {
              if (!oldData?.pages?.length) return oldData;

              // Add the new message to the FIRST page at the BEGINNING (newest first order)
              const newPages = [...oldData.pages];
              newPages[0] = {
                ...newPages[0],
                messages: [payload.new, ...newPages[0].messages]
              };

              return { ...oldData, pages: newPages };
            }
          );

          // Mark message as delivered automatically (debounced)
          if (payload.new.status === 'sent') {
            messagesAPI.markAsDelivered(payload.new.id).catch(() => {
              // Handle delivery marking error silently in production
            });
          }
        }
      )

    // Subscribe to message status updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId},receiver_id=eq.${recipientId}`,
        },
        (payload) => {
          // Message status updated

          // Optimized cache update for status changes
          queryClient.setQueryData(
            queryKeys.messages.messages(recipientId),
            (oldData: any) => {
              if (!oldData?.pages?.length) return oldData;

              const newPages = oldData.pages.map((page: any) => ({
                ...page,
                messages: page.messages.map((msg: any) =>
                  msg.id === payload.new.id
                    ? { ...msg, status: payload.new.status, delivered_at: payload.new.delivered_at, read_at: payload.new.read_at }
                    : msg
                )
              }));

              return { ...oldData, pages: newPages };
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          // Message reaction updated

          // Optimized reaction handling - only update specific message
          if ((payload.new as any)?.message_id || (payload.old as any)?.message_id) {
            const messageId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
            
            // Debounced reaction fetch to prevent excessive API calls
            if (reactionTimeouts.current[messageId]) {
              clearTimeout(reactionTimeouts.current[messageId]);
            }
            reactionTimeouts.current[messageId] = setTimeout(() => {
              messagesAPI.getMessagesReactions([messageId]).then(serverReactions => {
                const messageReactions = serverReactions[messageId] || [];
                const groupedByEmoji = messageReactions.reduce((acc: any, reaction: any) => {
                  if (!acc[reaction.emoji]) {
                    acc[reaction.emoji] = [];
                  }
                  acc[reaction.emoji].push(reaction);
                  return acc;
                }, {} as Record<string, any[]>);

                const processedReactions = Object.entries(groupedByEmoji).map(([emoji, emojiReactions]) => ({
                  emoji,
                  count: (emojiReactions as any[]).length,
                  userReacted: (emojiReactions as any[]).some((r: any) => r.user_id === userId)
                }));

                setReactions(prevReactions => ({
                  ...prevReactions,
                  [messageId]: processedReactions
                }));
              }).catch(() => {
                // Handle reaction fetch error silently in production
              });
            }, 100); // 100ms debounce
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions and timeouts
    return () => {
      // Cleaning up Supabase real-time subscriptions
      chatChannel.unsubscribe();
      
      // Clear all pending reaction timeouts
      Object.values(reactionTimeouts.current).forEach(timeout => clearTimeout(timeout));
      reactionTimeouts.current = {};
    };
  }, [userId, recipientId, queryClient]);

  // Mark unread messages as read when chat is opened (only once)
  const markedAsReadRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || !recipientId || !messages.length) return;

    // Find unread messages from the other user that haven't been marked yet
    const unreadMessages = messages.filter((msg: any) =>
      (msg as any).sender_id === recipientId &&
      (msg as any).status !== 'read' &&
      !(msg as any).is_read &&
      !(msg as any).id.startsWith('temp_') &&
      !markedAsReadRef.current.has((msg as any).id)
    );

    if (unreadMessages.length > 0) {
      // Marking new messages as read

      // Mark each unread message as read (only once)
      unreadMessages.forEach((msg: any) => {
        markedAsReadRef.current.add((msg as any).id); // Track that we've marked this message
        setTimeout(() => {
          markAsRead((msg as any).id);
        }, 500); // Small delay to simulate reading
      });
    }
  }, [messages, userId, recipientId, markAsRead]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string, replyToMessageId?: string) => {
    if (!content.trim()) return;

    // Create optimistic message for instant UI update
    const timestamp = Date.now();
    const optimisticMessage: any = {
        id: `temp_${timestamp}_${userId}`,
        content,
        sender_id: userId,
        receiver_id: recipientId,
        created_at: new Date(timestamp).toISOString(),
        status: 'sent',
        message_type: 'text',
        reply_to_message_id: replyToMessageId,
      };

    try {
      // Add optimistic message to cache
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
            // Add optimistic messages to the FIRST page at the BEGINNING (same as real-time messages)
            const firstPage = newPages[0];

            // Check if optimistic message already exists in any page
            const messageExists = newPages.some(page =>
              page.messages.some((m: any) =>
                m.id === optimisticMessage.id ||
                (m.content === optimisticMessage.content &&
                 m.sender_id === optimisticMessage.sender_id &&
                 Math.abs(new Date(m.created_at).getTime() - new Date(optimisticMessage.created_at).getTime()) < 2000)
              )
            );

            if (!messageExists) {
              // Add to FIRST page at BEGINNING for instant display (same as real-time messages)
              newPages[0] = {
                ...firstPage,
                messages: [optimisticMessage, ...firstPage.messages],
              };
              // Added optimistic message to first page at beginning for instant display
            } else {
              // Optimistic message already exists, skipping
            }
          }

          return { ...oldData, pages: newPages };
        }
      );

      // Send reply or regular message via API first to get real message ID
      let realMessage;
      if (replyToMessageId) {
        realMessage = await sendReplyMutation.mutateAsync({
          senderId: userId,
          receiverId: recipientId,
          content,
          replyToMessageId,
        });
      } else {
        realMessage = await sendMessageMutation.mutateAsync({
          senderId: userId,
          receiverId: recipientId,
          content,
        });
      }

      // Replace optimistic message with real message in cache
      if (realMessage && realMessage.id) {
        // Replacing optimistic message with real message

        queryClient.setQueryData(
          queryKeys.messages.messages(recipientId),
          (oldData: any) => {
            if (!oldData) return oldData;

            const newPages = oldData.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === optimisticMessage.id
                  ? { ...realMessage, status: 'sent' } // Replace with real message but keep 'sent' status
                  : msg
              )
            }));

            return { ...oldData, pages: newPages };
          }
        );

        // Send via Socket.IO for real-time delivery with REAL message ID
        // Handle Socket.IO separately - don't let it affect message sending success
        try {
          // Sending Socket.IO message with real ID
          sendSocketMessage({
            id: realMessage.id, // Use real database ID
            sender_id: userId,
            receiver_id: recipientId,
            content,
            is_read: false,
            created_at: realMessage.created_at,
          });
        } catch {
          // Socket.IO errors are expected in Expo Go - handle silently in production
        }
      }

      // Message sent successfully
    } catch (error) {
      // Failed to send message via API - handle silently in production

      // Run diagnostic if it's a recipient error
      if (error instanceof Error && error.message.includes('Recipient does not exist')) {
        // Running diagnostic for recipient error
        chatDebug.runFullDiagnostic(recipientId);
      }

      Alert.alert('Error', 'Failed to send message. Please try again.');

      // Remove specific optimistic message on error
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
            const lastPage = newPages[newPages.length - 1];
            newPages[newPages.length - 1] = {
              ...lastPage,
              messages: lastPage.messages.filter((m: any) => m.id !== optimisticMessage.id),
            };
          }

          return { ...oldData, pages: newPages };
        }
      );
    }
  }, [userId, recipientId, sendSocketMessage, sendMessageMutation, sendReplyMutation, queryClient]);

  // Handle typing status
  const handleTypingStatusChange = useCallback((isTyping: boolean) => {
    // Only send typing status if Socket.IO is connected
    if (isConnected) {
      sendTypingStatus(isTyping);
    }
    // If not connected, silently ignore typing status (no error)
  }, [sendTypingStatus, isConnected]);

  // TODO: Implement reply functionality later
  // const handleReply = useCallback((message: Message) => {
  //   setReplyToMessage(message);
  // }, []);

  // Handle cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyToMessage(undefined);
  }, []);

  // Handle emoji reactions with Socket.IO for instant real-time updates
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      // Adding reaction via Socket.IO

      // Optimistic update: immediately update local reactions state
      setReactions(prevReactions => {
        const messageReactions = prevReactions[messageId] || [];
        const existingReactionIndex = messageReactions.findIndex(r => r.emoji === emoji);

        let updatedReactions;
        if (existingReactionIndex >= 0) {
          const existingReaction = messageReactions[existingReactionIndex];
          if (existingReaction.userReacted) {
            // User is removing their reaction
            if (existingReaction.count === 1) {
              // Remove the reaction entirely
              updatedReactions = messageReactions.filter((_, index) => index !== existingReactionIndex);
            } else {
              // Decrease count and mark as not reacted
              updatedReactions = messageReactions.map((reaction, index) =>
                index === existingReactionIndex
                  ? { ...reaction, count: reaction.count - 1, userReacted: false }
                  : reaction
              );
            }
          } else {
            // User is adding their reaction to existing emoji
            updatedReactions = messageReactions.map((reaction, index) =>
              index === existingReactionIndex
                ? { ...reaction, count: reaction.count + 1, userReacted: true }
                : reaction
            );
          }
        } else {
          // New emoji reaction
          updatedReactions = [...messageReactions, { emoji, count: 1, userReacted: true }];
        }

        return {
          ...prevReactions,
          [messageId]: updatedReactions
        };
      });

      // Send reaction via Socket.IO for instant real-time updates
      if (!messageId.startsWith('temp_')) {
        // Sending reaction via Socket.IO
        sendSocketReaction(messageId, emoji);

        // Also send to API as backup (but don't wait for it)
        reactionMutation.mutateAsync({
          messageId,
          emoji,
          userId,
        }).catch(error => {
          // API reaction failed (Socket.IO already sent) - handle silently in production
          // Refresh reactions for this specific message if API fails
          setTimeout(async () => {
            try {
              const serverReactions = await messagesAPI.getMessagesReactions([messageId]);
              const messageReactions = serverReactions[messageId] || [];

              const groupedByEmoji = messageReactions.reduce((acc: any, reaction: any) => {
                if (!acc[reaction.emoji]) {
                  acc[reaction.emoji] = [];
                }
                acc[reaction.emoji].push(reaction);
                return acc;
              }, {} as Record<string, any[]>);

              const processedReactions = Object.entries(groupedByEmoji).map(([emoji, emojiReactions]) => ({
                emoji,
                count: (emojiReactions as any[]).length,
                userReacted: (emojiReactions as any[]).some((r: any) => r.user_id === userId)
              }));

              setReactions(prevReactions => ({
                ...prevReactions,
                [messageId]: processedReactions
              }));
            } catch {
              // Failed to refresh specific message reactions - handle silently in production
            }
          }, 1000);
        });
      } else {
        // Skipping reaction for temporary message
        // Add Redux optimistic reaction for temporary messages
        dispatch(addOptimisticReaction({ messageId, emoji }));
      }
    } catch {
      // Failed to send reaction - handle silently in production

      // Revert optimistic update on error - fetch only this message's reactions
      try {
        const serverReactions = await messagesAPI.getMessagesReactions([messageId]);
        const messageReactions = serverReactions[messageId] || [];

        const groupedByEmoji = messageReactions.reduce((acc: any, reaction: any) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
          }
          acc[reaction.emoji].push(reaction);
          return acc;
        }, {} as Record<string, any[]>);

        const processedReactions = Object.entries(groupedByEmoji).map(([emoji, emojiReactions]) => ({
          emoji,
          count: (emojiReactions as any[]).length,
          userReacted: (emojiReactions as any[]).some((r: any) => r.user_id === userId)
        }));

        setReactions(prevReactions => ({
          ...prevReactions,
          [messageId]: processedReactions
        }));
      } catch {
        // Failed to revert reaction state - handle silently in production
      }

      dispatch(removeOptimisticReaction(messageId));
    }
  }, [dispatch, reactionMutation, userId, sendSocketReaction]);

  // Handle message deletion - simplified
  const handleDelete = useCallback(async (messageId: string) => {
    // Delete handler called for message

    // Check if this is a temporary message (not yet saved to database)
    if (messageId.startsWith('temp_')) {
      // Deleting temporary message (not in database)
      // Only remove from cache since it's not in the database
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          for (let i = 0; i < newPages.length; i++) {
            const page = newPages[i];
            const filteredMessages = page.messages.filter((msg: any) => msg.id !== messageId);
            if (filteredMessages.length !== page.messages.length) {
              newPages[i] = { ...page, messages: filteredMessages };
              break;
            }
          }

          return { ...oldData, pages: newPages };
        }
      );
      // Temporary message removed from cache
      return; // Exit early for temporary messages
    }

    try {
      // Skip Redux optimistic deletion due to Immer MapSet issue
      // dispatch(addOptimisticDeletedMessage(messageId));
      // Processing database message deletion

      // Immediately remove from cache for instant UI update
      queryClient.setQueryData(
        queryKeys.messages.messages(recipientId),
        (oldData: any) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          for (let i = 0; i < newPages.length; i++) {
            const page = newPages[i];
            const filteredMessages = page.messages.filter((msg: any) => msg.id !== messageId);
            if (filteredMessages.length !== page.messages.length) {
              newPages[i] = { ...page, messages: filteredMessages };
              break;
            }
          }

          return { ...oldData, pages: newPages };
        }
      );

      // Optimistically removed message from cache

      // Delete message via API

      try {
        await deleteMessageMutation.mutateAsync(messageId);
        // deleteMessageMutation.mutateAsync completed successfully
        // Message should now be deleted from database
      } catch (mutationError) {
        // Mutation error - handle silently in production
        throw mutationError; // Re-throw to be caught by outer catch
      }

    } catch {
      // Error in handleDelete - handle silently in production
      // Skip Redux optimistic deletion removal due to Immer MapSet issue
      // dispatch(removeOptimisticDeletedMessage(messageId));

      // Restore message in cache on error
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.messages(recipientId) });

      // Failed to delete message - show user-friendly error
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    }
  }, [deleteMessageMutation, queryClient, recipientId]);

  // Handle media press (for image viewing, etc.)
  const handleMediaPress = useCallback((message: Message) => {
    // TODO: Implement image viewer or media modal
    // Media pressed
  }, []);

  // Handle load more messages
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      // Loading more messages
      fetchNextPage();
    } else {
      // No more messages to load or already loading
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle refresh - silent background refresh, no UI blocking
  const handleRefresh = useCallback(() => {
    // Silent refetch in background - no loading states
    queryClient.invalidateQueries({ queryKey: queryKeys.messages.messages(recipientId) });
  }, [queryClient, recipientId]);



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>      
      {/* INSTANT VIEW: Show loading hint only on very first load */}
      {isFirstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>No messages yet</Text>
        </View>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={userId}
          // {/* onReply={handleReply} */}
          onReaction={handleReaction}
          onDelete={handleDelete}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          isLoading={isFetchingNextPage || false}
          isRefreshing={false}
          hasMore={hasNextPage || false}
          isTyping={isTyping || false}
          typingUsername={typingUsername || ''}
          reactions={reactions || {}}
          optimisticReactions={optimisticReactions || {}}
          onMediaPress={handleMediaPress}
          isInitialLoading={false} // No overlay needed - using skeleton instead
          onScrollToMessage={handleScrollToMessage}
          messageListRef={messageListRef}
        />
      )}

      {/* Message Input - Always show for better UX */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTypingStatusChange={handleTypingStatusChange}
        replyToMessage={replyToMessage}
        onCancelReply={handleCancelReply}
        currentUserId={userId}
        disabled={isFirstLoad} // Disable only during very first load
        isConnected={isConnected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CustomChatContainer;
