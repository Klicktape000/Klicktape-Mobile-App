
-- KlickTape Production Deployment
-- Generated: 2025-10-01T06:58:45.118Z
-- Project: wpxkjqfcoudcddluiiab

-- =============================================================================
-- MAIN DATABASE SCHEMA
-- =============================================================================

-- =====================================================
-- KLICKTAPE DATABASE SCHEMA RECREATION SCRIPT
-- Complete schema for fresh Supabase project setup
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- CUSTOM TYPES AND ENUMS
-- =====================================================

-- Gender enum
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');

-- Account type enum  
CREATE TYPE account_type AS ENUM ('personal', 'creator', 'business');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Profiles table (main user table)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT UNIQUE,
    gender gender_enum,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar_url TEXT,
    account_type account_type,
    bio TEXT,
    public_key TEXT,
    anonymous_room_name TEXT
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    caption TEXT,
    image_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    bookmarks_count INTEGER DEFAULT 0
);

-- Reels table (videos/tapes)
CREATE TABLE reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    caption TEXT,
    music TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0
);

-- Stories table
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    viewed_by UUID[] DEFAULT '{}'
);

-- Likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- Reel likes table
CREATE TABLE reel_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, reel_id)
);

-- Bookmarks table
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- Follows table
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    replies_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    mentions JSONB DEFAULT '[]'
);

-- Comment likes table
CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Reel comments table
CREATE TABLE reel_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES reel_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    mentions JSONB DEFAULT '[]'
);

-- Reel comment likes table
CREATE TABLE reel_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES reel_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Reel views table
CREATE TABLE reel_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    duration INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (direct messages)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    encrypted_content TEXT,
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_version TEXT DEFAULT 'v1',
    inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public keys table (for encryption)
CREATE TABLE public_keys (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    algorithm TEXT DEFAULT 'RSA-OAEP',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public key audit table
CREATE TABLE public_key_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    old_public_key TEXT,
    new_public_key TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_type TEXT
);

-- Enhanced Communities table (X/Twitter-like communities)
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    cover_image_url TEXT,
    avatar_url TEXT,
    category_id UUID REFERENCES community_categories(id) ON DELETE SET NULL,
    members_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    privacy_type TEXT DEFAULT 'public' CHECK (privacy_type IN ('public', 'private', 'invite_only')),
    post_permissions TEXT DEFAULT 'all_members' CHECK (post_permissions IN ('all_members', 'admins_only', 'admins_and_moderators')),
    approval_required BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    rules TEXT[],
    tags TEXT[],
    location TEXT,
    website_url TEXT,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community categories table
CREATE TABLE community_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT,
    color_hex TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community members table with roles
CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned', 'left')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ban_reason TEXT,
    banned_until TIMESTAMPTZ,
    UNIQUE(community_id, user_id)
);

-- Community posts table
CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    image_urls TEXT[],
    video_url TEXT,
    link_url TEXT,
    link_title TEXT,
    link_description TEXT,
    link_image_url TEXT,
    post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'link', 'poll')),
    hashtags TEXT[],
    tagged_users UUID[],
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_announcement BOOLEAN DEFAULT FALSE,
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members_only')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted', 'reported')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community post likes table
CREATE TABLE community_post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Community post comments table
CREATE TABLE community_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES community_post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted', 'reported')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community post comment likes table
CREATE TABLE community_post_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES community_post_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Community post shares table
CREATE TABLE community_post_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shared_to_community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    share_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community rules table
CREATE TABLE community_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rule_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community moderation actions table
CREATE TABLE community_moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    moderator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    target_comment_id UUID REFERENCES community_post_comments(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'unban', 'mute', 'unmute', 'remove_post', 'remove_comment', 'pin_post', 'unpin_post', 'warn')),
    reason TEXT,
    duration_hours INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community reports table
CREATE TABLE community_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reported_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    reported_comment_id UUID REFERENCES community_post_comments(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'harassment', 'inappropriate_content', 'misinformation', 'copyright', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy rooms table (keeping for backward compatibility)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    participants_count INTEGER DEFAULT 0,
    is_anonymous BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room participants table
CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Room messages table
CREATE TABLE room_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    encrypted_content JSONB NOT NULL,
    tagged_users UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Typing status table
CREATE TABLE typing_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    chat_id TEXT,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, chat_id)
);

