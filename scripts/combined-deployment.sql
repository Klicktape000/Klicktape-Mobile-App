-- =====================================================
-- KLICKTAPE AUTOMATED DEPLOYMENT
-- Generated: 2025-10-01T07:28:09.924Z
-- Project: wpxkjqfcoudcddluiiab
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";


-- =====================================================
-- PRODUCTION-DEPLOYMENT-SAFE.SQL
-- =====================================================

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



-- =====================================================
-- PRODUCTION-PROFILE-TIER-DEPLOYMENT.SQL
-- =====================================================

-- =====================================================
-- KLICKTAPE PROFILE TIER ENHANCEMENT - PRODUCTION DEPLOYMENT
-- Adds mythological tier to profiles table for easy access
-- =====================================================

-- Ensure rank_tier enum exists (should already exist from previous deployment)
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
        RAISE NOTICE 'Created rank_tier enum';
    ELSE
        RAISE NOTICE 'rank_tier enum already exists';
    END IF;
END $$;

-- Add current_tier column to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'current_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD COLUMN current_tier rank_tier;
        RAISE NOTICE '✅ Added current_tier column to profiles table';
    ELSE
        RAISE NOTICE 'ℹ️ current_tier column already exists in profiles table';
    END IF;
END $$;

-- =====================================================
-- PROFILE TIER SYNC FUNCTIONS
-- =====================================================

-- Function to get user's current tier from leaderboard
CREATE OR REPLACE FUNCTION get_user_current_tier(user_id UUID)
RETURNS rank_tier AS $$
DECLARE
    user_tier rank_tier;
BEGIN
    -- Get the user's current tier from active leaderboard period
    SELECT lr.rank_tier INTO user_tier
    FROM leaderboard_rankings lr
    JOIN leaderboard_periods lp ON lr.period_id = lp.id
    WHERE lr.user_id = get_user_current_tier.user_id
    AND lp.is_active = true
    LIMIT 1;
    
    -- If user is not in current leaderboard, return null
    RETURN user_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile tier
CREATE OR REPLACE FUNCTION update_profile_tier(user_id UUID)
RETURNS void AS $$
DECLARE
    new_tier rank_tier;
BEGIN
    -- Get user's current tier
    new_tier := get_user_current_tier(user_id);
    
    -- Update profile with new tier (can be null if user not in leaderboard)
    UPDATE profiles 
    SET current_tier = new_tier,
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Log the update (optional, can be removed in production)
    -- RAISE NOTICE 'Updated profile tier for user % to %', user_id, new_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to sync all profile tiers
CREATE OR REPLACE FUNCTION sync_all_profile_tiers()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Update all users who are in the current active leaderboard
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
    
    -- Clear tier for users not in current leaderboard
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

-- =====================================================
-- TRIGGERS FOR AUTOMATIC PROFILE TIER UPDATES
-- =====================================================

-- Trigger function to update profile tier when leaderboard changes
CREATE OR REPLACE FUNCTION trigger_update_profile_tier()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_profile_tier(NEW.user_id);
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        PERFORM update_profile_tier(OLD.user_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaderboard_rankings (drop first if exists)
DROP TRIGGER IF EXISTS trigger_sync_profile_tier ON leaderboard_rankings;
CREATE TRIGGER trigger_sync_profile_tier
    AFTER INSERT OR UPDATE OR DELETE ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_profile_tier();

-- Trigger function for leaderboard period changes
CREATE OR REPLACE FUNCTION trigger_sync_all_profile_tiers()
RETURNS TRIGGER AS $$
BEGIN
    -- When a leaderboard period becomes active/inactive, sync all profile tiers
    IF TG_OP = 'UPDATE' AND (OLD.is_active != NEW.is_active) THEN
        PERFORM sync_all_profile_tiers();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaderboard_periods (drop first if exists)
DROP TRIGGER IF EXISTS trigger_sync_all_tiers_on_period_change ON leaderboard_periods;
CREATE TRIGGER trigger_sync_all_tiers_on_period_change
    AFTER UPDATE ON leaderboard_periods
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_all_profile_tiers();

-- =====================================================
-- ENHANCED PROFILE VIEW WITH TIER INFO
-- =====================================================

-- Create enhanced profile view with tier information
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
    -- Add tier description
    CASE p.current_tier
        WHEN 'Loki of Klicktape' THEN 'The Trickster Gods'
        WHEN 'Odin of Klicktape' THEN 'The All-Father Tier'
        WHEN 'Poseidon of Klicktape' THEN 'The Sea Lords'
        WHEN 'Zeus of Klicktape' THEN 'The Thunder Gods'
        WHEN 'Hercules of Klicktape' THEN 'The Heroes'
        ELSE 'Unranked'
    END as tier_description,
    -- Add tier rank range
    CASE p.current_tier
        WHEN 'Loki of Klicktape' THEN 'Ranks 1-10'
        WHEN 'Odin of Klicktape' THEN 'Ranks 11-20'
        WHEN 'Poseidon of Klicktape' THEN 'Ranks 21-30'
        WHEN 'Zeus of Klicktape' THEN 'Ranks 31-40'
        WHEN 'Hercules of Klicktape' THEN 'Ranks 41-50'
        ELSE 'Not in leaderboard'
    END as tier_rank_range,
    -- Get current rank position if available
    lr.rank_position,
    lr.total_points
FROM profiles p
LEFT JOIN leaderboard_rankings lr ON p.id = lr.user_id
LEFT JOIN leaderboard_periods lp ON lr.period_id = lp.id AND lp.is_active = true;

-- Grant permissions on the view
GRANT SELECT ON profiles_with_tier_info TO authenticated;

-- =====================================================
-- INITIAL DATA SYNC
-- =====================================================

-- Sync existing profile tiers with current leaderboard
SELECT 'Syncing profile tiers...' as status;
SELECT 'Updated ' || sync_all_profile_tiers() || ' user profiles with mythological tiers' as sync_result;

-- =====================================================
-- VERIFICATION AND TESTING
-- =====================================================

-- Verify the column was added
SELECT '📊 PROFILE TIER COLUMN VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'current_tier'
            AND table_schema = 'public'
        ) 
        THEN '✅ current_tier column exists in profiles table'
        ELSE '❌ current_tier column missing from profiles table'
    END as column_status;

