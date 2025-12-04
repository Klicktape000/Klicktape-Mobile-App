-- =====================================================
-- LEADERBOARD SYSTEM SCHEMA
-- =====================================================

-- Create enum for engagement types
CREATE TYPE engagement_type AS ENUM (
    'story_like',
    'story_comment', 
    'photo_like',
    'photo_comment',
    'reel_like',
    'reel_comment',
    'share_story',
    'share_photo',
    'share_reel'
);

-- Create enum for reward types
CREATE TYPE reward_type AS ENUM (
    'premium_badge',
    'normal_badge',
    'premium_title',
    'normal_title'
);

-- Create enum for mythological rank tiers
CREATE TYPE rank_tier AS ENUM (
    'Loki of Klicktape',      -- Ranks 1-10
    'Odin of Klicktape',      -- Ranks 11-20
    'Poseidon of Klicktape',  -- Ranks 21-30
    'Zeus of Klicktape',      -- Ranks 31-40
    'Hercules of Klicktape'   -- Ranks 41-50
);

-- Leaderboard periods table (weekly periods)
CREATE TABLE leaderboard_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(start_date, end_date)
);

-- Engagement points table (tracks all user engagement)
CREATE TABLE engagement_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    engagement_type engagement_type NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'post', 'reel')),
    content_id UUID NOT NULL,
    points DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_id, engagement_type, content_id)
);

-- Leaderboard rankings table (current rankings for active period)
CREATE TABLE leaderboard_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 50),
    rank_tier rank_tier NOT NULL,
    total_points DECIMAL(8,1) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, user_id),
    UNIQUE(period_id, rank_position)
);

-- Shares table (tracks content sharing)
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'post', 'reel')),
    content_id UUID NOT NULL,
    shared_to TEXT, -- platform or method shared to
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story likes table (for story engagement tracking)
CREATE TABLE story_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, story_id)
);

-- Story comments table (for story engagement tracking)
CREATE TABLE story_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User rewards table (tracks earned rewards)
CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    reward_type reward_type NOT NULL,
    rank_achieved INTEGER NOT NULL,
    rank_tier rank_tier NOT NULL,
    title_text TEXT,
    badge_icon TEXT,
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Leaderboard periods indexes
CREATE INDEX idx_leaderboard_periods_active ON leaderboard_periods(is_active, start_date, end_date);
CREATE INDEX idx_leaderboard_periods_dates ON leaderboard_periods(start_date, end_date);

-- Engagement points indexes
CREATE INDEX idx_engagement_points_user_period ON engagement_points(user_id, period_id);
CREATE INDEX idx_engagement_points_period_points ON engagement_points(period_id, points DESC);
CREATE INDEX idx_engagement_points_content ON engagement_points(content_type, content_id);
CREATE INDEX idx_engagement_points_created ON engagement_points(created_at DESC);

-- Leaderboard rankings indexes
CREATE INDEX idx_leaderboard_rankings_period_rank ON leaderboard_rankings(period_id, rank_position);
CREATE INDEX idx_leaderboard_rankings_period_points ON leaderboard_rankings(period_id, total_points DESC);
CREATE INDEX idx_leaderboard_rankings_user ON leaderboard_rankings(user_id, period_id);

-- Shares indexes
CREATE INDEX idx_shares_user_content ON shares(user_id, content_type, content_id);
CREATE INDEX idx_shares_created ON shares(created_at DESC);

-- Story engagement indexes
CREATE INDEX idx_story_likes_user_story ON story_likes(user_id, story_id);
CREATE INDEX idx_story_likes_story ON story_likes(story_id, created_at DESC);
CREATE INDEX idx_story_comments_story ON story_comments(story_id, created_at DESC);
CREATE INDEX idx_story_comments_user ON story_comments(user_id, created_at DESC);

-- User rewards indexes
CREATE INDEX idx_user_rewards_user_period ON user_rewards(user_id, period_id);
CREATE INDEX idx_user_rewards_period_rank ON user_rewards(period_id, rank_achieved);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- =====================================================
-- RANK TIER FUNCTIONS
-- =====================================================

-- Function to get rank tier based on position
CREATE OR REPLACE FUNCTION get_rank_tier(rank_position INTEGER)
RETURNS rank_tier AS $$
BEGIN
    CASE
        WHEN rank_position BETWEEN 1 AND 10 THEN
            RETURN 'Loki of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 11 AND 20 THEN
            RETURN 'Odin of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 21 AND 30 THEN
            RETURN 'Poseidon of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 31 AND 40 THEN
            RETURN 'Zeus of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 41 AND 50 THEN
            RETURN 'Hercules of Klicktape'::rank_tier;
        ELSE
            RETURN 'Hercules of Klicktape'::rank_tier; -- Default for ranks > 50
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to automatically set rank_tier when rank_position is inserted/updated
CREATE OR REPLACE FUNCTION set_rank_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_position);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for leaderboard_rankings
CREATE TRIGGER trigger_set_rank_tier
    BEFORE INSERT OR UPDATE OF rank_position ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier();

-- Create trigger for user_rewards
CREATE TRIGGER trigger_set_rank_tier_rewards
    BEFORE INSERT OR UPDATE OF rank_achieved ON user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier_rewards();

-- Trigger function for user_rewards
CREATE OR REPLACE FUNCTION set_rank_tier_rewards()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_achieved);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all tables
ALTER TABLE leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Leaderboard periods policies (read-only for all authenticated users)
CREATE POLICY "leaderboard_periods_read" ON leaderboard_periods
    FOR SELECT TO authenticated USING (true);

