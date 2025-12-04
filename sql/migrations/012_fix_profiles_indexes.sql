-- ============================================================================
-- CRITICAL PERFORMANCE FIX: Profiles Table Indexes
-- ============================================================================
-- Issue: Profile queries timing out due to missing indexes
-- Solution: Add critical indexes for common query patterns
-- Expected Impact: 100-1000x faster profile lookups
-- ============================================================================

-- 1. Primary key index on id (should exist, but verify)
-- This is the most critical - lookups by ID should be instant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'profiles' 
        AND indexname = 'profiles_pkey'
    ) THEN
        ALTER TABLE profiles ADD PRIMARY KEY (id);
        RAISE NOTICE 'Added primary key index on profiles.id';
    ELSE
        RAISE NOTICE 'Primary key index on profiles.id already exists';
    END IF;
END $$;

-- 2. Index on username for user search
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username) 
WHERE username IS NOT NULL;

-- 3. Index on email for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles(email) 
WHERE email IS NOT NULL;

-- 4. Composite index for common SELECT pattern
CREATE INDEX IF NOT EXISTS idx_profiles_user_lookup 
ON profiles(id, username, avatar_url) 
WHERE username IS NOT NULL;

-- 5. Index for username search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower 
ON profiles(LOWER(username)) 
WHERE username IS NOT NULL;

-- 6. Index for is_active users
CREATE INDEX IF NOT EXISTS idx_profiles_active 
ON profiles(is_active, id) 
WHERE is_active = true;

-- ============================================================================
-- ANALYZE TABLE
-- ============================================================================
-- Update statistics for query planner
ANALYZE profiles;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all indexes on profiles table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'profiles'
ORDER BY indexname;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'profiles';

-- Verify index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'profiles'
ORDER BY idx_scan DESC;
