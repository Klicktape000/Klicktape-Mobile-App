import { socketService } from '../lib/socketService';
import { alertService } from '../lib/utils/alertService';

export const testSocketConnection = () => {
  // if (__DEV__) {
  //   alertService.debug('🧪 Testing Socket.IO connection', 'Starting connection test');
  // }

  // Test connection status
  const isConnected = socketService.isSocketConnected();
  // if (__DEV__) {
  //   alertService.debug('Socket Status', `🔗 Socket connected: ${isConnected}`);
  // }

  if (isConnected) {
    // if (__DEV__) {
    //   alertService.debug('✅ Socket.IO is working!', 'Connection established');
    //   alertService.debug('Socket ID', `🆔 Socket ID: ${socketService.getSocketId()}`);
    // }
  } else {
    // if (__DEV__) {
    //   alertService.debug('❌ Socket.IO not connected', 'Attempting reconnection');
    //   alertService.debug('🔄 Attempting manual reconnection', 'Calling reconnect method');
    // }
    socketService.reconnect();
  }

  // Force connection check
  setTimeout(() => {
    socketService.checkConnection();
    // if (__DEV__) {
    //   alertService.debug('🔍 Connection check result:', connectionStatus);
    // }
  }, 2000);

  // Test message listener
  const unsubscribe = socketService.onMessage((message) => {
    // if (__DEV__) {
    //   alertService.debug('🧪 Test: Received message:', JSON.stringify(message));
    // }
  });

  // Test connection listener
  const unsubscribeConnection = socketService.onConnectionChange((connected) => {
    // if (__DEV__) {
    //   alertService.debug('Connection Change', `🧪 Test: Connection changed: ${connected}`);
    // }
    if (connected) {
      // if (__DEV__) {
      //   alertService.debug('✅ Socket.IO connection restored!', 'Connection re-established');
      // }
    }
  });
  
  // Cleanup function
  return () => {
    unsubscribe();
    unsubscribeConnection();
  };
};

export const sendTestMessage = (senderId: string, receiverId: string) => {
  const testMessage = {
    id: `test_${Date.now()}`,
    sender_id: senderId,
    receiver_id: receiverId,
    content: `Test message at ${new Date().toLocaleTimeString()}`,
    message_type: 'text' as const,
    created_at: new Date().toISOString(),
    is_read: false,
    status: 'sent' as const,
  };
  
  try {
    socketService.sendMessage(testMessage);
    // if (__DEV__) {
    //   alertService.debug('Test Message', `🧪 Test message sent: ${testMessage.id}`);
    // }
    return testMessage;
  } catch (_error) {
    alertService.error('Test Message Error', `🧪 Test message failed: ${_error}`);
    throw _error;
  }
};
