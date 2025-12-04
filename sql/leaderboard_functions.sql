-- =====================================================
-- LEADERBOARD SYSTEM FUNCTIONS
-- =====================================================

-- Function to get or create current active period
CREATE OR REPLACE FUNCTION get_current_leaderboard_period()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_period_id UUID;
    week_start TIMESTAMPTZ;
    week_end TIMESTAMPTZ;
BEGIN
    -- Check if there's an active period
    SELECT id INTO current_period_id
    FROM leaderboard_periods
    WHERE is_active = TRUE
    AND NOW() BETWEEN start_date AND end_date
    LIMIT 1;

    -- If no active period, create a new one
    IF current_period_id IS NULL THEN
        -- Calculate current week boundaries (Monday to Sunday)
        week_start := date_trunc('week', NOW()) + INTERVAL '1 day'; -- Monday
        week_end := week_start + INTERVAL '6 days 23 hours 59 minutes 59 seconds'; -- Sunday

        -- Deactivate any previous periods
        UPDATE leaderboard_periods SET is_active = FALSE WHERE is_active = TRUE;

        -- Create new period
        INSERT INTO leaderboard_periods (start_date, end_date, is_active)
        VALUES (week_start, week_end, TRUE)
        RETURNING id INTO current_period_id;
    END IF;

    RETURN current_period_id;
END;
$$;

