import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useDispatch } from 'react-redux';
import { supabase } from './supabase';
import { notificationsAPI } from './notificationsApi';
import { notificationService } from './notificationService';
import { safeLogError, safeLogWarning, safeLogInfo } from './notificationErrorHandler';

interface NotificationData {
  id: string;
  recipient_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  post_id?: string;
  reel_id?: string;
  comment_id?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    username: string;
    avatar_url?: string;
  };
}

// Singleton to prevent multiple notification managers
let activeNotificationManagerUserId: string | null = null;

interface SupabaseNotificationManagerConfig {
  userId: string | null;
  enableRealtime: boolean;
  fallbackPollingInterval: number; // milliseconds
  maxRetries: number;
}

interface SupabaseNotificationManagerReturn {
  isConnected: boolean;
  subscriptionStatus: 'idle' | 'subscribing' | 'subscribed' | 'error';
  lastSyncTime: Date | null;
  syncNotifications: () => Promise<void>;
  forceReconnect: () => void;
  unreadCount: number;
}

export const useSupabaseNotificationManager = (
  config: SupabaseNotificationManagerConfig
): SupabaseNotificationManagerReturn => {
  const dispatch = useDispatch();

  // Create action creators to avoid import issues
  const createSetNotificationsAction = (notifications: any[]) => ({
    type: 'notifications/setNotifications',
    payload: notifications
  });

  const createSetUnreadCountAction = (count: number) => ({
    type: 'notifications/setUnreadCount',
    payload: count
  });

  const createAddNotificationAction = (notification: any) => ({
    type: 'notifications/addNotification',
    payload: notification
  });

  const createUpdateNotificationAction = (notification: any) => ({
    type: 'notifications/updateNotification',
    payload: notification
  });
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const subscriptionRef = useRef<any>(null);
  const fallbackIntervalRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const appState = useRef(AppState.currentState);

  // Sync notifications from Supabase with rate limiting
  const syncNotifications = useCallback(async () => {
    if (!config.userId) return;

    // Rate limiting: prevent sync if called within last 5 seconds
    const now = Date.now();
    const timeSinceLastSync = lastSyncTime ? now - lastSyncTime.getTime() : Infinity;
    if (timeSinceLastSync < 5000) {
// console.log('⏱️ Rate limited: Skipping sync (last sync was', timeSinceLastSync, 'ms ago)');
      return;
    }

    try {
// console.log('🔄 Syncing notifications from Supabase...');
      const notifications = await notificationsAPI.getNotifications(config.userId);

      if (notifications) {
// console.log('🔍 Debug: dispatch =', typeof dispatch);
// console.log('🔍 Debug: notifications =', typeof notifications);
// console.log('🔍 Debug: setUnreadCount =', typeof setUnreadCount);

        // Safely dispatch Redux actions with error handling
        try {
          if (typeof dispatch === 'function') {
            dispatch(createSetNotificationsAction(notifications));
          } else {
            console.error('❌ Redux dispatch is not available');
          }
        } catch (__dispatchError) {
          console.error('❌ Error dispatching setNotifications:', __dispatchError);
        }

        setLastSyncTime(new Date());
        retryCountRef.current = 0;

        // Count unread notifications
        const unread = notifications.filter(n => !n.is_read).length;
        setUnreadCount(unread);

        // Also update Redux store to keep it in sync
        try {
          if (typeof dispatch === 'function') {
            dispatch(createSetUnreadCountAction(unread));
          } else {
            console.error('❌ Redux dispatch is not available');
          }
        } catch (__dispatchError) {
          console.error('❌ Error dispatching setUnreadCount:', __dispatchError);
        }

// console.log(`✅ Synced ${notifications.length} notifications (${unread} unread)`);
      }
    } catch (__error) {
      safeLogError('sync notifications', __error);
      retryCountRef.current++;

      // Exponential backoff for retries
      if (retryCountRef.current < config.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        safeLogInfo('retry', `Retrying sync in ${delay}ms (attempt ${retryCountRef.current})`);
        setTimeout(syncNotifications, delay);
      }
    }
  }, [config.userId, config.maxRetries, dispatch, lastSyncTime]);

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!config.userId || !config.enableRealtime) {
// console.log('⚠️ Skipping real-time subscription setup:', {
// userId: config.userId,
// enableRealtime: config.enableRealtime
// });
      return;
    }

    try {
// console.log('🔔 Setting up Supabase real-time notification subscription for user:', config.userId);
      setSubscriptionStatus('subscribing');

      // Clean up existing subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch (__cleanupError) {
          safeLogWarning('cleanup', `Error during subscription cleanup: ${__cleanupError}`);
        }
      }

    subscriptionRef.current = supabase
      .channel(`notifications_realtime_${config.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${config.userId}`,
        },
        async (payload) => {
// console.log('🔔 New notification received:', payload.new);
          
          try {
            // Fetch the complete notification with sender info
            const { data: fullNotification, error } = await supabase
              .from('notifications')
              .select(`
                id,
                type,
                sender_id,
                post_id,
                reel_id,
                comment_id,
                created_at,
                is_read,
                sender:profiles!sender_id (
                  username,
                  avatar_url
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              safeLogWarning('fetch notification', `Failed to fetch notification details: ${error.message}`);
              return;
            }

            if (fullNotification) {
              // Add to Redux store
              try {
                dispatch(createAddNotificationAction(fullNotification));
                setUnreadCount(prev => {
                  const newCount = prev + 1;
// console.log(`🔔 Real-time: Incrementing unread count from ${prev} to ${newCount}`);
                  // Keep Redux store in sync
                  dispatch(createSetUnreadCountAction(newCount));
                  return newCount;
                });

// console.log('✅ Notification added to store');
              } catch (__dispatchError) {
                safeLogWarning('dispatch', `Failed to add notification to store: ${__dispatchError}`);
              }
            }
          } catch (__error) {
            safeLogError('notification processing', __error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${config.userId}`,
        },
        (payload) => {
          try {
// console.log('🔔 Notification updated:', payload.new);

            // Validate payload
            if (!payload?.new) {
              safeLogWarning('update', 'Invalid update payload received');
              return;
            }

            // Update notification in Redux store
            try {
              dispatch(createUpdateNotificationAction(payload.new));

              // If notification was marked as read, decrease unread count
              if (payload.new.is_read && !payload.old?.is_read) {
                setUnreadCount(prev => {
                  const newCount = Math.max(0, prev - 1);
                  // Keep Redux store in sync
                  dispatch(createSetUnreadCountAction(newCount));
                  return newCount;
                });
              }
            } catch (__dispatchError) {
              safeLogWarning('dispatch update', `Failed to update notification in store: ${__dispatchError}`);
            }
          } catch (__error) {
            safeLogError('notification update processing', __error);
          }
        }
      )
      .subscribe((status, error) => {
// console.log('🔔 Notification subscription status:', status);
        
        if (error) {
          console.error('❌ Notification subscription error:', error);
          setSubscriptionStatus('error');
          setIsConnected(false);
        } else if (status === 'SUBSCRIBED') {
// console.log('✅ Notifications real-time subscription active');
          setSubscriptionStatus('subscribed');
          setIsConnected(true);
          retryCountRef.current = 0;
        } else if (status === 'CHANNEL_ERROR') {
          safeLogWarning('subscription', 'Channel error occurred');
          setSubscriptionStatus('error');
          setIsConnected(false);
        } else if (status === 'TIMED_OUT') {
          safeLogWarning('subscription', 'Subscription timed out');
          setSubscriptionStatus('error');
          setIsConnected(false);
        }
      });

    } catch (__error) {
      safeLogError('subscription setup', __error);
      setSubscriptionStatus('error');
      setIsConnected(false);

      // Try to setup fallback polling if real-time fails
      if (config.fallbackPollingInterval) {
        safeLogInfo('fallback', 'Switching to polling mode due to subscription error');
        setupFallbackPolling();
      }
    }
  }, [config.userId, config.enableRealtime, dispatch, config.fallbackPollingInterval]);

  // Force reconnection
  const forceReconnect = useCallback(() => {
// console.log('🔄 Force reconnecting notification subscription...');
    setIsConnected(false);
    setSubscriptionStatus('idle');
    setupRealtimeSubscription();
  }, [setupRealtimeSubscription]);

  // Setup fallback polling
  const setupFallbackPolling = useCallback(() => {
    if (!config.enableRealtime || !config.fallbackPollingInterval) return;

// console.log(`⏰ Setting up fallback polling every ${config.fallbackPollingInterval}ms`);
    
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
    }

    fallbackIntervalRef.current = setInterval(() => {
      if (!isConnected) {
// console.log('📡 Fallback polling: syncing notifications...');
        syncNotifications();
      }
    }, config.fallbackPollingInterval);

  }, [config.enableRealtime, config.fallbackPollingInterval, isConnected, syncNotifications]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
