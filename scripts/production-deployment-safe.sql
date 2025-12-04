-- =====================================================
-- KLICKTAPE SAFE PRODUCTION DEPLOYMENT
-- Handles existing objects gracefully
-- =====================================================

-- Enable required extensions (safe if already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- CUSTOM TYPES AND ENUMS (SAFE CREATION)
-- =====================================================

-- Create types only if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('personal', 'creator', 'business');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_type') THEN
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
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_type') THEN
        CREATE TYPE reward_type AS ENUM (
            'premium_badge',
            'normal_badge',
            'premium_title',
            'normal_title'
        );
    END IF;
END $$;

-- =====================================================
-- MYTHOLOGICAL RANK TIER ENUM (NEW)
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rank_tier') THEN
        CREATE TYPE rank_tier AS ENUM (
            'Loki of Klicktape',      -- Ranks 1-10
            'Odin of Klicktape',      -- Ranks 11-20
            'Poseidon of Klicktape',  -- Ranks 21-30
            'Zeus of Klicktape',      -- Ranks 31-40
            'Hercules of Klicktape'   -- Ranks 41-50
        );
    END IF;
END $$;

-- =====================================================
-- ADD MYTHOLOGICAL RANK COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add rank_tier column to leaderboard_rankings if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leaderboard_rankings' 
        AND column_name = 'rank_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE leaderboard_rankings ADD COLUMN rank_tier rank_tier;
    END IF;
END $$;

-- Add rank_tier column to user_rewards if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_rewards' 
        AND column_name = 'rank_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_rewards ADD COLUMN rank_tier rank_tier;
    END IF;
END $$;

-- =====================================================
-- MYTHOLOGICAL RANK FUNCTIONS
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

-- Update existing records in leaderboard_rankings
UPDATE leaderboard_rankings 
SET rank_tier = get_rank_tier(rank_position)
WHERE rank_tier IS NULL;

-- Update existing records in user_rewards
UPDATE user_rewards 
SET rank_tier = get_rank_tier(rank_achieved)
WHERE rank_tier IS NULL;

-- Make rank_tier NOT NULL after updating existing records
DO $$ 
BEGIN
    -- Only set NOT NULL if column exists and has been populated
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leaderboard_rankings' 
        AND column_name = 'rank_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE leaderboard_rankings ALTER COLUMN rank_tier SET NOT NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_rewards' 
        AND column_name = 'rank_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_rewards ALTER COLUMN rank_tier SET NOT NULL;
    END IF;
END $$;

-- =====================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC TIER ASSIGNMENT
-- =====================================================

-- Trigger function to automatically set rank_tier when rank_position is inserted/updated
CREATE OR REPLACE FUNCTION set_rank_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_position);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for user_rewards
CREATE OR REPLACE FUNCTION set_rank_tier_rewards()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_achieved);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first if they exist)
DROP TRIGGER IF EXISTS trigger_set_rank_tier ON leaderboard_rankings;
CREATE TRIGGER trigger_set_rank_tier
    BEFORE INSERT OR UPDATE OF rank_position ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier();

DROP TRIGGER IF EXISTS trigger_set_rank_tier_rewards ON user_rewards;
CREATE TRIGGER trigger_set_rank_tier_rewards
    BEFORE INSERT OR UPDATE OF rank_achieved ON user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier_rewards();

-- =====================================================
-- ENHANCED LEADERBOARD VIEW
-- =====================================================

-- Create enhanced leaderboard view with mythological tiers
CREATE OR REPLACE VIEW leaderboard_with_tiers AS
SELECT 
    lr.id,
    lr.period_id,
    lr.user_id,
    p.username,
    p.avatar_url,
    lr.rank_position,
    lr.rank_tier,
    lr.total_points,
    lr.last_updated,
    -- Add tier description for display
    CASE lr.rank_tier
        WHEN 'Loki of Klicktape' THEN 'The Trickster Gods (Ranks 1-10)'
        WHEN 'Odin of Klicktape' THEN 'The All-Father Tier (Ranks 11-20)'
        WHEN 'Poseidon of Klicktape' THEN 'The Sea Lords (Ranks 21-30)'
        WHEN 'Zeus of Klicktape' THEN 'The Thunder Gods (Ranks 31-40)'
        WHEN 'Hercules of Klicktape' THEN 'The Heroes (Ranks 41-50)'
    END as tier_description
FROM leaderboard_rankings lr
JOIN profiles p ON lr.user_id = p.id
ORDER BY lr.rank_position;

-- Grant permissions on the view
GRANT SELECT ON leaderboard_with_tiers TO authenticated;

-- =====================================================
-- VERIFICATION AND TEST DATA
-- =====================================================

-- Verify mythological rank enum exists
SELECT 'Mythological tiers available:' as status;
SELECT unnest(enum_range(NULL::rank_tier)) as mythological_tiers;

-- Test the rank tier function
SELECT 'Testing rank tier function:' as status;
SELECT 
    get_rank_tier(5) as rank_5_tier,
    get_rank_tier(15) as rank_15_tier,
    get_rank_tier(25) as rank_25_tier,
    get_rank_tier(35) as rank_35_tier,
    get_rank_tier(45) as rank_45_tier;

-- Create test leaderboard period if none exists
INSERT INTO leaderboard_periods (start_date, end_date, is_active)
VALUES (CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', true)
ON CONFLICT (start_date, end_date) DO NOTHING;

-- Final success message
SELECT '🎉 MYTHOLOGICAL RANKING SYSTEM DEPLOYED SUCCESSFULLY! 🏆' as final_status;
SELECT 'Ready to use: Loki, Odin, Poseidon, Zeus, Hercules tiers!' as mythological_status;