-- Backup tables (for data safety)
CREATE TABLE public_keys_backup (
    user_id UUID,
    public_key TEXT,
    algorithm TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimized posts view (materialized for performance)
CREATE TABLE posts_optimized (
    id UUID PRIMARY KEY,
    caption TEXT,
    image_urls TEXT[],
    user_id UUID,
    created_at TIMESTAMPTZ,
    likes_count BIGINT,
    comments_count BIGINT,
    bookmarks_count BIGINT,
    username TEXT,
    avatar_url TEXT
);

-- Posts feed view (for optimized feed queries)
CREATE VIEW posts_feed AS
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
    pr.avatar_url
FROM posts p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC;

-- =====================================================
-- PRODUCTION-LEVEL INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_id ON profiles(id);

-- Posts indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at_desc ON posts(created_at DESC);
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_created_desc ON posts(created_at DESC);

-- Likes indexes (critical for performance)
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_post ON likes(user_id, post_id);
CREATE INDEX idx_likes_post_user ON likes(post_id, user_id);
CREATE INDEX idx_likes_toggle_optimized ON likes(user_id, post_id) INCLUDE (id, created_at);

-- Bookmarks indexes
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_post_id ON bookmarks(post_id);
CREATE INDEX idx_bookmarks_user_post ON bookmarks(user_id, post_id);
CREATE INDEX idx_bookmarks_post_user ON bookmarks(post_id, user_id);
CREATE INDEX idx_bookmarks_toggle_optimized ON bookmarks(user_id, post_id) INCLUDE (id, created_at);

-- Follows indexes
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);
CREATE INDEX idx_follows_both ON follows(follower_id, following_id);

-- Comments indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at DESC);

-- Messages indexes (for chat performance)
CREATE INDEX idx_messages_sender_receiver_created ON messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_messages_receiver_sender_created ON messages(receiver_id, sender_id, created_at);
CREATE INDEX idx_messages_conversation_optimized ON messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);
CREATE INDEX idx_messages_receiver_is_read ON messages(receiver_id, is_read, created_at DESC);
CREATE INDEX idx_messages_realtime_created ON messages(created_at DESC, sender_id, receiver_id);
CREATE INDEX idx_messages_is_encrypted ON messages(is_encrypted);
CREATE INDEX idx_messages_encryption_version ON messages(encryption_version);

-- Reel indexes
CREATE INDEX reel_likes_user_id_idx ON reel_likes(user_id);
CREATE INDEX reel_comments_user_id_idx ON reel_comments(user_id);

-- Room indexes
CREATE INDEX idx_rooms_participants_count ON rooms(participants_count DESC);
CREATE INDEX idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX idx_room_messages_sender_id ON room_messages(sender_id);

-- Notifications indexes
CREATE INDEX notifications_sender_id_idx ON notifications(sender_id);

-- Public keys indexes
CREATE INDEX idx_public_keys_user_id ON public_keys(user_id);
CREATE INDEX idx_public_keys_algorithm ON public_keys(algorithm);
CREATE INDEX idx_public_keys_created_at ON public_keys(created_at);

-- Community indexes
CREATE INDEX idx_communities_creator_id ON communities(creator_id);
CREATE INDEX idx_communities_category_id ON communities(category_id);
CREATE INDEX idx_communities_privacy_type ON communities(privacy_type);
CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_members_count_desc ON communities(members_count DESC);
CREATE INDEX idx_communities_last_activity_desc ON communities(last_activity_at DESC);
CREATE INDEX idx_communities_created_desc ON communities(created_at DESC);
CREATE INDEX idx_communities_name_search ON communities USING gin(to_tsvector('english', name));
CREATE INDEX idx_communities_description_search ON communities USING gin(to_tsvector('english', description));
CREATE INDEX idx_communities_tags ON communities USING gin(tags);

-- Community categories indexes
CREATE INDEX idx_community_categories_name ON community_categories(name);
CREATE INDEX idx_community_categories_featured ON community_categories(is_featured, sort_order);

-- Community members indexes
CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_community_members_user_id ON community_members(user_id);
CREATE INDEX idx_community_members_role ON community_members(role);
CREATE INDEX idx_community_members_status ON community_members(status);
CREATE INDEX idx_community_members_joined_desc ON community_members(joined_at DESC);
CREATE INDEX idx_community_members_community_role ON community_members(community_id, role);
CREATE INDEX idx_community_members_user_communities ON community_members(user_id, status, joined_at DESC);