// console.log('📱 App state changed:', appState.current, '->', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - sync notifications and reconnect if needed
// console.log('📱 App became active - syncing notifications');
        syncNotifications();
        
        if (!isConnected && config.enableRealtime) {
          forceReconnect();
        }
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, config.enableRealtime, syncNotifications, forceReconnect]);

  // Initialize
  useEffect(() => {
// console.log('🚀 Initializing notification manager:', {
// userId: config.userId,
// enableRealtime: config.enableRealtime
// });

    // Only initialize if we have a valid userId (not empty string)
    if (config.userId && config.userId.trim() !== '') {
      // Check for singleton - prevent multiple managers for the same user
      if (activeNotificationManagerUserId === config.userId) {
// console.log('⚠️ Notification manager already active for this user, skipping initialization');
        return;
      }

      // Set this as the active manager
      activeNotificationManagerUserId = config.userId;
// console.log('✅ Set as active notification manager for user:', config.userId);

      // Initial sync
// console.log('📥 Starting initial notification sync...');
      syncNotifications();

      // Setup real-time subscription
      if (config.enableRealtime) {
// console.log('🔔 Setting up real-time subscription...');
        setupRealtimeSubscription();
      }

      // Setup fallback polling
      setupFallbackPolling();
    } else {
// console.log('⚠️ No valid userId provided, skipping notification manager initialization');
      // Clear any existing manager if userId becomes invalid
      if (activeNotificationManagerUserId) {
        activeNotificationManagerUserId = null;
// console.log('✅ Cleared active notification manager due to invalid userId');
      }
    }

    return () => {
      // Only cleanup if we had a valid userId
      if (config.userId && config.userId.trim() !== '') {
// console.log('🧹 Cleaning up notification manager for user:', config.userId);

        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
        }

        // Reset singleton if this was the active manager
        if (activeNotificationManagerUserId === config.userId) {
          activeNotificationManagerUserId = null;
// console.log('✅ Reset active notification manager');
        }
      }
    };
  }, [config.userId, config.enableRealtime, syncNotifications, setupRealtimeSubscription, setupFallbackPolling]);

  return {
    isConnected,
    subscriptionStatus,
    lastSyncTime,
    syncNotifications,
    forceReconnect,
    unreadCount,
  };
};

