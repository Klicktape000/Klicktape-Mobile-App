-- =====================================================
-- LEADERBOARD SYSTEM SETUP SCRIPT
-- Run this script to set up the complete leaderboard system
-- =====================================================

-- First, run the schema setup
\i sql/leaderboard_schema.sql

-- Then, run the functions setup
\i sql/leaderboard_functions.sql

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Create the first leaderboard period (current week)
SELECT get_current_leaderboard_period();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if all tables were created
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN (
    'leaderboard_periods',
    'engagement_points', 
    'leaderboard_rankings',
    'shares',
    'story_likes',
    'story_comments',
    'user_rewards'
) 
ORDER BY tablename;

-- Check if all functions were created
SELECT 
    proname as function_name,
    pronargs as num_args
FROM pg_proc 
WHERE proname IN (
    'get_current_leaderboard_period',
    'add_engagement_points',
    'remove_engagement_points',
    'update_leaderboard_rankings',
    'get_current_leaderboard',
    'get_user_leaderboard_stats',
    'complete_leaderboard_period'
)
ORDER BY proname;

-- Check if all triggers were created
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%points%'
ORDER BY event_object_table, trigger_name;

-- Check current leaderboard period
SELECT 
    id,
    start_date,
    end_date,
    is_active,
    is_completed
FROM leaderboard_periods 
WHERE is_active = true;

-- Sample test data (optional - uncomment to add test data)
/*
-- Add some test engagement points
INSERT INTO engagement_points (user_id, period_id, engagement_type, content_type, content_id, points)
SELECT 
    p.id as user_id,
    (SELECT id FROM leaderboard_periods WHERE is_active = true LIMIT 1) as period_id,
    'photo_like' as engagement_type,
    'post' as content_type,
    gen_random_uuid() as content_id,
    2.0 as points
FROM profiles p
LIMIT 10;

-- Update rankings with test data
SELECT update_leaderboard_rankings((SELECT id FROM leaderboard_periods WHERE is_active = true LIMIT 1));
*/

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON leaderboard_periods TO authenticated;
GRANT SELECT, INSERT ON engagement_points TO authenticated;
GRANT SELECT ON leaderboard_rankings TO authenticated;
GRANT SELECT, INSERT ON shares TO authenticated;
GRANT SELECT, INSERT, DELETE ON story_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON story_comments TO authenticated;
GRANT SELECT ON user_rewards TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_current_leaderboard_period() TO authenticated;
GRANT EXECUTE ON FUNCTION add_engagement_points(UUID, engagement_type, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_engagement_points(UUID, engagement_type, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_leaderboard_stats(UUID) TO authenticated;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

-- Test the main functions
SELECT 'Testing get_current_leaderboard function:' as test;
SELECT * FROM get_current_leaderboard() LIMIT 5;

SELECT 'Testing get_user_leaderboard_stats function:' as test;
SELECT * FROM get_user_leaderboard_stats(NULL);

-- Show setup completion message
SELECT 'Leaderboard system setup completed successfully!' as status;
SELECT 'You can now use the leaderboard features in your application.' as message;
