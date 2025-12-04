// Stub notification service for Expo Go compatibility
// This provides the same interface but without actual notification functionality

export interface NotificationData {
  type: 'like' | 'comment' | 'follow' | 'share' | 'new_post' | 'leaderboard';
  title: string;
  body: string;
  data?: any;
  userId?: string;
  postId?: string;
  fromUserId?: string;
}

class NotificationServiceStub {
  constructor() {
// console.log('📱 Using notification stub for Expo Go compatibility');
  }

  async initialize() {
// console.log('🚫 Notifications disabled in Expo Go');
    return false;
  }

  setupNotificationListeners() {
// console.log('📱 Notification listeners disabled in Expo Go');
  }

  async sendPushNotification(targetUserId: string, data: NotificationData) {
// console.log('📱 Simulated notification (Expo Go):', data.title, '-', data.body);
  }

  async notifyLike(fromUsername: string, postId: string, targetUserId: string) {
// console.log('📱 Simulated like notification:', `${fromUsername} liked your post`);
  }

  async notifyComment(fromUsername: string, postId: string, targetUserId: string, comment: string) {
// console.log('📱 Simulated comment notification:', `${fromUsername}: ${comment.substring(0, 50)}`);
  }

  async notifyFollow(fromUsername: string, targetUserId: string) {
// console.log('📱 Simulated follow notification:', `${fromUsername} started following you`);
  }

  async notifyShare(fromUsername: string, postId: string, targetUserId: string) {
// console.log('📱 Simulated share notification:', `${fromUsername} shared your post`);
  }

  async notifyNewPost(fromUsername: string, postId: string, followerIds: string[]) {
// console.log('📱 Simulated new post notification:', `${fromUsername} posted something new`);
  }

  async notifyLeaderboardUpdate(username: string, position: number, targetUserId: string) {
// console.log('📱 Simulated leaderboard notification:', `${username} is now #${position} on the leaderboard`);
  }

  // Add the missing initializeOnAppStart method to match the interface
  async initializeOnAppStart() {
// console.log('📱 Simulated notification initialization on app start (Expo Go)');
    return false; // Return false to indicate no actual initialization occurred
  }

  // Add other missing methods that might be called
  async updateBadgeCount() {
// console.log('📱 Simulated badge count update (Expo Go)');
  }

  async getUserNotificationSettings() {
// console.log('📱 Simulated get user notification settings (Expo Go)');
    return {
      status_bar_enabled: true,
      sound_enabled: true
    };
  }
}

export const notificationServiceStub = new NotificationServiceStub();