-- Verify functions exist
SELECT '🔧 FUNCTIONS VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_current_tier') 
        THEN '✅ get_user_current_tier function exists'
        ELSE '❌ get_user_current_tier function missing'
    END as function1_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_profile_tier') 
        THEN '✅ update_profile_tier function exists'
        ELSE '❌ update_profile_tier function missing'
    END as function2_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_all_profile_tiers') 
        THEN '✅ sync_all_profile_tiers function exists'
        ELSE '❌ sync_all_profile_tiers function missing'
    END as function3_status;

-- Verify triggers exist
SELECT '⚡ TRIGGERS VERIFICATION' as check_type;
SELECT 
    COUNT(*) as trigger_count,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ Profile tier triggers created'
        ELSE '❌ Missing profile tier triggers'
    END as trigger_status
FROM information_schema.triggers 
WHERE trigger_name LIKE '%profile_tier%' OR trigger_name LIKE '%sync%tier%';

-- Verify enhanced view exists
SELECT '👁️ ENHANCED VIEW VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'profiles_with_tier_info') 
        THEN '✅ profiles_with_tier_info view exists'
        ELSE '❌ profiles_with_tier_info view missing'
    END as view_status;

-- Show sample profile tier data
SELECT '📋 SAMPLE PROFILE TIER DATA' as check_type;
SELECT 
    COUNT(*) as total_profiles,
    COUNT(current_tier) as profiles_with_tier,
    COUNT(*) - COUNT(current_tier) as profiles_without_tier
FROM profiles;

-- Show tier distribution in profiles
SELECT '🏆 TIER DISTRIBUTION IN PROFILES' as check_type;
SELECT 
    current_tier,
    COUNT(*) as user_count
FROM profiles 
WHERE current_tier IS NOT NULL
GROUP BY current_tier
ORDER BY 
    CASE current_tier
        WHEN 'Loki of Klicktape' THEN 1
        WHEN 'Odin of Klicktape' THEN 2
        WHEN 'Poseidon of Klicktape' THEN 3
        WHEN 'Zeus of Klicktape' THEN 4
        WHEN 'Hercules of Klicktape' THEN 5
    END;

-- Final success message
SELECT '🎉 PROFILE TIER ENHANCEMENT DEPLOYED SUCCESSFULLY! 🏆' as final_status;
SELECT 'Users can now display their mythological tier directly from their profile!' as feature_status;



-- =====================================================
-- FINAL DEPLOYMENT VERIFICATION
-- =====================================================

SELECT '🎉 KLICKTAPE DEPLOYMENT COMPLETED SUCCESSFULLY! 🏆' as final_status;
SELECT 'Mythological ranking system with profile tiers is now live!' as feature_status;

-- Show deployment summary
SELECT 
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_type WHERE typname = 'rank_tier') as mythological_enums,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_tier') as profile_tier_columns,
    (SELECT COUNT(*) FROM pg_views WHERE viewname LIKE '%tier%') as tier_views;