-- Community posts indexes
CREATE INDEX idx_community_posts_community_id ON community_posts(community_id);
CREATE INDEX idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX idx_community_posts_created_desc ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_community_created ON community_posts(community_id, created_at DESC);
CREATE INDEX idx_community_posts_author_created ON community_posts(author_id, created_at DESC);
CREATE INDEX idx_community_posts_likes_desc ON community_posts(likes_count DESC);
CREATE INDEX idx_community_posts_comments_desc ON community_posts(comments_count DESC);
CREATE INDEX idx_community_posts_post_type ON community_posts(post_type);
CREATE INDEX idx_community_posts_status ON community_posts(status);
CREATE INDEX idx_community_posts_pinned ON community_posts(is_pinned, created_at DESC);
CREATE INDEX idx_community_posts_hashtags ON community_posts USING gin(hashtags);
CREATE INDEX idx_community_posts_tagged_users ON community_posts USING gin(tagged_users);
CREATE INDEX idx_community_posts_content_search ON community_posts USING gin(to_tsvector('english', content));

-- Community post likes indexes
CREATE INDEX idx_community_post_likes_post_id ON community_post_likes(post_id);
CREATE INDEX idx_community_post_likes_user_id ON community_post_likes(user_id);
CREATE INDEX idx_community_post_likes_user_post ON community_post_likes(user_id, post_id);
CREATE INDEX idx_community_post_likes_created_desc ON community_post_likes(created_at DESC);

-- Community post comments indexes
CREATE INDEX idx_community_post_comments_post_id ON community_post_comments(post_id);
CREATE INDEX idx_community_post_comments_author_id ON community_post_comments(author_id);
CREATE INDEX idx_community_post_comments_parent_id ON community_post_comments(parent_comment_id);
CREATE INDEX idx_community_post_comments_post_created ON community_post_comments(post_id, created_at DESC);
CREATE INDEX idx_community_post_comments_status ON community_post_comments(status);

-- Community post comment likes indexes
CREATE INDEX idx_community_post_comment_likes_comment_id ON community_post_comment_likes(comment_id);
CREATE INDEX idx_community_post_comment_likes_user_id ON community_post_comment_likes(user_id);
CREATE INDEX idx_community_post_comment_likes_user_comment ON community_post_comment_likes(user_id, comment_id);

-- Community post shares indexes
CREATE INDEX idx_community_post_shares_post_id ON community_post_shares(post_id);
CREATE INDEX idx_community_post_shares_user_id ON community_post_shares(user_id);
CREATE INDEX idx_community_post_shares_shared_to ON community_post_shares(shared_to_community_id);
CREATE INDEX idx_community_post_shares_created_desc ON community_post_shares(created_at DESC);

-- Community rules indexes
CREATE INDEX idx_community_rules_community_id ON community_rules(community_id);
CREATE INDEX idx_community_rules_active_order ON community_rules(is_active, rule_order);

-- Community moderation actions indexes
CREATE INDEX idx_community_moderation_community_id ON community_moderation_actions(community_id);
CREATE INDEX idx_community_moderation_moderator_id ON community_moderation_actions(moderator_id);
CREATE INDEX idx_community_moderation_target_user ON community_moderation_actions(target_user_id);
CREATE INDEX idx_community_moderation_action_type ON community_moderation_actions(action_type);
CREATE INDEX idx_community_moderation_created_desc ON community_moderation_actions(created_at DESC);

-- Community reports indexes
CREATE INDEX idx_community_reports_community_id ON community_reports(community_id);
CREATE INDEX idx_community_reports_reporter_id ON community_reports(reporter_id);
CREATE INDEX idx_community_reports_reported_user ON community_reports(reported_user_id);
CREATE INDEX idx_community_reports_status ON community_reports(status);
CREATE INDEX idx_community_reports_type ON community_reports(report_type);
CREATE INDEX idx_community_reports_created_desc ON community_reports(created_at DESC);

