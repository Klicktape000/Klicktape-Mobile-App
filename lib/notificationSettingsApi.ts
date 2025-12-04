import { supabase } from './supabase';

export interface NotificationSettings {
  id?: string;
  user_id: string;
  
  // Global notification settings
  notifications_enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  status_bar_enabled: boolean;
  
  // Specific notification type settings
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  mentions_enabled: boolean;
  shares_enabled: boolean;
  new_posts_enabled: boolean;
  messages_enabled: boolean;
  referrals_enabled: boolean;
  profile_views_enabled: boolean; // Premium feature
  leaderboard_enabled: boolean;
  
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_start_time: string; // HH:MM:SS format
  quiet_end_time: string; // HH:MM:SS format
  
  created_at?: string;
  updated_at?: string;
}

export const notificationSettingsAPI = {
  // Get user's notification settings
  getSettings: async (userId: string): Promise<NotificationSettings | null> => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, create default settings
          return await notificationSettingsAPI.createDefaultSettings(userId);
        }
        console.error('Error fetching notification settings:', error);
        throw error;
      }

      return data;
    } catch (__error) {
      console.error('Error in getSettings:', __error);
      throw __error;
    }
  },

  // Create default notification settings for a user
  createDefaultSettings: async (userId: string): Promise<NotificationSettings> => {
    try {
      const defaultSettings: Partial<NotificationSettings> = {
        user_id: userId,
        notifications_enabled: true,
        sound_enabled: true,
        vibration_enabled: true,
        status_bar_enabled: true,
        likes_enabled: true,
        comments_enabled: true,
        follows_enabled: true,
        mentions_enabled: true,
        shares_enabled: true,
        new_posts_enabled: true,
        messages_enabled: true,
        referrals_enabled: true,
        profile_views_enabled: true,
        leaderboard_enabled: true,
        quiet_hours_enabled: false,
        quiet_start_time: '22:00:00',
        quiet_end_time: '08:00:00',
      };

       const { data, error } = await (supabase as any)
         .from('notification_settings')
         .insert(defaultSettings)
         .select()
         .single();

       if (error) {
         console.error('Error creating default notification settings:', error);
         throw error;
       }

       return data;
     } catch (__error) {
       console.error('Error in createDefaultSettings:', __error);
       throw __error;
     }
   },

   // Update notification settings
   updateSettings: async (userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
     try {
       const updateData = {
         ...settings,
         updated_at: new Date().toISOString(),
       };

       // Remove fields that shouldn't be updated
       delete updateData.id;
       delete updateData.user_id;
       delete updateData.created_at;

       const { data, error } = await (supabase as any)
         .from('notification_settings')
         .update(updateData)
         .eq('user_id', userId)
         .select()
         .single();

       if (error) {
         console.error('Error updating notification settings:', error);
         throw error;
       }

       return data;
     } catch (__error) {
       console.error('Error in updateSettings:', __error);
       throw __error;
     }
   },

   // Check if a specific notification type should be sent to a user
   shouldSendNotification: async (userId: string, notificationType: string): Promise<boolean> => {
     try {
       const { data, error } = await (supabase as any)
         .rpc('should_send_notification', {
           p_user_id: userId,
           p_notification_type: notificationType
         });

      if (error) {
        console.error('Error checking notification permission:', error);
        // Default to allowing notifications if there's an error
        return true;
      }

      return data;
    } catch (__error) {
      console.error('Error in shouldSendNotification:', __error);
      // Default to allowing notifications if there's an error
      return true;
    }
  },

  // Toggle a specific notification setting
  toggleNotificationSetting: async (
    userId: string, 
    settingKey: keyof NotificationSettings, 
    value: boolean
  ): Promise<NotificationSettings> => {
    try {
      const updateData = {
        [settingKey]: value,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from('notification_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error toggling notification setting:', error);
        throw error;
      }

      return data;
    } catch (__error) {
      console.error('Error in toggleNotificationSetting:', __error);
      throw __error;
    }
  },

  /**
   * Update quiet hours settings for a user
   */
  updateQuietHours: async (
    userId: string, 
    enabled: boolean, 
    startTime: string, 
    endTime: string
  ): Promise<NotificationSettings> => {
    try {
      const updateData = {
        quiet_hours_enabled: enabled,
        quiet_start_time: startTime,
        quiet_end_time: endTime,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from('notification_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating quiet hours:', error);
        throw error;
      }

      return data;
    } catch (__error) {
      console.error('Error in updateQuietHours:', __error);
      throw __error;
    }
  },

  // Get current user's settings (convenience method)
  getCurrentUserSettings: async (): Promise<NotificationSettings | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await notificationSettingsAPI.getSettings(user.id);
    } catch (__error) {
      console.error('Error in getCurrentUserSettings:', __error);
      throw __error;
    }
  },

  // Update current user's settings (convenience method)
  updateCurrentUserSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await notificationSettingsAPI.updateSettings(user.id, settings);
    } catch (__error) {
      console.error('Error in updateCurrentUserSettings:', __error);
      throw __error;
    }
  },
};

