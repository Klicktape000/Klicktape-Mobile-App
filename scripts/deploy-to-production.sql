-- KlickTape Production Deployment Script
-- This script deploys the complete database schema to production Supabase
-- Run this script in your production Supabase SQL editor

-- =============================================================================
-- STEP 1: MAIN DATABASE SCHEMA
-- =============================================================================

-- Note: Copy and paste the contents of docs/klicktape_database_schema.sql here
-- This includes:
-- - Extensions (uuid-ossp, pg_stat_statements)
-- - Custom types (gender_enum, account_type)
-- - All core tables (profiles, posts, reels, stories, etc.)
-- - Indexes for performance
-- - Foreign key constraints
-- - RLS policies
-- - Triggers and functions

\echo 'Applying main database schema...'
-- INSERT MAIN SCHEMA CONTENT HERE

-- =============================================================================
-- STEP 2: LEADERBOARD SYSTEM
-- =============================================================================

-- Note: Copy and paste the contents of sql/leaderboard_schema.sql here
-- This includes:
-- - Leaderboard types (engagement_type, reward_type)
-- - Leaderboard tables (periods, rankings, points, rewards)
-- - Leaderboard indexes and RLS policies

\echo 'Applying leaderboard schema...'
-- INSERT LEADERBOARD SCHEMA CONTENT HERE

-- =============================================================================
-- STEP 3: VERIFICATION QUERIES
-- =============================================================================

-- Verify all tables were created
SELECT 'Tables created: ' || COUNT(*) as status 
FROM pg_tables 
WHERE schemaname = 'public';

-- Verify all indexes were created
SELECT 'Indexes created: ' || COUNT(*) as status 
FROM pg_indexes 
WHERE schemaname = 'public';

-- Verify all foreign keys were created
SELECT 'Foreign keys created: ' || COUNT(*) as status 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'public';

-- Verify all RLS policies were created
SELECT 'RLS policies created: ' || COUNT(*) as status 
FROM pg_policies 
WHERE schemaname = 'public';

-- =============================================================================
-- STEP 4: PRODUCTION-SPECIFIC CONFIGURATIONS
-- =============================================================================

-- Enable RLS on all tables (should already be enabled by schema)
-- This is a safety check

DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END $$;

-- =============================================================================
-- STEP 5: INITIAL DATA SETUP (OPTIONAL)
-- =============================================================================

-- Create initial leaderboard period
INSERT INTO leaderboard_periods (
    name, 
    start_date, 
    end_date, 
    is_active
) VALUES (
    'Launch Period', 
    CURRENT_DATE, 
    CURRENT_DATE + INTERVAL '30 days', 
    true
) ON CONFLICT DO NOTHING;

-- Create default community categories
INSERT INTO community_categories (
    name, 
    description, 
    is_featured, 
    sort_order
) VALUES 
    ('General', 'General discussions and content', true, 1),
    ('Entertainment', 'Movies, music, and entertainment', true, 2),
    ('Technology', 'Tech discussions and innovations', true, 3),
    ('Sports', 'Sports content and discussions', true, 4),
    ('Art & Design', 'Creative content and artwork', true, 5)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- DEPLOYMENT COMPLETE
-- =============================================================================

SELECT 'KlickTape database deployment completed successfully!' as status;

-- Final verification
SELECT 
    'Deployment Summary:' as summary,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tables_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as indexes_count,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as foreign_keys_count,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as rls_policies_count;