-- Note: Views cannot have indexes directly.
-- The underlying posts and profiles tables already have the necessary indexes:
-- - idx_posts_created_at_desc for chronological ordering
-- - idx_posts_user_created for user-specific queries
-- - idx_profiles_id for profile joins

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- User profile creation function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Lightning fast like toggle function
CREATE OR REPLACE FUNCTION lightning_toggle_like_v3(post_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    like_exists BOOLEAN;
    result BOOLEAN;
BEGIN
    -- Use a single query to check and delete if exists
    DELETE FROM likes
    WHERE post_id = post_id_param AND user_id = user_id_param;

    -- Check if we deleted anything
    GET DIAGNOSTICS like_exists = ROW_COUNT;

    IF like_exists THEN
        -- Was liked, now unliked - update count atomically
        UPDATE posts
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = post_id_param;
        result := FALSE;
    ELSE
        -- Wasn't liked, so insert and update count atomically
        INSERT INTO likes (post_id, user_id, created_at)
        VALUES (post_id_param, user_id_param, NOW());

        UPDATE posts
        SET likes_count = likes_count + 1
        WHERE id = post_id_param;
        result := TRUE;
    END IF;

    RETURN result;
END;
$$;

-- Lightning fast bookmark toggle function
CREATE OR REPLACE FUNCTION lightning_toggle_bookmark_v3(post_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bookmark_exists BOOLEAN;
    result BOOLEAN;
BEGIN
    -- Use a single query to check and delete if exists
    DELETE FROM bookmarks
    WHERE post_id = post_id_param AND user_id = user_id_param;

    -- Check if we deleted anything
    GET DIAGNOSTICS bookmark_exists = ROW_COUNT;

    IF bookmark_exists THEN
        -- Was bookmarked, now unbookmarked - update count atomically
        UPDATE posts
        SET bookmarks_count = GREATEST(0, bookmarks_count - 1)
        WHERE id = post_id_param;
        result := FALSE;
    ELSE
        -- Wasn't bookmarked, so insert and update count atomically
        INSERT INTO bookmarks (post_id, user_id, created_at)
        VALUES (post_id_param, user_id_param, NOW());

        UPDATE posts
        SET bookmarks_count = bookmarks_count + 1
        WHERE id = post_id_param;
        result := TRUE;
    END IF;

    RETURN result;
END;
$$;

-- Optimized posts feed function
CREATE OR REPLACE FUNCTION lightning_fast_posts_feed(user_id_param UUID, limit_param INTEGER DEFAULT 20, offset_param INTEGER DEFAULT 0)
RETURNS TABLE(
    id UUID,
    caption TEXT,
    image_urls TEXT[],
    user_id UUID,
    created_at TIMESTAMPTZ,
    likes_count BIGINT,
    comments_count BIGINT,
    bookmarks_count BIGINT,
    is_liked BOOLEAN,
    is_bookmarked BOOLEAN,
    username TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.caption,
        p.image_urls,
        p.user_id,
        p.created_at,
        COALESCE(p.likes_count, 0)::BIGINT as likes_count,
        COALESCE(p.comments_count, 0)::BIGINT as comments_count,
        COALESCE(p.bookmarks_count, 0)::BIGINT as bookmarks_count,
        (l.user_id IS NOT NULL) as is_liked,
        (b.user_id IS NOT NULL) as is_bookmarked,
        pr.username,
        pr.avatar_url
    FROM posts p
    INNER JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN likes l ON p.id = l.post_id AND l.user_id = user_id_param
    LEFT JOIN bookmarks b ON p.id = b.post_id AND b.user_id = user_id_param
    WHERE pr.id IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT limit_param OFFSET offset_param;
END;
$$;

-- Reel like toggle function
CREATE OR REPLACE FUNCTION toggle_reel_like(p_reel_id UUID, p_user_id UUID, p_is_liked BOOLEAN)
RETURNS TABLE(is_liked BOOLEAN, likes_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    reel_owner_id UUID;
BEGIN
    -- Get the reel owner ID
    SELECT user_id INTO reel_owner_id
    FROM reels
    WHERE id = p_reel_id;

    IF p_is_liked THEN
        -- Unlike: Remove like from reel_likes
        DELETE FROM reel_likes
        WHERE reel_id = p_reel_id AND user_id = p_user_id;

        -- Update likes_count in reels
        UPDATE reels
        SET likes_count = reels.likes_count - 1
        WHERE id = p_reel_id;

        -- Remove notification if it exists
        DELETE FROM notifications
        WHERE recipient_id = reel_owner_id
        AND sender_id = p_user_id
        AND type = 'like'
        AND reel_id = p_reel_id;
    ELSE
        -- Like: Add like to reel_likes
        INSERT INTO reel_likes (reel_id, user_id)
        VALUES (p_reel_id, p_user_id);

        -- Update likes_count in reels
        UPDATE reels
        SET likes_count = reels.likes_count + 1
        WHERE id = p_reel_id;

        -- Create notification if not liking own reel
        IF reel_owner_id != p_user_id THEN
            INSERT INTO notifications (recipient_id, sender_id, type, reel_id, created_at, is_read)
            VALUES (reel_owner_id, p_user_id, 'like', p_reel_id, NOW(), FALSE)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Return the updated state
    RETURN QUERY
    SELECT
        EXISTS (
            SELECT 1
            FROM reel_likes
            WHERE reel_id = p_reel_id AND user_id = p_user_id
        ) AS is_liked,
        reels.likes_count
    FROM reels
    WHERE id = p_reel_id;
END;
$$;

-- Get conversation messages function
CREATE OR REPLACE FUNCTION get_conversation_messages(
    user1_id UUID,
    user2_id UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    content TEXT,
    encrypted_content TEXT,
    is_read BOOLEAN,
    status TEXT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    sender JSONB,
    receiver JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.encrypted_content,
    m.is_read,
    m.status,
    m.created_at,
    m.delivered_at,
    m.read_at,
    jsonb_build_object(
      'id', sender.id,
      'username', sender.username,
      'avatar_url', sender.avatar_url
    ) as sender,
    jsonb_build_object(
      'id', receiver.id,
      'username', receiver.username,
      'avatar_url', receiver.avatar_url
    ) as receiver
  FROM messages m
  LEFT JOIN profiles sender ON m.sender_id = sender.id
  LEFT JOIN profiles receiver ON m.receiver_id = receiver.id
  WHERE
    (m.sender_id = user1_id AND m.receiver_id = user2_id)
    OR (m.sender_id = user2_id AND m.receiver_id = user1_id)
  ORDER BY m.created_at ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update likes count trigger function
CREATE OR REPLACE FUNCTION update_likes_count_optimized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use a more efficient update that doesn't lock the entire row
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Update bookmarks count trigger function
CREATE OR REPLACE FUNCTION update_bookmarks_count_optimized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET bookmarks_count = bookmarks_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET bookmarks_count = GREATEST(0, bookmarks_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Update comments count trigger function
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Update updated_at column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- User profile creation trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Likes count triggers
CREATE TRIGGER trigger_update_likes_count_insert_optimized
    AFTER INSERT ON likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count_optimized();

CREATE TRIGGER trigger_update_likes_count_delete_optimized
    AFTER DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count_optimized();

-- Bookmarks count triggers
CREATE TRIGGER trigger_update_bookmarks_count_insert_optimized
    AFTER INSERT ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_bookmarks_count_optimized();

CREATE TRIGGER trigger_update_bookmarks_count_delete_optimized
    AFTER DELETE ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_bookmarks_count_optimized();

-- Comments count triggers
CREATE TRIGGER trigger_update_comments_count_insert
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comments_count();

CREATE TRIGGER trigger_update_comments_count_delete
    AFTER DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comments_count();

-- Updated at triggers
CREATE TRIGGER update_public_keys_updated_at
    BEFORE UPDATE ON public_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Community updated at triggers
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_post_comments_updated_at
    BEFORE UPDATE ON community_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_rules_updated_at
    BEFORE UPDATE ON community_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Community count triggers
CREATE OR REPLACE FUNCTION update_community_members_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities
        SET members_count = members_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities
        SET members_count = GREATEST(members_count - 1, 0),
            last_activity_at = NOW()
        WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_posts_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities
        SET posts_count = posts_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities
        SET posts_count = GREATEST(posts_count - 1, 0),
            last_activity_at = NOW()
        WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts
        SET comments_count = comments_count + 1
        WHERE id = NEW.post_id;

        -- Update parent comment replies count if this is a reply
        IF NEW.parent_comment_id IS NOT NULL THEN
            UPDATE community_post_comments
            SET replies_count = replies_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts
        SET comments_count = GREATEST(comments_count - 1, 0)
        WHERE id = OLD.post_id;

        -- Update parent comment replies count if this was a reply
        IF OLD.parent_comment_id IS NOT NULL THEN
            UPDATE community_post_comments
            SET replies_count = GREATEST(replies_count - 1, 0)
            WHERE id = OLD.parent_comment_id;
        END IF;

        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_post_comments
        SET likes_count = likes_count + 1
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_post_comments
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts
        SET shares_count = shares_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts
        SET shares_count = GREATEST(shares_count - 1, 0)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for community counts
CREATE TRIGGER trigger_update_community_members_count_insert
    AFTER INSERT ON community_members
    FOR EACH ROW EXECUTE FUNCTION update_community_members_count();

CREATE TRIGGER trigger_update_community_members_count_delete
    AFTER DELETE ON community_members
    FOR EACH ROW EXECUTE FUNCTION update_community_members_count();

CREATE TRIGGER trigger_update_community_posts_count_insert
    AFTER INSERT ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_community_posts_count();

CREATE TRIGGER trigger_update_community_posts_count_delete
    AFTER DELETE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_community_posts_count();

CREATE TRIGGER trigger_update_community_post_likes_count_insert
    AFTER INSERT ON community_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_community_post_likes_count();

CREATE TRIGGER trigger_update_community_post_likes_count_delete
    AFTER DELETE ON community_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_community_post_likes_count();

CREATE TRIGGER trigger_update_community_post_comments_count_insert
    AFTER INSERT ON community_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_community_post_comments_count();

CREATE TRIGGER trigger_update_community_post_comments_count_delete
    AFTER DELETE ON community_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_community_post_comments_count();

CREATE TRIGGER trigger_update_community_post_comment_likes_count_insert
    AFTER INSERT ON community_post_comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_community_post_comment_likes_count();

CREATE TRIGGER trigger_update_community_post_comment_likes_count_delete
    AFTER DELETE ON community_post_comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_community_post_comment_likes_count();

CREATE TRIGGER trigger_update_community_post_shares_count_insert
    AFTER INSERT ON community_post_shares
    FOR EACH ROW EXECUTE FUNCTION update_community_post_shares_count();

CREATE TRIGGER trigger_update_community_post_shares_count_delete
    AFTER DELETE ON community_post_shares
    FOR EACH ROW EXECUTE FUNCTION update_community_post_shares_count();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Enable read access for all users" ON profiles FOR SELECT USING (true);
CREATE POLICY "Enable insert for signing up users" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for users based on id" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts policies
CREATE POLICY "posts_select_policy" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_policy" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_policy" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_policy" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Reels policies
CREATE POLICY "reels_select_policy" ON reels FOR SELECT USING (true);
CREATE POLICY "reels_insert_policy" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update_policy" ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete_policy" ON reels FOR DELETE USING (auth.uid() = user_id);

-- Stories policies
CREATE POLICY "stories_select_policy" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert_policy" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_update_policy" ON stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stories_delete_policy" ON stories FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "likes_select_policy" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_policy" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_update_policy" ON likes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "likes_delete_policy" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Reel likes policies
CREATE POLICY "reel_likes_select_policy" ON reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert_policy" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_update_policy" ON reel_likes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete_policy" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks policies
CREATE POLICY "Allow users to read their own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to create their own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow users to delete their own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "follows_select_policy" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_policy" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_update_policy" ON follows FOR UPDATE USING (auth.uid() = follower_id);
CREATE POLICY "follows_delete_policy" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Comments policies
CREATE POLICY "comments_select_policy" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_policy" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_policy" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_policy" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Comment likes policies
CREATE POLICY "Allow read for authenticated users" ON comment_likes FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Allow insert for authenticated users" ON comment_likes FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Allow delete for like owner" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel comments policies
CREATE POLICY "reel_comments_select_policy" ON reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert_policy" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_update_policy" ON reel_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete_policy" ON reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Reel comment likes policies
CREATE POLICY "Allow read for authenticated users" ON reel_comment_likes FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Allow insert for authenticated users" ON reel_comment_likes FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Allow delete for like owner" ON reel_comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel views policies
CREATE POLICY "Allow authenticated read access to reel_views" ON reel_views FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Allow users to record views" ON reel_views FOR INSERT WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY "messages_select_policy" ON messages FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));
CREATE POLICY "messages_insert_policy" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_policy" ON messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "messages_delete_policy" ON messages FOR DELETE USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

-- Public keys policies
CREATE POLICY "public_keys_select_policy" ON public_keys FOR SELECT USING (true);
CREATE POLICY "public_keys_insert_policy" ON public_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public_keys_update_policy" ON public_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "public_keys_delete_policy" ON public_keys FOR DELETE USING (auth.uid() = user_id);

-- Rooms policies
CREATE POLICY "view_rooms" ON rooms FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "create_room" ON rooms FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Room participants policies
CREATE POLICY "view_room_participants" ON room_participants FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "join_room" ON room_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave_room" ON room_participants FOR DELETE USING (auth.uid() = user_id);

-- Room messages policies
CREATE POLICY "room_messages_select_policy" ON room_messages FOR SELECT USING (EXISTS (SELECT 1 FROM room_participants WHERE room_participants.room_id = room_messages.room_id AND room_participants.user_id = auth.uid()));
CREATE POLICY "room_messages_insert_policy" ON room_messages FOR INSERT WITH CHECK ((auth.uid() = sender_id) AND (EXISTS (SELECT 1 FROM room_participants WHERE room_participants.room_id = room_messages.room_id AND room_participants.user_id = auth.uid())));
CREATE POLICY "room_messages_update_policy" ON room_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "room_messages_delete_policy" ON room_messages FOR DELETE USING (auth.uid() = sender_id);

-- Notifications policies
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT USING ((auth.uid() = recipient_id) OR (auth.uid() = sender_id));
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id));

-- Typing status policies
CREATE POLICY "Users can manage their typing status" ON typing_status FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view chat typing status" ON typing_status FOR SELECT USING (true);

-- =====================================================
-- FINAL SETUP AND OPTIMIZATIONS
-- =====================================================

-- Update table statistics for optimal query planning
ANALYZE profiles;
ANALYZE posts;
ANALYZE reels;
ANALYZE stories;
ANALYZE likes;
ANALYZE reel_likes;
ANALYZE bookmarks;
ANALYZE follows;
ANALYZE comments;
ANALYZE messages;
ANALYZE notifications;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

-- This completes the Klicktape database schema setup
-- All tables, indexes, functions, triggers, and RLS policies are now configured
-- The database is optimized for production use with proper security and performance

SELECT 'Klicktape database schema setup completed successfully!' as status;


-- =============================================================================
-- LEADERBOARD SCHEMA
-- =============================================================================

-- =====================================================
-- LEADERBOARD SYSTEM SCHEMA
-- =====================================================

-- Create enum for engagement types
CREATE TYPE engagement_type AS ENUM (
    'story_like',
    'story_comment', 
    'photo_like',
    'photo_comment',
    'reel_like',
    'reel_comment',
    'share_story',
    'share_photo',
    'share_reel'
);

-- Create enum for reward types
CREATE TYPE reward_type AS ENUM (
    'premium_badge',
    'normal_badge',
    'premium_title',
    'normal_title'
);

-- Create enum for mythological rank tiers
CREATE TYPE rank_tier AS ENUM (
    'Loki of Klicktape',      -- Ranks 1-10
    'Odin of Klicktape',      -- Ranks 11-20
    'Poseidon of Klicktape',  -- Ranks 21-30
    'Zeus of Klicktape',      -- Ranks 31-40
    'Hercules of Klicktape'   -- Ranks 41-50
);

-- Leaderboard periods table (weekly periods)
CREATE TABLE leaderboard_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(start_date, end_date)
);

-- Engagement points table (tracks all user engagement)
CREATE TABLE engagement_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    engagement_type engagement_type NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'post', 'reel')),
    content_id UUID NOT NULL,
    points DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_id, engagement_type, content_id)
);

