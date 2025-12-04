import { supabase } from './supabase';

/**
 * Configuration utilities for push notifications
 */
export class PushNotificationConfig {
  
  /**
   * Set the Expo access token in the database
   */
  static async setExpoAccessToken(token: string): Promise<boolean> {
    try {
      const { error } = await (supabase as any).rpc('update_expo_token', {
        p_token: token
      });

      if (error) {
        console.error('Failed to set Expo access token:', error);
        return false;
      }

// console.log('✅ Expo access token updated successfully');
      return true;
    } catch (__error) {
      console.error('Error setting Expo access token:', __error);
      return false;
    }
  }

  /**
   * Test the push notification system
   */
  static async testNotificationSystem(testToken?: string): Promise<any> {
    try {
      const { data, error } = await (supabase as any).rpc('test_notification_system', {
        p_test_token: testToken || 'ExponentPushToken[test]'
      });

      if (error) {
        console.error('Failed to test notification system:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (__error) {
      console.error('Error testing notification system:', __error);
      return { success: false, error: (__error as Error).message };
    }
  }

  /**
   * Send a test notification to a specific user
   */
  static async sendTestNotification(
    recipientId: string,
    senderUsername: string = 'System',
    type: 'like' | 'comment' | 'follow' | 'message' = 'like'
  ): Promise<any> {
    try {
      const testData = {
        postId: 'test-post-123',
        senderId: 'test-sender-id',
        message: 'This is a test message'
      };

      const { data, error } = await (supabase as any).rpc('send_notification', {
        p_type: type,
        p_recipient_id: recipientId,
        p_sender_username: senderUsername,
        p_data: testData
      });

      if (error) {
        console.error('Failed to send test notification:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if the notification system is properly configured
   */
  static async checkConfiguration(): Promise<{
    databaseFunctions: boolean;
    expoToken: boolean;
    httpExtension: boolean;
    overallStatus: 'ready' | 'needs_setup' | 'error';
  }> {
    try {
      // Test if database functions exist
      const { data: functionsTest, error: functionsError } = await (supabase as any).rpc(
        'test_notification_system',
        { p_test_token: 'ExponentPushToken[config-test]' }
      );

      const databaseFunctions = !functionsError;

      // Check if Expo token is configured
      const { data: tokenTest } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'EXPO_ACCESS_TOKEN')
        .single();

      const expoToken = (tokenTest as any)?.setting_value && 
                       (tokenTest as any).setting_value !== 'PLACEHOLDER_TOKEN_NEEDS_TO_BE_SET';

      // Check if HTTP extension is available (basic test)
      const httpExtension = (functionsTest as any)?.success !== false;

      const overallStatus = 
        databaseFunctions && expoToken && httpExtension ? 'ready' :
        databaseFunctions ? 'needs_setup' : 'error';

      return {
        databaseFunctions,
        expoToken: !!expoToken,
        httpExtension,
        overallStatus
      };

    } catch (error) {
      console.error('Error checking configuration:', error);
      return {
        databaseFunctions: false,
        expoToken: false,
        httpExtension: false,
        overallStatus: 'error'
      };
    }
  }
}

export default PushNotificationConfig;

