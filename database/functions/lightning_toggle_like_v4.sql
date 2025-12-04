-- LIGHTNING TOGGLE LIKE V4 - WITH NOTIFICATIONS
-- ============================================================================
-- Fast atomic like/unlike operation with notification support
-- Created: 2025
-- ============================================================================

CREATE OR REPLACE FUNCTION lightning_toggle_like_v4(
    post_id_param UUID,
    user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    like_exists BOOLEAN;
    result BOOLEAN;
    post_owner_id UUID;
BEGIN
    -- Get the post owner ID
    SELECT user_id INTO post_owner_id
    FROM posts
    WHERE id = post_id_param;

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
        
        -- Remove notification if it exists
        DELETE FROM notifications
        WHERE recipient_id = post_owner_id
        AND sender_id = user_id_param
        AND type = 'like'
        AND post_id = post_id_param;
        
        result := FALSE;
    ELSE
        -- Wasn't liked, so insert and update count atomically
        INSERT INTO likes (post_id, user_id, created_at)
        VALUES (post_id_param, user_id_param, NOW());

        UPDATE posts
        SET likes_count = likes_count + 1
        WHERE id = post_id_param;
        
        -- Create notification if not liking own post
        IF post_owner_id != user_id_param THEN
            INSERT INTO notifications (
                recipient_id,
                sender_id,
                type,
                post_id,
                created_at,
                is_read
            )
            VALUES (
                post_owner_id,
                user_id_param,
                'like',
                post_id_param,
                NOW(),
                FALSE
            )
            ON CONFLICT DO NOTHING; -- Prevent duplicate notifications
        END IF;
        
        result := TRUE;
    END IF;

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION lightning_toggle_like_v4(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the function (replace with actual user IDs)
-- SELECT lightning_toggle_like_v4('00000000-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid);
