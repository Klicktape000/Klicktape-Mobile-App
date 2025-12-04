/**
 * Comprehensive Push Notification Test Script
 * Run this after deploying the Edge Function to verify everything works
 * Usage: node test-push-notifications.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test configuration
const TEST_PUSH_TOKEN = 'ExponentPushToken[test-token-for-validation]';
const TEST_NOTIFICATION = {
  to: TEST_PUSH_TOKEN,
  title: '🧪 KlickTape Test Notification',
  body: 'Testing the fixed push notification system - this should work now!',
  data: {
    type: 'test',
    timestamp: new Date().toISOString()
  },
  sound: 'default',
  priority: 'high'
};

async function testPushNotificationSystem() {
  console.log('🚀 Starting Push Notification System Test...\n');

  try {
    // Test 1: Check Edge Function exists and is accessible
    console.log('📡 Test 1: Checking Edge Function availability...');
    
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: TEST_NOTIFICATION
    });

    if (error) {
      console.error('❌ Edge Function Error:', error);
      
      if (error.message?.includes('Function not found')) {
        console.log('💡 Solution: Deploy the Edge Function via Supabase Dashboard');
        console.log('   See: MANUAL_DEPLOYMENT_INSTRUCTIONS.md');
        return false;
      }
      
      if (error.message?.includes('Invalid JWT')) {
        console.log('💡 Solution: Check your SUPABASE_ANON_KEY in .env file');
        return false;
      }
      
      return false;
    }

    // Test 2: Analyze the response
    console.log('📊 Test 2: Analyzing response...');
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data?.success) {
      console.log('✅ SUCCESS: Push notification sent successfully!');
      console.log(`📱 Notification ID: ${data.id}`);
      console.log(`📝 Message: ${data.message}`);
      return true;
    } else if (data?.error) {
      console.log('❌ FAILED: Edge Function returned error');
      console.log(`Error: ${data.error}`);
      console.log(`Details: ${data.message || 'No additional details'}`);
      
      // Provide specific troubleshooting
      if (data.error.includes('Push notification service not configured')) {
        console.log('💡 Solution: Set EXPO_ACCESS_TOKEN in Supabase Dashboard');
        console.log('   Current token should be: JmQyuZoVkT8c5am0RPjCEHcnZnB7SSTAGWh36R6x');
      }
      
      if (data.error.includes('Invalid Expo push token format')) {
        console.log('💡 Note: This is expected with test token - use real token for actual testing');
      }
      
      return false;
    }

    console.log('⚠️  UNEXPECTED: Response format not recognized');
    return false;

  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error.message);
    
    if (error.message?.includes('fetch')) {
      console.log('💡 Solution: Check your internet connection and Supabase URL');
    }
    
    return false;
  }
}

async function testWithRealToken() {
  console.log('\n🔄 Testing with Real Push Token...');
  console.log('Note: You need a real Expo push token for this test');
  console.log('Get one from your app by running the notification diagnostic');
  
  // This would be used with a real token from the app
  const realTokenExample = 'ExponentPushToken[XXXXXXXXXXXXXXXXXXXXXX]';
  console.log(`Example format: ${realTokenExample}`);
  
  console.log('\n📱 To get a real token:');
  console.log('1. Open your KlickTape app on a physical device');
  console.log('2. Go to notification settings or diagnostic screen');
  console.log('3. Copy the push token displayed');
  console.log('4. Replace TEST_PUSH_TOKEN in this script');
}

async function checkEnvironmentSetup() {
  console.log('🔧 Checking Environment Setup...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  
  // Check if we can connect to Supabase
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    console.log(`   Supabase Connection: ${error ? '❌ Failed' : '✅ Connected'}`);
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
  } catch (err) {
    console.log(`   Supabase Connection: ❌ Failed - ${err.message}`);
  }
  
  console.log('');
}

async function main() {
  console.log('🧪 KlickTape Push Notification Test Suite');
  console.log('==========================================\n');
  
  // Step 1: Check environment
  await checkEnvironmentSetup();
  
  // Step 2: Test the system
  const success = await testPushNotificationSystem();
  
  // Step 3: Provide next steps
  if (success) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Push notification system is working correctly');
    console.log('✅ Edge Function is deployed and functional');
    console.log('✅ EXPO_ACCESS_TOKEN is configured properly');
    
    await testWithRealToken();
    
  } else {
    console.log('\n❌ TESTS FAILED');
    console.log('📋 Next Steps:');
    console.log('1. Follow MANUAL_DEPLOYMENT_INSTRUCTIONS.md to deploy Edge Function');
    console.log('2. Verify EXPO_ACCESS_TOKEN is set in Supabase Dashboard');
    console.log('3. Run this test again after deployment');
  }
  
  console.log('\n📚 Additional Resources:');
  console.log('- PUSH_NOTIFICATION_FIX.md - Complete fix documentation');
  console.log('- MANUAL_DEPLOYMENT_INSTRUCTIONS.md - Deployment guide');
  console.log('- Supabase Dashboard: https://supabase.com/dashboard');
  
  console.log('\n🏁 Test Complete');
}

// Run the test if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testPushNotificationSystem,
  checkEnvironmentSetup
};