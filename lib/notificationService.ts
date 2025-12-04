import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { notificationSettingsAPI } from './notificationSettingsApi';
import { NotificationPlatformConfig } from './notificationPlatformConfig';
import { alertService } from './utils/alertService';

export interface NotificationData {
  type: 'like' | 'comment' | 'follow' | 'share' | 'new_post' | 'leaderboard' | 'mention' | 'message' | 'referral' | 'profile_view';
  title: string;
  body: string;
  data?: any;
  userId?: string;
  postId?: string;
  fromUserId?: string;
  sound?: string;
  priority?: 'default' | 'high' | 'max';
  categoryId?: string;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private isExpoGo: boolean = false;
  private Notifications: any = null;
  private Device: any = null;

  constructor() {
    // Detect if running in Expo Go
    this.isExpoGo = Constants.appOwnership === 'expo';
    if (this.isExpoGo && __DEV__) {
      alertService.debug('Notification Service', 'Running in Expo Go - Push notifications disabled');
    }
  }



  private async loadNotificationModules() {
    if (this.isExpoGo || this.Notifications) return;

    try {
      this.Notifications = await import('expo-notifications');
      this.Device = await import('expo-device');

      // Configure notification behavior with user preferences
      this.Notifications.setNotificationHandler({
        handleNotification: async (notification: any) => {
          // Get user settings to determine notification behavior
          // Use try-catch to handle any errors gracefully
          try {
            const settings = await this.getUserNotificationSettings();
            return {
              shouldShowAlert: settings?.status_bar_enabled ?? true,
              shouldPlaySound: settings?.sound_enabled ?? true,
              shouldSetBadge: true,
            };
          } catch (__error) {
            if (__DEV__) {
              alertService.debug('Notification Settings', `Failed to get notification settings, using defaults: ${__error}`);
            }
            return {
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            };
          }
        },
      });
    } catch (__error) {
      alertService.error('Notification Error', `Failed to load notification modules: ${__error}`);
    }
  }

  async initialize() {
    try {
      if (__DEV__) {
        alertService.debug('Notification Service', 'Initializing notification service...');
      }

      // Skip initialization if running in Expo Go
      if (this.isExpoGo) {
        if (__DEV__) {
          alertService.debug('Notification Service', 'Skipping push notifications - not supported in Expo Go');
        }
        return false;
      }

      // Load notification modules
      await this.loadNotificationModules();

      if (!this.Notifications || !this.Device) {
        alertService.error('Notification Error', 'Failed to load notification modules');
        return false;
      }

      // Check if device supports notifications
      if (!this.Device.isDevice) {
        alertService.warning('Device Warning', 'Must use physical device for Push Notifications');
        return false;
      }

      // Request permissions
      const { status: existingStatus } = await this.Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Log to console instead of showing debug modal
      if (__DEV__) {
// console.log('🔔 Current notification permission status:', existingStatus);
      }

      if (existingStatus !== 'granted') {
// console.log('🔐 Requesting notification permissions...');
        const { status } = await this.Notifications.requestPermissionsAsync();
        finalStatus = status;
// console.log('📱 New notification permission status:', finalStatus);
      }

      if (finalStatus !== 'granted') {
// console.log('❌ Failed to get push notification permissions!');
        return false;
      }

      // Get push token
      try {
// console.log('🎫 Getting Expo push token...');
        const token = await this.Notifications.getExpoPushTokenAsync({
          projectId: 'af9ec5ff-79c9-46e7-95d9-341da4351f22', // Klicktape project ID
        });
        this.expoPushToken = token.data;
// console.log('✅ Expo push token obtained:', this.expoPushToken?.substring(0, 20) + '...');

        // Save token to database
        if (this.expoPushToken) {
          await this.savePushTokenToDatabase(this.expoPushToken);
// console.log('💾 Push token saved to database');
        }

        // Setup platform-specific configurations
        await NotificationPlatformConfig.setupPlatformConfigurations();

        return true;
      } catch (__tokenError) {
        console.error('❌ Error getting push token:', __tokenError);
        // Continue without push notifications
        return false;
      }
    } catch (__error) {
      console.error('❌ Error initializing notifications:', __error);
      return false;
    }
  }

