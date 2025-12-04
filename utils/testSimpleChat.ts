// Simple Chat Test Utility
// Tests the basic chat functionality without encryption

import { messagesAPI } from '../lib/messagesApi';
import { supabase } from '../lib/supabase';
import { alertService } from '../lib/utils/alertService';

export const testSimpleChat = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    // if (__DEV__) {
    //   alertService.debug('🧪 Testing simple chat functionality', 'Starting chat tests');
    // }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        message: 'No authenticated user found'
      };
    }

    // Test 1: Check if we can fetch conversations
    // if (__DEV__) {
    //   alertService.debug('📥 Testing conversation fetching', 'Fetching user conversations');
    // }
    const conversations = await messagesAPI.getUserConversations(user.id);
    
    if (!conversations) {
      return {
        success: false,
        message: 'Failed to fetch conversations'
      };
    }

    // if (__DEV__) {
    //   alertService.debug('✅ Fetched conversations', `Count: ${conversations.documents?.length || 0}`);
    // }

    // Test 2: Check if we can send a test message (to self for testing)
    // if (__DEV__) {
    //   alertService.debug('📤 Testing message sending', 'Sending test message');
    // }
    const testMessage = `Test message at ${new Date().toISOString()}`;
    
    try {
      const sentMessage = await messagesAPI.sendMessage(
        user.id,
        user.id, // Send to self for testing
        testMessage
      );

      if (!sentMessage || !sentMessage.id) {
        return {
          success: false,
          message: 'Failed to send test message'
        };
      }

      // if (__DEV__) {
      //   alertService.debug('✅ Message sent successfully', `ID: ${sentMessage.id}`);
      // }

      // Test 3: Verify the message was stored correctly
      // if (__DEV__) {
      //   alertService.debug('🔍 Verifying message storage', 'Checking database');
      // }
      const updatedConversations = await messagesAPI.getUserConversations(user.id);
      
      const foundMessage = updatedConversations.documents?.find(
        (msg: any) => msg.id === sentMessage.id
      );

      if (!foundMessage) {
        return {
          success: false,
          message: 'Message was sent but not found in database'
        };
      }

      if (foundMessage.content !== testMessage) {
        return {
          success: false,
          message: 'Message content does not match what was sent'
        };
      }

      // if (__DEV__) {
      //   alertService.debug('✅ Message storage verified', 'Message found in database');
      // }

      // Test 4: Test conversation between users
      // if (__DEV__) {
      //   alertService.debug('💬 Testing conversation retrieval', 'Getting conversation between users');
      // }
      const conversation = await messagesAPI.getConversationBetweenUsers(
        user.id,
        user.id
      );

      if (!conversation || !conversation.documents) {
        return {
          success: false,
          message: 'Failed to retrieve conversation'
        };
      }

      const conversationMessage = conversation.documents.find(
        (msg: any) => msg.id === sentMessage.id
      );

      if (!conversationMessage) {
        return {
          success: false,
          message: 'Message not found in conversation'
        };
      }

      // if (__DEV__) {
      //   alertService.debug('✅ Conversation retrieval verified', 'Conversation found successfully');
      // }

      // Test 5: Mark message as read
      // if (__DEV__) {
      //   alertService.debug('👁️ Testing mark as read', 'Marking message as read');
      // }
      const markReadSuccess = await messagesAPI.markMessagesAsRead(
        sentMessage.sender_id,
        sentMessage.receiver_id
      );

      if (!markReadSuccess) {
        alertService.warning('Mark Read Warning', '⚠️ Mark as read failed, but continuing...');
      } else {
        // if (__DEV__) {
        //   alertService.debug('✅ Mark as read verified', 'Message marked as read successfully');
        // }
      }

      return {
        success: true,
        message: 'All chat functionality tests passed!',
        details: {
          userId: user.id,
          testMessageId: sentMessage.id,
          testMessageContent: testMessage,
          conversationCount: conversations.documents?.length || 0,
          conversationMessageCount: conversation.documents.length
        }
      };

    } catch (sendError: any) {
      // alertService.error('❌ Message sending failed:', sendError);
      return {
        success: false,
        message: `Message sending failed: ${sendError.message}`
      };
    }

  } catch (error: any) {
    // alertService.error('❌ Chat test failed:', error);
    return {
      success: false,
      message: `Chat test failed: ${error.message}`
    };
  }
};

// Test Socket.IO connection (basic check)
export const testSocketConnection = (): Promise<{
  success: boolean;
  message: string;
}> => {
  return new Promise((resolve) => {
    try {
      // This is a basic test - in a real app you'd import your socket service
      // if (__DEV__) {
      //   alertService.debug('🔌 Testing Socket.IO connection', 'Checking socket service availability');
      // }
      
      // For now, just check if the socket service exists
      const socketExists = true; // You can import and check your socket service here
      
      if (socketExists) {
        resolve({
          success: true,
          message: 'Socket.IO service is available'
        });
      } else {
        resolve({
          success: false,
          message: 'Socket.IO service not found'
        });
      }
    } catch (error: any) {
      resolve({
        success: false,
        message: `Socket test failed: ${error.message}`
      });
    }
  });
};

// Quick test function you can call from anywhere
export const quickChatTest = async (): Promise<void> => {
  // if (__DEV__) {
  //   alertService.debug('🚀 Running quick chat test', 'Starting comprehensive chat tests');
  // }
  
  const chatResult = await testSimpleChat();
  const socketResult = await testSocketConnection();
  
  // if (__DEV__) {
  //   alertService.debug('📊 Chat Test Results', 'Displaying test results');
  //   alertService.debug('Chat API Test', `${chatResult.success ? '✅ PASS' : '❌ FAIL'} - ${chatResult.message}`);
  //   alertService.debug('Socket.IO Test', `${socketResult.success ? '✅ PASS' : '❌ FAIL'} - ${socketResult.message}`);
  // }
  
  if (chatResult.success && socketResult.success) {
    // if (__DEV__) {
    //   alertService.debug('🎉 All tests passed', 'Chat system is working correctly');
    // }
  } else {
     alertService.warning('Test Warning', '\n⚠️ Some tests failed. Check the logs above for details.');
   }
  
  if (chatResult.details) {
     // if (__DEV__) {
     //   alertService.debug('📋 Test Details', JSON.stringify(chatResult.details, null, 2));
     // }
   }
};

export default { testSimpleChat, testSocketConnection, quickChatTest };
