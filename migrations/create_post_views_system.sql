-- =====================================================
-- POST VIEWS TRACKING SYSTEM
-- Smart Home Feed with View Count & Session Management
-- =====================================================

-- 1. Post Views Table - Core tracking table
CREATE TABLE IF NOT EXISTS post_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    view_count INTEGER NOT NULL DEFAULT 1,
    last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    first_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_id TEXT, -- Track views per session
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one record per user-post combination
    UNIQUE(user_id, post_id)
);

-- 2. User Sessions Table - Track app sessions for view reset logic
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Post View Analytics - Aggregated data for performance
CREATE TABLE IF NOT EXISTS post_view_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    total_views INTEGER NOT NULL DEFAULT 0,
    unique_viewers INTEGER NOT NULL DEFAULT 0,
    avg_view_count DECIMAL(5,2) NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(post_id)
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Post Views Indexes
CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON post_views(user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_post ON post_views(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_last_viewed ON post_views(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_views_view_count ON post_views(view_count);
CREATE INDEX IF NOT EXISTS idx_post_views_session ON post_views(session_id);

-- User Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions(last_activity_at DESC);

-- Post View Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_view_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_total_views ON post_view_analytics(total_views DESC);

-- =====================================================
-- VIEWS FOR SMART FEED QUERIES
-- =====================================================

-- Smart Feed View - Excludes posts based on view count and session rules
CREATE OR REPLACE VIEW smart_feed_posts AS
SELECT 
    p.id,
    p.caption,
    p.image_urls,
    p.user_id,
    p.created_at,
    p.likes_count,
    p.comments_count,
    p.bookmarks_count,
    pr.username,
    pr.avatar_url,
    COALESCE(pv.view_count, 0) as user_view_count,
    pv.last_viewed_at,
    pva.total_views,
    pva.unique_viewers
FROM posts p
JOIN profiles pr ON p.user_id = pr.id
LEFT JOIN post_views pv ON p.id = pv.post_id
LEFT JOIN post_view_analytics pva ON p.id = pva.post_id
ORDER BY p.created_at DESC;

-- User View History - For session-based filtering
CREATE OR REPLACE VIEW user_view_history AS
SELECT 
    pv.user_id,
    pv.post_id,
    pv.view_count,
    pv.last_viewed_at,
    pv.session_id,
    p.created_at as post_created_at,
    CASE 
        WHEN pv.view_count >= 2 THEN true 
        ELSE false 
    END as should_exclude,
    CASE 
        WHEN pv.last_viewed_at > NOW() - INTERVAL '24 hours' THEN true 
        ELSE false 
    END as viewed_recently
FROM post_views pv
JOIN posts p ON pv.post_id = p.id;

-- =====================================================
-- FUNCTIONS FOR SMART FEED LOGIC
-- =====================================================

-- Function to get smart feed for a user
CREATE OR REPLACE FUNCTION get_smart_feed_for_user(
    p_user_id UUID,
    p_session_id TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_exclude_viewed_twice BOOLEAN DEFAULT TRUE,
    p_respect_24h_cooldown BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    caption TEXT,
    image_urls TEXT[],
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER,
    comments_count INTEGER,
    bookmarks_count INTEGER,
    username TEXT,
    avatar_url TEXT,
    user_view_count INTEGER,
    last_viewed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sfp.id,
        sfp.caption,
        sfp.image_urls,
        sfp.user_id,
        sfp.created_at,
        sfp.likes_count,
        sfp.comments_count,
        sfp.bookmarks_count,
        sfp.username,
        sfp.avatar_url,
        COALESCE(sfp.user_view_count, 0)::INTEGER,
        sfp.last_viewed_at
    FROM smart_feed_posts sfp
    LEFT JOIN user_view_history uvh ON sfp.id = uvh.post_id AND uvh.user_id = p_user_id
    WHERE 
        -- Exclude user's own posts
        sfp.user_id != p_user_id
        -- Exclude posts viewed twice if enabled
        AND (NOT p_exclude_viewed_twice OR uvh.should_exclude IS NOT TRUE)
        -- Respect 24-hour cooldown if enabled
        AND (NOT p_respect_24h_cooldown OR uvh.viewed_recently IS NOT TRUE)
    ORDER BY sfp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to track post view
CREATE OR REPLACE FUNCTION track_post_view(
    p_user_id UUID,
    p_post_id UUID,
    p_session_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update post view
    INSERT INTO post_views (user_id, post_id, view_count, last_viewed_at, session_id)
    VALUES (p_user_id, p_post_id, 1, NOW(), p_session_id)
    ON CONFLICT (user_id, post_id)
    DO UPDATE SET 
        view_count = post_views.view_count + 1,
        last_viewed_at = NOW(),
        session_id = COALESCE(p_session_id, post_views.session_id),
        updated_at = NOW();
        
    -- Update analytics (async)
    INSERT INTO post_view_analytics (post_id, total_views, unique_viewers)
    VALUES (p_post_id, 1, 1)
    ON CONFLICT (post_id)
    DO UPDATE SET 
        total_views = post_view_analytics.total_views + 1,
        last_calculated_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to start new user session
CREATE OR REPLACE FUNCTION start_user_session(
    p_user_id UUID,
    p_device_info JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    session_token TEXT;
BEGIN
    -- Generate unique session token
    session_token := 'sess_' || encode(gen_random_bytes(16), 'hex');
    
    -- End any existing active sessions
    UPDATE user_sessions 
    SET is_active = FALSE, ended_at = NOW()
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    -- Create new session
    INSERT INTO user_sessions (user_id, session_token, device_info)
    VALUES (p_user_id, session_token, p_device_info);
    
    RETURN session_token;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update post_views.updated_at on changes
CREATE OR REPLACE FUNCTION update_post_views_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_views_timestamp
    BEFORE UPDATE ON post_views
    FOR EACH ROW
    EXECUTE FUNCTION update_post_views_timestamp();

-- Update user_sessions.last_activity_at on changes
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_view_analytics ENABLE ROW LEVEL SECURITY;

-- Post Views Policies
CREATE POLICY "Users can view their own post views" ON post_views
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post views" ON post_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post views" ON post_views
    FOR UPDATE USING (auth.uid() = user_id);

-- User Sessions Policies
CREATE POLICY "Users can manage their own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Post View Analytics Policies (read-only for post owners)
CREATE POLICY "Post owners can view analytics" ON post_view_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = post_view_analytics.post_id 
            AND posts.user_id = auth.uid()
        )
    );

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Function to cleanup old view data (run daily)
CREATE OR REPLACE FUNCTION cleanup_old_view_data()
RETURNS VOID AS $$
BEGIN
    -- Delete view records older than 30 days for non-active users
    DELETE FROM post_views 
    WHERE last_viewed_at < NOW() - INTERVAL '30 days'
    AND user_id NOT IN (
        SELECT user_id FROM user_sessions 
        WHERE last_activity_at > NOW() - INTERVAL '7 days'
    );
    
    -- End inactive sessions older than 24 hours
    UPDATE user_sessions 
    SET is_active = FALSE, ended_at = NOW()
    WHERE is_active = TRUE 
    AND last_activity_at < NOW() - INTERVAL '24 hours';
    
    -- Delete old ended sessions (keep for 7 days)
    DELETE FROM user_sessions 
    WHERE is_active = FALSE 
    AND ended_at < NOW() - INTERVAL '7 days';
    
    -- Recalculate analytics for posts with recent activity
    UPDATE post_view_analytics 
    SET 
        unique_viewers = (
            SELECT COUNT(DISTINCT user_id) 
            FROM post_views 
            WHERE post_id = post_view_analytics.post_id
        ),
        avg_view_count = (
            SELECT AVG(view_count) 
            FROM post_views 
            WHERE post_id = post_view_analytics.post_id
        ),
        last_calculated_at = NOW(),
        updated_at = NOW()
    WHERE last_calculated_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA & COMMENTS
-- =====================================================

COMMENT ON TABLE post_views IS 'Tracks how many times each user has viewed each post';
COMMENT ON TABLE user_sessions IS 'Manages user app sessions for view reset logic';
COMMENT ON TABLE post_view_analytics IS 'Aggregated analytics for post performance';

COMMENT ON FUNCTION get_smart_feed_for_user IS 'Returns filtered feed excluding posts based on view count and session rules';
COMMENT ON FUNCTION track_post_view IS 'Records or increments a post view for a user';
COMMENT ON FUNCTION start_user_session IS 'Starts a new user session and returns session token';
COMMENT ON FUNCTION cleanup_old_view_data IS 'Cleanup function to run daily for data maintenance';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Post Views Tracking System created successfully!';
    RAISE NOTICE 'Tables: post_views, user_sessions, post_view_analytics';
    RAISE NOTICE 'Views: smart_feed_posts, user_view_history';
    RAISE NOTICE 'Functions: get_smart_feed_for_user, track_post_view, start_user_session, cleanup_old_view_data';
END $$;