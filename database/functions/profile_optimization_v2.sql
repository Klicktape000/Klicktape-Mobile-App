-- ============================================================================
-- PROFILE OPTIMIZATION V2 - ULTRA-FAST PROFILE LOADING
-- ============================================================================
-- This version uses a single CTE-based query with parallel execution
-- for maximum performance
-- Created: 2025-10-31
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_complete_profile_data(UUID, UUID);

-- ============================================================================
-- OPTIMIZED: GET COMPLETE PROFILE DATA (Single Parallel Query)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_complete_profile_data(
    p_profile_user_id UUID,
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Use CTEs for parallel execution - PostgreSQL can execute these in parallel
    WITH 
    profile_info AS (
        SELECT 
            id, username, name, email, avatar_url, bio, 
            account_type, gender, created_at, updated_at
        FROM profiles
        WHERE id = p_profile_user_id
    ),
    counts AS (
        SELECT
            -- Use COUNT(*) FILTER for parallel aggregation
            COUNT(*) FILTER (WHERE f1.following_id = p_profile_user_id) AS followers_count,
            COUNT(*) FILTER (WHERE f1.follower_id = p_profile_user_id) AS following_count,
            COUNT(*) FILTER (WHERE p.user_id = p_profile_user_id) AS posts_count,
            COUNT(*) FILTER (WHERE r.user_id = p_profile_user_id) AS reels_count,
            COUNT(*) FILTER (
                WHERE b.user_id = p_profile_user_id 
                AND p_current_user_id = p_profile_user_id
            ) AS bookmarks_count
        FROM (SELECT 1) AS dummy
        LEFT JOIN follows f1 ON (
            f1.following_id = p_profile_user_id 
            OR f1.follower_id = p_profile_user_id
        )
        LEFT JOIN posts p ON p.user_id = p_profile_user_id
        LEFT JOIN reels r ON r.user_id = p_profile_user_id
        LEFT JOIN bookmarks b ON (
            b.user_id = p_profile_user_id 
            AND p_current_user_id = p_profile_user_id
        )
    ),
    follow_status AS (
        SELECT EXISTS(
            SELECT 1 
            FROM follows 
            WHERE follower_id = p_current_user_id 
            AND following_id = p_profile_user_id
        ) AS is_following
        WHERE p_current_user_id IS NOT NULL 
        AND p_current_user_id != p_profile_user_id
    ),
    rank_info AS (
        SELECT 
            lr.rank_position,
            lr.total_points,
            lr.rank_tier,
            (lr.rank_position <= 50) AS is_in_top_50
        FROM leaderboard_rankings lr
        INNER JOIN leaderboard_periods lp ON lr.period_id = lp.id
        WHERE lr.user_id = p_profile_user_id
        AND lp.is_active = TRUE
        LIMIT 1
    )
    SELECT json_build_object(
        'profile', json_build_object(
            'id', p.id,
            'username', p.username,
            'name', p.name,
            'email', p.email,
            'avatar_url', p.avatar_url,
            'bio', p.bio,
            'account_type', p.account_type,
            'gender', p.gender,
            'created_at', p.created_at,
            'updated_at', p.updated_at
        ),
        'followers_count', COALESCE(c.followers_count, 0)::INTEGER,
        'following_count', COALESCE(c.following_count, 0)::INTEGER,
        'posts_count', COALESCE(c.posts_count, 0)::INTEGER,
        'reels_count', COALESCE(c.reels_count, 0)::INTEGER,
        'bookmarks_count', COALESCE(c.bookmarks_count, 0)::INTEGER,
        'is_following', COALESCE(fs.is_following, FALSE),
        'rank_data', COALESCE(
            json_build_object(
                'rank_position', ri.rank_position,
                'total_points', ri.total_points,
                'rank_tier', ri.rank_tier,
                'points_to_next_rank', 0,
                'is_in_top_50', ri.is_in_top_50
            ),
            json_build_object(
                'rank_position', NULL,
                'total_points', 0,
                'rank_tier', NULL,
                'points_to_next_rank', 0,
                'is_in_top_50', FALSE
            )
        )
    )
    INTO result
    FROM profile_info p
    CROSS JOIN counts c
    LEFT JOIN follow_status fs ON TRUE
    LEFT JOIN rank_info ri ON TRUE;

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_complete_profile_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_complete_profile_data(UUID, UUID) TO anon;

-- ============================================================================
-- ADDITIONAL OPTIMIZATION: Create materialized view for leaderboard
-- ============================================================================
-- This caches active leaderboard data for instant lookups

CREATE MATERIALIZED VIEW IF NOT EXISTS active_leaderboard_cache AS
SELECT 
    lr.user_id,
    lr.rank_position,
    lr.total_points,
    lr.rank_tier,
    (lr.rank_position <= 50) AS is_in_top_50,
    lp.id AS period_id
FROM leaderboard_rankings lr
INNER JOIN leaderboard_periods lp ON lr.period_id = lp.id
WHERE lp.is_active = TRUE;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_leaderboard_cache_user 
ON active_leaderboard_cache(user_id);

-- Refresh function (call this when leaderboard updates)
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY active_leaderboard_cache;
END;
$$;

-- Grant permissions
GRANT SELECT ON active_leaderboard_cache TO authenticated;
GRANT SELECT ON active_leaderboard_cache TO anon;

-- ============================================================================
-- OPTIMIZED V3: Use materialized view for even faster lookups
-- ============================================================================
CREATE OR REPLACE FUNCTION get_complete_profile_data_v3(
    p_profile_user_id UUID,
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    WITH 
    profile_info AS (
        SELECT 
            id, username, name, email, avatar_url, bio, 
            account_type, gender, created_at, updated_at
        FROM profiles
        WHERE id = p_profile_user_id
    ),
    follow_status AS (
        SELECT EXISTS(
            SELECT 1 
            FROM follows 
            WHERE follower_id = p_current_user_id 
            AND following_id = p_profile_user_id
        ) AS is_following
        WHERE p_current_user_id IS NOT NULL 
        AND p_current_user_id != p_profile_user_id
    ),
    rank_info AS (
        SELECT 
            rank_position,
            total_points,
            rank_tier,
            is_in_top_50
        FROM active_leaderboard_cache
        WHERE user_id = p_profile_user_id
        LIMIT 1
    )
    SELECT json_build_object(
        'profile', json_build_object(
            'id', p.id,
            'username', p.username,
            'name', p.name,
            'email', p.email,
            'avatar_url', p.avatar_url,
            'bio', p.bio,
            'account_type', p.account_type,
            'gender', p.gender,
            'created_at', p.created_at,
            'updated_at', p.updated_at
        ),
        'followers_count', (
            SELECT COUNT(*)::INTEGER 
            FROM follows 
            WHERE following_id = p_profile_user_id
        ),
        'following_count', (
            SELECT COUNT(*)::INTEGER 
            FROM follows 
            WHERE follower_id = p_profile_user_id
        ),
        'posts_count', (
            SELECT COUNT(*)::INTEGER 
            FROM posts 
            WHERE user_id = p_profile_user_id
        ),
        'reels_count', (
            SELECT COUNT(*)::INTEGER 
            FROM reels 
            WHERE user_id = p_profile_user_id
        ),
        'bookmarks_count', CASE
            WHEN p_current_user_id = p_profile_user_id THEN
                (SELECT COUNT(*)::INTEGER FROM bookmarks WHERE user_id = p_profile_user_id)
            ELSE 0
        END,
        'is_following', COALESCE(fs.is_following, FALSE),
        'rank_data', COALESCE(
            json_build_object(
                'rank_position', ri.rank_position,
                'total_points', ri.total_points,
                'rank_tier', ri.rank_tier,
                'points_to_next_rank', 0,
                'is_in_top_50', ri.is_in_top_50
            ),
            json_build_object(
                'rank_position', NULL,
                'total_points', 0,
                'rank_tier', NULL,
                'points_to_next_rank', 0,
                'is_in_top_50', FALSE
            )
        )
    )
    INTO result
    FROM profile_info p
    LEFT JOIN follow_status fs ON TRUE
    LEFT JOIN rank_info ri ON TRUE;

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_complete_profile_data_v3(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_complete_profile_data_v3(UUID, UUID) TO anon;

-- ============================================================================
-- VERIFICATION & PERFORMANCE TESTING
-- ============================================================================

-- Test query (replace with actual user IDs)
-- EXPLAIN ANALYZE SELECT get_complete_profile_data('user-id-here'::uuid, 'current-user-id-here'::uuid);
-- EXPLAIN ANALYZE SELECT get_complete_profile_data_v3('user-id-here'::uuid, 'current-user-id-here'::uuid);

