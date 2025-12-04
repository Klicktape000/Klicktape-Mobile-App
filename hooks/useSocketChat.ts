import { useEffect, useState, useCallback, useRef } from 'react';
import Constants from 'expo-constants';
import { socketService } from '@/lib/socketService';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  status: 'sent' | 'delivered' | 'read';
  message_type?: 'text' | 'shared_post' | 'shared_reel';
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
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface UseSocketChatProps {
  userId: string;
  chatId: string;
  onNewMessage?: (message: Message) => void;
  onMessageStatusUpdate?: (data: { messageId: string; status: string; isRead: boolean }) => void;
  onTypingUpdate?: (data: { userId: string; isTyping: boolean }) => void;
  onNewReaction?: (data: { messageId: string; reaction: Reaction }) => void;
  onReactionRemoved?: (data: { messageId: string; reactionId: string; userId: string }) => void;
  // Add polling options
  enablePolling?: boolean;
  pollingInterval?: number;
  onPollMessages?: () => void;
}

export const useSocketChat = ({
  userId,
  chatId,
  onNewMessage,
  onMessageStatusUpdate,
  onTypingUpdate,
  onNewReaction,
  onReactionRemoved,
  enablePolling = true,
  pollingInterval = 3000, // 3 seconds default
  onPollMessages,
}: UseSocketChatProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const hasJoinedRoom = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';
  
  // In Expo Go, we consider the connection as "available" for API-based messaging
  // even though Socket.IO is disabled
  const isApiAvailable = true; // API is always available for messaging
  const effectiveConnectionStatus = isExpoGo ? isApiAvailable : isConnected;

  // Polling fallback for Expo Go
  useEffect(() => {
    if (isExpoGo && enablePolling && onPollMessages) {
      if (isExpoGo && pollingInterval > 0) {
        //// console.log('📱 Starting polling fallback for Expo Go (interval:', pollingInterval, 'ms)');
        pollingIntervalRef.current = setInterval(() => {
          //// console.log('🔄 Polling for new messages...');
          onPollMessages?.();
        }, pollingInterval);
      }
    } else {
      // Stop polling
      if (pollingIntervalRef.current) {
        //// console.log('📱 Stopping polling fallback');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isExpoGo, enablePolling, pollingInterval, onPollMessages]);

  // Join chat room when component mounts and socket connects
  useEffect(() => {
    if (userId && chatId && isConnected && !hasJoinedRoom.current) {
      //// console.log(`🏠 Joining chat room: ${chatId}`);
      socketService.joinChat(userId, chatId);
      hasJoinedRoom.current = true;
    }

    return () => {
      if (chatId && hasJoinedRoom.current) {
        //// console.log(`🚪 Leaving chat room: ${chatId}`);
        socketService.leaveChat(chatId);
        hasJoinedRoom.current = false;
      }
    };
  }, [userId, chatId, isConnected]);

  // Set up message listener
  useEffect(() => {
    if (!onNewMessage || isExpoGo) return; // Skip Socket.IO listeners in Expo Go

    const unsubscribe = socketService.onMessage((message: Message) => {
      // Only handle messages for this chat
      const messageChatId = [message.sender_id, message.receiver_id].sort().join('-');
      if (messageChatId === chatId) {
        //// console.log('📨 Received message for this chat:', message.id);
        onNewMessage(message);
      }
    });

    return unsubscribe;
  }, [chatId, onNewMessage, isExpoGo]);

  // Set up status update listener
  useEffect(() => {
    if (!onMessageStatusUpdate || isExpoGo) return; // Skip Socket.IO listeners in Expo Go

    const unsubscribe = socketService.onStatusUpdate((data) => {
      //// console.log('📊 Status update received:', data);
      onMessageStatusUpdate(data);
    });

    return unsubscribe;
  }, [onMessageStatusUpdate, isExpoGo]);

  // Set up typing listener
  useEffect(() => {
    if (!onTypingUpdate || isExpoGo) return; // Skip Socket.IO listeners in Expo Go

    const unsubscribe = socketService.onTyping((data) => {
      // Only handle typing for this chat
      if (data.chatId === chatId && data.userId !== userId) {
        //// console.log('⌨️ Typing update for this chat:', data);
        onTypingUpdate({
          userId: data.userId,
          isTyping: data.isTyping,
        });
      }
    });

    return unsubscribe;
  }, [chatId, userId, onTypingUpdate, isExpoGo]);

  // Set up reaction listeners
  useEffect(() => {
    if (!onNewReaction || isExpoGo) return; // Skip Socket.IO listeners in Expo Go

    const unsubscribe = socketService.onReaction((data) => {
      //// console.log('😀 Reaction update received:', data);
      onNewReaction(data);
    });

    return unsubscribe;
  }, [onNewReaction, isExpoGo]);

  useEffect(() => {
    if (!onReactionRemoved || isExpoGo) return; // Skip Socket.IO listeners in Expo Go

    const unsubscribe = socketService.onReactionRemoved((data) => {
      //// console.log('😐 Reaction removed:', data);
      onReactionRemoved(data);
    });

    return unsubscribe;
  }, [onReactionRemoved, isExpoGo]);

  // Set up connection status listener
  useEffect(() => {
    if (isExpoGo) {
      // In Expo Go, simulate connected status for UI purposes
      setIsConnected(false); // Actual Socket.IO is not connected
      setConnectionStatus('connected'); // But show as connected for UI
      return;
    }

    const unsubscribe = socketService.onConnectionChange((connected) => {
      //// console.log('🔗 Connection status changed:', connected);
      setIsConnected(connected);
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      
      // Reset room join status when disconnected
      if (!connected) {
        hasJoinedRoom.current = false;
      }
    });

    // Set initial connection status
    const initiallyConnected = socketService.isSocketConnected();
    setIsConnected(initiallyConnected);
    setConnectionStatus(initiallyConnected ? 'connected' : 'connecting');

    return unsubscribe;
  }, [isExpoGo]);

  // Send message function - can accept message with or without ID
  const sendMessage = useCallback((message: Partial<Message> & { sender_id: string; receiver_id: string; content: string }, optimisticId?: string) => {
    //// console.log('🔍 useSocketChat sendMessage called with:', {
// //   id: message.id,
// //   sender_id: message.sender_id,
// //   receiver_id: message.receiver_id,
// //   content: message.content,
// //   optimisticId,
// //   isConnected,
// //   connectionStatus
// // });

    const fullMessage: Message = {
      id: message.id || optimisticId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: message.created_at || new Date().toISOString(),
      status: message.status || 'sent',
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      content: message.content,
      is_read: message.is_read || false,
      message_type: message.message_type || 'text',
    };

    try {
      //// console.log('📤 Sending message via Socket.IO with ID:', fullMessage.id);
      //// console.log('📤 Full message object:', fullMessage);
      socketService.sendMessage(fullMessage as any);
      return fullMessage;
    } catch (error) {
      // console.error('❌ Failed to send message:', error);
      throw error;
    }
  }, []); // Removed unnecessary dependencies as the function doesn't actually use isConnected or connectionStatus

  // Send typing status function
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    try {
      socketService.sendTypingStatus({
        userId,
        chatId,
        isTyping,
      });
    } catch {
      // console.error('❌ Failed to send typing status');
    }
  }, [userId, chatId]);

  // Mark message as delivered
  const markAsDelivered = useCallback((messageId: string) => {
    try {
      socketService.updateMessageStatus({
        messageId,
        status: 'delivered',
        isRead: false,
      });
    } catch {
      // console.error('❌ Failed to mark as delivered');
    }
  }, []);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    try {
      socketService.updateMessageStatus({
        messageId,
        status: 'read',
        isRead: true,
      });
    } catch {
      // console.error('❌ Failed to mark as read');
    }
  }, []);

  // Send emoji reaction
  const sendReaction = useCallback((messageId: string, emoji: string) => {
    try {
      //// console.log('😀 Sending reaction via Socket.IO:', { messageId, emoji, userId });
      socketService.sendReaction({
        messageId,
        userId,
        emoji,
      });
    } catch {
      // console.error('❌ Failed to send reaction');
    }
  }, [userId]);

  return {
    isConnected: effectiveConnectionStatus, // Use effective connection status for UI
    connectionStatus,
    sendMessage,
    sendTypingStatus,
    markAsDelivered,
    markAsRead,
    sendReaction,
    socketId: socketService.getSocketId(),
    isSocketConnected: isConnected, // Actual Socket.IO connection status
    isExpoGo, // Expose Expo Go status for debugging
  };
};
