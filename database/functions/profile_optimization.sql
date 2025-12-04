-- ============================================================================
-- PROFILE OPTIMIZATION FUNCTIONS - KLICKTAPE
-- ============================================================================
-- These functions optimize profile loading by fetching all data in a single call
-- Created: 2025-10-30
-- ============================================================================

-- ============================================================================
-- 1. GET COMPLETE PROFILE DATA (Single RPC Call)
-- ============================================================================
-- This function fetches all profile data including:
-- - User profile information
-- - Followers/following counts
-- - Posts count
-- - Reels count
-- - Bookmarks count
-- - Rank stats
-- - Is following status (for other users' profiles)

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
    -- Optimized: Get all data in a single query using CTEs and subqueries
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
        'followers_count', COALESCE(
            (SELECT COUNT(*)::INTEGER FROM follows WHERE following_id = p_profile_user_id),
            0
        ),
        'following_count', COALESCE(
            (SELECT COUNT(*)::INTEGER FROM follows WHERE follower_id = p_profile_user_id),
            0
        ),
        'posts_count', COALESCE(
            (SELECT COUNT(*)::INTEGER FROM posts WHERE user_id = p_profile_user_id),
            0
        ),
        'reels_count', COALESCE(
            (SELECT COUNT(*)::INTEGER FROM reels WHERE user_id = p_profile_user_id),
            0
        ),
        'bookmarks_count', CASE
            WHEN p_current_user_id = p_profile_user_id THEN
                COALESCE((SELECT COUNT(*)::INTEGER FROM bookmarks WHERE user_id = p_profile_user_id), 0)
            ELSE 0
        END,
        'is_following', CASE
            WHEN p_current_user_id IS NOT NULL AND p_current_user_id != p_profile_user_id THEN
                EXISTS(SELECT 1 FROM follows WHERE follower_id = p_current_user_id AND following_id = p_profile_user_id)
            ELSE FALSE
        END,
        'rank_data', COALESCE(
            (
                SELECT json_build_object(
                    'rank_position', lr.rank_position,
                    'total_points', lr.total_points,
                    'rank_tier', lr.rank_tier,
                    'points_to_next_rank', 0,
                    'is_in_top_50', (lr.rank_position <= 50)
                )
                FROM leaderboard_rankings lr
                JOIN leaderboard_periods lp ON lr.period_id = lp.id
                WHERE lr.user_id = p_profile_user_id
                AND lp.is_active = TRUE
                LIMIT 1
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
    FROM profiles p
    WHERE p.id = p_profile_user_id;

    RETURN result;
END;
$$;

-- ============================================================================
-- 2. GET PROFILE POSTS (Optimized with pagination)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_posts(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    caption TEXT,
    image_urls TEXT[],
    created_at TIMESTAMPTZ,
    likes_count INTEGER,
    comments_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.caption,
        p.image_urls,
        p.created_at,
        p.likes_count,
        p.comments_count
    FROM posts p
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 3. GET PROFILE REELS (Optimized with pagination)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_reels(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    caption TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ,
    likes_count INTEGER,
    comments_count INTEGER,
    views_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.user_id,
        r.caption,
        r.video_url,
        r.thumbnail_url,
        r.created_at,
        r.likes_count,
        r.comments_count,
        r.views_count
    FROM reels r
    WHERE r.user_id = p_user_id
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4. GET PROFILE BOOKMARKS (Optimized with pagination)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_bookmarks(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    caption TEXT,
    image_urls TEXT[],
    created_at TIMESTAMPTZ,
    likes_count INTEGER,
    comments_count INTEGER,
    post_user_id UUID,
    post_username TEXT,
    post_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.caption,
        p.image_urls,
        p.created_at,
        p.likes_count,
        p.comments_count,
        pr.id as post_user_id,
        pr.username as post_username,
        pr.avatar_url as post_avatar_url
    FROM bookmarks b
    JOIN posts p ON b.post_id = p.id
    JOIN profiles pr ON p.user_id = pr.id
    WHERE b.user_id = p_user_id
    ORDER BY b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_complete_profile_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_complete_profile_data(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_posts(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_posts(UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_reels(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_reels(UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_bookmarks(UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the function (replace with actual user ID)
-- SELECT get_complete_profile_data('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);