-- Engagement points policies
CREATE POLICY "engagement_points_read" ON engagement_points
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "engagement_points_insert" ON engagement_points
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Leaderboard rankings policies (read-only for all authenticated users)
CREATE POLICY "leaderboard_rankings_read" ON leaderboard_rankings
    FOR SELECT TO authenticated USING (true);

-- Shares policies
CREATE POLICY "shares_read" ON shares
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "shares_insert" ON shares
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Story engagement policies
CREATE POLICY "story_likes_read" ON story_likes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "story_likes_insert" ON story_likes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "story_likes_delete" ON story_likes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "story_comments_read" ON story_comments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "story_comments_insert" ON story_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "story_comments_update" ON story_comments
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "story_comments_delete" ON story_comments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User rewards policies
CREATE POLICY "user_rewards_read" ON user_rewards
    FOR SELECT TO authenticated USING (true);

-- =====================================================
-- POINT ALLOCATION CONSTANTS
-- =====================================================

-- Point values as per requirements:
-- Story Like: 1 point
-- Story Comment: 2 points
-- Photo Like: 2 points
-- Photo Comment: 1.5 points
-- Reel Like: 2 points
-- Reel Comment: 3 points
-- Share (any): 3 points

-- =====================================================
-- PROFILE TIER INTEGRATION
-- =====================================================

-- Add current_tier column to profiles table for easy tier access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'current_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD COLUMN current_tier rank_tier;
        RAISE NOTICE 'Added current_tier column to profiles table';
    END IF;
END $$;

-- Function to get user's current tier from leaderboard
CREATE OR REPLACE FUNCTION get_user_current_tier(user_id UUID)
RETURNS rank_tier AS $$
DECLARE
    user_tier rank_tier;
BEGIN
    SELECT lr.rank_tier INTO user_tier
    FROM leaderboard_rankings lr
    JOIN leaderboard_periods lp ON lr.period_id = lp.id
    WHERE lr.user_id = get_user_current_tier.user_id
    AND lp.is_active = true
    LIMIT 1;

    RETURN user_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile tier
CREATE OR REPLACE FUNCTION update_profile_tier(user_id UUID)
RETURNS void AS $$
DECLARE
    new_tier rank_tier;
BEGIN
    new_tier := get_user_current_tier(user_id);

    UPDATE profiles
    SET current_tier = new_tier,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to sync all profile tiers
CREATE OR REPLACE FUNCTION sync_all_profile_tiers()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    FOR user_record IN
        SELECT DISTINCT lr.user_id, lr.rank_tier
        FROM leaderboard_rankings lr
        JOIN leaderboard_periods lp ON lr.period_id = lp.id
        WHERE lp.is_active = true
    LOOP
        UPDATE profiles
        SET current_tier = user_record.rank_tier,
            updated_at = NOW()
        WHERE id = user_record.user_id;

        updated_count := updated_count + 1;
    END LOOP;

    UPDATE profiles
    SET current_tier = NULL,
        updated_at = NOW()
    WHERE id NOT IN (
        SELECT lr.user_id
        FROM leaderboard_rankings lr
        JOIN leaderboard_periods lp ON lr.period_id = lp.id
        WHERE lp.is_active = true
    )
    AND current_tier IS NOT NULL;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update profile tier when leaderboard changes
CREATE OR REPLACE FUNCTION trigger_update_profile_tier()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_profile_tier(NEW.user_id);
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM update_profile_tier(OLD.user_id);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaderboard_rankings
DROP TRIGGER IF EXISTS trigger_sync_profile_tier ON leaderboard_rankings;
CREATE TRIGGER trigger_sync_profile_tier
    AFTER INSERT OR UPDATE OR DELETE ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_profile_tier();

-- Trigger function for leaderboard period changes
CREATE OR REPLACE FUNCTION trigger_sync_all_profile_tiers()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.is_active != NEW.is_active) THEN
        PERFORM sync_all_profile_tiers();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaderboard_periods
DROP TRIGGER IF EXISTS trigger_sync_all_tiers_on_period_change ON leaderboard_periods;
CREATE TRIGGER trigger_sync_all_tiers_on_period_change
    AFTER UPDATE ON leaderboard_periods
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_all_profile_tiers();

-- Enhanced profile view with tier information
CREATE OR REPLACE VIEW profiles_with_tier_info AS
SELECT
    p.id,
    p.email,
    p.username,
    p.gender,
    p.created_at,
    p.updated_at,
    p.avatar_url,
    p.account_type,
    p.bio,
    p.current_tier,
    CASE p.current_tier
        WHEN 'Loki of Klicktape' THEN 'The Trickster Gods'
        WHEN 'Odin of Klicktape' THEN 'The All-Father Tier'
        WHEN 'Poseidon of Klicktape' THEN 'The Sea Lords'
        WHEN 'Zeus of Klicktape' THEN 'The Thunder Gods'
        WHEN 'Hercules of Klicktape' THEN 'The Heroes'
        ELSE 'Unranked'
    END as tier_description,
    CASE p.current_tier
        WHEN 'Loki of Klicktape' THEN 'Ranks 1-10'
        WHEN 'Odin of Klicktape' THEN 'Ranks 11-20'
        WHEN 'Poseidon of Klicktape' THEN 'Ranks 21-30'
        WHEN 'Zeus of Klicktape' THEN 'Ranks 31-40'
        WHEN 'Hercules of Klicktape' THEN 'Ranks 41-50'
        ELSE 'Not in leaderboard'
    END as tier_rank_range,
    lr.rank_position,
    lr.total_points
FROM profiles p
LEFT JOIN leaderboard_rankings lr ON p.id = lr.user_id
LEFT JOIN leaderboard_periods lp ON lr.period_id = lp.id AND lp.is_active = true;

GRANT SELECT ON profiles_with_tier_info TO authenticated;
