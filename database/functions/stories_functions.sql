-- =====================================================
-- KLICKTAPE STORIES DATABASE FUNCTIONS
-- Fixed create_story_enhanced function with duration_param
-- =====================================================

-- Function to create story with proper ordering and duration support
CREATE OR REPLACE FUNCTION create_story_enhanced(
    image_url_param TEXT,
    caption_param TEXT DEFAULT NULL,
    duration_param INTEGER DEFAULT 5000,
    story_type_param TEXT DEFAULT 'image'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_val UUID;
    next_order INTEGER;
    story_id UUID;
    expires_time TIMESTAMPTZ;
BEGIN
    -- Get current user ID
    user_id_val := auth.uid();
    
    IF user_id_val IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Calculate expiration time (24 hours from now)
    expires_time := NOW() + INTERVAL '24 hours';
    
    -- Get next story order for this user
    SELECT COALESCE(MAX(story_order), 0) + 1 
    INTO next_order
    FROM stories 
    WHERE user_id = user_id_val 
        AND is_active = TRUE 
        AND expires_at > NOW();
    
    -- Insert new story
    INSERT INTO stories (
        user_id, 
        image_url, 
        caption, 
        expires_at, 
        story_order, 
        duration, 
        story_type,
        is_active,
        view_count
    )
    VALUES (
        user_id_val, 
        image_url_param, 
        caption_param, 
        expires_time, 
        COALESCE(next_order, 1), 
        duration_param, 
        story_type_param,
        TRUE,
        0
    )
    RETURNING id INTO story_id;
    
    RETURN story_id;
END;
$$;

-- Function to get stories feed with enhanced features
CREATE OR REPLACE FUNCTION get_stories_feed_enhanced(limit_param INTEGER DEFAULT 50)
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    story_count INTEGER,
    latest_story_time TIMESTAMPTZ,
    has_unviewed BOOLEAN,
    stories JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stories AS (
        SELECT 
            s.user_id,
            p.username,
            p.avatar_url,
            COUNT(s.id)::INTEGER as story_count,
            MAX(s.created_at) as latest_story_time,
            BOOL_OR(sv.story_id IS NULL) as has_unviewed,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', s.id,
                    'image_url', s.image_url,
                    'caption', s.caption,
                    'created_at', s.created_at,
                    'expires_at', s.expires_at,
                    'story_order', COALESCE(s.story_order, 1),
                    'duration', COALESCE(s.duration, 5000),
                    'story_type', COALESCE(s.story_type, 'image'),
                    'view_count', COALESCE(s.view_count, 0),
                    'is_viewed', CASE WHEN sv.story_id IS NOT NULL THEN true ELSE false END
                ) ORDER BY COALESCE(s.story_order, 1) ASC, s.created_at ASC
            ) as stories
        FROM stories s
        JOIN profiles p ON s.user_id = p.id
        LEFT JOIN story_views sv ON s.id = sv.story_id AND sv.viewer_id = auth.uid()
        WHERE COALESCE(s.is_active, TRUE) = TRUE
            AND s.expires_at > NOW()
        GROUP BY s.user_id, p.username, p.avatar_url
    )
    SELECT 
        us.user_id,
        us.username,
        us.avatar_url,
        us.story_count,
        us.latest_story_time,
        us.has_unviewed,
        us.stories
    FROM user_stories us
    ORDER BY us.has_unviewed DESC, us.latest_story_time DESC
    LIMIT limit_param;
END;
$$;

-- Function to mark story as viewed
CREATE OR REPLACE FUNCTION mark_story_viewed(
    story_id_param UUID,
    view_duration_param INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    viewer_id_val UUID;
    is_new_view BOOLEAN := FALSE;
BEGIN
    -- Get current user ID
    viewer_id_val := auth.uid();

    IF viewer_id_val IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if this is a new view (user hasn't viewed this story before)
    SELECT NOT EXISTS(
        SELECT 1 FROM story_views
        WHERE story_id = story_id_param AND viewer_id = viewer_id_val
    ) INTO is_new_view;

    -- Insert or update story view
    INSERT INTO story_views (story_id, viewer_id, viewed_at, view_duration, completed)
    VALUES (story_id_param, viewer_id_val, NOW(), view_duration_param, view_duration_param >= 3000)
    ON CONFLICT (story_id, viewer_id)
    DO UPDATE SET
        viewed_at = NOW(),
        view_duration = GREATEST(story_views.view_duration, view_duration_param),
        completed = CASE
            WHEN view_duration_param >= 3000 THEN TRUE
            ELSE story_views.completed
        END;

    -- Only increment view count for new views
    IF is_new_view THEN
        UPDATE stories
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = story_id_param;
    END IF;

    RETURN TRUE;
END;
$$;

-- Add missing columns to stories table if they don't exist
DO $$
BEGIN
    -- Add story_order column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'story_order') THEN
        ALTER TABLE stories ADD COLUMN story_order INTEGER DEFAULT 1;
    END IF;
    
    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'is_active') THEN
        ALTER TABLE stories ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Add view_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'view_count') THEN
        ALTER TABLE stories ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add story_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'story_type') THEN
        ALTER TABLE stories ADD COLUMN story_type TEXT DEFAULT 'image';
    END IF;
    
    -- Add duration column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'duration' AND column_name = 'duration') THEN
        ALTER TABLE stories ADD COLUMN duration INTEGER DEFAULT 5000;
    END IF;
END $$;

-- Create story_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS story_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    view_duration INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    UNIQUE(story_id, viewer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_user_id_active ON stories(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_order ON stories(user_id, story_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_active_recent ON stories(is_active, created_at DESC) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id, viewed_at DESC);

-- Enable RLS on story_views table
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for story_views
DROP POLICY IF EXISTS "story_views_select_policy" ON story_views;
CREATE POLICY "story_views_select_policy" ON story_views FOR SELECT USING (true);

DROP POLICY IF EXISTS "story_views_insert_policy" ON story_views;
CREATE POLICY "story_views_insert_policy" ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "story_views_update_policy" ON story_views;
CREATE POLICY "story_views_update_policy" ON story_views FOR UPDATE USING (auth.uid() = viewer_id);