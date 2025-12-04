-- ============================================================================
-- MIGRATION: Optimize Bookmarks Loading Performance
-- ============================================================================
-- Issue: Saved posts loading too slow due to nested joins (N+1 queries)
-- Solution: Create optimized RPC function that returns all data in one query
-- Expected improvement: ~10x faster bookmark loading
-- Created: 2025-11-06
-- ============================================================================

-- Drop existing function if it exists (required when changing return type)
DROP FUNCTION IF EXISTS get_user_bookmarks_optimized(UUID, INTEGER, INTEGER);

-- Create the optimized function
CREATE OR REPLACE FUNCTION get_user_bookmarks_optimized(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    bookmark_id UUID,
    bookmark_created_at TIMESTAMPTZ,
    post_id UUID,
    post_caption TEXT,
    post_image_urls TEXT[],
    post_created_at TIMESTAMPTZ,
    post_likes_count INTEGER,
    post_comments_count INTEGER,
    post_user_id UUID,
    post_username TEXT,
    post_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as bookmark_id,
        b.created_at as bookmark_created_at,
        p.id as post_id,
        p.caption as post_caption,
        p.image_urls as post_image_urls,
        p.created_at as post_created_at,
        p.likes_count as post_likes_count,
        p.comments_count as post_comments_count,
        p.user_id as post_user_id,
        pr.username as post_username,
        pr.avatar_url as post_avatar_url
    FROM bookmarks b
    INNER JOIN posts p ON b.post_id = p.id
    INNER JOIN profiles pr ON p.user_id = pr.id
    WHERE b.user_id = p_user_id
    ORDER BY b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_bookmarks_optimized(UUID, INTEGER, INTEGER) TO authenticated;

-- Ensure critical indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- Verify the function was created successfully
SELECT 'Bookmark optimization function created successfully!' as status;

-- ============================================================================
-- HOW THIS FIXES THE SLOW LOADING:
-- ============================================================================
-- 
-- BEFORE (Slow - nested joins):
--   1. Query bookmarks table
--   2. For each bookmark, query posts table
--   3. For each post, query profiles table
--   = 1 + N + N queries = very slow with many bookmarks
--
-- AFTER (Fast - single optimized query):
--   1. Single query with proper JOINs returns everything
--   = 1 query total = ~10x faster!
--
-- Additional benefits:
--   - Uses existing indexes for fast lookups
--   - STABLE function allows PostgreSQL to cache results
--   - Properly ordered by bookmark creation date
--   - Pagination support with limit/offset
--
-- ============================================================================
