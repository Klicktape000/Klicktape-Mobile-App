// Import polyfill for React Native
import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  status: 'sent' | 'delivered' | 'read';
  message_type: 'text' | 'shared_post' | 'shared_reel';
}

interface TypingData {
  userId: string;
  chatId: string;
  isTyping: boolean;
}

interface MessageStatusUpdate {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  isRead: boolean;
}

interface ReactionData {
  messageId: string;
  reaction: {
    id: string;
    message_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
  };
}

interface ReactionRemovedData {
  messageId: string;
  reactionId: string;
  userId: string;
}

class SocketService {
  private socket: any = null;
  private io: any = null;
  private isConnected = false;
  private currentServerUrl: string = '';
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private isExpoGo = false;
  private socketModulesLoaded = false;

  // Event listeners
  private messageListeners: ((message: Message) => void)[] = [];
  private typingListeners: ((data: TypingData) => void)[] = [];
  private statusListeners: ((data: MessageStatusUpdate) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private reactionListeners: ((data: ReactionData) => void)[] = [];
  private reactionRemovedListeners: ((data: ReactionRemovedData) => void)[] = [];

  constructor() {
    this.isExpoGo = Constants.appOwnership === 'expo';
    if (this.isExpoGo) {
// console.log('📱 SocketService: Running in Expo Go - Socket.IO disabled for compatibility');
      return;
    }
    this.initializeSocket();
  }

  private async initializeSocket() {
    try {
      // Dynamically import socket.io-client to avoid Babel runtime issues in Expo Go
      const socketIO = await import('socket.io-client');
      this.io = socketIO.io;
      this.socketModulesLoaded = true;
// console.log('✅ Socket.IO modules loaded successfully');
      this.connect();
    } catch (__error) {
      // Error: Failed to load Socket.IO modules
// console.log('⚠️ Socket.IO functionality will be disabled');
    }
  }

  private connect(customUrl?: string) {
    // Skip connection if running in Expo Go or modules not loaded
    if (this.isExpoGo) {
// console.log('📱 SocketService: Skipping connection - running in Expo Go');
      return;
    }

    if (!this.socketModulesLoaded || !this.io) {
// console.log('⏳ SocketService: Socket.IO modules not loaded yet');
      return;
    }

    try {
      // Get all possible URLs
      const getAllUrls = () => {
        const urls: string[] = [];

        // Check for environment variable first (deployed server)
        const SERVER_URL = process.env.EXPO_PUBLIC_SOCKET_SERVER_URL;
// console.log('🌐 Environment SERVER_URL:', SERVER_URL);

        if (SERVER_URL) {
          urls.push(SERVER_URL);
// console.log('✅ Using deployed server URL from environment:', SERVER_URL);
        }

        // Only try local development URLs if no environment URL is set
        if (!SERVER_URL) {
          // Fallback URLs for local development - Updated to use correct port 3001
          if (Platform.OS === 'android') {
            urls.push('http://10.0.2.2:3001');
            urls.push('http://192.168.31.80:3001'); // Updated to match server's actual Wi-Fi IP
            urls.push('http://localhost:3001');
          } else if (Platform.OS === 'ios') {
            urls.push('http://localhost:3001');
            urls.push('http://192.168.31.80:3001'); // Updated to match server's actual Wi-Fi IP
            urls.push('http://10.0.2.2:3001');
          } else {
            urls.push('http://localhost:3001');
            urls.push('http://192.168.31.80:3001'); // Updated to match server's actual Wi-Fi IP
          }
        }

// console.log('🔗 Available URLs:', urls);
        return urls;
      };

      const allUrls = getAllUrls();
      const serverUrl = customUrl || allUrls[this.connectionAttempts] || allUrls[0];
      this.currentServerUrl = serverUrl;

// console.log(`🔗 Connecting to Socket.IO server: ${serverUrl} (Attempt ${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`);

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // React Native compatible Socket.IO configuration
      this.socket = this.io(serverUrl, {
        transports: ['polling', 'websocket'], // Allow both transports
        autoConnect: true,
        reconnection: false, // We'll handle reconnection manually
        timeout: 8000, // Reduced timeout for faster failover
        forceNew: true, // Force new connection for each attempt
        upgrade: true, // Allow transport upgrades
        rememberUpgrade: false, // Don't remember upgrade for React Native
      });

      this.setupEventListeners();
    } catch (__error) {
      // Error: Socket connection error
      this.tryNextUrl();
    }
  }

  private setupEventListeners() {
    if (!this.socket || this.isExpoGo) return;

    this.socket.on('connect', () => {
// console.log('✅ Socket.IO connected:', this.socket?.id);
// console.log('🌐 Connected to server:', this.currentServerUrl);
      this.isConnected = true;
      this.connectionAttempts = 0; // Reset attempts on successful connection
      this.notifyConnectionListeners(true);
    });

    this.socket.on('disconnect', (reason: string) => {
// console.log('❌ Socket.IO disconnected:', reason);
      this.isConnected = false;
      this.notifyConnectionListeners(false);
    });

    this.socket.on('connect_error', (error: any) => {
// console.log('❌ Socket connection failed to:', this.currentServerUrl);
      this.isConnected = false;
      this.notifyConnectionListeners(false);

      // Simplified error logging to avoid Babel runtime issues
// console.log('⚠️ Connection error - trying next server...');

      // Try next URL after a short delay
      setTimeout(() => {
        this.tryNextUrl();
      }, 1000);
    });

    // Listen for new messages
    this.socket.on('new_message', (message: Message) => {
// console.log('📨 New message received via Socket.IO:', message.id);
      this.notifyMessageListeners(message);
    });

    // Listen for message status updates
    this.socket.on('message_status_update', (data: MessageStatusUpdate) => {
// console.log('📊 Message status update:', data);
      this.notifyStatusListeners(data);
    });

    // Listen for typing indicators
    this.socket.on('typing_update', (data: TypingData) => {
// console.log('⌨️ Typing update:', data);
      this.notifyTypingListeners(data);
    });

    // Listen for reaction updates (unified event)
    this.socket.on('reaction_update', (data: any) => {
// console.log('😀 Reaction update received:', data);
      this.notifyReactionListeners(data);
    });
  }

  private tryNextUrl() {
    this.connectionAttempts++;

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      // Error: All connection attempts failed. Resetting...
      this.connectionAttempts = 0;

      // Wait longer before trying again
      setTimeout(() => {
// console.log('🔄 Restarting connection attempts...');
        this.connect();
      }, 5000);
      return;
    }

// console.log(`🔄 Trying next URL (${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`);
    this.connect();
  }