  private async savePushTokenToDatabase(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase as any)
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving push token:', error);
      }
    } catch (__error) {
      console.error('Error in savePushTokenToDatabase:', __error);
    }
  }

  private async getUserNotificationSettings() {
    try {
      return await notificationSettingsAPI.getCurrentUserSettings();
    } catch (__error) {
      console.error('Error getting user notification settings:', __error);
      return null;
    }
  }

  async sendLocalNotification(data: NotificationData) {
    try {
      if (this.isExpoGo || !this.Notifications) {
// console.log('📱 Local notification simulated (Expo Go):', data.title);
        return;
      }

      // Get user settings to check if notifications should be sent
      const settings = await this.getUserNotificationSettings();
      if (!settings?.notifications_enabled) {
// console.log('🔕 Notifications disabled by user');
        return;
      }

      // Check if this specific notification type is enabled
      const shouldSend = await notificationSettingsAPI.shouldSendNotification(
        settings.user_id,
        data.type
      );
      if (!shouldSend) {
// console.log(`🔕 ${data.type} notifications disabled by user`);
        return;
      }

      // Determine notification channel and sound based on type
      const channelId = NotificationPlatformConfig.getChannelIdForType(data.type);
      const categoryId = NotificationPlatformConfig.getCategoryIdForType(data.type);
      let sound = settings.sound_enabled ? (data.sound || 'default') : false;

      const notificationContent: any = {
        title: data.title,
        body: data.body,
        data: data.data || {},
        sound: sound,
        priority: data.priority || 'default',
      };

      // Add Android-specific properties
      if (Platform.OS === 'android') {
        notificationContent.channelId = channelId;
        notificationContent.vibrate = settings.vibration_enabled ? [0, 250, 250, 250] : false;
      }

      // Add iOS-specific properties
      if (Platform.OS === 'ios') {
        notificationContent.categoryIdentifier = categoryId;
        notificationContent.badge = 1;
      }

      await this.Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Show immediately
      });