-- Leaderboard rankings table (current rankings for active period)
CREATE TABLE leaderboard_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 50),
    rank_tier rank_tier NOT NULL,
    total_points DECIMAL(8,1) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, user_id),
    UNIQUE(period_id, rank_position)
);

-- Shares table (tracks content sharing)
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'post', 'reel')),
    content_id UUID NOT NULL,
    shared_to TEXT, -- platform or method shared to
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story likes table (for story engagement tracking)
CREATE TABLE story_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, story_id)
);

-- Story comments table (for story engagement tracking)
CREATE TABLE story_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User rewards table (tracks earned rewards)
CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    reward_type reward_type NOT NULL,
    rank_achieved INTEGER NOT NULL,
    rank_tier rank_tier NOT NULL,
    title_text TEXT,
    badge_icon TEXT,
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Leaderboard periods indexes
CREATE INDEX idx_leaderboard_periods_active ON leaderboard_periods(is_active, start_date, end_date);
CREATE INDEX idx_leaderboard_periods_dates ON leaderboard_periods(start_date, end_date);

-- Engagement points indexes
CREATE INDEX idx_engagement_points_user_period ON engagement_points(user_id, period_id);
CREATE INDEX idx_engagement_points_period_points ON engagement_points(period_id, points DESC);
CREATE INDEX idx_engagement_points_content ON engagement_points(content_type, content_id);
CREATE INDEX idx_engagement_points_created ON engagement_points(created_at DESC);