  // Join a chat room
  joinChat(userId: string, chatId: string) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: joinChat skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
// console.log(`🏠 Joining chat room: ${chatId}`);
      this.socket.emit('join_chat', { userId, chatId });
    } else {
// console.log('⏳ Socket not connected, will join chat when connected');
      // Retry when connected
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          this.joinChat(userId, chatId);
        }
      }, 1000);
    }
  }

  // Leave a chat room
  leaveChat(chatId: string) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: leaveChat skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
// console.log(`🚪 Leaving chat room: ${chatId}`);
      this.socket.emit('leave_chat', { chatId });
    }
  }

  // Send a message
  sendMessage(message: Message) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: sendMessage skipped - running in Expo Go');
      throw new Error('Socket.IO not available in Expo Go');
    }

// console.log('🔍 sendMessage called with:', {
// messageId: message.id,
// hasSocket: !!this.socket,
// isConnected: this.isConnected,
// socketConnected: this.socket?.connected,
// currentUrl: this.currentServerUrl
// });

    if (this.socket && this.isConnected) {
// console.log('📤 Sending message via Socket.IO:', message.id);
// console.log('📤 Message content:', message.content);
      this.socket.emit('send_message', message);
    } else {
      // Error: Cannot send message: Socket not connected
      // Error: Debug info
      throw new Error('Socket not connected');
    }
  }

  // Send typing status
  sendTypingStatus(data: TypingData) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: sendTypingStatus skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('typing_status', data);
    }
  }

  // Update message status (delivered/read)
  updateMessageStatus(data: MessageStatusUpdate) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: updateMessageStatus skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('message_status', data);
    }
  }

  // Send reaction
  sendReaction(data: { messageId: string; userId: string; emoji: string }) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: sendReaction skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
