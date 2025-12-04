import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface NotificationChannel {
  id: string;
  name: string;
  importance: 'MIN' | 'LOW' | 'DEFAULT' | 'HIGH' | 'MAX';
  description?: string;
  sound?: string;
  vibrationPattern?: number[];
  lightColor?: string;
  showBadge?: boolean;
}

export interface NotificationCategory {
  identifier: string;
  actions: {
    identifier: string;
    title: string;
    options?: {
      opensAppToForeground?: boolean;
      isAuthenticationRequired?: boolean;
      isDestructive?: boolean;
    };
  }[];
  options?: {
    customDismissAction?: boolean;
    allowInCarPlay?: boolean;
    showTitle?: boolean;
    showSubtitle?: boolean;
  };
}

export class NotificationPlatformConfig {
  private static Notifications: any = null;

  static async loadNotificationModules() {
    if (Constants.appOwnership === 'expo') return null;
    
    try {
      this.Notifications = await import('expo-notifications');
      return this.Notifications;
    } catch (__error) {
      console.error('Failed to load notification modules:', __error);
      return null;
    }
  }

  // Android notification channels
  static getAndroidChannels(): NotificationChannel[] {
    return [
      {
        id: 'default',
        name: 'Default notifications',
        importance: 'DEFAULT',
        description: 'General app notifications',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      },
      {
        id: 'social',
        name: 'Social interactions',
        importance: 'HIGH',
        description: 'Likes, comments, follows, and shares',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      },
      {
        id: 'messages',
        name: 'Messages',
        importance: 'HIGH',
        description: 'Direct messages and mentions',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      },
      {
        id: 'updates',
        name: 'App updates',
        importance: 'DEFAULT',
        description: 'Referrals, leaderboard, and other updates',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      },
      {
        id: 'premium',
        name: 'Premium features',
        importance: 'DEFAULT',
        description: 'Profile views and premium notifications',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
        showBadge: true,
      },
    ];
  }

  // iOS notification categories
  static getIOSCategories(): NotificationCategory[] {
    return [
      {
        identifier: 'SOCIAL_INTERACTION',
        actions: [
          {
            identifier: 'VIEW_POST',
            title: 'View Post',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'LIKE_BACK',
            title: 'Like Back',
            options: {
              opensAppToForeground: false,
            },
          },
        ],
        options: {
          customDismissAction: true,
          showTitle: true,
          showSubtitle: true,
        },
      },
      {
        identifier: 'MESSAGE',
        actions: [
          {
            identifier: 'REPLY',
            title: 'Reply',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'MARK_READ',
            title: 'Mark as Read',
            options: {
              opensAppToForeground: false,
            },
          },
        ],
        options: {
          customDismissAction: true,
          showTitle: true,
          showSubtitle: true,
        },
      },
      {
        identifier: 'FOLLOW',
        actions: [
          {
            identifier: 'VIEW_PROFILE',
            title: 'View Profile',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'FOLLOW_BACK',
            title: 'Follow Back',
            options: {
              opensAppToForeground: false,
            },
          },
        ],
        options: {
          customDismissAction: true,
          showTitle: true,
          showSubtitle: true,
        },
      },
      {
        identifier: 'GENERAL',
        actions: [
          {
            identifier: 'VIEW',
            title: 'View',
            options: {
              opensAppToForeground: true,
            },
          },
        ],
        options: {
          customDismissAction: true,
          showTitle: true,
          showSubtitle: true,
        },
      },
    ];
  }

  // Setup Android notification channels
  static async setupAndroidChannels(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      await this.loadNotificationModules();
      if (!this.Notifications) return false;

      const channels = this.getAndroidChannels();
      
      for (const channel of channels) {
        await this.Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: this.Notifications.AndroidImportance[channel.importance],
          description: channel.description,
          sound: channel.sound,
          vibrationPattern: channel.vibrationPattern,
          lightColor: channel.lightColor,
          showBadge: channel.showBadge,
        });
      }

// console.log('✅ Android notification channels configured');
      return true;
    } catch (__error) {
      console.error('❌ Error setting up Android channels:', __error);
      return false;
    }
  }

  // Setup iOS notification categories
  static async setupIOSCategories(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;

    try {
      await this.loadNotificationModules();
      if (!this.Notifications) return false;

      const categories = this.getIOSCategories();
      
      await this.Notifications.setNotificationCategoriesAsync(categories);

// console.log('✅ iOS notification categories configured');
      return true;
    } catch (__error) {
      console.error('❌ Error setting up iOS categories:', __error);
      return false;
    }
  }

  // Setup platform-specific configurations
  static async setupPlatformConfigurations(): Promise<boolean> {
    try {
// console.log('🔧 Setting up platform-specific notification configurations...');
      
      const androidResult = await this.setupAndroidChannels();
      const iosResult = await this.setupIOSCategories();

      if (androidResult && iosResult) {
// console.log('✅ Platform-specific notification configurations completed');
        return true;
      } else {
// console.log('⚠️ Some platform configurations failed');
        return false;
      }
    } catch (__error) {
      console.error('❌ Error setting up platform configurations:', __error);
      return false;
    }
  }

  // Get category ID for notification type
  static getCategoryIdForType(type: string): string {
    switch (type) {
      case 'like':
      case 'comment':
      case 'share':
        return 'SOCIAL_INTERACTION';
      case 'message':
      case 'mention':
        return 'MESSAGE';
      case 'follow':
        return 'FOLLOW';
      default:
        return 'GENERAL';
    }
  }

  // Get channel ID for notification type
  static getChannelIdForType(type: string): string {
    switch (type) {
      case 'like':
      case 'comment':
      case 'follow':
      case 'share':
        return 'social';
      case 'message':
      case 'mention':
        return 'messages';
      case 'referral':
      case 'leaderboard':
        return 'updates';
      case 'profile_view':
        return 'premium';
      default:
        return 'default';
    }
  }

  // Handle notification action responses (iOS)
  static async handleNotificationAction(
    identifier: string,
    userInfo: Record<string, any>,
    completionHandler: (results: string[]) => void
  ): Promise<void> {
    try {
      // Import router here to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router } = require('expo-router');

      const data = userInfo;
// console.log('📱 Handling notification action:', identifier, data);

      switch (identifier) {
        case 'REPLY_ACTION':
          if (data.fromUserId) {
            router.push(`/chats/${data.fromUserId}`);
          }
          break;
        case 'VIEW_ACTION':
          if (data.postId) {
            router.push(`/post/${data.postId}`);
          } else if (data.fromUserId) {
            router.push(`/userProfile/${data.fromUserId}`);
          }
          break;
        case 'DISMISS_ACTION':
          // Just dismiss the notification
          break;
        default:
// console.log('📱 Unknown action identifier:', identifier);
      }
    } catch (__error) {
      console.error('Error handling notification action:', __error);
    }
  }
}

