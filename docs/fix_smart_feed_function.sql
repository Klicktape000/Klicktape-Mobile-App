-- ============================================================================
-- FIX SMART FEED FUNCTION - KLICKTAPE DATABASE OPTIMIZATION
-- ============================================================================
-- This script fixes the get_smart_feed_for_user function to use correct tables
-- Issue: Function references non-existent user_view_history table
-- Solution: Use existing post_views table instead
-- Generated: 2025-10-30
-- ============================================================================

-- ============================================================================
-- ANALYSIS
-- ============================================================================

/*
CURRENT SITUATION:
- ✅ smart_feed_posts view exists and works correctly
- ✅ post_views table exists (tracks user views of posts)
- ✅ post_view_analytics table exists (aggregated view statistics)
- ❌ user_view_history table does NOT exist (referenced in function)

FUNCTION DEPENDENCIES:
- get_smart_feed_for_user() references user_view_history table
- This table doesn't exist, causing the function to fail or return incorrect results

SOLUTION:
- Replace user_view_history with post_views table
- Update logic to use post_views columns (user_id, post_id, view_count, last_viewed_at)
*/

-- ============================================================================
-- DROP EXISTING FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_smart_feed_for_user(uuid, text, integer, integer, boolean, boolean);

-- ============================================================================
-- CREATE FIXED SMART FEED FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_smart_feed_for_user(
    p_user_id uuid,
    p_session_id text DEFAULT NULL::text,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0,
    p_exclude_viewed_twice boolean DEFAULT true,
    p_respect_24h_cooldown boolean DEFAULT true
)
RETURNS TABLE(
    id uuid,
    caption text,
    image_urls text[],
    user_id uuid,
    created_at timestamp with time zone,
    likes_count integer,
    comments_count integer,
    bookmarks_count integer,
    username text,
    avatar_url text,
    user_view_count integer,
    last_viewed_at timestamp with time zone,
    is_liked boolean,
    is_bookmarked boolean
)
LANGUAGE plpgsql
AS $function$
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
        sfp.last_viewed_at,
        EXISTS(SELECT 1 FROM likes l WHERE l.post_id = sfp.id AND l.user_id = p_user_id) as is_liked,
        EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = sfp.id AND b.user_id = p_user_id) as is_bookmarked
    FROM smart_feed_posts sfp
    LEFT JOIN post_views pv ON sfp.id = pv.post_id AND pv.user_id = p_user_id
    WHERE 
        -- Exclude user's own posts
        sfp.user_id != p_user_id
        -- Exclude posts viewed twice if enabled
        AND (
            NOT p_exclude_viewed_twice 
            OR pv.view_count IS NULL 
            OR pv.view_count < 2
        )
        -- Respect 24-hour cooldown if enabled
        AND (
            NOT p_respect_24h_cooldown 
            OR pv.last_viewed_at IS NULL 
            OR pv.last_viewed_at < NOW() - INTERVAL '24 hours'
        )
    ORDER BY sfp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_smart_feed_for_user(uuid, text, integer, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_smart_feed_for_user(uuid, text, integer, integer, boolean, boolean) TO anon;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test the function with a sample user
-- SELECT * FROM get_smart_feed_for_user(
--     '00000000-0000-0000-0000-000000000000'::uuid,  -- Replace with actual user_id
--     NULL,
--     10,
--     0,
--     true,
--     true
-- );

-- Check function definition
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname = 'get_smart_feed_for_user';

-- ============================================================================
-- OPTIONAL: CREATE user_view_history TABLE FOR FUTURE USE
-- ============================================================================

/*
If you want to track more detailed view history in the future, create this table:

CREATE TABLE IF NOT EXISTS public.user_view_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    view_count integer DEFAULT 1,
    last_viewed_at timestamp with time zone DEFAULT NOW(),
    should_exclude boolean DEFAULT false,
    viewed_recently boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_view_history_user_id ON public.user_view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_view_history_post_id ON public.user_view_history(post_id);
CREATE INDEX IF NOT EXISTS idx_user_view_history_last_viewed ON public.user_view_history(last_viewed_at);
CREATE INDEX IF NOT EXISTS idx_user_view_history_should_exclude ON public.user_view_history(should_exclude) WHERE should_exclude = true;

-- Enable RLS
ALTER TABLE public.user_view_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own view history" ON public.user_view_history
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own view history" ON public.user_view_history
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own view history" ON public.user_view_history
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_view_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_view_history_updated_at
    BEFORE UPDATE ON public.user_view_history
    FOR EACH ROW
    EXECUTE FUNCTION update_user_view_history_updated_at();
*/

-- ============================================================================
-- PERFORMANCE IMPACT SUMMARY
-- ============================================================================

/*
🚀 PERFORMANCE IMPROVEMENTS:

✅ Fixed smart feed function to use existing post_views table
✅ Removed dependency on non-existent user_view_history table
✅ Function now works correctly with proper view tracking
✅ Maintains all original functionality (exclude viewed twice, 24h cooldown)

📊 CHANGES MADE:
- Replaced user_view_history with post_views table
- Updated column references (view_count, last_viewed_at)
- Simplified logic using post_views data
- Added proper permissions for authenticated and anon users

📊 FUNCTION FEATURES:
- ✅ Excludes user's own posts
- ✅ Excludes posts viewed twice (configurable)
- ✅ Respects 24-hour cooldown (configurable)
- ✅ Returns comprehensive post data with user info
- ✅ Supports pagination (limit/offset)
- ✅ Orders by created_at DESC (newest first)

⚡ EXPECTED IMPACT:
- Smart feed function now works correctly
- No more errors from missing table references
- Proper view tracking using existing post_views table
- Better user experience with intelligent feed filtering

⚠️ IMPORTANT NOTES:
- Test the function with actual user IDs before deploying to production
- Monitor post_views table for proper view tracking
- Consider creating user_view_history table in the future for more detailed tracking
- Update application code to use post_views table for view tracking
*/