// console.log('😀 Sending reaction via Socket.IO:', data);
      this.socket.emit('add_reaction', data);
    } else {
      // Error: Cannot send reaction: Socket not connected
    }
  }

  // Remove reaction
  removeReaction(data: { messageId: string; userId: string }) {
    if (this.isExpoGo) {
// console.log('📱 SocketService: removeReaction skipped - running in Expo Go');
      return;
    }

    if (this.socket && this.isConnected) {
// console.log('😐 Removing reaction via Socket.IO:', data);
      this.socket.emit('remove_reaction', data);
    } else {
      // Error: Cannot remove reaction: Socket not connected
    }
  }

  // Event listener management
  onMessage(callback: (message: Message) => void) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  onTyping(callback: (data: TypingData) => void) {
    this.typingListeners.push(callback);
    return () => {
      this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
    };
  }

  onStatusUpdate(callback: (data: MessageStatusUpdate) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  onReaction(callback: (data: ReactionData) => void) {
    this.reactionListeners.push(callback);
    return () => {
      this.reactionListeners = this.reactionListeners.filter(cb => cb !== callback);
    };
  }

  onReactionRemoved(callback: (data: ReactionRemovedData) => void) {
    this.reactionRemovedListeners.push(callback);
    return () => {
      this.reactionRemovedListeners = this.reactionRemovedListeners.filter(cb => cb !== callback);
    };
  }

  // Notify listeners
  private notifyMessageListeners(message: Message) {
    this.messageListeners.forEach(callback => {
      try {
        callback(message);
      } catch (__error) {
        console.error('Error in message listener:', __error);
      }
    });
  }

  private notifyTypingListeners(data: TypingData) {
    this.typingListeners.forEach(callback => {
      try {
        callback(data);
      } catch (__error) {
        console.error('Error in typing listener:', __error);
      }
    });
  }

  private notifyStatusListeners(data: MessageStatusUpdate) {
    this.statusListeners.forEach(callback => {
      try {
        callback(data);
      } catch (__error) {
        console.error('Error in status listener:', __error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (__error) {
        console.error('Error in connection listener:', __error);
      }
    });
  }

  private notifyReactionListeners(data: ReactionData) {
    this.reactionListeners.forEach(callback => {
      try {
        callback(data);
      } catch (__error) {
        console.error('Error in reaction listener:', __error);
      }
    });
  }

  private notifyReactionRemovedListeners(data: ReactionRemovedData) {
    this.reactionRemovedListeners.forEach(callback => {
      try {
        callback(data);
      } catch (__error) {
        console.error('Error in reaction removed listener:', __error);
      }
    });
  }

  // Utility methods
  isSocketConnected(): boolean {
    if (this.isExpoGo) {
      return false;
    }

    const result = this.isConnected && this.socket?.connected === true;
// console.log('🔍 isSocketConnected check:', {
// isConnected: this.isConnected,
// socketConnected: this.socket?.connected,
// result
// });
    return result;
  }

  getSocketId(): string | undefined {
    if (this.isExpoGo) {
      return undefined;
    }
    return this.socket?.id;
  }

  // Manual reconnection
  reconnect() {
    if (this.isExpoGo) {
// console.log('📱 SocketService: reconnect skipped - running in Expo Go');
      return;
    }

// console.log('🔄 Manual reconnection triggered');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.connectionAttempts = 0; // Reset attempts
    this.connect();
  }

  // Force connection check
  checkConnection() {
    if (this.isExpoGo) {
      return false;
    }

    if (this.socket) {
// console.log('🔍 Connection check - Socket connected:', this.socket.connected);
// console.log('🔍 Connection check - Internal connected:', this.isConnected);
      return this.socket.connected;
    }
    return false;
  }

  // Cleanup
  disconnect() {
    if (this.isExpoGo) {
// console.log('📱 SocketService: disconnect skipped - running in Expo Go');
      return;
    }

    if (this.socket) {
// console.log('🔌 Disconnecting Socket.IO');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;

