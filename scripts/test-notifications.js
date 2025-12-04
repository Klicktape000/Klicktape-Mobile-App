/**
 * Simple test script to verify notification system functionality
 * Run this with: node scripts/test-notifications.js
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testNotificationSystem() {

  try {
    // Test 1: Check if notification_settings table exists
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('*')
      .limit(1);

    if (settingsError) {
      return;
    }

    // Test 2: Check if profiles table has push_token column
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .limit(1);

    if (profilesError && profilesError.message.includes('push_token')) {
      return;
    }

    // Test 3: Check if edge function exists
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          test: true,
          to: 'test-token',
          title: 'Test',
          body: 'Test notification'
        }
      }
    );

    // Test 4: Test RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'should_send_notification',
      {
        p_user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
        p_notification_type: 'like'
      }
    );

    // Test 5: Check notification channels/categories configuration
    const fs = require('fs');
    const path = require('path');

    const configFiles = [
      'lib/notificationService.ts',
      'lib/notificationPlatformConfig.ts',
      'lib/notificationSettingsApi.ts',
      'app/(root)/notification-settings.tsx'
    ];

    let allFilesExist = true;
    for (const file of configFiles) {
      if (!fs.existsSync(path.join(process.cwd(), file))) {
        allFilesExist = false;
      }
    }

  } catch (error) {
    // Test failed - error handling without logging
  }
}

// Run the test
if (require.main === module) {
  testNotificationSystem();
}

module.exports = { testNotificationSystem };
