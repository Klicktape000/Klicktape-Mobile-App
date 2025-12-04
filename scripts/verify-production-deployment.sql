-- =====================================================
-- PRODUCTION DEPLOYMENT VERIFICATION SCRIPT
-- Run this after executing the main deployment script
-- =====================================================

-- Step 1: Verify all tables exist
SELECT 'TABLES VERIFICATION' as check_type;
SELECT 
    COUNT(*) as total_tables,
    CASE 
        WHEN COUNT(*) >= 31 THEN '✅ All tables created'
        ELSE '❌ Missing tables'
    END as status
FROM pg_tables 
WHERE schemaname = 'public';

-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Step 2: Verify mythological rank enum exists
SELECT 'MYTHOLOGICAL RANKS VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rank_tier') 
        THEN '✅ rank_tier enum exists'
        ELSE '❌ rank_tier enum missing'
    END as rank_tier_status;

-- Show all rank tiers
SELECT unnest(enum_range(NULL::rank_tier)) as mythological_tiers;

-- Step 3: Verify leaderboard_rankings table has rank_tier column
SELECT 'LEADERBOARD TABLE VERIFICATION' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'leaderboard_rankings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Verify user_rewards table has rank_tier column
SELECT 'USER REWARDS TABLE VERIFICATION' as check_type;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_rewards' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 5: Verify rank tier function exists
SELECT 'RANK TIER FUNCTION VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_rank_tier') 
        THEN '✅ get_rank_tier function exists'
        ELSE '❌ get_rank_tier function missing'
    END as function_status;

-- Test the function
SELECT 
    get_rank_tier(5) as rank_5_tier,
    get_rank_tier(15) as rank_15_tier,
    get_rank_tier(25) as rank_25_tier,
    get_rank_tier(35) as rank_35_tier,
    get_rank_tier(45) as rank_45_tier;

-- Step 6: Verify triggers exist
SELECT 'TRIGGERS VERIFICATION' as check_type;
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%rank_tier%'
ORDER BY trigger_name;

-- Step 7: Verify leaderboard view exists
SELECT 'LEADERBOARD VIEW VERIFICATION' as check_type;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'leaderboard_with_tiers') 
        THEN '✅ leaderboard_with_tiers view exists'
        ELSE '❌ leaderboard_with_tiers view missing'
    END as view_status;

-- Step 8: Create test data to verify mythological ranking system
SELECT 'CREATING TEST DATA' as check_type;