-- Function to add engagement points
CREATE OR REPLACE FUNCTION add_engagement_points(
    p_user_id UUID,
    p_engagement_type engagement_type,
    p_content_type TEXT,
    p_content_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    period_id UUID;
    point_value DECIMAL(4,1);
BEGIN
    -- Get current period
    period_id := get_current_leaderboard_period();

    -- Determine point value based on engagement type
    CASE p_engagement_type
        WHEN 'story_like' THEN point_value := 1.0;
        WHEN 'story_comment' THEN point_value := 2.0;
        WHEN 'photo_like' THEN point_value := 2.0;
        WHEN 'photo_comment' THEN point_value := 1.5;
        WHEN 'reel_like' THEN point_value := 2.0;
        WHEN 'reel_comment' THEN point_value := 3.0;
        WHEN 'share_story', 'share_photo', 'share_reel' THEN point_value := 3.0;
        ELSE point_value := 0.0;
    END CASE;

    -- Insert engagement points (ignore if already exists)
    INSERT INTO engagement_points (user_id, period_id, engagement_type, content_type, content_id, points)
    VALUES (p_user_id, period_id, p_engagement_type, p_content_type, p_content_id, point_value)
    ON CONFLICT (user_id, period_id, engagement_type, content_id) DO NOTHING;

    -- Update leaderboard rankings
    PERFORM update_leaderboard_rankings(period_id);

    RETURN TRUE;
END;
$$;

-- Function to remove engagement points (for unlikes, etc.)
CREATE OR REPLACE FUNCTION remove_engagement_points(
    p_user_id UUID,
    p_engagement_type engagement_type,
    p_content_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    period_id UUID;
BEGIN
    -- Get current period
    period_id := get_current_leaderboard_period();

    -- Remove engagement points
    DELETE FROM engagement_points
    WHERE user_id = p_user_id
    AND period_id = period_id
    AND engagement_type = p_engagement_type
    AND content_id = p_content_id;

    -- Update leaderboard rankings
    PERFORM update_leaderboard_rankings(period_id);

    RETURN TRUE;
END;
$$;

-- Function to update leaderboard rankings
CREATE OR REPLACE FUNCTION update_leaderboard_rankings(p_period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clear existing rankings for this period
    DELETE FROM leaderboard_rankings WHERE period_id = p_period_id;

    -- Insert top 50 users with their total points
    INSERT INTO leaderboard_rankings (period_id, user_id, rank_position, total_points)
    SELECT 
        p_period_id,
        user_id,
        ROW_NUMBER() OVER (ORDER BY total_points DESC, MIN(created_at) ASC) as rank_position,
        total_points
    FROM (
        SELECT 
            user_id,
            SUM(points) as total_points,
            MIN(created_at) as created_at
        FROM engagement_points
        WHERE period_id = p_period_id
        GROUP BY user_id
        ORDER BY total_points DESC, MIN(created_at) ASC
        LIMIT 50
    ) ranked_users;
END;
$$;

-- Function to get current leaderboard
CREATE OR REPLACE FUNCTION get_current_leaderboard()
RETURNS TABLE (
    rank_position INTEGER,
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    total_points DECIMAL(8,1),
    is_current_user BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    period_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user and period
    current_user_id := auth.uid();
    period_id := get_current_leaderboard_period();

    RETURN QUERY
    SELECT 
        lr.rank_position,
        lr.user_id,
        p.username,
        p.avatar_url,
        lr.total_points,
        (lr.user_id = current_user_id) as is_current_user
    FROM leaderboard_rankings lr
    JOIN profiles p ON lr.user_id = p.id
    WHERE lr.period_id = period_id
    ORDER BY lr.rank_position ASC;
END;
$$;

-- Function to get user's current rank and points
CREATE OR REPLACE FUNCTION get_user_leaderboard_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    rank_position INTEGER,
    total_points DECIMAL(8,1),
    points_to_next_rank DECIMAL(8,1),
    is_in_top_50 BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    period_id UUID;
    target_user_id UUID;
    user_rank INTEGER;
    user_points DECIMAL(8,1);
    next_rank_points DECIMAL(8,1);
BEGIN
    -- Use provided user_id or current authenticated user
    target_user_id := COALESCE(p_user_id, auth.uid());
    period_id := get_current_leaderboard_period();

    -- Get user's current rank and points
    SELECT lr.rank_position, lr.total_points
    INTO user_rank, user_points
    FROM leaderboard_rankings lr
    WHERE lr.period_id = period_id AND lr.user_id = target_user_id;

    -- If user is not in rankings, get their total points
    IF user_rank IS NULL THEN
        SELECT COALESCE(SUM(points), 0)
        INTO user_points
        FROM engagement_points
        WHERE period_id = period_id AND user_id = target_user_id;

        user_rank := NULL;
    END IF;

    -- Get points needed to reach next rank
    IF user_rank IS NOT NULL AND user_rank > 1 THEN
        SELECT lr.total_points
        INTO next_rank_points
        FROM leaderboard_rankings lr
        WHERE lr.period_id = period_id AND lr.rank_position = user_rank - 1;
        
        next_rank_points := next_rank_points - user_points;
    ELSIF user_rank IS NULL THEN
        -- User not in top 50, get 50th place points
        SELECT lr.total_points
        INTO next_rank_points
        FROM leaderboard_rankings lr
        WHERE lr.period_id = period_id AND lr.rank_position = 50;
        
        next_rank_points := COALESCE(next_rank_points, 0) - user_points + 0.1;
    ELSE
        next_rank_points := 0; -- User is rank 1
    END IF;

    RETURN QUERY
    SELECT 
        user_rank,
        COALESCE(user_points, 0),
        COALESCE(next_rank_points, 0),
        (user_rank IS NOT NULL) as is_in_top_50;
END;
$$;

-- Function to complete current period and distribute rewards
CREATE OR REPLACE FUNCTION complete_leaderboard_period()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    period_id UUID;
    user_record RECORD;
BEGIN
    -- Get current active period
    SELECT id INTO period_id
    FROM leaderboard_periods
    WHERE is_active = TRUE
    LIMIT 1;

    IF period_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Distribute rewards based on final rankings
    FOR user_record IN
        SELECT lr.user_id, lr.rank_position
        FROM leaderboard_rankings lr
        WHERE lr.period_id = period_id
        ORDER BY lr.rank_position
    LOOP
        -- Determine reward type based on rank
        IF user_record.rank_position <= 10 THEN
            INSERT INTO user_rewards (user_id, period_id, reward_type, rank_achieved, badge_icon)
            VALUES (user_record.user_id, period_id, 'premium_badge', user_record.rank_position, 'premium_star');
        ELSIF user_record.rank_position <= 20 THEN
            INSERT INTO user_rewards (user_id, period_id, reward_type, rank_achieved, badge_icon)
            VALUES (user_record.user_id, period_id, 'normal_badge', user_record.rank_position, 'star');
        ELSIF user_record.rank_position <= 30 THEN
            INSERT INTO user_rewards (user_id, period_id, reward_type, rank_achieved, title_text)
            VALUES (user_record.user_id, period_id, 'premium_title', user_record.rank_position, 'Engagement Master');
        ELSE
            INSERT INTO user_rewards (user_id, period_id, reward_type, rank_achieved, title_text)
            VALUES (user_record.user_id, period_id, 'normal_title', user_record.rank_position, 'Active Member');
        END IF;
    END LOOP;

    -- Mark period as completed and inactive
    UPDATE leaderboard_periods
    SET is_active = FALSE, is_completed = TRUE
    WHERE id = period_id;

    RETURN TRUE;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC POINT TRACKING
-- =====================================================

-- Trigger function for post likes
CREATE OR REPLACE FUNCTION trigger_post_like_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'photo_like', 'post', NEW.post_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'photo_like', OLD.post_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for reel likes
CREATE OR REPLACE FUNCTION trigger_reel_like_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'reel_like', 'reel', NEW.reel_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'reel_like', OLD.reel_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for story likes
CREATE OR REPLACE FUNCTION trigger_story_like_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'story_like', 'story', NEW.story_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'story_like', OLD.story_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for post comments
CREATE OR REPLACE FUNCTION trigger_post_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'photo_comment', 'post', NEW.post_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'photo_comment', OLD.post_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for reel comments
CREATE OR REPLACE FUNCTION trigger_reel_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'reel_comment', 'reel', NEW.reel_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'reel_comment', OLD.reel_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for story comments
CREATE OR REPLACE FUNCTION trigger_story_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM add_engagement_points(NEW.user_id, 'story_comment', 'story', NEW.story_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM remove_engagement_points(OLD.user_id, 'story_comment', OLD.story_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for shares
CREATE OR REPLACE FUNCTION trigger_share_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    engagement_type_val engagement_type;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Determine engagement type based on content type
        CASE NEW.content_type
            WHEN 'story' THEN engagement_type_val := 'share_story';
            WHEN 'post' THEN engagement_type_val := 'share_photo';
            WHEN 'reel' THEN engagement_type_val := 'share_reel';
        END CASE;

        PERFORM add_engagement_points(NEW.user_id, engagement_type_val, NEW.content_type, NEW.content_id);
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Post likes triggers
DROP TRIGGER IF EXISTS trigger_post_like_points_insert ON likes;
DROP TRIGGER IF EXISTS trigger_post_like_points_delete ON likes;

CREATE TRIGGER trigger_post_like_points_insert
    AFTER INSERT ON likes
    FOR EACH ROW EXECUTE FUNCTION trigger_post_like_points();

CREATE TRIGGER trigger_post_like_points_delete
    AFTER DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION trigger_post_like_points();

-- Reel likes triggers
DROP TRIGGER IF EXISTS trigger_reel_like_points_insert ON reel_likes;
DROP TRIGGER IF EXISTS trigger_reel_like_points_delete ON reel_likes;

CREATE TRIGGER trigger_reel_like_points_insert
    AFTER INSERT ON reel_likes
    FOR EACH ROW EXECUTE FUNCTION trigger_reel_like_points();

CREATE TRIGGER trigger_reel_like_points_delete
    AFTER DELETE ON reel_likes
    FOR EACH ROW EXECUTE FUNCTION trigger_reel_like_points();

-- Story likes triggers
DROP TRIGGER IF EXISTS trigger_story_like_points_insert ON story_likes;
DROP TRIGGER IF EXISTS trigger_story_like_points_delete ON story_likes;

CREATE TRIGGER trigger_story_like_points_insert
    AFTER INSERT ON story_likes
    FOR EACH ROW EXECUTE FUNCTION trigger_story_like_points();

CREATE TRIGGER trigger_story_like_points_delete
    AFTER DELETE ON story_likes
    FOR EACH ROW EXECUTE FUNCTION trigger_story_like_points();

-- Post comments triggers
DROP TRIGGER IF EXISTS trigger_post_comment_points_insert ON comments;
DROP TRIGGER IF EXISTS trigger_post_comment_points_delete ON comments;

CREATE TRIGGER trigger_post_comment_points_insert
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION trigger_post_comment_points();

CREATE TRIGGER trigger_post_comment_points_delete
    AFTER DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION trigger_post_comment_points();

-- Reel comments triggers
DROP TRIGGER IF EXISTS trigger_reel_comment_points_insert ON reel_comments;
DROP TRIGGER IF EXISTS trigger_reel_comment_points_delete ON reel_comments;

CREATE TRIGGER trigger_reel_comment_points_insert
    AFTER INSERT ON reel_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_reel_comment_points();

CREATE TRIGGER trigger_reel_comment_points_delete
    AFTER DELETE ON reel_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_reel_comment_points();

-- Story comments triggers
DROP TRIGGER IF EXISTS trigger_story_comment_points_insert ON story_comments;
DROP TRIGGER IF EXISTS trigger_story_comment_points_delete ON story_comments;

CREATE TRIGGER trigger_story_comment_points_insert
    AFTER INSERT ON story_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_story_comment_points();

CREATE TRIGGER trigger_story_comment_points_delete
    AFTER DELETE ON story_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_story_comment_points();

-- Shares triggers
DROP TRIGGER IF EXISTS trigger_share_points_insert ON shares;

CREATE TRIGGER trigger_share_points_insert
    AFTER INSERT ON shares
    FOR EACH ROW EXECUTE FUNCTION trigger_share_points();