// Notification creation and broadcasting using Supabase real-time
export class SupabaseNotificationBroadcaster {
  /**
   * Create and broadcast a notification using Supabase real-time
   */
  static async createAndBroadcastNotification(
    recipientId: string,
    senderId: string,
    type: 'like' | 'comment' | 'follow' | 'mention',
    postId?: string,
    reelId?: string,
    commentId?: string
  ): Promise<boolean> {
    try {
// console.log('📢 Creating notification via Supabase:', {
// type,
// recipient: recipientId,
// sender: senderId
// });

      // Determine if this is a post comment or reel comment
      const isPostComment = postId && commentId;
      const isReelComment = reelId && commentId;

      // Create notification in Supabase - this will trigger real-time updates automatically
      const notification = await notificationsAPI.createNotification(
        recipientId,
        type,
        senderId,
        postId,
        reelId,
        isPostComment ? commentId : undefined,
        isReelComment ? commentId : undefined
      );

      if (notification) {
// console.log('✅ Notification created successfully - real-time broadcast automatic');

        // Also send push notification
        await this.sendPushNotification(recipientId, senderId, type, postId, reelId, commentId);

        return true;
      }

      return false;
    } catch (__error) {
      safeLogError('create notification', __error);
      return false;
    }
  }

  /**
   * Send push notification for the created notification
   */
  static async sendPushNotification(
    recipientId: string,
    senderId: string,
    type: 'like' | 'comment' | 'follow' | 'mention',
    postId?: string,
    reelId?: string,
    commentId?: string
  ) {
    try {
      // Get sender's username for the notification
      const { data: senderProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', senderId)
        .single();

      if (profileError) {
// console.warn('Failed to fetch sender profile:', profileError);
      }

      const senderUsername = (senderProfile as any)?.username || 'Someone';

      // Prepare data based on notification type
      let data: any = { senderId };

      switch (type) {
        case 'like':
          if (postId) data.postId = postId;
          break;
        case 'comment':
          if (postId) data.postId = postId;
          if (commentId) {
            // Get comment content for the notification
            const { data: comment } = await supabase
              .from('comments')
              .select('content')
              .eq('id', commentId)
              .single();
            data.comment = (comment as any)?.content || 'commented on your post';
          }
          break;
        case 'follow':
          data.senderId = senderId;
          break;
        case 'mention':
          if (postId) data.postId = postId;
          break;
      }

      // Send push notification via Database Function
      const { data: response, error: functionError } = await (supabase as any).rpc(
        'send_notification',
        {
          p_type: type,
          p_recipient_id: recipientId,
          p_sender_username: senderUsername,
          p_data: data
        }
      );

      if (functionError) {
        safeLogError('Push notification database function error', functionError);
        return;
      }

      if (response?.success) {
        safeLogInfo('Push notification sent successfully', `Recipient: ${recipientId}, Type: ${type}`);
      } else {
        safeLogWarning('Push notification failed or skipped', `Recipient: ${recipientId}, Type: ${type}`);
      }

    } catch (__error) {
      safeLogError('send push notification', __error);
      // Don't throw error - push notification failure shouldn't break the main flow
    }
  }

  /**
   * Broadcast a like notification
   */
  static async broadcastLike(
    recipientId: string, 
    senderId: string, 
    postId?: string, 
    reelId?: string
  ): Promise<boolean> {
    return this.createAndBroadcastNotification(
      recipientId,
      senderId,
      'like',
      postId,
      reelId
    );
  }

  /**
   * Broadcast a comment notification
   */
  static async broadcastComment(
    recipientId: string,
    senderId: string,
    commentId: string,
    postId?: string,
    reelId?: string
  ): Promise<boolean> {
    return this.createAndBroadcastNotification(
      recipientId,
      senderId,
      'comment',
      postId,
      reelId,
      commentId
    );
  }

  /**
   * Broadcast a mention notification
   */
  static async broadcastMention(
    recipientId: string, 
    senderId: string, 
    postId?: string, 
    reelId?: string
  ): Promise<boolean> {
    return this.createAndBroadcastNotification(
      recipientId,
      senderId,
      'mention',
      postId,
      reelId
    );
  }

  /**
   * Broadcast a follow notification
   */
  static async broadcastFollow(
    recipientId: string,
    senderId: string
  ): Promise<boolean> {
    return this.createAndBroadcastNotification(
      recipientId,
      senderId,
      'follow'
    );
  }

  /**
   * Send message notification (direct push notification, no database record)
   */
  static async notifyMessage(
    recipientId: string,
    senderId: string,
    messagePreview: string
  ): Promise<boolean> {
    try {
      // Get sender's username
      const { data: senderProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', senderId)
        .single();

      if (profileError) {
// console.warn('Failed to fetch sender profile:', profileError);
      }

      const senderUsername = (senderProfile as any)?.username || 'Someone';

      // Send push notification via Database Function
      const { data: response, error: functionError } = await (supabase as any).rpc(
        'send_notification',
        {
          p_type: 'message',
          p_recipient_id: recipientId,
          p_sender_username: senderUsername,
          p_data: { senderId, message: messagePreview }
        }
      );

      if (functionError) {
        safeLogError('Message notification database function error', functionError);
        return false;
      }

      if (response?.success) {
        safeLogInfo('Message notification sent successfully', `Recipient: ${recipientId}, Sender: ${senderId}`);
        return true;
      } else {
        safeLogWarning('Message notification failed or skipped', `Recipient: ${recipientId}, Sender: ${senderId}`);
        return false;
      }

    } catch (__error) {
      safeLogError('send message notification', __error);
      return false;
    }
  }

  /**
   * Send referral success notification
   */
  static async notifyReferralSuccess(
    recipientId: string,
    referredUsername: string,
    reward?: string
  ): Promise<boolean> {
    try {
      await notificationService.notifyReferralSuccess(referredUsername, recipientId, reward);
      return true;
    } catch (__error) {
      safeLogError('send referral success notification', __error);
      return false;
    }
  }

  /**
   * Send referral milestone notification
   */
  static async notifyReferralMilestone(
    recipientId: string,
    milestone: number,
    reward: string
  ): Promise<boolean> {
    try {
      await notificationService.notifyReferralMilestone(recipientId, milestone, reward);
      return true;
    } catch (__error) {
      safeLogError('send referral milestone notification', __error);
      return false;
    }
  }

  /**
   * Send profile view notification (premium feature)
   */
  static async notifyProfileView(
    recipientId: string,
    viewerId: string
  ): Promise<boolean> {
    try {
      // Get viewer's username
      const { data: viewerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', viewerId)
        .single();

      if (profileError) {
// console.warn('Failed to fetch viewer profile:', profileError);
      }

      const viewerUsername = (viewerProfile as any)?.username || 'Someone';

      await notificationService.notifyProfileView(viewerUsername, recipientId);
      return true;
    } catch (__error) {
      safeLogError('send profile view notification', __error);
      return false;
    }
  }
}

// Export singleton instance
export const supabaseNotificationBroadcaster = new SupabaseNotificationBroadcaster();

