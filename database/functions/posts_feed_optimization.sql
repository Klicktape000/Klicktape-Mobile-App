-- ============================================================================
-- OPTIMIZED POSTS FEED FUNCTION
-- Replaces N+1 queries with single efficient query
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_feed_optimized(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result JSON;
BEGIN
    WITH posts_with_counts AS (
        SELECT 
            p.id,
            p.user_id,
            p.caption,
            p.image_urls,
            p.created_at,
            p.updated_at,
            -- Use cached columns for instant loading (fastest!)
            COALESCE(p.likes_count, 0) as likes_count,
            COALESCE(p.comments_count, 0) as comments_count,
            -- User interaction checks (only if user is logged in)
            CASE 
                WHEN p_user_id IS NOT NULL THEN 
                    EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = p_user_id)
                ELSE false 
            END as is_liked,
            CASE 
                WHEN p_user_id IS NOT NULL THEN 
                    EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = p_user_id)
                ELSE false 
            END as is_bookmarked,
            -- User profile
            prof.username,
            prof.avatar_url
        FROM posts p
        LEFT JOIN profiles prof ON p.user_id = prof.id
        ORDER BY p.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT json_agg(
        json_build_object(
            'id', id,
            'user_id', user_id,
            'caption', caption,
            'image_urls', image_urls,
            'created_at', created_at,
            'updated_at', updated_at,
            'likes_count', likes_count,
            'comments_count', comments_count,
            'is_liked', is_liked,
            'is_bookmarked', is_bookmarked,
            'user', json_build_object(
                'username', username,
                'avatar_url', avatar_url
            )
        )
    )
    INTO result
    FROM posts_with_counts;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_posts_feed_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_posts_feed_optimized TO anon;

COMMENT ON FUNCTION get_posts_feed_optimized IS 
'Optimized posts feed query that replaces N+1 queries with a single efficient query using LATERAL joins and aggregations.';
