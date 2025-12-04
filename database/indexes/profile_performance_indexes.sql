-- ============================================================================
-- PROFILE PERFORMANCE INDEXES - KLICKTAPE
-- ============================================================================
-- These indexes optimize profile loading queries
-- Created: 2025-10-31
-- ============================================================================

-- Index for follows table - follower lookups
CREATE INDEX IF NOT EXISTS idx_follows_follower_id 
ON follows(follower_id);

-- Index for follows table - following lookups
CREATE INDEX IF NOT EXISTS idx_follows_following_id 
ON follows(following_id);

-- Composite index for follow relationship checks
CREATE INDEX IF NOT EXISTS idx_follows_follower_following 
ON follows(follower_id, following_id);

-- Index for posts by user
CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at 
ON posts(user_id, created_at DESC);

-- Index for reels by user
CREATE INDEX IF NOT EXISTS idx_reels_user_id_created_at 
ON reels(user_id, created_at DESC);

-- Index for bookmarks by user
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id_created_at 
ON bookmarks(user_id, created_at DESC);

-- Index for leaderboard rankings by user and active period
CREATE INDEX IF NOT EXISTS idx_leaderboard_rankings_user_period 
ON leaderboard_rankings(user_id, period_id);

-- Index for active leaderboard periods
CREATE INDEX IF NOT EXISTS idx_leaderboard_periods_active 
ON leaderboard_periods(is_active) 
WHERE is_active = TRUE;

-- Composite index for leaderboard lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_rankings_user_active 
ON leaderboard_rankings(user_id) 
INCLUDE (rank_position, total_points, rank_tier);

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE profiles;
ANALYZE follows;
ANALYZE posts;
ANALYZE reels;
ANALYZE bookmarks;
ANALYZE leaderboard_rankings;
ANALYZE leaderboard_periods;

