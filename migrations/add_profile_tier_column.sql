-- =====================================================
-- ADD MYTHOLOGICAL TIER TO PROFILES TABLE
-- Adds current_tier column to profiles for easy tier access
-- =====================================================

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
        RAISE NOTICE 'Added current_tier column to profiles table';
    ELSE
        RAISE NOTICE 'current_tier column already exists in profiles table';
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
    
    RAISE NOTICE 'Updated profile tier for user % to %', user_id, new_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to sync all profile tiers
CREATE OR REPLACE FUNCTION sync_all_profile_tiers()
RETURNS void AS $$
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
    
    RAISE NOTICE 'Synced profile tiers for % users', updated_count;
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
    -- When a leaderboard period becomes active/inactive, sync all profile tiers
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

-- =====================================================
-- INITIAL DATA SYNC
-- =====================================================

-- Sync existing profile tiers with current leaderboard
SELECT sync_all_profile_tiers();

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
-- RLS POLICIES FOR PROFILE TIER
-- =====================================================

-- The current_tier column inherits the existing RLS policies from profiles table
-- No additional policies needed as it's part of the user's profile data

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify the column was added
SELECT 'Profile tier column verification:' as status;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'current_tier'
AND table_schema = 'public';

-- Test the sync function
SELECT 'Testing profile tier sync:' as status;
SELECT 
    p.username,
    p.current_tier,
    lr.rank_position,
    lr.rank_tier as leaderboard_tier
FROM profiles p
LEFT JOIN leaderboard_rankings lr ON p.id = lr.user_id
LEFT JOIN leaderboard_periods lp ON lr.period_id = lp.id AND lp.is_active = true
WHERE p.current_tier IS NOT NULL OR lr.rank_tier IS NOT NULL
ORDER BY lr.rank_position NULLS LAST;

-- Show enhanced profile view
SELECT 'Enhanced profile view test:' as status;
SELECT 
    username,
    current_tier,
    tier_description,
    tier_rank_range,
    rank_position,
    total_points
FROM profiles_with_tier_info
WHERE current_tier IS NOT NULL
ORDER BY rank_position NULLS LAST;

SELECT '✅ Profile tier enhancement completed successfully!' as final_status;
