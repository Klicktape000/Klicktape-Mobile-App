-- ============================================================================
-- POST OPTIMIZATION FUNCTIONS
-- Optimized RPC functions for fast post loading
-- ============================================================================

-- ============================================================================
-- 1. GET COMPLETE POST DATA (Single optimized query)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_complete_post_data(
    p_post_id UUID,
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Optimized: Get all post data in a single query using subqueries
    SELECT json_build_object(
        'post', json_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'caption', p.caption,
            'image_urls', p.image_urls,
            'created_at', p.created_at,
            'likes_count', p.likes_count,
            'comments_count', p.comments_count
        ),
        'author', json_build_object(
            'id', pr.id,
            'username', pr.username,
            'avatar_url', pr.avatar_url
        ),
        'is_liked', CASE
            WHEN p_current_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM likes WHERE post_id = p_post_id AND user_id = p_current_user_id)
            ELSE FALSE
        END,
        'is_bookmarked', CASE
            WHEN p_current_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p_post_id AND user_id = p_current_user_id)
            ELSE FALSE
        END,
        'is_following', CASE
            WHEN p_current_user_id IS NOT NULL AND p_current_user_id != p.user_id THEN
                EXISTS(SELECT 1 FROM follows WHERE follower_id = p_current_user_id AND following_id = p.user_id)
            ELSE FALSE
        END
    )
    INTO result
    FROM posts p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.id = p_post_id;

    RETURN result;
END;
$$;

-- ============================================================================
-- 2. GET POST COMMENTS (Optimized with pagination)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_post_comments(
    p_post_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    user_id UUID,
    username TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.created_at,
        c.user_id,
        pr.username,
        pr.avatar_url
    FROM comments c
    JOIN profiles pr ON c.user_id = pr.id
    WHERE c.post_id = p_post_id
    ORDER BY c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 3. GET FEED POSTS (Optimized for feed loading)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_feed_posts(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
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
    username TEXT,
    avatar_url TEXT,
    is_liked BOOLEAN,
    is_bookmarked BOOLEAN,
    is_following BOOLEAN
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
        pr.username,
        pr.avatar_url,
        CASE
            WHEN p_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = p_user_id)
            ELSE FALSE
        END as is_liked,
        CASE
            WHEN p_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = p_user_id)
            ELSE FALSE
        END as is_bookmarked,
        CASE
            WHEN p_user_id IS NOT NULL AND p_user_id != p.user_id THEN
                EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = p_user_id AND f.following_id = p.user_id)
            ELSE FALSE
        END as is_following
    FROM posts p
    JOIN profiles pr ON p.user_id = pr.id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4. GET USER POSTS (Optimized for profile)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_posts(
    p_user_id UUID,
    p_current_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
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
    is_liked BOOLEAN,
    is_bookmarked BOOLEAN
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
        CASE
            WHEN p_current_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = p_current_user_id)
            ELSE FALSE
        END as is_liked,
        CASE
            WHEN p_current_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = p_current_user_id)
            ELSE FALSE
        END as is_bookmarked
    FROM posts p
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 5. PREFETCH POST DATA (For hover/scroll prefetching)
-- ============================================================================

CREATE OR REPLACE FUNCTION prefetch_posts_data(
    p_post_ids UUID[],
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Return minimal data for multiple posts for prefetching
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'caption', p.caption,
            'image_urls', p.image_urls,
            'created_at', p.created_at,
            'likes_count', p.likes_count,
            'comments_count', p.comments_count,
            'username', pr.username,
            'avatar_url', pr.avatar_url,
            'is_liked', CASE
                WHEN p_current_user_id IS NOT NULL THEN
                    EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = p_current_user_id)
                ELSE FALSE
            END,
            'is_bookmarked', CASE
                WHEN p_current_user_id IS NOT NULL THEN
                    EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = p_current_user_id)
                ELSE FALSE
            END
        )
    )
    INTO result
    FROM posts p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.id = ANY(p_post_ids);

    RETURN result;
END;
$$;

-- ============================================================================
-- 6. GET EXPLORE POSTS (Optimized for discovery)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_explore_posts_optimized(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 30,
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
    username TEXT,
    avatar_url TEXT,
    is_liked BOOLEAN,
    is_bookmarked BOOLEAN
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
        pr.username,
        pr.avatar_url,
        CASE
            WHEN p_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = p_user_id)
            ELSE FALSE
        END as is_liked,
        CASE
            WHEN p_user_id IS NOT NULL THEN
                EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = p_user_id)
            ELSE FALSE
        END as is_bookmarked
    FROM posts p
    JOIN profiles pr ON p.user_id = pr.id
    -- Explore: prioritize high engagement then recency
    ORDER BY p.likes_count DESC, p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_explore_posts_optimized(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_explore_posts_optimized(UUID, INTEGER, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION get_complete_post_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_comments(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_posts(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_posts(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION prefetch_posts_data(UUID[], UUID) TO authenticated;

-- Also grant to anon for public access
GRANT EXECUTE ON FUNCTION get_complete_post_data(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_post_comments(UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_feed_posts(UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_user_posts(UUID, UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION prefetch_posts_data(UUID[], UUID) TO anon;


