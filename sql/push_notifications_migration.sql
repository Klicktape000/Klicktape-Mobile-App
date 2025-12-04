-- Push Notifications Enhancement Migration
-- This migration adds comprehensive push notification support to KlickTape

-- Add push_token field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Create notification_settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Global notification settings
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    vibration_enabled BOOLEAN DEFAULT TRUE,
    status_bar_enabled BOOLEAN DEFAULT TRUE,
    
    -- Specific notification type settings
    likes_enabled BOOLEAN DEFAULT TRUE,
    comments_enabled BOOLEAN DEFAULT TRUE,
    follows_enabled BOOLEAN DEFAULT TRUE,
    mentions_enabled BOOLEAN DEFAULT TRUE,
    shares_enabled BOOLEAN DEFAULT TRUE,
    new_posts_enabled BOOLEAN DEFAULT TRUE,
    messages_enabled BOOLEAN DEFAULT TRUE,
    referrals_enabled BOOLEAN DEFAULT TRUE,
    profile_views_enabled BOOLEAN DEFAULT TRUE, -- Premium feature
    leaderboard_enabled BOOLEAN DEFAULT TRUE,
    
    -- Quiet hours (optional)
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_start_time TIME DEFAULT '22:00:00',
    quiet_end_time TIME DEFAULT '08:00:00',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS notifications_recipient_id_idx ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
CREATE INDEX IF NOT EXISTS notification_settings_user_id_idx ON notification_settings(user_id);

-- Enable RLS for notification_settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_settings
CREATE POLICY "notification_settings_select_policy" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notification_settings_insert_policy" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notification_settings_update_policy" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notification_settings_delete_policy" ON notification_settings FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically create notification settings for new users
CREATE OR REPLACE FUNCTION create_notification_settings_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification settings when a user is created
DROP TRIGGER IF EXISTS trigger_create_notification_settings ON profiles;
CREATE TRIGGER trigger_create_notification_settings
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_settings_for_user();

-- Create function to check if user should receive notification based on their settings
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_notification_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    settings RECORD;
    current_time TIME;
BEGIN
    -- Get user's notification settings
    SELECT * INTO settings
    FROM notification_settings
    WHERE user_id = p_user_id;
    
    -- If no settings found, create default settings and allow notification
    IF NOT FOUND THEN
        INSERT INTO notification_settings (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        RETURN TRUE;
    END IF;
    
    -- Check if notifications are globally disabled
    IF NOT settings.notifications_enabled THEN
        RETURN FALSE;
    END IF;
    
    -- Check quiet hours
    IF settings.quiet_hours_enabled THEN
        current_time := CURRENT_TIME;
        
        -- Handle quiet hours that span midnight
        IF settings.quiet_start_time > settings.quiet_end_time THEN
            -- Quiet hours span midnight (e.g., 22:00 to 08:00)
            IF current_time >= settings.quiet_start_time OR current_time <= settings.quiet_end_time THEN
                RETURN FALSE;
            END IF;
        ELSE
            -- Normal quiet hours (e.g., 01:00 to 06:00)
            IF current_time >= settings.quiet_start_time AND current_time <= settings.quiet_end_time THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- Check specific notification type settings
    CASE p_notification_type
        WHEN 'like' THEN RETURN settings.likes_enabled;
        WHEN 'comment' THEN RETURN settings.comments_enabled;
        WHEN 'follow' THEN RETURN settings.follows_enabled;
        WHEN 'mention' THEN RETURN settings.mentions_enabled;
        WHEN 'share' THEN RETURN settings.shares_enabled;
        WHEN 'new_post' THEN RETURN settings.new_posts_enabled;
        WHEN 'message' THEN RETURN settings.messages_enabled;
        WHEN 'referral' THEN RETURN settings.referrals_enabled;
        WHEN 'profile_view' THEN RETURN settings.profile_views_enabled;
        WHEN 'leaderboard' THEN RETURN settings.leaderboard_enabled;
        ELSE RETURN TRUE; -- Default to allowing unknown notification types
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update existing notification creation functions to check user preferences
-- This will be used by the application when creating notifications

-- Analyze tables for better query performance
ANALYZE notification_settings;

-- Grant necessary permissions
GRANT ALL ON notification_settings TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_settings_for_user() TO authenticated;
GRANT EXECUTE ON FUNCTION should_send_notification(UUID, TEXT) TO authenticated;

-- Create default notification settings for existing users
INSERT INTO notification_settings (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM notification_settings)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
