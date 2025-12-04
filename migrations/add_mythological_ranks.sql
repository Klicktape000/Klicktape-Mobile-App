-- =====================================================
-- MYTHOLOGICAL RANKS MIGRATION
-- Adds mythological ranking system to existing leaderboard
-- =====================================================

-- Create enum for mythological rank tiers
CREATE TYPE rank_tier AS ENUM (
    'Loki of Klicktape',      -- Ranks 1-10
    'Odin of Klicktape',      -- Ranks 11-20
    'Poseidon of Klicktape',  -- Ranks 21-30
    'Zeus of Klicktape',      -- Ranks 31-40
    'Hercules of Klicktape'   -- Ranks 41-50
);

-- Add rank_tier column to leaderboard_rankings table
ALTER TABLE leaderboard_rankings 
ADD COLUMN rank_tier rank_tier;

-- Add rank_tier column to user_rewards table
ALTER TABLE user_rewards 
ADD COLUMN rank_tier rank_tier;

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
SET rank_tier = get_rank_tier(rank_position);

-- Update existing records in user_rewards
UPDATE user_rewards 
SET rank_tier = get_rank_tier(rank_achieved);

-- Make rank_tier NOT NULL after updating existing records
ALTER TABLE leaderboard_rankings 
ALTER COLUMN rank_tier SET NOT NULL;

ALTER TABLE user_rewards 
ALTER COLUMN rank_tier SET NOT NULL;

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

-- Create trigger for leaderboard_rankings
DROP TRIGGER IF EXISTS trigger_set_rank_tier ON leaderboard_rankings;
CREATE TRIGGER trigger_set_rank_tier
    BEFORE INSERT OR UPDATE OF rank_position ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier();

-- Create trigger for user_rewards
DROP TRIGGER IF EXISTS trigger_set_rank_tier_rewards ON user_rewards;
CREATE TRIGGER trigger_set_rank_tier_rewards
    BEFORE INSERT OR UPDATE OF rank_achieved ON user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier_rewards();

-- Create a view for easy rank tier display
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

-- Create RLS policy for the view (inherits from base tables)
-- Views automatically inherit RLS from their base tables

-- Test the migration with sample data (optional)
-- This will be commented out for production
/*
-- Insert test leaderboard period if none exists
INSERT INTO leaderboard_periods (start_date, end_date, is_active)
VALUES (CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE, true)
ON CONFLICT DO NOTHING;

-- Test rank tier assignment
DO $$
DECLARE
    test_period_id UUID;
    test_user_id UUID;
BEGIN
    -- Get or create test period
    SELECT id INTO test_period_id FROM leaderboard_periods WHERE is_active = true LIMIT 1;
    
    -- Get a test user
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_user_id IS NOT NULL AND test_period_id IS NOT NULL THEN
        -- Test different rank positions
        INSERT INTO leaderboard_rankings (period_id, user_id, rank_position, total_points)
        VALUES 
            (test_period_id, test_user_id, 5, 1000.0),
            (test_period_id, gen_random_uuid(), 15, 800.0),
            (test_period_id, gen_random_uuid(), 25, 600.0),
            (test_period_id, gen_random_uuid(), 35, 400.0),
            (test_period_id, gen_random_uuid(), 45, 200.0)
        ON CONFLICT (period_id, rank_position) DO NOTHING;
        
        RAISE NOTICE 'Test data inserted successfully';
    END IF;
END $$;
*/

SELECT 'Mythological ranks migration completed successfully!' as status;
