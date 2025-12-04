# KlickTape Push Notifications Implementation Guide

## Overview

This document outlines the comprehensive push notification system implemented for KlickTape, including setup, testing, and troubleshooting.

## Features Implemented

### ✅ Core Features
- **Sound Support**: Notifications play audible sounds (device default or custom)
- **Status Bar Visibility**: Notifications appear and persist in device status bar
- **User Preferences**: Comprehensive settings for controlling notification behavior
- **Platform Support**: Full iOS and Android compatibility
- **Deep Linking**: Notifications navigate to relevant content when tapped

### ✅ Notification Types
- **Likes**: When someone likes your posts
- **Comments**: When someone comments on your posts  
- **Follows**: When someone follows you
- **Mentions**: When someone mentions you in posts
- **Shares**: When someone shares your posts
- **Messages**: Direct message notifications
- **Referrals**: Referral system updates and rewards
- **Profile Views**: When someone views your profile (Premium feature)
- **Leaderboard**: Ranking and achievement updates

### ✅ User Controls
- Global notification toggle
- Sound enable/disable
- Vibration control
- Status bar visibility
- Individual notification type controls
- Quiet hours functionality

## Architecture

### Database Schema
```sql
-- Enhanced profiles table with push token
ALTER TABLE profiles ADD COLUMN push_token TEXT;

-- Notification settings table
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    vibration_enabled BOOLEAN DEFAULT TRUE,
    status_bar_enabled BOOLEAN DEFAULT TRUE,
    -- Individual notification type controls
    likes_enabled BOOLEAN DEFAULT TRUE,
    comments_enabled BOOLEAN DEFAULT TRUE,
    follows_enabled BOOLEAN DEFAULT TRUE,
    mentions_enabled BOOLEAN DEFAULT TRUE,
    shares_enabled BOOLEAN DEFAULT TRUE,
    new_posts_enabled BOOLEAN DEFAULT TRUE,
    messages_enabled BOOLEAN DEFAULT TRUE,
    referrals_enabled BOOLEAN DEFAULT TRUE,
    profile_views_enabled BOOLEAN DEFAULT TRUE,
    leaderboard_enabled BOOLEAN DEFAULT TRUE,
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_start_time TIME DEFAULT '22:00:00',
    quiet_end_time TIME DEFAULT '08:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Components

1. **NotificationService** (`lib/notificationService.ts`)
   - Core notification handling
   - Push token management
   - Local and remote notification sending
   - User preference integration

2. **NotificationSettingsAPI** (`lib/notificationSettingsApi.ts`)
   - Database operations for user preferences
   - Settings validation and defaults

3. **NotificationPlatformConfig** (`lib/notificationPlatformConfig.ts`)
   - iOS notification categories
   - Android notification channels
   - Platform-specific configurations

4. **SupabaseNotificationBroadcaster** (`lib/supabaseNotificationManager.ts`)
   - Integration with existing notification system
   - Real-time and push notification coordination

5. **Supabase Edge Function** (`supabase/functions/send-push-notification/index.ts`)
   - Server-side push notification sending
   - Expo Push API integration

## Setup Instructions

### 1. Database Migration
```bash
# Run the migration to add notification tables
psql -d your_database -f sql/push_notifications_migration.sql
```

### 2. Supabase Edge Function Deployment
```bash
# Set the Expo access token
supabase secrets set EXPO_ACCESS_TOKEN=your_expo_access_token_here

# Deploy the edge function
supabase functions deploy send-push-notification
```

### 3. Expo Configuration
1. Get an Expo access token from https://expo.dev/accounts/[account]/settings/access-tokens
2. Set the token in your Supabase project secrets
3. Ensure your app.config.js includes notification configuration

### 4. App Integration
The notification system is automatically initialized in `app/_layout.tsx` when the app starts.

## Testing Guide

### 1. Development Testing

#### Test Notification Permissions
```typescript
// Check if notifications are enabled
const enabled = await notificationService.areNotificationsEnabled();
console.log('Notifications enabled:', enabled);

// Request permissions if needed
const granted = await notificationService.requestPermissions();
console.log('Permissions granted:', granted);
```

#### Test Local Notifications
```typescript
// Send a test notification
await notificationService.sendTestNotification();
```

#### Test User Settings
```typescript
// Get current user settings
const settings = await notificationSettingsAPI.getCurrentUserSettings();
console.log('User settings:', settings);

