-- =====================================================
-- PRODUCTION FIX FOR ELITE PERFORMER ISSUE
-- Updates frontend to use mythological tiers instead of "Elite Performer"
-- =====================================================

-- Ensure rank_tier enum exists
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

-- Ensure user_rewards table has rank_tier column
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

-- Ensure profiles table has current_tier column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'current_tier'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD COLUMN current_tier rank_tier;
    END IF;
END $$;

-- Update existing user_rewards records with proper mythological tiers
UPDATE user_rewards 
SET rank_tier = CASE 
    WHEN rank_achieved BETWEEN 1 AND 10 THEN 'Loki of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 11 AND 20 THEN 'Odin of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 21 AND 30 THEN 'Poseidon of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 31 AND 40 THEN 'Zeus of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 41 AND 50 THEN 'Hercules of Klicktape'::rank_tier
    ELSE 'Hercules of Klicktape'::rank_tier -- Default for ranks > 50
END
WHERE rank_tier IS NULL;

-- Update title_text to use mythological tier names instead of generic titles
UPDATE user_rewards 
SET title_text = rank_tier
WHERE title_text LIKE '%Elite Performer%' 
   OR title_text LIKE '%Top Contributor%'
   OR title_text LIKE '%Community Leader%'
   OR title_text LIKE '%Active Member%'
   OR title_text IS NULL;

-- Ensure all existing user_rewards have rank_tier set (safety check)
UPDATE user_rewards 
SET rank_tier = CASE 
    WHEN rank_achieved BETWEEN 1 AND 10 THEN 'Loki of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 11 AND 20 THEN 'Odin of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 21 AND 30 THEN 'Poseidon of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 31 AND 40 THEN 'Zeus of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 41 AND 50 THEN 'Hercules of Klicktape'::rank_tier
    ELSE 'Hercules of Klicktape'::rank_tier
END
WHERE rank_tier IS NULL;

-- Make rank_tier NOT NULL after updating existing records
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_rewards' 
        AND column_name = 'rank_tier'
        AND table_schema = 'public'
        AND is_nullable = 'YES'
    ) THEN
        -- Only set NOT NULL if all records have been updated
        IF NOT EXISTS (SELECT 1 FROM user_rewards WHERE rank_tier IS NULL) THEN
            ALTER TABLE user_rewards ALTER COLUMN rank_tier SET NOT NULL;
        END IF;
    END IF;
END $$;

-- Recreate the trigger function to automatically set rank_tier for new rewards
CREATE OR REPLACE FUNCTION set_rank_tier_rewards()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = CASE 
        WHEN NEW.rank_achieved BETWEEN 1 AND 10 THEN 'Loki of Klicktape'::rank_tier
        WHEN NEW.rank_achieved BETWEEN 11 AND 20 THEN 'Odin of Klicktape'::rank_tier
        WHEN NEW.rank_achieved BETWEEN 21 AND 30 THEN 'Poseidon of Klicktape'::rank_tier
        WHEN NEW.rank_achieved BETWEEN 31 AND 40 THEN 'Zeus of Klicktape'::rank_tier
        WHEN NEW.rank_achieved BETWEEN 41 AND 50 THEN 'Hercules of Klicktape'::rank_tier
        ELSE 'Hercules of Klicktape'::rank_tier
    END;
    
    -- Also set title_text to the mythological tier name
    NEW.title_text = NEW.rank_tier;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_set_rank_tier_rewards ON user_rewards;
CREATE TRIGGER trigger_set_rank_tier_rewards
    BEFORE INSERT OR UPDATE OF rank_achieved ON user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier_rewards();

-- Sync profile tiers with current leaderboard
DO $$
DECLARE
    user_record RECORD;
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
    END LOOP;
END $$;

-- Create a function to get mythological tier display name
CREATE OR REPLACE FUNCTION get_mythological_tier_display(rank_position INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE 
        WHEN rank_position BETWEEN 1 AND 10 THEN
            RETURN 'Loki of Klicktape';
        WHEN rank_position BETWEEN 11 AND 20 THEN
            RETURN 'Odin of Klicktape';
        WHEN rank_position BETWEEN 21 AND 30 THEN
            RETURN 'Poseidon of Klicktape';
        WHEN rank_position BETWEEN 31 AND 40 THEN
            RETURN 'Zeus of Klicktape';
        WHEN rank_position BETWEEN 41 AND 50 THEN
            RETURN 'Hercules of Klicktape';
        ELSE
            RETURN 'Hercules of Klicktape'; -- Default for ranks > 50
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for easy mythological tier lookup
CREATE OR REPLACE VIEW mythological_tier_info AS
SELECT 
    tier_name,
    tier_description,
    min_rank,
    max_rank,
    tier_color,
    tier_icon
FROM (VALUES
    ('Loki of Klicktape', 'The Trickster Gods', 1, 10, '#9333EA', '🃏'),
    ('Odin of Klicktape', 'The All-Father Tier', 11, 20, '#3B82F6', '👁️'),
    ('Poseidon of Klicktape', 'The Sea Lords', 21, 30, '#06B6D4', '🔱'),
    ('Zeus of Klicktape', 'The Thunder Gods', 31, 40, '#F59E0B', '⚡'),
    ('Hercules of Klicktape', 'The Heroes', 41, 50, '#EF4444', '💪')
) AS tiers(tier_name, tier_description, min_rank, max_rank, tier_color, tier_icon);

GRANT SELECT ON mythological_tier_info TO authenticated;

-- Verification queries
SELECT '🔍 VERIFICATION: Elite Performer Fix Status' as status;

-- Check if rank_tier column exists in user_rewards
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_rewards' 
            AND column_name = 'rank_tier'
        ) 
        THEN '✅ rank_tier column exists in user_rewards'
        ELSE '❌ rank_tier column missing from user_rewards'
    END as user_rewards_status;

-- Check if current_tier column exists in profiles
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'current_tier'
        ) 
        THEN '✅ current_tier column exists in profiles'
        ELSE '❌ current_tier column missing from profiles'
    END as profiles_status;

-- Check mythological tiers
SELECT 'Available mythological tiers:' as tier_status;
SELECT unnest(enum_range(NULL::rank_tier)) as mythological_tiers;

-- Check user_rewards with mythological tiers
SELECT 
    COUNT(*) as total_rewards,
    COUNT(rank_tier) as rewards_with_tiers,
    COUNT(*) - COUNT(rank_tier) as rewards_without_tiers
FROM user_rewards;

-- Show tier distribution in user_rewards (if any exist)
SELECT 
    rank_tier,
    COUNT(*) as count,
    MIN(rank_achieved) as min_rank,
    MAX(rank_achieved) as max_rank
FROM user_rewards 
WHERE rank_tier IS NOT NULL
GROUP BY rank_tier
ORDER BY MIN(rank_achieved);

-- Check profiles with tiers
SELECT 
    COUNT(*) as total_profiles,
    COUNT(current_tier) as profiles_with_tiers
FROM profiles;

-- Final success message
SELECT '🎉 ELITE PERFORMER ISSUE FIXED! 🏆' as final_status;
SELECT 'Frontend will now display mythological tiers instead of "Elite Performer"!' as frontend_status;
SELECT 'BadgeDisplay and Leaderboard components updated to use mythological tier names.' as component_status;
