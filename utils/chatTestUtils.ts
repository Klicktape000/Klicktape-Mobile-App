import { messagesAPI } from '../lib/messagesApi';
import { chatDebug } from './chatDebug';
import { alertService } from '../lib/utils/alertService';

/**
 * Chat Testing Utilities
 * Comprehensive testing tools for chat functionality
 */
export const chatTestUtils = {
  /**
   * Test 1: Basic Connection Test
   * Verify Socket.IO connection and basic setup
   */
  testSocketConnection: async () => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 1', 'Socket Connection Test');
    //   alertService.debug('Debug', '================================');
    // }
    
    // Import socketService dynamically to avoid circular dependencies
    const { socketService } = await import('../lib/socketService');
    
    const connectionStatus = socketService.checkConnection();
    const socketId = socketService.getSocketId();
    
    // if (__DEV__) {
    //   alertService.debug('🔍 Socket Status', `Connected: ${connectionStatus}, Socket ID: ${socketId}, Server URL: Check console`);
    // }
    
    return {
      isConnected: connectionStatus,
      socketId,
      status: connectionStatus ? 'PASS' : 'FAIL'
    };
  },

  /**
   * Test 2: User Authentication & Profile Test
   * Verify current user and profile setup
   */
  testUserAuth: async () => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 2', 'User Authentication Test');
    //   alertService.debug('Debug', '===================================');
    // }
    
    const authResult = await chatDebug.getCurrentUser();
    const profileExists = authResult.user ? await chatDebug.checkUserExists(authResult.user.id) : null;
    
    // if (__DEV__) {
    //   alertService.debug('🔍 Auth Result', `User: ${!!authResult.user}, ID: ${authResult.user?.id}, Email: ${authResult.user?.email}, Profile: ${profileExists?.exists}`);
    // }
    
    return {
      user: authResult.user,
      profileExists: profileExists?.exists,
      status: (authResult.user && profileExists?.exists) ? 'PASS' : 'FAIL'
    };
  },

  /**
   * Test 3: Database Message Operations
   * Test sending and retrieving messages via API
   */
  testDatabaseOperations: async (senderId: string, receiverId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 3', 'Database Operations Test');
    //   alertService.debug('Debug', '===================================');
    // }
    
    try {
      // Test sending a message
      const testMessage = `Test message ${Date.now()}`;
      // if (__DEV__) {
      //   alertService.debug('📤 Sending test message', testMessage);
      // }
      
      const sentMessage = await messagesAPI.sendMessage(senderId, receiverId, testMessage);
      // if (__DEV__) {
      //   alertService.debug('✅ Message sent', sentMessage.id);
      // }
      
      // Test retrieving messages
      // if (__DEV__) {
      //   alertService.debug('📥 Retrieving messages', 'Getting conversation messages...');
      // }
      const messagesResult = await messagesAPI.getConversationBetweenUsers(senderId, receiverId);
      const messages = (messagesResult as any).documents || [];
      // if (__DEV__) {
      //   alertService.debug('✅ Messages retrieved', `Count: ${messages.length}`);
      // }

      // Find our test message
      const foundMessage = messages.find((m: any) => (m as any).content === testMessage);
      // if (__DEV__) {
      //   alertService.debug('🔍 Test message found', `Found: ${!!foundMessage}`);
      // }
      
      return {
        messageSent: !!sentMessage,
        messageRetrieved: !!foundMessage,
        messageId: sentMessage?.id,
        status: (sentMessage && foundMessage) ? 'PASS' : 'FAIL'
      };
    } catch (_error) {
      alertService.error('❌ Database test failed:', String(_error));
      return {
        messageSent: false,
        messageRetrieved: false,
        error: (_error as Error).message,
        status: 'FAIL'
      };
    }
  },

  /**
   * Test 4: Socket.IO Message Sending
   * Test real-time message sending via Socket.IO
   */
  testSocketMessaging: async (senderId: string, receiverId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 4', 'Socket.IO Messaging Test');
    //   alertService.debug('Debug', '===================================');
    // }
    
    try {
      const { socketService } = await import('../lib/socketService');
      
      // Check connection first
      if (!socketService.isSocketConnected()) {
        // if (__DEV__) {
        //   alertService.debug('❌ Socket not connected', 'Attempting to connect...');
        // }
        socketService.reconnect();
        
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!socketService.isSocketConnected()) {
          throw new Error('Socket connection failed');
        }
      }
      
      // Create test message
      const testMessage = {
        id: `test_${Date.now()}`,
        content: `Socket test message ${Date.now()}`,
        sender_id: senderId,
        receiver_id: receiverId,
        created_at: new Date().toISOString(),
        status: 'sent' as const,
        message_type: 'text' as const,
        is_read: false
      };
      
      // if (__DEV__) {
      //   alertService.debug('📤 Sending via Socket.IO', testMessage.id);
      // }
      socketService.sendMessage(testMessage);
      
      // if (__DEV__) {
      //   alertService.debug('✅ Socket message sent', 'Successfully sent via Socket.IO');
      // }
      
      return {
        messageSent: true,
        messageId: testMessage.id,
        status: 'PASS'
      };
    } catch (_error) {
      alertService.error('❌ Socket messaging test failed:', String(_error));
      return {
        messageSent: false,
        error: (_error as Error).message,
        status: 'FAIL'
      };
    }
  },

  /**
   * Test 5: Chat Room Operations
   * Test joining/leaving chat rooms
   */
  testChatRooms: async (userId: string, recipientId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 5', 'Chat Room Operations Test');
    //   alertService.debug('Debug', '====================================');
    // }
    
    try {
      const { socketService } = await import('../lib/socketService');
      
      const chatId = [userId, recipientId].sort().join('-');
      // if (__DEV__) {
      //   alertService.debug('🏠 Chat ID', chatId);
      // }
      
      // Test joining room
      // if (__DEV__) {
      //   alertService.debug('🚪 Joining chat room', 'Attempting to join...');
      // }
      socketService.joinChat(userId, chatId);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test leaving room
      // if (__DEV__) {
      //   alertService.debug('🚪 Leaving chat room', 'Attempting to leave...');
      // }
      socketService.leaveChat(chatId);
      
      // if (__DEV__) {
      //   alertService.debug('✅ Chat room operations', 'Completed successfully');
      // }
      
      return {
        roomJoined: true,
        roomLeft: true,
        chatId,
        status: 'PASS'
      };
    } catch (_error) {
      alertService.error('❌ Chat room test failed:', String(_error));
      return {
        roomJoined: false,
        roomLeft: false,
        error: (_error as Error).message,
        status: 'FAIL'
      };
    }
  },

  /**
   * Test 6: Comprehensive Chat Flow
   * End-to-end test of complete chat functionality
   */
  testCompleteFlow: async (senderId: string, receiverId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🧪 TEST 6', 'Complete Chat Flow Test');
    //   alertService.debug('Debug', '==================================');
    // }
    
    const results = {
      connection: await chatTestUtils.testSocketConnection(),
      auth: await chatTestUtils.testUserAuth(),
      database: await chatTestUtils.testDatabaseOperations(senderId, receiverId),
      socket: await chatTestUtils.testSocketMessaging(senderId, receiverId),
      rooms: await chatTestUtils.testChatRooms(senderId, receiverId)
    };
    
    const allPassed = Object.values(results).every(r => r.status === 'PASS');
    
    // if (__DEV__) {
    //   alertService.debug('📊 COMPLETE TEST RESULTS', 'Test Summary');
    //   alertService.debug('Debug', '=========================');
    //   Object.entries(results).forEach(([test, result]) => {
    //     alertService.debug(`${result.status === 'PASS' ? '✅' : '❌'} ${test.toUpperCase()}`, `Status: ${result.status}`);
    //   });
    //   alertService.debug('🎯 OVERALL', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
    // }
    
    return {
      results,
      allPassed,
      summary: allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'
    };
  },

  /**
   * Quick Test Helper
   * Run basic tests with current user
   */
  quickTest: async () => {
    // if (__DEV__) {
    //   alertService.debug('🚀 QUICK CHAT TEST', 'Starting quick test');
    //   alertService.debug('Debug', '==================');
    // }
    
    // Get current user
    const authResult = await chatDebug.getCurrentUser();
    if (!authResult.user) {
      // if (__DEV__) {
      //   alertService.debug('❌ No authenticated user', 'User not found');
      // }
      return { status: 'FAIL', reason: 'No authenticated user' };
    }
    
    // Get some users to test with
    const usersList = await chatDebug.listAllUsers();
    if (!usersList.data || usersList.data.length < 2) {
      // if (__DEV__) {
      //   alertService.debug('❌ Not enough users', 'Need at least 2 users for testing');
      // }
      return { status: 'FAIL', reason: 'Need at least 2 users for testing' };
    }
    
    // Find a different user to chat with
    const otherUser = (usersList as any).data.find((u: any) => (u as any).id !== (authResult.user as any).id);
    if (!otherUser) {
      // if (__DEV__) {
      //   alertService.debug('❌ No other user found', 'No other user available for testing');
      // }
      return { status: 'FAIL', reason: 'No other user available' };
    }
    
    // if (__DEV__) {
    //   alertService.debug('🎯 Testing chat', `Between ${(authResult.user as any).id} and ${(otherUser as any).id}`);
    // }
    
    // Run basic tests
    const connectionTest = await chatTestUtils.testSocketConnection();
    const databaseTest = await chatTestUtils.testDatabaseOperations((authResult.user as any).id, (otherUser as any).id);
    
    return {
      status: (connectionTest.status === 'PASS' && databaseTest.status === 'PASS') ? 'PASS' : 'FAIL',
      connection: connectionTest,
      database: databaseTest,
      users: {
        sender: authResult.user.id,
        receiver: (otherUser as any).id
      }
    };
  }
};

// Export for easy access in console
if (typeof window !== 'undefined') {
  (window as any).chatTestUtils = chatTestUtils;
}
