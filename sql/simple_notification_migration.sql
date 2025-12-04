-- Simple Push Notifications Migration for Supabase Dashboard
-- Copy and paste this into Supabase SQL Editor

-- 1. Add push_token to profiles table (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Global settings
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    vibration_enabled BOOLEAN DEFAULT TRUE,
    status_bar_enabled BOOLEAN DEFAULT TRUE,
    
    -- Notification types
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one settings record per user
    CONSTRAINT unique_user_settings UNIQUE(user_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for notification_settings
CREATE POLICY "Users can view own notification settings" ON notification_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings" ON notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings" ON notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification settings" ON notification_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Create helper function to check if notification should be sent
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_notification_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    settings RECORD;
    current_hour TIME;
    is_quiet_hours BOOLEAN := FALSE;
BEGIN
    -- Get user's notification settings
    SELECT * INTO settings
    FROM notification_settings
    WHERE user_id = p_user_id;

    -- If no settings found, return true (default behavior)
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Check if notifications are globally disabled
    IF NOT settings.notifications_enabled THEN
        RETURN FALSE;
    END IF;

    -- Check quiet hours
    IF settings.quiet_hours_enabled THEN
        current_hour := CURRENT_TIME;

        -- Handle quiet hours that span midnight
        IF settings.quiet_start_time <= settings.quiet_end_time THEN
            -- Same day quiet hours (e.g., 22:00 to 06:00 next day)
            is_quiet_hours := current_hour >= settings.quiet_start_time
                           OR current_hour <= settings.quiet_end_time;
        ELSE
            -- Quiet hours within same day (e.g., 10:00 to 14:00)
            is_quiet_hours := current_hour >= settings.quiet_start_time
                           AND current_hour <= settings.quiet_end_time;
        END IF;

        IF is_quiet_hours THEN
            RETURN FALSE;
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
        ELSE RETURN TRUE; -- Default for unknown types
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger to auto-create settings for new users
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_create_notification_settings ON profiles;
CREATE TRIGGER trigger_create_notification_settings
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_settings();

-- 8. Backfill notification settings for existing users
INSERT INTO notification_settings (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM notification_settings)
ON CONFLICT (user_id) DO NOTHING;

-- 9. Update table statistics for better query performance
ANALYZE notification_settings;
ANALYZE profiles;

-- Success message
SELECT 'Push notification migration completed successfully!' as result;
