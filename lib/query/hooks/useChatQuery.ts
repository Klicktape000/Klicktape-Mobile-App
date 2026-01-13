/**
 * TanStack Query hooks for Chat functionality
 * Provides optimized data fetching with caching and pagination
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { messagesAPI } from '@/lib/messagesApi';
import { queryKeys } from '../queryKeys';

// Types
interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Conversation {
  userId: string;
  username: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  isRead: boolean;
}

// Use centralized query keys
const chatQueryKeys = queryKeys.messages;

// Query Functions
const chatQueryFunctions = {
  /**
   * Get user profile for chat header
   */
  getUserProfile: async (userId: string): Promise<UserProfile> => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      throw new Error(`User profile not found: ${error?.message || 'No data'}`);
    }

    return profile;
  },

  /**
   * Get conversations list
   * OPTIMIZED: Uses database function to fetch only latest message per conversation
   * Much faster than fetching ALL messages
   */
  getConversations: async (currentUserId: string): Promise<Conversation[]> => {
    try {
      // OPTIMIZED: Use RPC function to get only latest message per conversation
      // This is MUCH faster than fetching all messages
      const { data, error } = await (supabase.rpc as any)('get_user_conversations', {
        user_id_param: currentUserId
      });

      if (error) {
        console.error('Error fetching conversations with RPC:', error);
        // Fallback to old method if RPC fails
        return await chatQueryFunctions.getConversationsFallback(currentUserId);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform RPC result to match expected format
      const conversations = data.map((conv: any) => ({
        userId: conv.other_user_id,
        username: conv.username || 'User',
        avatar: conv.avatar_url || "https://via.placeholder.com/50",
        lastMessage: messagesAPI.getMessagePreview(conv.last_message_content, conv.last_message_type),
        timestamp: conv.last_message_time,
        isRead: conv.is_read,
      }));

      return conversations.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (__error) {
      console.error('Error loading conversations:', __error);
      // Fallback to old method
      return await chatQueryFunctions.getConversationsFallback(currentUserId);
    }
  },

  /**
   * Fallback method if RPC function doesn't exist
   * Fetches all messages (slower but works)
   */
  getConversationsFallback: async (currentUserId: string): Promise<Conversation[]> => {
    try {
      // LIMIT to last 100 messages to reduce load
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          sender_id,
          receiver_id,
          created_at,
          is_read,
          message_type
        `)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .limit(100); // CRITICAL: Limit to last 100 messages only

      if (error) throw error;

      if (!messages || messages.length === 0) {
        return [];
      }

      // Group messages by conversation partner
      const conversationMap = new Map<string, any>();

      for (const message of messages) {
        const otherId = (message as any).sender_id === currentUserId ? (message as any).receiver_id : (message as any).sender_id;

        if (!conversationMap.has(otherId)) {
          conversationMap.set(otherId, message);
        }
      }

      // OPTIMIZED: Batch fetch all user profiles in a single query instead of N+1 queries
      const otherUserIds = Array.from(conversationMap.keys());

      const { data: userProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherUserIds);

      if (profilesError) {
        console.error("Error fetching conversation user profiles:", profilesError);
        return [];
      }

      // Create a map of user profiles for quick lookup
      const profileMap = new Map(
        (userProfiles || []).map((profile: any) => [profile.id, profile])
      );

      // Build conversations array
      const conversationUsers = Array.from(conversationMap.entries()).map(([otherId, lastMessage]) => {
        const userDoc = profileMap.get(otherId);

        if (!userDoc) {
          return null;
        }

        return {
          userId: otherId,
          username: (userDoc as any).username,
          avatar: (userDoc as any).avatar_url || "https://via.placeholder.com/50",
          lastMessage: messagesAPI.getMessagePreview(lastMessage.content, lastMessage.message_type),
          timestamp: lastMessage.created_at,
          isRead: lastMessage.is_read,
        };
      }).filter(Boolean) as Conversation[];

      return conversationUsers.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (__error) {
       throw __error;
     }
  },

  /**
   * Get messages with pagination (Instagram/WhatsApp style)
   * OPTIMIZED: Uses database RPC function for faster queries
   * First page: Most recent messages (more for instant full screen)
   * Next pages: Older messages when scrolling up
   * Respects cleared chat status - only shows messages after clear time
   */
  getMessages: async ({
    pageParam = 0,
    currentUserId,
    recipientId
  }: {
    pageParam?: number;
    currentUserId: string;
    recipientId: string;
  }) => {
    const MESSAGES_PER_PAGE = 50; // Increased for instant full screen display
    const offset = pageParam * MESSAGES_PER_PAGE;

    try {
      // OPTIMIZED: Use database RPC function for faster queries
      const { data, error } = await (supabase.rpc as any)('get_conversation_messages_optimized', {
        p_user_id: currentUserId,
        p_recipient_id: recipientId,
        p_limit: MESSAGES_PER_PAGE,
        p_offset: offset
      });

      if (error) {
        console.error('Error fetching messages with RPC:', error);
        throw error;
      }

      const result = data as any;
      const messages = result?.messages || [];
      const hasMore = result?.hasMore || false;

      return {
        messages: messages, // Keep DB order (newest first)
        nextCursor: hasMore ? pageParam + 1 : undefined,
        hasMore,
        pageParam,
      };
    } catch (__error) {
       // Error fetching messages
       throw __error;
     }
  },
};

// Hooks
/**
 * Get user profile for chat header
 * INSTANT VIEW: No loading, cache-first
 */
export const useChatUserProfile = (userId: string) => {
  return useQuery({
    queryKey: chatQueryKeys.userProfile(userId),
    queryFn: () => chatQueryFunctions.getUserProfile(userId),
    enabled: !!userId,
    staleTime: Infinity, // Never stale - profiles rarely change
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: false, // Use cached data immediately
    refetchOnWindowFocus: false,
    retry: 0, // No retry - instant display
    networkMode: 'offlineFirst', // Show cache immediately
  });
};

/**
 * Get conversations list
 * INSTANT VIEW: Aggressive fetching, immediate display
 */
export const useConversations = (
  currentUserId: string,
  options?: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
    refetchInterval?: number;
  }
) => {
  return useQuery({
    queryKey: chatQueryKeys.conversations(),
    queryFn: async () => {
      const result = await chatQueryFunctions.getConversations(currentUserId);
      return result;
    },
    enabled: options?.enabled !== false && !!currentUserId,
    staleTime: options?.staleTime || Infinity, // Never stale - rely on realtime
    gcTime: options?.gcTime || 24 * 60 * 60 * 1000, // 24 hours
    refetchInterval: options?.refetchInterval || false,
    refetchOnMount: false, // Use cached data immediately
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0, // No retry - instant display
    retryDelay: 0,
    networkMode: 'always', // Always fetch immediately
    placeholderData: (previousData) => previousData || [],
  });
};

/**
 * Get messages with infinite pagination (Instagram/WhatsApp style)
 * INSTANT VIEW: Aggressive prefetching, immediate cache display
 */
export const useChatMessages = (currentUserId: string, recipientId: string) => {
  return useInfiniteQuery({
    queryKey: chatQueryKeys.messages(recipientId),
    queryFn: async ({ pageParam }) => {
      const result = await chatQueryFunctions.getMessages({
        pageParam,
        currentUserId,
        recipientId
      });
      return result;
    },
    enabled: !!currentUserId && !!recipientId,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return lastPage.nextCursor;
    },
    staleTime: Infinity, // Never stale - rely on real-time updates
    gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
    initialPageParam: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // CRITICAL: Use cached data immediately
    refetchOnReconnect: false,
    // Infinite scroll optimizations
    maxPages: 50,
    getPreviousPageParam: () => undefined,
    // Instagram-style performance optimizations
    structuralSharing: false, // Disable for instant rendering
    retry: 0, // No retry - instant display
    retryDelay: 0,
    // CRITICAL: Always online mode for instant fetching
    networkMode: 'always', // Fetch immediately on first render
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });
};

/**
 * Send message mutation
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      senderId,
      receiverId,
      content,
      messageType = 'text'
    }: {
      senderId: string;
      receiverId: string;
      content: string;
      messageType?: 'text' | 'shared_post' | 'shared_reel';
    }) => {
      return await messagesAPI.sendMessage(senderId, receiverId, content, messageType);
    },
    onSuccess: (data, variables) => {
      // Update conversations cache directly instead of invalidating
      queryClient.setQueryData(
        chatQueryKeys.conversations(),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;

          // Find and update the conversation with the new message
          const updatedConversations = oldData.map((conversation: any) => {
            if (conversation.userId === variables.receiverId) {
              return {
                ...conversation,
                lastMessage: messagesAPI.getMessagePreview(variables.content, variables.messageType || 'text'),
                timestamp: new Date().toISOString(),
                isRead: false, // New message is unread for recipient
              };
            }
            return conversation;
          });

          // If conversation doesn't exist, it will be added by real-time events
          return updatedConversations;
        }
      );

      //// console.log('✅ Message sent successfully via API:', (data as any).id);
    },
    onError: (error) => {
       // Failed to send message
     },
  });
};

/**
 * Mark messages as read mutation
 */
export const useMarkMessagesAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ senderId, receiverId }: { senderId: string; receiverId: string }) => {
      return await messagesAPI.markMessagesAsRead(senderId, receiverId);
    },
    onSuccess: (data, variables) => {
      // Update conversations cache directly to mark messages as read
      queryClient.setQueryData(
        chatQueryKeys.conversations(),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;

          return oldData.map((conversation: any) => {
            if (conversation.userId === variables.senderId) {
              return {
                ...conversation,
                isRead: true, // Mark conversation as read
              };
            }
            return conversation;
          });
        }
      );

      // Update messages cache to mark messages as read
      queryClient.setQueryData(
        chatQueryKeys.messages(variables.senderId),
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query data structure
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                messages: page.messages?.map((msg: any) => {
                  if (msg.sender_id === variables.senderId && !msg.is_read) {
                    return {
                      ...msg,
                      is_read: true,
                      status: 'read',
                      read_at: new Date().toISOString(),
                    };
                  }
                  return msg;
                }) || []
              }))
            };
          }

          return oldData;
        }
      );
    },
  });
};

/**
 * Send reply mutation
 */
export const useSendReply = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      senderId,
      receiverId,
      content,
      replyToMessageId,
      messageType = 'text'
    }: {
      senderId: string;
      receiverId: string;
      content: string;
      replyToMessageId: string;
      messageType?: 'text' | 'shared_post' | 'shared_reel';
    }) => {
      return await messagesAPI.sendReply(senderId, receiverId, content, replyToMessageId, messageType);
    },
    onSuccess: (data, variables) => {
      // Update conversations cache directly instead of invalidating
      queryClient.setQueryData(
        chatQueryKeys.conversations(),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;

          // Find and update the conversation with the new reply
          const updatedConversations = oldData.map((conversation: any) => {
            if (conversation.userId === variables.receiverId) {
              return {
                ...conversation,
                lastMessage: messagesAPI.getMessagePreview(variables.content, variables.messageType || 'text'),
                timestamp: new Date().toISOString(),
                isRead: false, // New reply is unread for recipient
              };
            }
            return conversation;
          });

          return updatedConversations;
        }
      );

      //// console.log('✅ Reply sent successfully via API:', (data as any).id);
    },
    onError: (error) => {
       // Reply mutation error
     },
  });
};

/**
 * Add/remove reaction mutation
 */
export const useReactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      userId,
      emoji
    }: {
      messageId: string;
      userId: string;
      emoji: string;
    }) => {
      return await messagesAPI.addReaction(messageId, userId, emoji);
    },
    onSuccess: (data, variables) => {
      // Invalidate reactions query for this message
      queryClient.invalidateQueries({
        queryKey: [...chatQueryKeys.messages(''), 'reactions', variables.messageId]
      });
    },
    onError: (error) => {
       // Reaction mutation error
     },
  });
};

/**
 * Get message reactions query
 */
export const useMessageReactions = (messageId: string) => {
  return useQuery({
    queryKey: [...chatQueryKeys.messages(''), 'reactions', messageId],
    queryFn: () => messagesAPI.getMessageReactions(messageId),
    enabled: !!messageId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Delete message mutation
 */
export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      //// console.log('🗑️ Delete mutation called for message:', messageId);
      // Get current user ID from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      //// console.log('🗑️ Calling messagesAPI.deleteMessage with:', { messageId, userId: user.id });
      return await messagesAPI.deleteMessage(messageId, user.id);
    },
    onSuccess: (data, messageId) => {
      // Remove message from all cached queries
      queryClient.setQueriesData(
        { queryKey: chatQueryKeys.all },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query data structure
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                messages: page.messages?.filter((msg: any) => msg.id !== messageId) || []
              }))
            };
          }

          // Handle regular array data
          if (Array.isArray(oldData)) {
            return oldData.filter((msg: any) => msg.id !== messageId);
          }

          return oldData;
        }
      );

      // Update conversations cache directly to remove deleted message impact
      queryClient.setQueryData(
        chatQueryKeys.conversations(),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;

          // If the deleted message was the last message in a conversation,
          // we need to find the new last message or mark conversation as empty
          // For now, we'll just keep the conversation as-is since finding the new
          // last message would require additional API calls
          return oldData;
        }
      );

      //// console.log('✅ Message deleted successfully:', messageId);
    },
    onError: (error, messageId) => {
       // Delete message mutation error
       // Failed to delete message ID
       // Error details
     },
  });
};

/**
 * Clear entire chat mutation (delete all messages sent by current user)
 */
export const useClearChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientId }: { recipientId: string }) => {
      // Get current user ID from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await messagesAPI.clearChat(user.id, recipientId);
    },
    onSuccess: (data, variables) => {
      // Get current user ID to filter messages
      const getCurrentUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
      };

      // Remove user's messages from all cached queries
      getCurrentUserId().then(currentUserId => {
        if (currentUserId) {
          queryClient.setQueriesData(
            { queryKey: chatQueryKeys.all },
            (oldData: any) => {
              if (!oldData) return oldData;

              // Handle infinite query data structure
              if (oldData.pages) {
                return {
                  ...oldData,
                  pages: oldData.pages.map((page: any) => ({
                    ...page,
                    messages: page.messages?.filter((msg: any) =>
                      !(msg.sender_id === currentUserId && msg.receiver_id === variables.recipientId)
                    ) || []
                  }))
                };
              }

              // Handle regular array data
              if (Array.isArray(oldData)) {
                return oldData.filter((msg: any) =>
                  !(msg.sender_id === currentUserId && msg.receiver_id === variables.recipientId)
                );
              }

              return oldData;
            }
          );
        }
      });

      // Update conversations cache directly to reflect cleared chat
      queryClient.setQueryData(
        chatQueryKeys.conversations(),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;

          // Remove or update the conversation for the cleared recipient
          return oldData.map((conversation: any) => {
            if (conversation.userId === variables.recipientId) {
              return {
                ...conversation,
                lastMessage: 'Chat cleared', // Placeholder message
                timestamp: new Date().toISOString(),
                isRead: true,
              };
            }
            return conversation;
          });
        }
      );

      //// console.log('✅ Chat cleared successfully for recipient:', variables.recipientId);
    },
    onError: (error) => {
       // Clear chat mutation error
     },
  });
};

