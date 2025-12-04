-- ============================================================================
-- CRITICAL MISSING INDEXES FOR PERFORMANCE
-- These indexes will dramatically speed up common queries
-- ============================================================================

-- Stories indexes (CRITICAL - currently causing slow loading)
CREATE INDEX IF NOT EXISTS idx_stories_user_active_created 
ON stories(user_id, is_active, created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_stories_active_expires 
ON stories(is_active, expires_at) 
WHERE is_active = true;

-- Reels indexes (for faster feed loading)
CREATE INDEX IF NOT EXISTS idx_reels_created_views_likes 
ON reels(created_at DESC, views_count DESC, likes_count DESC);

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_created 
ON reel_comments(reel_id, created_at DESC);

-- Notifications indexes (for faster notification loading)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
ON notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read 
ON notifications(recipient_id, is_read, created_at DESC);

-- Message reactions indexes (currently slowing down chat)
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_user 
ON message_reactions(message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_emoji 
ON message_reactions(message_id, emoji);

-- Post views indexes (for smart feed)
CREATE INDEX IF NOT EXISTS idx_post_views_user_viewed 
ON post_views(user_id, last_viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_views_post_user 
ON post_views(post_id, user_id);

-- Search optimization indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm 
ON profiles USING gin(username gin_trgm_ops);

-- Composite index for explore page
CREATE INDEX IF NOT EXISTS idx_posts_likes_comments_created 
ON posts(likes_count DESC, comments_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reels_likes_views_created 
ON reels(likes_count DESC, views_count DESC, created_at DESC);

-- Leaderboard indexes (for faster loading)
CREATE INDEX IF NOT EXISTS idx_leaderboard_rankings_period_rank 
ON leaderboard_rankings(period_id, rank_position ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_rankings_user_period 
ON leaderboard_rankings(user_id, period_id, total_points DESC);

-- Referral indexes (for faster dashboard)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status 
ON referrals(referrer_id, status, created_at DESC);

-- Profile indexes (for instant profile loading)
CREATE INDEX IF NOT EXISTS idx_posts_user_created 
ON posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reels_user_created 
ON reels(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created 
ON bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_follower_following 
ON follows(follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_follows_following_created 
ON follows(following_id, created_at DESC);

-- ============================================================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- ============================================================================

ANALYZE stories;
ANALYZE reels;
ANALYZE reel_comments;
ANALYZE notifications;
ANALYZE message_reactions;
ANALYZE post_views;
ANALYZE profiles;
ANALYZE posts;