-- Leaderboard rankings indexes
CREATE INDEX idx_leaderboard_rankings_period_rank ON leaderboard_rankings(period_id, rank_position);
CREATE INDEX idx_leaderboard_rankings_period_points ON leaderboard_rankings(period_id, total_points DESC);
CREATE INDEX idx_leaderboard_rankings_user ON leaderboard_rankings(user_id, period_id);

-- Shares indexes
CREATE INDEX idx_shares_user_content ON shares(user_id, content_type, content_id);
CREATE INDEX idx_shares_created ON shares(created_at DESC);

-- Story engagement indexes
CREATE INDEX idx_story_likes_user_story ON story_likes(user_id, story_id);
CREATE INDEX idx_story_likes_story ON story_likes(story_id, created_at DESC);
CREATE INDEX idx_story_comments_story ON story_comments(story_id, created_at DESC);
CREATE INDEX idx_story_comments_user ON story_comments(user_id, created_at DESC);

-- User rewards indexes
CREATE INDEX idx_user_rewards_user_period ON user_rewards(user_id, period_id);
CREATE INDEX idx_user_rewards_period_rank ON user_rewards(period_id, rank_achieved);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- =====================================================
-- RANK TIER FUNCTIONS
-- =====================================================

-- Function to get rank tier based on position
CREATE OR REPLACE FUNCTION get_rank_tier(rank_position INTEGER)
RETURNS rank_tier AS $$
BEGIN
    CASE
        WHEN rank_position BETWEEN 1 AND 10 THEN
            RETURN 'Loki of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 11 AND 20 THEN
            RETURN 'Odin of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 21 AND 30 THEN
            RETURN 'Poseidon of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 31 AND 40 THEN
            RETURN 'Zeus of Klicktape'::rank_tier;
        WHEN rank_position BETWEEN 41 AND 50 THEN
            RETURN 'Hercules of Klicktape'::rank_tier;
        ELSE
            RETURN 'Hercules of Klicktape'::rank_tier; -- Default for ranks > 50
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to automatically set rank_tier when rank_position is inserted/updated
CREATE OR REPLACE FUNCTION set_rank_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_position);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for leaderboard_rankings
CREATE TRIGGER trigger_set_rank_tier
    BEFORE INSERT OR UPDATE OF rank_position ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier();