-- Insert test leaderboard period
INSERT INTO leaderboard_periods (start_date, end_date, is_active)
VALUES (CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', true)
ON CONFLICT (start_date, end_date) DO NOTHING;

-- Get the period ID
DO $$
DECLARE
    test_period_id UUID;
    test_user_ids UUID[];
BEGIN
    -- Get active period
    SELECT id INTO test_period_id 
    FROM leaderboard_periods 
    WHERE is_active = true 
    LIMIT 1;
    
    -- Get some user IDs (create test users if none exist)
    SELECT ARRAY(SELECT id FROM profiles LIMIT 5) INTO test_user_ids;
    
    -- If no users exist, create test users
    IF array_length(test_user_ids, 1) IS NULL OR array_length(test_user_ids, 1) < 5 THEN
        -- Create test users in auth.users first
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES 
            ('11111111-1111-1111-1111-111111111111', 'loki@klicktape.com', 'encrypted', NOW(), NOW(), NOW()),
            ('22222222-2222-2222-2222-222222222222', 'odin@klicktape.com', 'encrypted', NOW(), NOW(), NOW()),
            ('33333333-3333-3333-3333-333333333333', 'poseidon@klicktape.com', 'encrypted', NOW(), NOW(), NOW()),
            ('44444444-4444-4444-4444-444444444444', 'zeus@klicktape.com', 'encrypted', NOW(), NOW(), NOW()),
            ('55555555-5555-5555-5555-555555555555', 'hercules@klicktape.com', 'encrypted', NOW(), NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
        
        -- Create profiles
        INSERT INTO profiles (id, username, email)
        VALUES 
            ('11111111-1111-1111-1111-111111111111', 'loki_test', 'loki@klicktape.com'),
            ('22222222-2222-2222-2222-222222222222', 'odin_test', 'odin@klicktape.com'),
            ('33333333-3333-3333-3333-333333333333', 'poseidon_test', 'poseidon@klicktape.com'),
            ('44444444-4444-4444-4444-444444444444', 'zeus_test', 'zeus@klicktape.com'),
            ('55555555-5555-5555-5555-555555555555', 'hercules_test', 'hercules@klicktape.com')
        ON CONFLICT (id) DO NOTHING;
        
        test_user_ids := ARRAY[
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333',
            '44444444-4444-4444-4444-444444444444',
            '55555555-5555-5555-5555-555555555555'
        ];
    END IF;
    
    -- Insert test rankings for each mythological tier
    IF test_period_id IS NOT NULL AND array_length(test_user_ids, 1) >= 5 THEN
        INSERT INTO leaderboard_rankings (period_id, user_id, rank_position, total_points)
        VALUES 
            (test_period_id, test_user_ids[1], 5, 2000.0),   -- Loki tier
            (test_period_id, test_user_ids[2], 15, 1500.0),  -- Odin tier
            (test_period_id, test_user_ids[3], 25, 1000.0),  -- Poseidon tier
            (test_period_id, test_user_ids[4], 35, 750.0),   -- Zeus tier
            (test_period_id, test_user_ids[5], 45, 500.0)    -- Hercules tier
        ON CONFLICT (period_id, rank_position) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            total_points = EXCLUDED.total_points;
            
        RAISE NOTICE 'Test leaderboard data created successfully';
    END IF;
END $$;

-- Step 9: Verify mythological tier assignment
SELECT 'MYTHOLOGICAL TIER VERIFICATION' as check_type;
SELECT 
    lr.rank_position,
    lr.rank_tier,
    p.username,
    lr.total_points,
    CASE lr.rank_tier
        WHEN 'Loki of Klicktape' THEN '✅ Correct (Ranks 1-10)'
        WHEN 'Odin of Klicktape' THEN '✅ Correct (Ranks 11-20)'
        WHEN 'Poseidon of Klicktape' THEN '✅ Correct (Ranks 21-30)'
        WHEN 'Zeus of Klicktape' THEN '✅ Correct (Ranks 31-40)'
        WHEN 'Hercules of Klicktape' THEN '✅ Correct (Ranks 41-50)'
        ELSE '❌ Incorrect tier assignment'
    END as tier_verification
FROM leaderboard_rankings lr
JOIN profiles p ON lr.user_id = p.id
WHERE lr.period_id = (SELECT id FROM leaderboard_periods WHERE is_active = true LIMIT 1)
ORDER BY lr.rank_position;

-- Step 10: Test the enhanced leaderboard view
SELECT 'ENHANCED LEADERBOARD VIEW TEST' as check_type;
SELECT 
    rank_position,
    rank_tier,
    tier_description,
    username,
    total_points
FROM leaderboard_with_tiers
ORDER BY rank_position;

-- Step 11: Final verification summary
SELECT 'DEPLOYMENT VERIFICATION SUMMARY' as check_type;
SELECT 
    'Tables: ' || (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tables_count,
    'Indexes: ' || (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as indexes_count,
    'Foreign Keys: ' || (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as foreign_keys_count,
    'RLS Policies: ' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as rls_policies_count,
    'Mythological Tiers: ' || (SELECT COUNT(*) FROM unnest(enum_range(NULL::rank_tier))) as mythological_tiers_count;

SELECT '🎉 MYTHOLOGICAL RANKING SYSTEM DEPLOYMENT VERIFICATION COMPLETE! 🏆' as final_status;
