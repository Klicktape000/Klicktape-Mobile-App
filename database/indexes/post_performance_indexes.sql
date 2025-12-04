-- ============================================================================
-- POST PERFORMANCE INDEXES
-- Indexes to optimize post queries and loading
-- ============================================================================

-- Index for post lookups by ID (primary key already indexed, but explicit for clarity)
-- CREATE INDEX IF NOT EXISTS idx_posts_id ON posts(id);

-- Index for posts by user with created_at for sorting
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- Index for posts by created_at for feed queries
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Index for likes by post_id
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);

-- Index for likes by user_id and post_id (for checking if user liked a post)
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);

-- Index for bookmarks by post_id
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON bookmarks(post_id);

-- Index for bookmarks by user_id and post_id (for checking if user bookmarked a post)
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_post ON bookmarks(user_id, post_id);

-- Index for bookmarks by user_id with created_at for sorting
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);

-- Index for comments by post_id with created_at for sorting
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);

-- Index for comments by user_id
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Index for follows for checking follow status
CREATE INDEX IF NOT EXISTS idx_follows_follower_following ON follows(follower_id, following_id);

-- Composite index for post feed queries (user_id + created_at)
CREATE INDEX IF NOT EXISTS idx_posts_composite_feed ON posts(user_id, created_at DESC, id);

-- Index for post image URLs (for image loading optimization)
-- Using GIN index for array operations if needed
CREATE INDEX IF NOT EXISTS idx_posts_image_urls ON posts USING GIN(image_urls);

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE posts;
ANALYZE likes;
ANALYZE bookmarks;
ANALYZE comments;
ANALYZE follows;
ANALYZE profiles;