// Update a setting
await notificationSettingsAPI.updateCurrentUserSettings({
  sound_enabled: false
});
```

### 2. Feature Testing

#### Like Notifications
1. Have another user like your post
2. Verify notification appears in status bar
3. Tap notification and verify it navigates to the post
4. Check that sound plays (if enabled)

#### Comment Notifications  
1. Have another user comment on your post
2. Verify notification shows comment preview
3. Test navigation to post with comment highlighted

#### Follow Notifications
1. Have another user follow you
2. Verify notification appears
3. Test navigation to follower's profile

#### Message Notifications
1. Send a direct message to another user
2. Verify they receive a push notification
3. Test navigation to chat screen

### 3. Settings Testing

#### Notification Settings Screen
1. Navigate to Settings > Notification Settings
2. Test toggling various notification types
3. Verify changes are saved and applied
4. Test quiet hours functionality

#### Sound Testing
1. Enable/disable sound in settings
2. Trigger a notification
3. Verify sound behavior matches setting

### 4. Platform-Specific Testing

#### iOS Testing
- Test notification categories and actions
- Verify badge count updates
- Test notification sounds
- Check notification grouping

#### Android Testing  
- Test notification channels
- Verify channel-specific settings
- Test notification importance levels
- Check vibration patterns

## Troubleshooting

### Common Issues

#### 1. Notifications Not Appearing
- Check if permissions are granted
- Verify push token is saved to database
- Check Expo access token configuration
- Ensure device is not in Do Not Disturb mode

#### 2. Sounds Not Playing
- Verify sound is enabled in user settings
- Check device volume and notification settings
- Test on physical device (sounds don't work in simulators)
- Verify custom sound files are properly configured

#### 3. Deep Linking Not Working
- Check notification data structure
- Verify router navigation paths
- Test with app in foreground and background
- Check iOS notification action handling

#### 4. Push Notifications Not Sending
- Verify Supabase Edge Function is deployed
- Check Expo access token validity
- Monitor Edge Function logs for errors
- Verify user has valid push token

### Debug Commands

```typescript
// Check notification service status
console.log('Push token:', notificationService.getPushToken());
console.log('Notifications enabled:', await notificationService.areNotificationsEnabled());

// Test edge function directly
const response = await supabase.functions.invoke('send-push-notification', {
  body: {
    to: 'ExponentPushToken[...]',
    title: 'Test',
    body: 'Test notification',
    data: { test: true }
  }
});
console.log('Edge function response:', response);

// Check user settings
const settings = await notificationSettingsAPI.getCurrentUserSettings();
console.log('User notification settings:', settings);
```

## Performance Considerations

- Notification settings are cached to minimize database queries
- Push notifications are sent asynchronously to avoid blocking UI
- Badge counts are updated efficiently using database triggers
- Quiet hours are checked server-side to respect user preferences

## Security

- Push tokens are stored securely in the database
- User preferences are protected by Row Level Security (RLS)
- Edge function validates notification data before sending
- Deep linking validates navigation targets

## Deployment Checklist

### Pre-Deployment
- [ ] Run database migration: `sql/push_notifications_migration.sql`
- [ ] Get Expo access token from https://expo.dev/accounts/[account]/settings/access-tokens
- [ ] Set Supabase secret: `supabase secrets set EXPO_ACCESS_TOKEN=your_token`
- [ ] Deploy edge function: `supabase functions deploy send-push-notification`
- [ ] Test notification system using `components/NotificationTester.tsx`

### Production Testing
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Verify all notification types work
- [ ] Test user preference controls
- [ ] Verify deep linking works correctly
- [ ] Test quiet hours functionality
- [ ] Verify badge count updates
- [ ] Test notification sounds

### Post-Deployment Monitoring
- [ ] Monitor Supabase Edge Function logs
- [ ] Check notification delivery rates
- [ ] Monitor user feedback on notification experience
- [ ] Track notification engagement metrics

## Testing Component

A comprehensive testing component is available at `components/NotificationTester.tsx` that allows developers to:
- Check notification permissions and status
- Test local and push notifications
- Test all notification types
- View current user settings
- Update badge counts

To use the tester, import and render the component in your development builds.

## Future Enhancements

- Custom notification sounds per type
- Rich media notifications (images, videos)
- Notification scheduling and delayed sending
- Advanced notification grouping
- Push notification analytics and metrics
- A/B testing for notification content
- Smart notification timing based on user behavior