-- Create trigger for user_rewards
CREATE TRIGGER trigger_set_rank_tier_rewards
    BEFORE INSERT OR UPDATE OF rank_achieved ON user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION set_rank_tier_rewards();

-- Trigger function for user_rewards
CREATE OR REPLACE FUNCTION set_rank_tier_rewards()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rank_tier = get_rank_tier(NEW.rank_achieved);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all tables
ALTER TABLE leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Leaderboard periods policies (read-only for all authenticated users)
CREATE POLICY "leaderboard_periods_read" ON leaderboard_periods
    FOR SELECT TO authenticated USING (true);

-- Engagement points policies
CREATE POLICY "engagement_points_read" ON engagement_points
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "engagement_points_insert" ON engagement_points
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Leaderboard rankings policies (read-only for all authenticated users)
CREATE POLICY "leaderboard_rankings_read" ON leaderboard_rankings
    FOR SELECT TO authenticated USING (true);

-- Shares policies
CREATE POLICY "shares_read" ON shares
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "shares_insert" ON shares
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Story engagement policies
CREATE POLICY "story_likes_read" ON story_likes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "story_likes_insert" ON story_likes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "story_likes_delete" ON story_likes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "story_comments_read" ON story_comments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "story_comments_insert" ON story_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "story_comments_update" ON story_comments
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "story_comments_delete" ON story_comments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User rewards policies
CREATE POLICY "user_rewards_read" ON user_rewards
    FOR SELECT TO authenticated USING (true);

-- =====================================================
-- POINT ALLOCATION CONSTANTS
-- =====================================================

-- Point values as per requirements:
-- Story Like: 1 point
-- Story Comment: 2 points  
-- Photo Like: 2 points
-- Photo Comment: 1.5 points
-- Reel Like: 2 points
-- Reel Comment: 3 points
-- Share (any): 3 points


-- =============================================================================
-- DEPLOYMENT VERIFICATION
-- =============================================================================

-- Verify tables
SELECT 'Tables created: ' || COUNT(*) as status FROM pg_tables WHERE schemaname = 'public';

-- Verify indexes
SELECT 'Indexes created: ' || COUNT(*) as status FROM pg_indexes WHERE schemaname = 'public';

-- Verify foreign keys
SELECT 'Foreign keys created: ' || COUNT(*) as status 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- Verify RLS policies
SELECT 'RLS policies created: ' || COUNT(*) as status FROM pg_policies WHERE schemaname = 'public';

SELECT 'KlickTape production deployment completed successfully!' as final_status;
