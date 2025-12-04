# 🚀 Manual Edge Function Deployment Instructions

## 📋 **Overview**
Since Docker Desktop is not available, you'll need to manually deploy the fixed `send-push-notification` Edge Function via the Supabase Dashboard.

## 🔧 **Step-by-Step Deployment**

### 1. **Access Supabase Dashboard**
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your KlickTape project

### 2. **Navigate to Edge Functions**
1. In the left sidebar, click on **"Edge Functions"**
2. Look for the existing `send-push-notification` function
3. Click on it to open the editor

### 3. **Update the Function Code**
1. **Delete all existing code** in the editor
2. **Copy the entire contents** from: `supabase/functions/send-push-notification/index.ts`
3. **Paste the new code** into the Supabase editor

### 4. **Verify Environment Variables**
1. Go to **Settings** → **API** → **Environment Variables**
2. Confirm `EXPO_ACCESS_TOKEN` is set to: `JmQyuZoVkT8c5am0RPjCEHcnZnB7SSTAGWh36R6x`
3. If not set, add it now

### 5. **Deploy the Function**
1. Click **"Deploy"** or **"Save"** in the Edge Functions editor
2. Wait for the deployment to complete
3. You should see a success message

## 🧪 **Testing After Deployment**

### Option 1: Use the Test Script
```bash
node scripts/test-notifications.js
```

### Option 2: Manual Test via Dashboard
1. In the Edge Functions section, find your deployed function
2. Click **"Invoke"** or **"Test"**
3. Use this test payload:
```json
{
  "to": "ExponentPushToken[test-token-here]",
  "title": "Test Notification",
  "body": "Testing the fixed push notification system"
}
```

### Option 3: Use the App's Built-in Tester
1. Open your KlickTape app
2. Navigate to the notification test screen
3. Use the **PushNotificationTester** component

## ✅ **Expected Results**

### **Success Response:**
```json
{
  "success": true,
  "id": "some-expo-id",
  "message": "Push notification sent successfully"
}
```

### **Error Indicators:**
- ❌ 500 errors should be resolved
- ❌ "Cannot read properties of undefined" should be fixed
- ❌ Invalid JWT errors indicate token issues

## 🔍 **Verification Checklist**

- [ ] Edge Function deployed successfully
- [ ] EXPO_ACCESS_TOKEN environment variable is set
- [ ] Test returns 200 status code
- [ ] No JavaScript errors in function logs
- [ ] Push notifications work on physical devices

## 🚨 **Troubleshooting**

### If deployment fails:
1. Check the function syntax in the editor
2. Verify all imports are correct
3. Ensure no TypeScript errors

### If tests still fail:
1. Check Supabase function logs
2. Verify the Expo access token is valid
3. Ensure you're testing on a physical device (not simulator)

## 📞 **Next Steps**
After successful deployment:
1. Run the test script to verify functionality
2. Test push notifications in the actual app
3. Monitor function logs for any issues

---
**Created**: $(Get-Date)
**Status**: Ready for deployment