// console.log(`✅ Local notification sent: ${data.title}`);
    } catch (__error) {
      console.error('Error sending local notification:', __error);
    }
  }

  async sendPushNotification(targetUserId: string, data: NotificationData) {
    try {
      // Skip if running in Expo Go
      if (this.isExpoGo) {
// console.log('📱 Simulated notification (Expo Go):', data.title, '-', data.body);
        return;
      }

      // Check if user should receive this notification type
      const shouldSend = await notificationSettingsAPI.shouldSendNotification(
        targetUserId,
        data.type
      );
      if (!shouldSend) {
// console.log(`🔕 ${data.type} notifications disabled for user:`, targetUserId);
        return;
      }

      // Get target user's push token and settings
      const { data: profile, error } = await (supabase as any)
        .from('profiles')
        .select('push_token')
        .eq('id', targetUserId)
        .single();

      if (error || !(profile as any)?.push_token) {
// console.log('No push token found for user:', targetUserId);
        return;
      }

      // Get user's notification settings for sound and other preferences
      const settings = await notificationSettingsAPI.getSettings(targetUserId);

      // Prepare notification payload with user preferences
      const notificationPayload = {
        to: (profile as any).push_token,
        title: data.title,
        body: data.body,
        data: data.data || {},
        sound: settings?.sound_enabled ? (data.sound || 'default') : 'none',
        priority: data.priority || 'default',
        channelId: NotificationPlatformConfig.getChannelIdForType(data.type),
      };

      // Send via Supabase Edge Function
      const { error: sendError } = await supabase.functions.invoke('send-push-notification', {
        body: notificationPayload,
      });

      if (sendError) {
        // Silent error - logged in edge function
      }
    } catch (__error) {
      console.error('Error in sendPushNotification:', __error);
    }
  }



  // Notification templates
  async notifyLike(fromUsername: string, postId: string, targetUserId: string) {
    const data: NotificationData = {
      type: 'like',
      title: '❤️ New Like',
      body: `${fromUsername} liked your post`,
      data: { postId, type: 'like' },
      postId,
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyComment(fromUsername: string, postId: string, targetUserId: string, comment: string) {
    const data: NotificationData = {
      type: 'comment',
      title: '💬 New Comment',
      body: `${fromUsername}: ${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}`,
      data: { postId, type: 'comment' },
      postId,
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyFollow(fromUsername: string, targetUserId: string, fromUserId: string) {
    const data: NotificationData = {
      type: 'follow',
      title: '👥 New Follower',
      body: `${fromUsername} started following you`,
      data: { fromUserId, type: 'follow' },
      fromUserId,
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyShare(fromUsername: string, postId: string, targetUserId: string) {
    const data: NotificationData = {
      type: 'share',
      title: '📤 Post Shared',
      body: `${fromUsername} shared your post`,
      data: { postId, type: 'share' },
      postId,
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyNewPost(fromUsername: string, postId: string, followerIds: string[]) {
    const data: NotificationData = {
      type: 'new_post',
      title: '📸 New Post',
      body: `${fromUsername} shared a new post`,
      data: { postId, type: 'new_post' },
      postId,
    };

    // Send to all followers
    for (const followerId of followerIds) {
      await this.sendPushNotification(followerId, data);
    }
  }

  private getMythologicalTier(rank: number): string {
    if (rank >= 1 && rank <= 10) {
      return 'Loki of Klicktape';
    } else if (rank >= 11 && rank <= 20) {
      return 'Odin of Klicktape';
    } else if (rank >= 21 && rank <= 30) {
      return 'Poseidon of Klicktape';
    } else if (rank >= 31 && rank <= 40) {
      return 'Zeus of Klicktape';
    } else if (rank >= 41 && rank <= 50) {
      return 'Hercules of Klicktape';
    }
    return 'Klicktape Member';
  }

  async notifyLeaderboardUpdate(username: string, rank: number, targetUserId: string) {
    const tierTitle = this.getMythologicalTier(rank);
    const data: NotificationData = {
      type: 'leaderboard',
      title: '🏆 Leaderboard Update',
      body: `Congratulations! You've achieved the title of ${tierTitle}`,
      data: { rank, type: 'leaderboard', tier: tierTitle },
      priority: 'default',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyMention(fromUsername: string, postId: string, targetUserId: string, content: string) {
    const data: NotificationData = {
      type: 'mention',
      title: '📢 You were mentioned',
      body: `${fromUsername} mentioned you: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      data: { postId, type: 'mention', fromUsername },
      postId,
      priority: 'high',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyMessage(fromUsername: string, targetUserId: string, messagePreview: string) {
    const data: NotificationData = {
      type: 'message',
      title: `💬 Message from ${fromUsername}`,
      body: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
      data: { type: 'message', fromUsername },
      priority: 'high',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyReferralSuccess(referredUsername: string, targetUserId: string, reward?: string) {
    const data: NotificationData = {
      type: 'referral',
      title: '🎉 Referral Success!',
      body: `${referredUsername} joined using your referral code${reward ? `. You earned: ${reward}` : '!'}`,
      data: { type: 'referral', referredUsername, reward },
      priority: 'default',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyReferralMilestone(targetUserId: string, milestone: number, reward: string) {
    const data: NotificationData = {
      type: 'referral',
      title: '🏅 Referral Milestone Reached!',
      body: `You've referred ${milestone} users and unlocked: ${reward}`,
      data: { type: 'referral', milestone, reward },
      priority: 'high',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  async notifyProfileView(viewerUsername: string, targetUserId: string) {
    const data: NotificationData = {
      type: 'profile_view',
      title: '👀 Profile View',
      body: `${viewerUsername} viewed your profile`,
      data: { type: 'profile_view', viewerUsername },
      priority: 'default',
    };

    await this.sendPushNotification(targetUserId, data);
  }

  // Handle notification received while app is open
  async setupNotificationListeners() {
    // Skip if running in Expo Go
    if (this.isExpoGo) {
// console.log('📱 Notification listeners disabled in Expo Go');
      return;
    }

    // Load notification modules if not already loaded
    await this.loadNotificationModules();

    if (!this.Notifications) {
// console.log('⚠️ Cannot setup listeners - notification modules not loaded');
      return;
    }

    // Handle notification received while app is in foreground
    const foregroundSubscription = this.Notifications.addNotificationReceivedListener(async (notification: any) => {
// console.log('📱 Notification received in foreground:', notification.request.content.title);

      // Get user settings to determine if we should show in-app notification
      const settings = await this.getUserNotificationSettings();

      if (settings?.status_bar_enabled) {
        // Show a custom in-app notification banner (you can implement this)
        this.showInAppNotification(notification.request.content);
      }

      // Update badge count
      await this.updateBadgeCount();
    });

    // Handle notification tapped (app opened from notification)
    const responseSubscription = this.Notifications.addNotificationResponseReceivedListener(async (response: any) => {
// console.log('📱 Notification tapped:', response.notification.request.content.title);
      const data = response.notification.request.content.data;
      const actionIdentifier = response.actionIdentifier;

      // Clear the notification badge when user interacts with notifications
      await this.clearBadgeCount();

      // Handle iOS action responses or regular notification taps
      if (actionIdentifier && actionIdentifier !== this.Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // Handle iOS notification action
        setTimeout(() => {
          NotificationPlatformConfig.handleNotificationAction(
            actionIdentifier, 
            response.notification.request.content.data || {}, 
            () => {}
          );
        }, 100);
      } else {
        // Handle regular notification tap
        setTimeout(() => {
          this.handleNotificationTap(data);
        }, 100);
      }
    });

    // Handle notification dismissed
    const dismissSubscription = this.Notifications.addNotificationDismissedListener(async (notification: any) => {
// console.log('📱 Notification dismissed:', notification.request.content.title);
      // Update badge count when notification is dismissed
      await this.updateBadgeCount();
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
      dismissSubscription.remove();
    };
  }

  private showInAppNotification(content: any) {
    // This is a placeholder for showing in-app notifications
    // You can implement a custom toast/banner component here
    // Example: You could dispatch a Redux action to show a notification banner
    // or use a toast library like react-native-toast-message
  }

  private async updateBadgeCount() {
    try {
      if (this.isExpoGo || !this.Notifications) return;

      // Get unread notification count from database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      // Set badge count
      await this.Notifications.setBadgeCountAsync(count || 0);
// console.log(`📱 Badge count updated: ${count || 0}`);
    } catch (__error) {
      console.error('Error updating badge count:', __error);
    }
  }

  private async clearBadgeCount() {
    try {
      if (this.isExpoGo || !this.Notifications) return;

      await this.Notifications.setBadgeCountAsync(0);
// console.log('📱 Badge count cleared');
    } catch (__error) {
      console.error('Error clearing badge count:', __error);
    }
  }

  private handleNotificationTap(data: any) {
    try {
      // Import router here to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router } = require('expo-router');

// console.log('📱 Handling notification tap for type:', data.type, data);

      switch (data.type) {
        case 'like':
        case 'comment':
        case 'share':
          if (data.postId) {
// console.log('📱 Navigating to post:', data.postId);
            router.push(`/post/${data.postId}`);
          } else {
            router.push('/(tabs)/');
          }
          break;

        case 'follow':
          if (data.fromUserId) {
// console.log('📱 Navigating to user profile:', data.fromUserId);
            router.push(`/userProfile/${data.fromUserId}`);
          } else {
            router.push('/(tabs)/');
          }
          break;

        case 'mention':
          if (data.postId) {
// console.log('📱 Navigating to mentioned post:', data.postId);
            router.push(`/post/${data.postId}`);
          } else {
            router.push('/(tabs)/');
          }
          break;

        case 'message':
          if (data.fromUserId) {
// console.log('📱 Navigating to chat with user:', data.fromUserId);
            router.push(`/chats/${data.fromUserId}`);
          } else {
            router.push('/chat/index');
          }
          break;

        case 'new_post':
// console.log('📱 Navigating to home feed');
          router.push('/(tabs)/');
          break;

        case 'referral':
// console.log('📱 Navigating to referral section');
          // Navigate to referral/rewards section when implemented
          router.push('/(tabs)/');
          break;

        case 'profile_view':
          if (data.viewerUserId) {
// console.log('📱 Navigating to viewer profile:', data.viewerUserId);
            router.push(`/userProfile/${data.viewerUserId}`);
          } else {
            router.push('/(tabs)/');
          }
          break;

        case 'leaderboard':
// console.log('📱 Navigating to leaderboard');
          // Navigate to leaderboard when implemented
          router.push('/(tabs)/');
          break;

        default:
// console.log('📱 Unknown notification type, navigating to home');
          router.push('/(tabs)/');
      }
    } catch (__error) {
      console.error('Error handling notification tap:', __error);
      // Fallback to home screen
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { router } = require('expo-router');
        router.push('/(tabs)/');
      } catch (__fallbackError) {
        console.error('Error in fallback navigation:', __fallbackError);
      }
    }
  }

  getPushToken() {
    return this.expoPushToken;
  }

  // Check if notifications are enabled for the current user
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      if (this.isExpoGo) return false;

      await this.loadNotificationModules();
      if (!this.Notifications) return false;

      const { status } = await this.Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (__error) {
      console.error('Error checking notification permissions:', __error);
      return false;
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (this.isExpoGo) {
// console.log('📱 Cannot request permissions in Expo Go');
        return false;
      }

      await this.loadNotificationModules();
      if (!this.Notifications) return false;

      const { status } = await this.Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (__error) {
      console.error('Error requesting notification permissions:', __error);
      return false;
    }
  }

  // Mark notifications as read and update badge
  async markNotificationsAsRead(notificationIds: string[]) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Mark notifications as read in database
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .in('id', notificationIds)
        .eq('recipient_id', user.id);

      if (error) {
        console.error('Error marking notifications as read:', error);
        return;
      }

      // Update badge count
      await this.updateBadgeCount();
// console.log(`📱 Marked ${notificationIds.length} notifications as read`);
    } catch (__error) {
      console.error('Error in markNotificationsAsRead:', __error);
    }
  }

  // Get notification settings for current user
  async getNotificationSettings() {
    return await this.getUserNotificationSettings();
  }

  // Test notification (for debugging)
  async sendTestNotification() {
    const testData: NotificationData = {
      type: 'like',
      title: '🧪 Test Notification',
      body: 'This is a test notification to verify the system is working',
      data: { test: true },
      priority: 'high',
    };

    await this.sendLocalNotification(testData);
  }

  // Public method to update badge count
  async refreshBadgeCount() {
    await this.updateBadgeCount();
  }

  // Initialize notification system on app start
  async initializeOnAppStart() {
    try {
// console.log('🔔 Initializing notification system on app start...');

      // Initialize the service
      const initialized = await this.initialize();
      if (!initialized) {
// console.log('⚠️ Notification initialization failed');
        return false;
      }

      // Setup listeners
      const cleanup = await this.setupNotificationListeners();

      // Update badge count on app start
      await this.updateBadgeCount();

// console.log('✅ Notification system initialized successfully');
      return cleanup;
    } catch (__error) {
      console.error('❌ Error initializing notification system:', __error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();

