-- Simple Leaderboard Setup Script
-- Run this in your Supabase SQL editor to set up the leaderboard system

-- First, check if tables exist and create them if they don't
DO $$
BEGIN
    -- Create leaderboard_periods table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leaderboard_periods') THEN
        CREATE TABLE leaderboard_periods (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            is_active BOOLEAN DEFAULT false,
            is_completed BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index for active periods
        CREATE INDEX idx_leaderboard_periods_active ON leaderboard_periods(is_active) WHERE is_active = true;
    END IF;

    -- Create engagement_points table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'engagement_points') THEN
        CREATE TABLE engagement_points (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
            engagement_type TEXT NOT NULL,
            content_id UUID,
            points DECIMAL(4,1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX idx_engagement_points_user_period ON engagement_points(user_id, period_id);
        CREATE INDEX idx_engagement_points_period ON engagement_points(period_id);
    END IF;

    -- Create leaderboard_rankings table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leaderboard_rankings') THEN
        CREATE TABLE leaderboard_rankings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            rank_position INTEGER NOT NULL,
            total_points DECIMAL(10,1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(period_id, user_id),
            UNIQUE(period_id, rank_position)
        );
        
        -- Create indexes
        CREATE INDEX idx_leaderboard_rankings_period_rank ON leaderboard_rankings(period_id, rank_position);
        CREATE INDEX idx_leaderboard_rankings_user ON leaderboard_rankings(user_id);
    END IF;

    -- Create user_rewards table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_rewards') THEN
        CREATE TABLE user_rewards (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
            reward_type TEXT NOT NULL,
            reward_value TEXT NOT NULL,
            earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index
        CREATE INDEX idx_user_rewards_user ON user_rewards(user_id);
    END IF;
END $$;

-- Create a simple function to get or create current period
CREATE OR REPLACE FUNCTION get_or_create_current_period()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_period_id UUID;
    week_start TIMESTAMP WITH TIME ZONE;
    week_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if there's an active period
    SELECT id INTO current_period_id
    FROM leaderboard_periods
    WHERE is_active = true
    LIMIT 1;
    
    -- If no active period, create one
    IF current_period_id IS NULL THEN
        -- Calculate current week (Monday to Sunday)
        week_start := date_trunc('week', NOW()) + INTERVAL '1 day'; -- Monday
        week_end := week_start + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds'; -- Sunday
        
        -- Create new period
        INSERT INTO leaderboard_periods (start_date, end_date, is_active)
        VALUES (week_start, week_end, true)
        RETURNING id INTO current_period_id;
    END IF;
    
    RETURN current_period_id;
END;
$$;

-- Create a simple function to get current leaderboard (read-only)
CREATE OR REPLACE FUNCTION get_simple_leaderboard()
RETURNS TABLE (
    rank_position INTEGER,
    total_points DECIMAL(10,1),
    user_id UUID,
    username TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_period_id UUID;
BEGIN
    -- Get current active period
    SELECT id INTO current_period_id
    FROM leaderboard_periods
    WHERE is_active = true
    LIMIT 1;
    
    -- If no active period, return empty
    IF current_period_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Return rankings
    RETURN QUERY
    SELECT 
        lr.rank_position,
        lr.total_points,
        lr.user_id,
        COALESCE(u.username, 'Unknown User') as username,
        u.avatar_url
    FROM leaderboard_rankings lr
    LEFT JOIN auth.users u ON lr.user_id = u.id
    WHERE lr.period_id = current_period_id
    ORDER BY lr.rank_position
    LIMIT 50;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow read for authenticated users)
CREATE POLICY "Allow read leaderboard_periods" ON leaderboard_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read engagement_points" ON engagement_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read leaderboard_rankings" ON leaderboard_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read user_rewards" ON user_rewards FOR SELECT TO authenticated USING (true);

-- Allow users to see their own engagement points
CREATE POLICY "Allow users to see own engagement_points" ON engagement_points FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow users to see their own rewards
CREATE POLICY "Allow users to see own user_rewards" ON user_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Create initial period if none exists
SELECT get_or_create_current_period();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_current_period() TO authenticated;
GRANT EXECUTE ON FUNCTION get_simple_leaderboard() TO authenticated;

-- Success message
SELECT 'Leaderboard system setup completed successfully!' as message;
